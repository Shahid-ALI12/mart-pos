import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Plus, Minus, Save, AlertTriangle } from 'lucide-react'
import { useForm } from 'react-hook-form'

interface AdjustmentItem {
  id: string
  sku: string
  name: string
  currentStock: number
  adjustmentQty: number
  adjustmentType: 'increase' | 'decrease'
  reason: string
  unit: string
}

const mockProducts = [
  { sku: 'SKU001', name: 'Premium Basmati Rice 1kg', currentStock: 45, unit: 'pcs' },
  { sku: 'SKU002', name: 'Full Cream Milk 1L', currentStock: 12, unit: 'pcs' },
  { sku: 'SKU003', name: 'Wheat Flour 5kg', currentStock: 78, unit: 'pcs' },
  { sku: 'SKU004', name: 'Refined Sunflower Oil 1L', currentStock: 8, unit: 'pcs' },
  { sku: 'SKU005', name: 'Toor Dal 1kg', currentStock: 56, unit: 'pcs' },
]

export function StockAdjustment() {
  const [adjustments, setAdjustments] = useState<AdjustmentItem[]>([
    { id: '1', sku: '', name: '', currentStock: 0, adjustmentQty: 0, adjustmentType: 'increase', reason: '', unit: 'pcs' }
  ])
  const [saved, setSaved] = useState(false)

  const handleProductSelect = (index: number, sku: string) => {
    const product = mockProducts.find(p => p.sku === sku)
    if (product) {
      const newAdjustments = [...adjustments]
      newAdjustments[index] = {
        ...newAdjustments[index],
        sku: product.sku,
        name: product.name,
        currentStock: product.currentStock,
        unit: product.unit
      }
      setAdjustments(newAdjustments)
    }
  }

  const addRow = () => {
    setAdjustments([...adjustments, { id: Date.now().toString(), sku: '', name: '', currentStock: 0, adjustmentQty: 0, adjustmentType: 'increase', reason: '', unit: 'pcs' }])
  }

  const removeRow = (id: string) => {
    if (adjustments.length > 1) {
      setAdjustments(adjustments.filter(a => a.id !== id))
    }
  }

  const updateAdjustment = (id: string, field: keyof AdjustmentItem, value: any) => {
    setAdjustments(adjustments.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  const handleSave = () => {
    // In real app, call backend API
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Adjustment</h1>
          <p className="text-gray-500 mt-1">Record stock adjustments for damaged, expired, or found items</p>
        </div>
        <Button onClick={handleSave} disabled={saved}>
          <Save className="w-4 h-4" />
          {saved ? 'Saved!' : 'Save Adjustments'}
        </Button>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Stock adjustments saved successfully!
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Adjustment Entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Current Stock</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Qty</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Reason</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">New Stock</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((adj, idx) => (
                  <tr key={adj.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Select value={adj.sku} onValueChange={(v) => handleProductSelect(idx, v)}>
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Select product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {mockProducts.map(p => (
                            <SelectItem key={p.sku} value={p.sku}>{p.sku} - {p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {adj.name && <p className="text-sm text-gray-500 mt-1">{adj.name}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-900">{adj.currentStock} {adj.unit}</td>
                    <td className="px-4 py-3">
                      <Select value={adj.adjustmentType} onValueChange={(v) => updateAdjustment(adj.id, 'adjustmentType', v)}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="increase">Increase (+)</SelectItem>
                          <SelectItem value="decrease">Decrease (-)</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="1"
                        value={adj.adjustmentQty}
                        onChange={(e) => updateAdjustment(adj.id, 'adjustmentQty', parseInt(e.target.value) || 0)}
                        className="w-[100px]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Select value={adj.reason} onValueChange={(v) => updateAdjustment(adj.id, 'reason', v)}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select reason..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="damaged">Damaged Goods</SelectItem>
                          <SelectItem value="expired">Expired Products</SelectItem>
                          <SelectItem value="found">Stock Found</SelectItem>
                          <SelectItem value="theft">Theft/Loss</SelectItem>
                          <SelectItem value="promo">Promotional Use</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">
                      {adj.currentStock + (adj.adjustmentType === 'increase' ? adj.adjustmentQty : -adj.adjustmentQty)} {adj.unit}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="icon" onClick={() => removeRow(adj.id)} className="text-red-600 hover:text-red-800">
                        <Minus className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={addRow} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Adjustment Line
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adjustment Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p><strong>Increase (+):</strong> Stock found, returns from customers, promotional stock received</p>
          <p><strong>Decrease (-):</strong> Damaged goods, expired products, theft/loss, internal use, promotional giveaway</p>
          <p>All adjustments create an audit trail with timestamp and user info</p>
          <p>Negative stock is not allowed - system will prevent overselling</p>
        </CardContent>
      </Card>
    </div>
  )
}