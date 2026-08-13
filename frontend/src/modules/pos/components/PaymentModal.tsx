// modules/pos/components/PaymentModal.tsx
//
// Full-screen overlay shown when the user clicks "Pay & Print" or hits F1.
// For cash mode it shows the cash-received input + quick-amount buttons
// (100/200/500/1000/2000/5000) and a change-due indicator. For non-cash
// modes it just confirms the amount.
//
// The modal does NOT call create_sales_invoice itself — it validates the
// cash-received amount and then delegates to `onConfirm`, which is wired
// to POS.processSale(). This keeps the modal reusable for any future
// "edit before finalize" flow.

import { Button } from '../../../shared/components/ui/Button'
import { Input } from '../../../shared/components/ui/Input'
import { X } from 'lucide-react'
import { formatCurrency } from '../../../shared/utils'
import toast from 'react-hot-toast'
import type { PaymentMode } from './PaymentSidebar'

interface PaymentModalProps {
  open: boolean
  paymentMode: PaymentMode
  roundedTotal: number
  changeAmount: number
  cashReceived: string
  onCashReceivedChange: (v: string) => void
  onConfirm: () => void
  onClose: () => void
}

const QUICK_AMOUNTS = ['100', '200', '500', '1000', '2000', '5000']

export function PaymentModal({
  open,
  paymentMode,
  roundedTotal,
  changeAmount,
  cashReceived,
  onCashReceivedChange,
  onConfirm,
  onClose,
}: PaymentModalProps) {
  if (!open) return null

  const handleConfirm = () => {
    if (paymentMode === 'cash' && (!cashReceived || parseFloat(cashReceived) < roundedTotal)) {
      toast.error('Insufficient cash received')
      return
    }
    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Complete Payment</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
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
                onChange={(e) => onCashReceivedChange(e.target.value)}
                className="text-2xl font-mono text-center"
                autoFocus
              />
              <div className="flex justify-between text-lg">
                <span>Change</span>
                <span className="font-bold text-green-600">{formatCurrency(changeAmount)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_AMOUNTS.map(amt => (
                  <Button key={amt} variant="outline" onClick={() => onCashReceivedChange(amt)}>
                    {amt}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleConfirm}>
              Confirm & Print
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
