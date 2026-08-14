import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Button } from '@/shared/components/ui/button'
import { Plus, Search, RotateCcw, FileText, User } from 'lucide-react'

export function SalesRegister() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sales Register</h1>
          <p className="text-gray-500">View all sales invoices</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> New Sale</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Sales Invoices</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Sales Register module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function SalesReturn() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sales Returns</h1>
          <p className="text-gray-500">Manage customer returns</p>
        </div>
        <Button className="gap-2"><RotateCcw className="w-4 h-4" /> New Return</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Sales Returns</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Sales Returns module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function Quotations() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Quotations</h1>
          <p className="text-gray-500">Create and manage quotations</p>
        </div>
        <Button className="gap-2"><FileText className="w-4 h-4" /> New Quotation</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Quotations</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Quotations module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function Layaways() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Layaways</h1>
          <p className="text-gray-500">Manage layaway plans</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Layaway Plans</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Layaways module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function CustomerOutstanding() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Customer Outstanding</h1>
          <p className="text-gray-500">Track customer dues</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Outstanding Report</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Customer Outstanding module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}