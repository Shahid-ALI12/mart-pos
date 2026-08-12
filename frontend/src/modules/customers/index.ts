import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Plus, User, Award, CreditCard, FileText } from 'lucide-react'

export function Customers() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-gray-500">Manage customer database</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Add Customer</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Customer List</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Customers module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function LoyaltyProgram() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Loyalty Program</h1>
          <p className="text-gray-500">Manage loyalty points and rewards</p>
        </div>
        <Button className="gap-2"><Award className="w-4 h-4" /> Configure</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Loyalty Settings</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Loyalty Program module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function CreditManagement() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Credit Management</h1>
          <p className="text-gray-500">Manage customer credit limits</p>
        </div>
        <Button className="gap-2"><CreditCard className="w-4 h-4" /> Set Limits</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Credit Limits</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Credit Management module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function CustomerStatements() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Customer Statements</h1>
          <p className="text-gray-500">Generate account statements</p>
        </div>
        <Button className="gap-2"><FileText className="w-4 h-4" /> Generate</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Statements</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Customer Statements module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}