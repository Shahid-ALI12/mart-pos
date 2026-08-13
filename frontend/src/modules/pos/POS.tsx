// modules/pos/POS.tsx
//
// POS checkout screen — the orchestrator.
//
// Pre-refactor this file was 787 lines, mixing state management, keyboard
// shortcut wiring, six modals, and layout in a single component. It has now
// been split into:
//
//   hooks/
//     useCart.ts                — cart state + derived totals
//     useKeyboardShortcuts.ts   — F1..F4 / Esc / barcode-routing wiring
//
//   components/
//     ProductSearch.tsx         — search bar + results dropdown
//     CartList.tsx              — line items list + Clear/Hold header
//     CartSummary.tsx           — subtotal/discount/GST/total footer
//     PaymentSidebar.tsx        — payment-mode buttons + cash input + Pay CTA
//     PaymentModal.tsx          — confirm-payment overlay (cash / card / upi / credit)
//     CustomerModal.tsx         — customer picker overlay
//     HoldBillModal.tsx         — hold bill / resume bill overlay
//
// What lives here, intentionally:
//   - Top-level layout (top bar / cart area / payment sidebar)
//   - Modal open/close state
//   - The barcode-scan and process-sale flows (they touch too many pieces
//     of state to live in a sub-component cleanly)
//   - Wiring the hooks together and passing the right props to each child
//
// The original behavior is preserved 1:1 — same Tauri invoke names, same
// TanStack Query keys, same toast notifications, same keyboard shortcuts.

import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import toast from 'react-hot-toast'

import type { ProductWithDetails, Customer, CartItem } from '../../shared/types'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Barcode, UserPlus, RotateCcw, X } from 'lucide-react'

import { useCart } from './hooks/useCart'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import {
  ProductSearch,
  CartList,
  CartSummary,
  PaymentSidebar,
  PaymentModal,
  CustomerModal,
  HoldBillModal,
} from './components'
import type { PaymentMode } from './components/PaymentSidebar'

interface HeldBill {
  id: number
  hold_number: string
  cart_data: string
  customer_id?: number | null
  grand_total: number
  created_at: string
}

