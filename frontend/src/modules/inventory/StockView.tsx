import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Search, AlertTriangle, Package, TrendingUp, TrendingDown } from 'lucide-react'

interface StockItem {
  id: number
  sku: string
  name: string
  category: string
  brand: string
  currentStock: number
  minStock: number
  maxStock: number
  unit: string
  location: string
  lastUpdated: string
}

const mockStockData: StockItem[] = [
  { id: 1, sku: 'SKU001', name: 'Premium Basmati Rice 1kg', category: 'Grains', brand: 'India Gate', currentStock: 45, minStock: 20, maxStock: 200, unit: 'pcs', location: 'A1-R2', lastUpdated: '2026-08-12' },
  { id: 2, sku: 'SKU002', name: 'Full Cream Milk 1L', category: 'Dairy', brand: 'Amul', currentStock: 12, minStock: 30, maxStock: 100, unit: 'pcs', location: 'B2-Cold', lastUpdated: '2026-08-12' },
  { id: 3, sku: 'SKU003', name: 'Wheat Flour 5kg', category: 'Grains', brand: 'Aashirvaad', currentStock: 78, minStock: 25, maxStock: 150, unit: 'pcs', location: 'A1-R3', lastUpdated: '2026-08-11' },
  { id: 4, sku: 'SKU004', name: 'Refined Sunflower Oil 1L', category: 'Oils', brand: 'Fortune', currentStock: 8, minStock: 15, maxStock: 80, unit: 'pcs', location: 'A2-R1', lastUpdated: '2026-08-10' },
  { id: 5, sku: 'SKU005', name: 'Toor Dal 1kg', category: 'Pulses', brand: 'Tata', currentStock: 56, minStock: 20, maxStock: 120, unit: 'pcs', location: 'A1-R4', lastUpdated: '2026-08-12' },
  { id: 6, sku: 'SKU006', name: 'Sugar 1kg', category: 'Sweeteners', brand: 'Madhur', currentStock: 92, minStock: 30, maxStock: 200, unit: 'pcs', location: 'A2-R2', lastUpdated: '2026-08-12' },
  { id: 7, sku: 'SKU007', name: 'Bath Soap 125g', category: 'Personal Care', brand: 'Dettol', currentStock: 3, minStock: 25, maxStock: 100, unit: 'pcs', location: 'C1-R1', lastUpdated: '2026-08-09' },
  { id: 8, sku: 'SKU008', name: 'Dish Wash Liquid 500ml', category: 'Home Care', brand: 'Vim', currentStock: 34, minStock: 15, maxStock: 80, unit: 'pcs', location: 'C1-R2', lastUpdated: '2026-08-12' },
]

export function StockView() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'out' | 'ok'>('all')

  const { data: stock = [] } = useQuery({
    queryKey: ['stock'],
    queryFn: async () => mockStockData,
  })

  const filteredStock = stock.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
    
    let matchesStatus = true
    if (filterStatus === 'low') matchesStatus = item.currentStock <= item.minStock && item.currentStock > 0
    else if (filterStatus === 'out') matchesStatus = item.currentStock === 0
    else if (filterStatus === 'ok') matchesStatus = item.currentStock > item.minStock
    
    return matchesSearch && matchesStatus
  })

  const lowStockCount = stock.filter(s => s.currentStock <= s.minStock && s.currentStock > 0).length
  const outOfStockCount = stock.filter(s => s.currentStock === 0).length

  const getStockStatus = (item: StockItem) => {
    if (item.currentStock === 0) return { label: 'Out of Stock', class: 'bg-red-100 text-red-800', icon: <AlertTriangle className="w-3 h-3" /> }
    if (item.currentStock <= item.minStock) return { label: 'Low Stock', class: 'bg-yellow-100 text-yellow-800', icon: <TrendingDown className="w-3 h-3" /> }
    return { label: 'In Stock', class: 'bg-green-100 text-green-800', icon: <TrendingUp className="w-3 h-3" /> }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock View</h1>
          <p className="text-gray-500 mt-1">Monitor inventory levels across all locations</p>
        </div>
        <Button className="gap-2">
          <Package className="w-4 h-4" />
          Export Stock Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">{stock.length}</p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, SKU, category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 min-w-[180px]"
            >
              <option value="all">All Status</option>
              <option value="ok">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Details ({filteredStock.length} items)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-10">SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead className="text-center">Current</TableHead>
                  <TableHead className="text-center">Min</TableHead>
                  <TableHead className="text-center">Max</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStock.map((item) => {
                  const status = getStockStatus(item)
                  return (
                    <TableRow key={item.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{item.brand}</TableCell>
                      <TableCell className="text-center font-mono font-medium">{item.currentStock}</TableCell>
                      <TableCell className="text-center text-gray-500">{item.minStock}</TableCell>
                      <TableCell className="text-center text-gray-500">{item.maxStock}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="font-mono text-sm bg-gray-50 px-2 py-1 rounded">{item.location}</TableCell>
                      <TableCell>
                        <Badge className={`${status.class} gap-1`} variant="secondary">
                          {status.icon}
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500">{item.lastUpdated}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {filteredStock.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No stock items found matching your criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}