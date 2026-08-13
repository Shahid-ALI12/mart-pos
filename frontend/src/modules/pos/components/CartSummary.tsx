// modules/pos/components/CartSummary.tsx
//
// The gray bar at the bottom of the cart showing subtotal / discount / GST /
// grand total. Pure presentational component — receives the four derived
// numbers from the parent (which itself gets them from useCart).
//
// Keeping it separate means the layout doesn't get re-rendered if a
// cart-item's internal state changes; only when the totals change.

import { formatCurrency } from '../../../shared/utils'

interface CartSummaryProps {
  subtotal: number
  totalDiscount: number
  totalGST: number
  roundedTotal: number
  totalQty: number
}

export function CartSummary({
  subtotal,
  totalDiscount,
  totalGST,
  roundedTotal,
  totalQty,
}: CartSummaryProps) {
  return (
    <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-2">
      <div className="flex justify-between text-sm">
        <span>Subtotal ({totalQty} items)</span>
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
  )
}
