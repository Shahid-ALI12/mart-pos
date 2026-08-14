import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Button } from '@/shared/components/ui/button'
import { Plus, Search, Truck, FileText } from 'lucide-react'

export function Suppliers() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-gray-500">Manage supplier information and contacts</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Add Supplier</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Supplier List</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-8">No suppliers yet. Click "Add Supplier" to get started.</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export function PurchaseOrders() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-gray-500">Create and manage purchase orders</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> New PO</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Purchase Orders</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Purchase Orders module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function GoodsReceipt() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Goods Receipt</h1>
          <p className="text-gray-500">Record received goods against purchase orders</p>
        </div>
        <Button className="gap-2"><Truck className="w-4 h-4" /> New Receipt</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Goods Receipts</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Goods Receipt module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function PurchaseReturns() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Purchase Returns</h1>
          <p className="text-gray-500">Manage returns to suppliers</p>
        </div>
        <Button className="gap-2"><FileText className="w-4 h-4" /> New Return</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Purchase Returns</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Purchase Returns module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function PayablesReport() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Payables Report</h1>
          <p className="text-gray-500">Track outstanding payables to suppliers</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Payables Summary</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Payables Report module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}