export function POS() {
  const queryClient = useQueryClient()

  // ---- Cart state + derived totals ----
  const cart = useCart()

  // ---- Top-level state that crosses components ----
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash')
  const [paymentDetails, setPaymentDetails] = useState<{ mode: PaymentMode; amount: number }[]>([])
  const [cashReceived, setCashReceived] = useState('')

  // ---- Modal open/close state ----
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showHoldModal, setShowHoldModal] = useState(false)

  // ---- Misc UI state ----
  const [heldBills, setHeldBills] = useState<HeldBill[]>([])
  const [isReturnMode, setIsReturnMode] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')

  // Refs to focus the search and barcode inputs programmatically.
  const searchInputRef = useRef<HTMLInputElement>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Derived: how much change to give back for cash sales.
  const changeAmount =
    paymentMode === 'cash' && cashReceived
      ? Math.max(0, parseFloat(cashReceived) - cart.roundedTotal)
      : 0

  // Focus the search input on mount so the user can immediately start typing.
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // ---- Keyboard shortcuts (F1..F4, Esc, barcode routing) ----
  useKeyboardShortcuts({
    onOpenPayment: () => setShowPaymentModal(true),
    onOpenHold: () => setShowHoldModal(true),
    onOpenCustomer: () => setShowCustomerModal(true),
    onToggleReturnMode: () => setIsReturnMode(v => !v),
    onCloseModals: () => {
      setShowPaymentModal(false)
      setShowCustomerModal(false)
      setShowHoldModal(false)
    },
    onBarcodeKey: () => {
      // Don't steal focus from inputs (the hook already filters this, but
      // double-check here — if the user is in the search box, a scanner
      // should still go there).
      const active = document.activeElement
      if (active === searchInputRef.current || active === barcodeInputRef.current) return
      barcodeInputRef.current?.focus()
    },
    isCartEmpty: () => cart.cart.length === 0,
    isReturnMode: () => isReturnMode,
  })

  // ---- Barcode scan handler ----
  const handleBarcodeScan = async (code: string) => {
    try {
      const product = await invoke('search_products', { query: code, limit: 1 }) as ProductWithDetails[]
      if (product.length > 0) {
        cart.addToCart(product[0])
        toast.success(`Added: ${product[0].name}`)
      } else {
        toast.error('Product not found')
      }
    } catch {
      toast.error('Scan failed')
    }
  }

  // ---- Clear cart (with confirm) ----
  const clearCart = () => {
    if (cart.cart.length === 0) return
    if (window.confirm('Clear all items from cart?')) {
      cart.clearCart()
      setSelectedCustomer(null)
      setPaymentDetails([])
      setCashReceived('')
    }
  }

  // ---- Process sale (mutation so we get loading state for free) ----
  const processSaleMutation = useMutation({
    mutationFn: async () => {
      const paymentDetailsJson = JSON.stringify(
        paymentDetails.length > 0 ? paymentDetails : [{ mode: paymentMode, amount: cart.roundedTotal }]
      )

      const result = await invoke('create_sales_invoice', {
        counterId: 1, // Default counter — would come from settings
        customerId: selectedCustomer?.id,
        items: cart.cart.map(item => ({
          productId: item.product_id,
          variantId: item.variant_id,
          unitId: item.unit_id,
          qty: item.qty,
          freeQty: item.free_qty,
          unitPrice: item.unit_price,
          discountPercent: item.discount_percent,
          discountAmount: item.discount_amount,
          gstRate: item.gst_rate,
          cgstAmount: item.cgst_amount,
          sgstAmount: item.sgst_amount,
          igstAmount: item.igst_amount,
          lineTotal: item.line_total,
          costPrice: item.cost_price,
          batchNumber: item.batch_number,
          expiryDate: item.expiry_date,
        })),
        paymentMode,
        paymentDetails: paymentDetailsJson,
        discountAmount: cart.totalDiscount,
        discountPercent: cart.subtotal > 0 ? (cart.totalDiscount / cart.subtotal) * 100 : 0,
        notes: '',
      }) as { invoiceNumber: string; id: number }

      return result
    },
    onSuccess: async (result) => {
      toast.success(`Sale completed! Invoice: ${result.invoiceNumber}`)

      // Print receipt — failure is non-fatal, just warn.
      try {
        await invoke('print_receipt', {
          printerName: 'default',
          invoiceData: {
            ...result,
            items: cart.cart,
            customer: selectedCustomer,
          },
        })
      } catch (printError) {
        console.warn('Print failed:', printError)
      }

      // Reset everything for the next sale.
      cart.clearCart()
      setSelectedCustomer(null)
      setPaymentDetails([])
      setCashReceived('')
      setShowPaymentModal(false)
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Failed to process sale')
    },
  })

  const processSale = () => {
    if (cart.cart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    processSaleMutation.mutate()
  }

  // ---- Hold current bill ----
  const holdBill = async () => {
    if (cart.cart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    try {
      await invoke('hold_bill', {
        counterId: 1,
        userId: 1, // TODO: wire to auth.user.id once login state lands here
        customerId: selectedCustomer?.id,
        cartData: JSON.stringify(cart.cart),
        subtotal: cart.subtotal,
        discountAmount: cart.totalDiscount,
        taxAmount: cart.totalGST,
        grandTotal: cart.roundedTotal,
      })
      toast.success('Bill held successfully')
      clearCart()
      setShowHoldModal(false)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to hold bill')
    }
  }

  // ---- Resume a held bill ----
  const resumeBill = (bill: HeldBill) => {
    try {
      const parsed = JSON.parse(bill.cart_data) as CartItem[]
      cart.setCart(parsed)
      // customer_id resolution would need a separate fetch; leave as walk-in for now.
      setSelectedCustomer(null)
      setShowHoldModal(false)
    } catch {
      toast.error('Failed to resume bill — cart data is corrupt')
    }
  }

  // ===========================================================================
  // Layout
  // ===========================================================================

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar: Search + Barcode + Customer + Return */}
      <div className="flex items-center gap-3 p-4 bg-white border-b border-gray-200">
        <ProductSearch ref={searchInputRef} onPick={(p) => cart.addToCart(p)} />

        {/* Barcode Scanner Input */}
        <div className="relative w-48">
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            ref={barcodeInputRef}
            type="text"
            placeholder="Scan barcode"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && barcodeInput.trim()) {
                handleBarcodeScan(barcodeInput.trim())
                setBarcodeInput('')
              }
            }}
            className="pl-10"
          />
        </div>

        {/* Customer Selection */}
        <div className="flex items-center gap-2">
          <Button
            variant={selectedCustomer ? 'default' : 'outline'}
            onClick={() => setShowCustomerModal(true)}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>{selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}</span>
          </Button>
          {selectedCustomer && (
            <Button variant="ghost" size="icon" onClick={() => setSelectedCustomer(null)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Return Mode Toggle */}
        <Button
          variant={isReturnMode ? 'destructive' : 'outline'}
          onClick={() => setIsReturnMode(!isReturnMode)}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          <span>{isReturnMode ? 'Return Mode' : 'Return'}</span>
        </Button>
      </div>

      {/* Main Content: Cart (left) + Payment Sidebar (right) */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <CartList
            cart={cart.cart}
            totalQty={cart.totalQty}
            onUpdateQty={cart.updateQty}
            onRemove={cart.removeFromCart}
            onClear={clearCart}
            onHold={() => setShowHoldModal(true)}
          />
          <CartSummary
            subtotal={cart.subtotal}
            totalDiscount={cart.totalDiscount}
            totalGST={cart.totalGST}
            roundedTotal={cart.roundedTotal}
            totalQty={cart.totalQty}
          />
        </div>

        <PaymentSidebar
          paymentMode={paymentMode}
          roundedTotal={cart.roundedTotal}
          changeAmount={changeAmount}
          cashReceived={cashReceived}
          paymentDetails={paymentDetails}
          selectedCustomer={selectedCustomer}
          onModeChange={setPaymentMode}
          onCashReceivedChange={setCashReceived}
          onPaymentDetailsChange={setPaymentDetails}
          onPayClick={() => setShowPaymentModal(true)}
        />
      </div>

      {/* Modals */}
      <PaymentModal
        open={showPaymentModal}
        paymentMode={paymentMode}
        roundedTotal={cart.roundedTotal}
        changeAmount={changeAmount}
        cashReceived={cashReceived}
        onCashReceivedChange={setCashReceived}
        onConfirm={processSale}
        onClose={() => setShowPaymentModal(false)}
      />

      <CustomerModal
        open={showCustomerModal}
        selectedCustomer={selectedCustomer}
        onPick={setSelectedCustomer}
        onClose={() => setShowCustomerModal(false)}
      />

      <HoldBillModal
        open={showHoldModal}
        heldBills={heldBills}
        onHoldCurrent={holdBill}
        onResume={resumeBill}
        onClose={() => setShowHoldModal(false)}
      />
    </div>
  )
}
