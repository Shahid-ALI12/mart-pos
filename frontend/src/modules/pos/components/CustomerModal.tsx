// modules/pos/components/CustomerModal.tsx
//
// Customer picker modal. Currently shows a search box and a "Walk-in Customer"
// option. The full customer-list-with-search behavior was a stub in the
// original POS.tsx (`<p>Search to find customers...</p>`) — that's preserved
// here. When the customer search command lands, this component is the only
// thing that needs to change.

import { Button } from '../../../shared/components/ui/Button'
import { Input } from '../../../shared/components/ui/Input'
import { X } from 'lucide-react'
import type { Customer } from '../../../shared/types'

interface CustomerModalProps {
  open: boolean
  selectedCustomer: Customer | null
  onPick: (customer: Customer | null) => void
  onClose: () => void
}

export function CustomerModal({ open, selectedCustomer, onPick, onClose }: CustomerModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Select Customer</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
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
                onPick(null)
                onClose()
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
  )
}
