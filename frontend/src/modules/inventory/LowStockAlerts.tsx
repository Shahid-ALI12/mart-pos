import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { AlertTriangle, Package, Download, RefreshCw } from 'lucide-react'

interface LowStockItem {
  id: number
  sku: string
  name: string
  category: string
  currentStock: number
  minStock: number
  reorderLevel: number
  unit: string
  supplier: string
  lastRestocked: string
  daysUntilStockout: number
}

const mockLowStock = [
  { id: 1, sku: 'SKU002', name: 'Full Cream Milk 1L', category: 'Dairy', currentStock: 12, minStock: 30, reorderLevel: 25, unit: 'pcs', supplier: 'Amul Distributors', lastRestocked: '2026-08-05', daysUntilStockout: 2 },
  { id: 2, sku: 'SKU004', name: 'Refined Sunflower Oil 1L', category: 'Oils', currentStock: 8, minStock: 15, reorderLevel: 12, unit: 'pcs', supplier: 'Fortune Oils Ltd', lastRestocked: '2026-08-01', daysUntilStockout: 3 },
  { id: 3, sku: 'SKU007', name: 'Bath Soap 125g', category: 'Personal Care', currentStock: 3, minStock: 25, reorderLevel: 20, unit: 'pcs', supplier: 'Dettol India', lastRestocked: '2026-07-28', daysUntilStockout: 1 },
  { id: 4, sku: 'SKU009', name: 'Toothpaste 100g', category: 'Personal Care', currentStock: 0, minStock: 20, reorderLevel: 15, unit: 'pcs', supplier: 'Colgate Palmolive', lastRestocked: '2026-07-20', daysUntilStockout: 0 },
  { id: 5, sku: 'SKU010', name: 'Shampoo 180ml', category: 'Personal Care', currentStock: 5, minStock: 18, reorderLevel: 12, unit: 'pcs', supplier: 'HUL', lastRestocked: '2026-08-03', daysUntilStockout: 2 },
]

export function LowStockAlerts() {
  const [sortBy, setSortBy] = useState<'days' | 'stock' | 'name'>('days')

  const sortedItems = [...mockLowStock].sort((a, b) => {
    if (sortBy === 'days') return a.daysUntilStockout - b.daysUntilStockout
    if (sortBy === 'stock') return a.currentStock - b.currentStock
    return a.name.localeCompare(b.name)
  })

  const criticalCount = mockLowStock.filter(i => i.daysUntilStockout <= 1).length
  const outOfStockCount = mockLowStock.filter(i => i.currentStock === 0).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Low Stock Alerts</h1>
          <p className="text-gray-500 mt-1">Items requiring immediate restocking attention</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Critical (≤1 day)</p>
                <p className="text-3xl font-bold text-red-900">{criticalCount}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Out of Stock</p>
                <p className="text-3xl font-bold text-red-900">{outOfStockCount}</p>
              </div>
              <Package className="w-10 h-10 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Alerts</p>
                <p className="text-3xl font-bold text-gray-900">{mockLowStock.length}</p>
              </div>
              <Package className="w-10 h-10 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sort Controls */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <label className="text-sm text-gray-600">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="days">Days Until Stockout</option>
            <option value="stock">Current Stock (Low to High)</option>
            <option value="name">Product Name</option>
          </select>
        </CardContent>
      </Card>

      {/* Low Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Low Stock Items ({sortedItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Current</TableHead>
                  <TableHead className="text-center">Min Level</TableHead>
                  <TableHead className="text-center">Reorder</TableHead>
                  <TableHead className="text-center">Days Left</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Last Restocked</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map(item => {
                  const isCritical = item.daysUntilStockout <= 1
                  const isOut = item.currentStock === 0
                  return (
                    <TableRow key={item.id} className={isOut ? 'bg-red-50' : isCritical ? 'bg-yellow-50' : ''}>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-center font-mono font-bold text-red-600">{item.currentStock}</TableCell>
                      <TableCell className="text-center text-gray-500">{item.minStock}</TableCell>
                      <TableCell className="text-center text-gray-500">{item.reorderLevel}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={isOut ? 'bg-red-100 text-red-800' : isCritical ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'}>
                          {isOut ? 'OUT' : item.daysUntilStockout === 0 ? 'TODAY' : `${item.daysUntilStockout} day${item.daysUntilStockout > 1 ? 's' : ''}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{item.supplier}</TableCell>
                      <TableCell className="text-gray-500">{item.lastRestocked}</TableCell>
                      <TableCell>
                        <Badge variant={isOut ? 'destructive' : isCritical ? 'secondary' : 'outline'} className={isCritical ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : ''}>
                          {isOut ? 'URGENT' : isCritical ? 'HIGH' : 'MEDIUM'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" className="gap-2">
            <Package className="w-4 h-4" />
            Create Purchase Orders for All
          </Button>
          <Button variant="outline" className="gap-2">
            <Package className="w-4 h-4" />
            Email Suppliers
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Download Restock List
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}