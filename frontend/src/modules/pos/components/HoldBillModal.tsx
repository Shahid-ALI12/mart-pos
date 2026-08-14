// modules/pos/components/HoldBillModal.tsx
//
// Modal shown when the user hits F2 or clicks the Hold button. Two halves:
//   1. A "Hold Current Bill" CTA that calls `onHoldCurrent` (which invokes
//      the backend `hold_bill` command and clears the cart on success).
//   2. A list of currently held bills, each with a "Resume" button that
//      parses the held cart JSON back into the cart state.
//
// The held-bills list is currently fed from a `heldBills: any[]` prop — when
// the backend `get_held_bills` command lands, the parent will fetch them
// with TanStack Query and pass them in. The shape is intentionally `any`
// for now to match the original POS.tsx stub.

import { Button } from '../../../shared/components/ui/button'
import { X, Hold } from 'lucide-react'
import { formatCurrency } from '../../../shared/utils'

interface HeldBill {
  id: number
  hold_number: string
  cart_data: string
  customer_id?: number | null
  grand_total: number
  created_at: string
}

interface HoldBillModalProps {
  open: boolean
  heldBills: HeldBill[]
  onHoldCurrent: () => void
  onResume: (bill: HeldBill) => void
  onClose: () => void
}

export function HoldBillModal({
  open,
  heldBills,
  onHoldCurrent,
  onResume,
  onClose,
}: HoldBillModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Hold Bill</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-4">
          <Button
            variant="default"
            className="w-full mb-2"
            onClick={onHoldCurrent}
          >
            <Hold className="h-5 w-5 mr-2" />
            Hold Current Bill
          </Button>

          {heldBills.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-medium mb-2">Held Bills</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {heldBills.map((bill) => (
                  <Button
                    key={bill.id}
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => onResume(bill)}
                  >
                    <div className="flex-1 text-left">
                      <p className="font-medium">{bill.hold_number}</p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(bill.grand_total)} • {new Date(bill.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
