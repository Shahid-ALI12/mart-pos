import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { formatCurrency, formatNumber, cn, generateId, debounce } from '../../shared/utils'
import { ProductWithDetails, CartItem, PaymentDetail, Customer } from '../../shared/types'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/components/ui/Card'
import {
  Search,
  Barcode,
  UserPlus,
  CreditCard,
  DollarSign,
  Smartphone,
  RotateCcw,
  Minus,
  Plus,
  Trash2,
  Hold,
  FileText,
  Printer,
  Keyboard,
  X,
  Check,
  AlertCircle,
  Package,
} from 'lucide-react'
import toast from 'react-hot-toast'

export function POS() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi' | 'credit' | 'mixed'>('cash')
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([])
  const [cashReceived, setCashReceived] = useState('')
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showHoldModal, setShowHoldModal] = useState(false)
  const [heldBills, setHeldBills] = useState<any[]>([])
  const [isReturnMode, setIsReturnMode] = useState(false)
  const [returnInvoiceNumber, setReturnInvoiceNumber] = useState('')
  const [barcodeInput, setBarcodeInput] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Fetch products for search
  const { data: products } = useQuery({
    queryKey: ['products-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return []
      try {
        return await invoke('search_products', { query: searchQuery, limit: 20 }) as ProductWithDetails[]
      } catch {
        return []
      }
    },
    enabled: searchQuery.length >= 2,
    debounce: 300,
  })

  // Cart calculations
  const subtotal = cart.reduce((sum, item) => sum + item.line_total, 0)
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount_amount, 0)
  const totalGST = cart.reduce((sum, item) => sum + item.cgst_amount + item.sgst_amount + item.igst_amount, 0)
  const grandTotal = subtotal - totalDiscount + totalGST
  const roundedTotal = Math.round(grandTotal * 100) / 100
  const changeAmount = paymentMode === 'cash' && cashReceived ? Math.max(0, parseFloat(cashReceived) - roundedTotal) : 0

  // Add product to cart
  const addToCart = useCallback((product: ProductWithDetails, variant?: any) => {
    setCart(prev => {
      // Check if already in cart
      const existingIndex = prev.findIndex(item => 
        item.product_id === product.id && 
        item.variant_id === variant?.id &&
        item.unit_id === product.unit_id
      )
      
      const basePrice = variant?.sale_price || product.sale_price
      const costPrice = product.purchase_price
      
      // Calculate GST
      const gstRate = product.gst_rate
      const gstAmount = (basePrice * gstRate) / 100
      const cgst = gstAmount / 2
      const sgst = gstAmount / 2
      
      const newItem: CartItem = {
        id: generateId(),
        product_id: product.id,
        variant_id: variant?.id,
        product,
        variant,
        unit_id: product.unit_id,
        qty: 1,
        free_qty: 0,
        unit_price: basePrice,
        discount_percent: 0,
        discount_amount: 0,
        gst_rate: gstRate,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: 0,
        line_total: basePrice,
        cost_price: costPrice,
      }

      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          qty: updated[existingIndex].qty + 1,
          line_total: updated[existingIndex].unit_price * (updated[existingIndex].qty + 1),
          cgst_amount: cgst * (updated[existingIndex].qty + 1),
          sgst_amount: sgst * (updated[existingIndex].qty + 1),
        }
        return updated
      }
      
      return [...prev, newItem]
    })
    // Clear search after adding
    setSearchQuery('')
    if (searchInputRef.current) searchInputRef.current.focus()
  }, [])

  // Update cart item quantity
  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item
      const newQty = Math.max(1, item.qty + delta)
      const gstRate = item.gst_rate
      const gstPerUnit = (item.unit_price * gstRate) / 100
      const cgstPerUnit = gstPerUnit / 2
      const sgstPerUnit = gstPerUnit / 2
      return {
        ...item,
        qty: newQty,
        line_total: item.unit_price * newQty,
        cgst_amount: cgstPerUnit * newQty,
        sgst_amount: sgstPerUnit * newQty,
      }
    }))
  }

  // Remove from cart
  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  // Clear cart
  const clearCart = () => {
    if (cart.length === 0) return
    if (window.confirm('Clear all items from cart?')) {
      setCart([])
      setSelectedCustomer(null)
      setPaymentDetails([])
      setCashReceived('')
    }
  }

  // Handle barcode scan
  const handleBarcodeScan = async (code: string) => {
    try {
      const product = await invoke('search_products', { query: code, limit: 1 }) as ProductWithDetails[]
      if (product.length > 0) {
        addToCart(product[0])
        toast.success(`Added: ${product[0].name}`)
      } else {
        toast.error('Product not found')
      }
    } catch {
      toast.error('Scan failed')
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1 - Payment
      if (e.key === 'F1') {
        e.preventDefault()
        if (cart.length > 0) setShowPaymentModal(true)
      }
      // F2 - Hold Bill
      if (e.key === 'F2') {
        e.preventDefault()
        if (cart.length > 0) setShowHoldModal(true)
      }
      // F3 - Customer Search
      if (e.key === 'F3') {
        e.preventDefault()
        setShowCustomerModal(true)
      }
      // F4 - Return Mode
      if (e.key === 'F4') {
        e.preventDefault()
        setIsReturnMode(!isReturnMode)
      }
      // Escape - Close modals
      if (e.key === 'Escape') {
        setShowPaymentModal(false)
        setShowCustomerModal(false)
        setShowHoldModal(false)
      }
      // Barcode input focus (starts with number or *)
      if (e.key.length === 1 && /[\d*]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const active = document.activeElement
        if (active === searchInputRef.current || active === barcodeInputRef.current) return
        barcodeInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart.length, isReturnMode])

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  // Process payment
  const processSale = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }

    try {
      const paymentDetailsJson = JSON.stringify(paymentDetails.length > 0 ? paymentDetails : [
        { mode: paymentMode, amount: roundedTotal }
      ])

      const result = await invoke('create_sales_invoice', {
        counterId: 1, // Default counter - would come from settings
        customerId: selectedCustomer?.id,
        items: cart.map(item => ({
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
        discountAmount: totalDiscount,
        discountPercent: subtotal > 0 ? (totalDiscount / subtotal) * 100 : 0,
        notes: '',
      }) as { invoiceNumber: string; id: number }

      toast.success(`Sale completed! Invoice: ${result.invoiceNumber}`)
      
      // Print receipt
      try {
        await invoke('print_receipt', { 
          printerName: 'default', // Would come from settings
          invoiceData: { ...result, items: cart, customer: selectedCustomer }
        })
      } catch (printError) {
        console.warn('Print failed:', printError)
      }

      // Clear cart
      setCart([])
      setSelectedCustomer(null)
      setPaymentDetails([])
      setCashReceived('')
      setShowPaymentModal(false)
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    } catch (error: any) {
      toast.error(error?.message || 'Failed to process sale')
    }
  }

  // Hold bill
  const holdBill = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty')
      return
    }
    try {
      await invoke('hold_bill', {
        counterId: 1,
        userId: 1, // From auth
        customerId: selectedCustomer?.id,
        cartData: JSON.stringify(cart),
        subtotal,
        discountAmount: totalDiscount,
        taxAmount: totalGST,
        grandTotal: roundedTotal,
      })
      toast.success('Bill held successfully')
      clearCart()
      setShowHoldModal(false)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to hold bill')
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar - Search & Customer */}
      <div className="flex items-center gap-3 p-4 bg-white border-b border-gray-200">
        {/* Barcode/Search Input */}
        <div className="flex-1 max-w-xl relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search product by name, SKU, barcode... (F3 for customer)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && products?.length === 1) {
                addToCart(products[0])
              }
            }}
          />
          {products && products.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b last:border-0 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.sku} | {product.unit_short_name}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{formatCurrency(product.sale_price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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

      {/* Main Content - Cart & Payment */}
      <div className="flex-1 flex overflow-hidden">
        {/* Cart Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Cart Header */}
          <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
            <h2 className="text-lg font-semibold">Cart ({cart.length} items)</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearCart} disabled={cart.length === 0}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowHoldModal(true)} disabled={cart.length === 0}>
                <Hold className="h-4 w-4 mr-1" />
                Hold
              </Button>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Package className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg">Cart is empty</p>
                <p className="text-sm">Scan barcode or search products to add items</p>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg text-xs text-center max-w-xs">
                  <p><kbd className="px-2 py-1 bg-white border rounded">F1</kbd> Payment</p>
                  <p><kbd className="px-2 py-1 bg-white border rounded">F2</kbd> Hold Bill</p>
                  <p><kbd className="px-2 py-1 bg-white border rounded">F3</kbd> Customer</p>
                  <p><kbd className="px-2 py-1 bg-white border rounded">F4</kbd> Return Mode</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">{item.product.name}</span>
                        {item.variant && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.variant.variant_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span>{formatNumber(item.qty)} {item.product.unit_short_name}</span>
                        <span>@ {formatCurrency(item.unit_price)}</span>
                        {item.discount_percent > 0 && (
                          <span className="text-red-600">-{item.discount_percent}%</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => updateQty(item.id, -1)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">{formatNumber(item.qty)}</span>
                      <Button variant="ghost" size="icon" onClick={() => updateQty(item.id, 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="text-red-600 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="w-32 text-right font-semibold text-gray-900">
                      {formatCurrency(item.line_total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Summary */}
          <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Discount</span>
                <span>-{formatCurrency(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>GST</span>
              <span>{formatCurrency(totalGST)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>{formatCurrency(roundedTotal)}</span>
            </div>
          </div>
        </div>

        {/* Payment Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold">Payment</h3>
            <p className="text-sm text-gray-500">Amount: {formatCurrency(roundedTotal)}</p>
          </div>

          <div className="p-4 space-y-3">
            {/* Payment Mode Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'card', 'upi', 'credit'] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={paymentMode === mode ? 'default' : 'outline'}
                  className="h-16 flex-col gap-1"
                  onClick={() => {
                    setPaymentMode(mode)
                    if (mode !== 'mixed') {
                      setPaymentDetails([{ mode, amount: roundedTotal }])
                      setCashReceived(roundedTotal.toFixed(2))
                    }
                  }}
                >
                  {mode === 'cash' && <DollarSign className="h-6 w-6" />}
                  {mode === 'card' && <CreditCard className="h-6 w-6" />}
                  {mode === 'upi' && <Smartphone className="h-6 w-6" />}
                  {mode === 'credit' && <UserPlus className="h-6 w-6" />}
                  <span className="text-xs capitalize">{mode}</span>
                </Button>
              ))}
            </div>

            {/* Cash Input */}
            {paymentMode === 'cash' && (
              <div className="space-y-2">
                <label className="label">Cash Received</label>
                <Input
                  type="number"
                  step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="Enter amount"
                  className="text-xl font-mono text-center"
                />
                <div className="flex justify-between text-sm">
                  <span>Change</span>
                  <span className="font-semibold text-green-600">{formatCurrency(changeAmount)}</span>
                </div>
              </div>
            )}

            {/* Mixed Payment */}
            {paymentMode === 'mixed' && (
              <div className="space-y-2">
                <label className="label">Split Payment</label>
                <div className="space-y-2">
                  {paymentDetails.map((detail, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select
                        value={detail.mode}
                        onChange={(e) => {
                          const updated = [...paymentDetails]
                          updated[index] = { ...detail, mode: e.target.value as any }
                          setPaymentDetails(updated)
                        }}
                        className="flex-1 input text-sm py-1"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="upi">UPI</option>
                      </select>
                      <Input
                        type="number"
                        step="0.01"
                        value={detail.amount}
                        onChange={(e) => {
                          const updated = [...paymentDetails]
                          updated[index] = { ...detail, amount: parseFloat(e.target.value) || 0 }
                          setPaymentDetails(updated)
                        }}
                        className="w-24 text-right"
                      />
                      <Button variant="ghost" size="icon" onClick={() => {
                        const updated = paymentDetails.filter((_, i) => i !== index)
                        setPaymentDetails(updated)
                      }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => {
                    setPaymentDetails([...paymentDetails, { mode: 'cash', amount: 0 }])
                  }} className="w-full">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Payment
                  </Button>
                </div>
              </div>
            )}

            {/* Credit Customer Warning */}
            {paymentMode === 'credit' && selectedCustomer && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span>Credit Limit:</span>
                  <span className="font-medium">{formatCurrency(selectedCustomer.credit_limit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Outstanding:</span>
                  <span className="font-medium">{formatCurrency(selectedCustomer.current_credit)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>After this sale:</span>
                  <span className="font-medium">{formatCurrency(selectedCustomer.current_credit + roundedTotal)}</span>
                </div>
              </div>
            )}

            {/* Pay Button */}
            <Button
              size="lg"
              className="w-full mt-4"
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0}
            >
              <FileText className="h-5 w-5 mr-2" />
              Pay & Print ({formatCurrency(roundedTotal)})
            </Button>

            {/* Keyboard Shortcuts Hint */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
              <p><kbd className="px-1.5 py-0.5 bg-white border rounded">F1</kbd> Payment</p>
              <p><kbd className="px-1.5 py-0.5 bg-white border rounded">F2</kbd> Hold Bill</p>
              <p><kbd className="px-1.5 py-0.5 bg-white border rounded">F3</kbd> Customer</p>
              <p><kbd className="px-1.5 py-0.5 bg-white border rounded">F4</kbd> Return Mode</p>
              <p><kbd className="px-1.5 py-0.5 bg-white border rounded">Esc</kbd> Close Modal</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Complete Payment</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowPaymentModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(roundedTotal)}</p>
              </div>
              
              {paymentMode === 'cash' && (
                <div className="space-y-3">
                  <label className="label">Cash Received</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="text-2xl font-mono text-center"
                    autoFocus
                  />
                  <div className="flex justify-between text-lg">
                    <span>Change</span>
                    <span className="font-bold text-green-600">{formatCurrency(changeAmount)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {['100', '200', '500', '1000', '2000', '5000'].map(amt => (
                      <Button key={amt} variant="outline" onClick={() => setCashReceived(amt)}>
                        {amt}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={() => {
                    if (paymentMode === 'cash' && (!cashReceived || parseFloat(cashReceived) < roundedTotal)) {
                      toast.error('Insufficient cash received')
                      return
                    }
                    processSale()
                  }}
                >
                  Confirm & Print
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Select Customer</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowCustomerModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4">
              <Input
                placeholder="Search by name, phone, code..."
                className="mb-4"
                autoFocus
              />
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <Button
                  variant={!selectedCustomer ? 'default' : 'outline'}
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedCustomer(null)
                    setShowCustomerModal(false)
                  }}
                >
                  <span className="font-medium">Walk-in Customer</span>
                  <span className="text-sm text-gray-500 ml-auto">No account</span>
                </Button>
                {/* Customer list would come from API */}
                <p className="text-center text-gray-500 py-4">Search to find customers...</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hold Bill Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Hold Bill</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowHoldModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4">
              <Button
                variant="default"
                className="w-full mb-2"
                onClick={holdBill}
              >
                <Hold className="h-5 w-5 mr-2" />
                Hold Current Bill
              </Button>
              
              {heldBills.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-medium mb-2">Held Bills</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {heldBills.map((bill: any) => (
                      <Button
                        key={bill.id}
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={() => {
                          // Resume held bill
                          setCart(JSON.parse(bill.cart_data))
                          setSelectedCustomer(bill.customer_id ? {} : null)
                          setShowHoldModal(false)
                        }}
                      >
                        <div className="flex-1 text-left">
                          <p className="font-medium">{bill.hold_number}</p>
                          <p className="text-xs text-gray-500">{formatCurrency(bill.grand_total)} • {new Date(bill.created_at).toLocaleTimeString()}</p>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}