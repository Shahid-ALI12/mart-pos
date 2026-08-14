// modules/pos/components/CartList.tsx
//
// The left-hand side of the POS — the list of line items currently in the
// cart, with quantity steppers and a per-item remove button. Also renders
// the "Cart (N items)" header with the Clear and Hold actions.
//
// Empty state shows a Package icon + the keyboard-shortcut legend (the
// legend is duplicated in the payment sidebar — that's intentional, the
// user may be looking at either side of the screen).

import type { CartItem } from '../../../shared/types'
import { Button } from '../../../shared/components/ui/button'
import { Trash2, Minus, Plus, Hold, Package } from 'lucide-react'
import { formatCurrency, formatNumber } from '../../../shared/utils'

interface CartListProps {
  cart: CartItem[]
  totalQty: number
  onUpdateQty: (id: string, delta: number) => void
  onRemove: (id: string) => void
  onClear: () => void
  onHold: () => void
}

export function CartList({ cart, totalQty, onUpdateQty, onRemove, onClear, onHold }: CartListProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Cart Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <h2 className="text-lg font-semibold">Cart ({cart.length} items)</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClear} disabled={cart.length === 0}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={onHold} disabled={cart.length === 0}>
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
                  <Button variant="ghost" size="icon" onClick={() => onUpdateQty(item.id, -1)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-12 text-center font-medium">{formatNumber(item.qty)}</span>
                  <Button variant="ghost" size="icon" onClick={() => onUpdateQty(item.id, 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onRemove(item.id)} className="text-red-600 hover:bg-red-50">
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

      {/* Subtle total qty hint at the bottom of the cart (real summary is CartSummary) */}
      {cart.length > 0 && (
        <div className="px-4 py-2 bg-white border-t border-gray-200 text-xs text-gray-500">
          {totalQty} unit{totalQty === 1 ? '' : 's'} in cart
        </div>
      )}
    </div>
  )
}
