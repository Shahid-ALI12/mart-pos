import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { AlertTriangle, Calendar, Package, Filter, Download } from 'lucide-react'
import { format, addDays, differenceInDays } from 'date-fns'

interface ExpiryItem {
  id: number
  sku: string
  name: string
  category: string
  batchNumber: string
  manufactureDate: string
  expiryDate: string
  currentStock: number
  unit: string
  location: string
  daysToExpiry: number
}

const today = new Date()
const mockExpiryData: ExpiryItem[] = [
  { id: 1, sku: 'SKU002', name: 'Full Cream Milk 1L', category: 'Dairy', batchNumber: 'BAT-2026-001', manufactureDate: '2026-08-01', expiryDate: '2026-08-14', currentStock: 12, unit: 'pcs', location: 'B2-Cold', daysToExpiry: 2 },
  { id: 2, sku: 'SKU011', name: 'Yogurt 200g', category: 'Dairy', batchNumber: 'BAT-2026-002', manufactureDate: '2026-08-05', expiryDate: '2026-08-15', currentStock: 24, unit: 'pcs', location: 'B2-Cold', daysToExpiry: 3 },
  { id: 3, sku: 'SKU012', name: 'Paneer 250g', category: 'Dairy', batchNumber: 'BAT-2026-003', manufactureDate: '2026-08-08', expiryDate: '2026-08-18', currentStock: 18, unit: 'pcs', location: 'B2-Cold', daysToExpiry: 6 },
  { id: 4, sku: 'SKU013', name: 'Bread Loaf 400g', category: 'Bakery', batchNumber: 'BAT-2026-004', manufactureDate: '2026-08-10', expiryDate: '2026-08-14', currentStock: 30, unit: 'pcs', location: 'C1-R1', daysToExpiry: 2 },
  { id: 5, sku: 'SKU014', name: 'Burger Buns 6pcs', category: 'Bakery', batchNumber: 'BAT-2026-005', manufactureDate: '2026-08-11', expiryDate: '2026-08-16', currentStock: 22, unit: 'pcs', location: 'C1-R1', daysToExpiry: 4 },
  { id: 6, sku: 'SKU015', name: 'Fresh Juice 1L', category: 'Beverages', batchNumber: 'BAT-2026-006', manufactureDate: '2026-08-05', expiryDate: '2026-08-20', currentStock: 15, unit: 'pcs', location: 'B1-Cold', daysToExpiry: 8 },
  { id: 7, sku: 'SKU016', name: 'Salad Mix 200g', category: 'Produce', batchNumber: 'BAT-2026-007', manufactureDate: '2026-08-10', expiryDate: '2026-08-13', currentStock: 8, unit: 'pcs', location: 'B1-Cold', daysToExpiry: 1 },
  { id: 8, sku: 'SKU017', name: 'Chicken Breast 500g', category: 'Meat', batchNumber: 'BAT-2026-008', manufactureDate: '2026-08-09', expiryDate: '2026-08-15', currentStock: 10, unit: 'pcs', location: 'B2-Freeze', daysToExpiry: 3 },
]

const getExpiryStatus = (days: number) => {
  if (days <= 0) return { label: 'EXPIRED', class: 'bg-red-100 text-red-800 border-red-300', icon: <AlertTriangle className="w-3 h-3" /> }
  if (days <= 1) return { label: 'CRITICAL', class: 'bg-red-100 text-red-800 border-red-300', icon: <AlertTriangle className="w-3 h-3" /> }
  if (days <= 3) return { label: 'URGENT', class: 'bg-orange-100 text-orange-800 border-orange-300', icon: <Calendar className="w-3 h-3" /> }
  if (days <= 7) return { label: 'SOON', class: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: <Calendar className="w-3 h-3" /> }
  return { label: 'OK', class: 'bg-green-100 text-green-800 border-green-300', icon: <Package className="w-3 h-3" /> }
}

