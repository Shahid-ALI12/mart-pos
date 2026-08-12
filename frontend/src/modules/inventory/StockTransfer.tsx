import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Plus, Truck, Save, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'

interface TransferItem {
  id: string
  sku: string
  name: string
  qty: number
  unit: string
  fromLocation: string
  toLocation: string
}

const mockLocations = ['Main Store', 'Warehouse A', 'Warehouse B', 'Counter 1', 'Counter 2', 'Counter 3']
const mockProducts = [
  { sku: 'SKU001', name: 'Premium Basmati Rice 1kg', unit: 'pcs' },
  { sku: 'SKU002', name: 'Full Cream Milk 1L', unit: 'pcs' },
  { sku: 'SKU003', name: 'Wheat Flour 5kg', unit: 'pcs' },
  { sku: 'SKU004', name: 'Refined Sunflower Oil 1L', unit: 'pcs' },
  { sku: 'SKU005', name: 'Toor Dal 1kg', unit: 'pcs' },
]

export function StockTransfer() {
  const [items, setItems] = useState<TransferItem[]>([
    { id: '1', sku: '', name: '', qty: 0, unit: 'pcs', fromLocation: '', toLocation: '' }
  ])
  const [loading, setLoading] = useState(false)

  const handleProductSelect = (id: string, sku: string) => {
    const product = mockProducts.find(p => p.sku === sku)
    if (product) {
      setItems(items.map(i => i.id === id ? { ...i, sku: product.sku, name: product.name, unit: product.unit } : i))
    }
  }

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), sku: '', name: '', qty: 0, unit: 'pcs', fromLocation: '', toLocation: '' }])
  }

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter(i => i.id !== id))
  }

  const updateItem = (id: string, field: keyof TransferItem, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const handleTransfer = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    setLoading(false)
    alert('Stock transfer completed successfully!')
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Transfer</h1>
          <p className="text-gray-500 mt-1">Transfer stock between locations/counters</p>
        </div>
        <Button onClick={handleTransfer} disabled={loading}>
          <Truck className="w-4 h-4" />
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Execute Transfer'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>From Location</Label>
              <Select value={items[0]?.fromLocation} onValueChange={(v) => items.forEach(i => updateItem(i.id, 'fromLocation', v))}>
                <SelectTrigger><SelectValue placeholder="Select source location..." /></SelectTrigger>
                <SelectContent>
                  {mockLocations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Location</Label>
              <Select value={items[0]?.toLocation} onValueChange={(v) => items.forEach(i => updateItem(i.id, 'toLocation', v))}>
                <SelectTrigger><SelectValue placeholder="Select destination..." /></SelectTrigger>
                <SelectContent>
                  {mockLocations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="w-12">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Select value={item.sku} onValueChange={(v) => handleProductSelect(item.id, v)}>
                        <SelectTrigger className="w-[280px]">
                          <SelectValue placeholder="Select product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {mockProducts.map(p => <SelectItem key={p.sku} value={p.sku}>{p.sku} - {p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input type="number" min="1" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', parseInt(e.target.value) || 0)} className="w-[80px]" />
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>
                      <Select value={item.fromLocation} onValueChange={(v) => updateItem(item.id, 'fromLocation', v)}>
                        <SelectTrigger className="w-[150px]"><SelectValue placeholder="From..." /></SelectTrigger>
                        <SelectContent>{mockLocations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={item.toLocation} onValueChange={(v) => updateItem(item.id, 'toLocation', v)}>
                        <SelectTrigger className="w-[150px]"><SelectValue placeholder="To..." /></SelectTrigger>
                        <SelectContent>{mockLocations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-red-600">
                        <Plus className="w-4 h-4 rotate-45" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button variant="outline" onClick={addItem} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Transfer Line
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p>• Transfers create audit trail with timestamp, user, and locations</p>
          <p>• Source location stock is reserved immediately on initiation</p>
          <p>• Destination receives stock on confirmation (receipt scan)</p>
          <p>• Partial receipts allowed - remaining stays in transit</p>
          <p>• Inter-counter transfers require manager approval above threshold</p>
        </CardContent>
      </Card>
    </div>
  )
}