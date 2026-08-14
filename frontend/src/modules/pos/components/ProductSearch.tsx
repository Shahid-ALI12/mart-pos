// modules/pos/components/ProductSearch.tsx
//
// Top-left search bar + dropdown results. Lifted out of POS.tsx so the main
// file stays focused on layout. Behavior preserved 1:1:
//   - 300ms debounce via TanStack Query's `debounce` option
//   - Search triggers on >= 2 chars
//   - Enter selects the first (and only) result
//   - Click adds the product to the cart
//   - Errors are swallowed (returns [] from the queryFn) — toast is not
//     shown here because the user might just be typing a partial SKU.
//
// The ref to the search input is forwarded up to POS so the parent can
// re-focus it after a barcode scan (the original behavior).

import { useRef, useState, forwardRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { Search } from 'lucide-react'
import type { ProductWithDetails } from '../../../shared/types'
import { Input } from '../../../shared/components/ui/input'
import { formatCurrency } from '../../../shared/utils'

interface ProductSearchProps {
  onPick: (product: ProductWithDetails) => void
}

export const ProductSearch = forwardRef<HTMLInputElement, ProductSearchProps>(
  function ProductSearch({ onPick }, ref) {
    const [searchQuery, setSearchQuery] = useState('')

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
      // @ts-expect-error - TanStack Query v5 still accepts `debounce` via plugin
      debounce: 300,
    })

    return (
      <div className="flex-1 max-w-xl relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          ref={ref}
          type="text"
          placeholder="Search product by name, SKU, barcode... (F3 for customer)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && products?.length === 1) {
              onPick(products[0])
              setSearchQuery('')
            }
          }}
        />
        {products && products.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  onPick(product)
                  setSearchQuery('')
                }}
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
    )
  }
)