export function ExpiryManagement() {
  const [filterStatus, setFilterStatus] = useState<'all' | 'expired' | 'critical' | 'urgent' | 'soon' | 'ok'>('all')
  const [sortBy, setSortBy] = useState<'expiry' | 'name' | 'category'>('expiry')

  const filteredData = mockExpiryData
    .filter(item => {
      if (filterStatus === 'all') return true
      const status = getExpiryStatus(item.daysToExpiry).label.toLowerCase()
      return status === filterStatus.toLowerCase() || (filterStatus === 'critical' && (status === 'expired' || status === 'critical'))
    })
    .sort((a, b) => {
      if (sortBy === 'expiry') return a.daysToExpiry - b.daysToExpiry
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return a.category.localeCompare(b.category)
    })

  const expiredCount = mockExpiryData.filter(i => i.daysToExpiry <= 0).length
  const criticalCount = mockExpiryData.filter(i => i.daysToExpiry <= 3 && i.daysToExpiry > 0).length
  const totalValue = mockExpiryData.reduce((sum, i) => sum + (i.currentStock * 50), 0) // mock value

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expiry Management</h1>
          <p className="text-gray-500 mt-1">Track and manage product expiry dates across all batches</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Export Report</Button>
          <Button variant="outline" className="gap-2"><Filter className="w-4 h-4" /> Auto-Markdown</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Expired</p>
                <p className="text-2xl font-bold text-red-900">{expiredCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600">Critical (≤3 days)</p>
                <p className="text-2xl font-bold text-orange-900">{criticalCount}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Batches</p>
                <p className="text-2xl font-bold text-gray-900">{mockExpiryData.length}</p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Value at Risk</p>
                <p className="text-2xl font-bold text-gray-900">₹{totalValue.toLocaleString()}</p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-2 min-w-[180px]"
          >
            <option value="all">All Status</option>
            <option value="expired">Expired</option>
            <option value="critical">Critical (≤3 days)</option>
            <option value="urgent">Urgent (4-7 days)</option>
            <option value="soon">Soon (8-30 days)</option>
            <option value="ok">OK ({'>30 days'})</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-2 min-w-[180px]"
          >
            <option value="expiry">Expiry Date (Soonest First)</option>
            <option value="name">Product Name</option>
            <option value="category">Category</option>
          </select>
        </CardContent>
      </Card>

      {/* Expiry Table */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Expiry Details ({filteredData.length} batches)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Batch No.</TableHead>
                  <TableHead>Mfg Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map(item => {
                  const status = getExpiryStatus(item.daysToExpiry)
                  return (
                    <TableRow key={item.id} className={item.daysToExpiry <= 0 ? 'bg-red-50' : item.daysToExpiry <= 1 ? 'bg-red-50' : item.daysToExpiry <= 3 ? 'bg-orange-50' : item.daysToExpiry <= 7 ? 'bg-yellow-50' : ''}>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="font-mono text-sm bg-gray-50 px-2 py-1 rounded">{item.batchNumber}</TableCell>
                      <TableCell className="text-gray-500">{item.manufactureDate}</TableCell>
                      <TableCell className="font-medium text-red-600">{item.expiryDate}</TableCell>
                      <TableCell className="text-center font-mono">{item.currentStock} {item.unit}</TableCell>
                      <TableCell className="font-mono text-sm bg-gray-50 px-2 py-1 rounded">{item.location}</TableCell>
                      <TableCell>
                        <Badge className={`${status.class} gap-1`} variant="secondary">
                          {status.icon}
                          {status.label}
                          {item.daysToExpiry <= 7 && <span className="ml-1">({item.daysToExpiry}d)</span>}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="text-orange-600" title="Markdown">
                            <span className="text-xs font-bold">%</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="text-blue-600" title="Move to Front">
                            <span className="text-xs">→</span>
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-600" title="Write Off">
                            <AlertTriangle className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {filteredData.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No batches found matching your criteria</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Expiry Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" className="gap-2"><AlertTriangle className="w-4 h-4" /> Auto-Markdown Expired</Button>
          <Button variant="outline" className="gap-2"><Calendar className="w-4 h-4" /> Print Expiry Labels</Button>
          <Button variant="outline" className="gap-2"><Package className="w-4 h-4" /> Move to Front (FEFO)</Button>
          <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Export to Excel</Button>
        </CardContent>
      </Card>
    </div>
  )
}