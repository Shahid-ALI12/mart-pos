// modules/pos/components/PaymentSidebar.tsx
//
// Right-hand sidebar: payment-mode buttons, cash input (or split-payment
// editor for `mixed`), credit-customer warning, the big "Pay & Print" CTA,
// and the keyboard-shortcuts legend.
//
// Pure presentational component: the parent owns paymentMode / cashReceived /
// paymentDetails state and passes setters down. The original POS.tsx kept
// these local; we keep them local to POS.tsx too so the payment modal
// (which reads the same state) sees the same values.

import type { PaymentDetail, Customer } from '../../../shared/types'
import { Button } from '../../../shared/components/ui/button'
import { Input } from '../../../shared/components/ui/input'
import {
  DollarSign, CreditCard, Smartphone, UserPlus,
  Plus, X, FileText,
} from 'lucide-react'
import { formatCurrency } from '../../../shared/utils'

export type PaymentMode = 'cash' | 'card' | 'upi' | 'credit' | 'mixed'

interface PaymentSidebarProps {
  paymentMode: PaymentMode
  roundedTotal: number
  changeAmount: number
  cashReceived: string
  paymentDetails: PaymentDetail[]
  selectedCustomer: Customer | null
  onModeChange: (mode: PaymentMode) => void
  onCashReceivedChange: (v: string) => void
  onPaymentDetailsChange: (details: PaymentDetail[]) => void
  onPayClick: () => void
}

export function PaymentSidebar({
  paymentMode,
  roundedTotal,
  changeAmount,
  cashReceived,
  paymentDetails,
  selectedCustomer,
  onModeChange,
  onCashReceivedChange,
  onPaymentDetailsChange,
  onPayClick,
}: PaymentSidebarProps) {
  return (
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
                onModeChange(mode)
                // Auto-fill the cash received field with the exact total so
                // the user can hit "Pay" without typing for non-cash modes.
                if (mode !== 'mixed') {
                  onPaymentDetailsChange([{ mode, amount: roundedTotal }])
                  onCashReceivedChange(roundedTotal.toFixed(2))
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
              onChange={(e) => onCashReceivedChange(e.target.value)}
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
                      updated[index] = { ...detail, mode: e.target.value as PaymentDetail['mode'] }
                      onPaymentDetailsChange(updated)
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
                      onPaymentDetailsChange(updated)
                    }}
                    className="w-24 text-right"
                  />
                  <Button variant="ghost" size="icon" onClick={() => {
                    const updated = paymentDetails.filter((_, i) => i !== index)
                    onPaymentDetailsChange(updated)
                  }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => {
                onPaymentDetailsChange([...paymentDetails, { mode: 'cash', amount: 0 }])
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
          onClick={onPayClick}
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
  )
}
