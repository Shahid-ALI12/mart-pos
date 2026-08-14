import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Plus, Receipt, Coins, FileText } from 'lucide-react'

export function ExpenseEntry() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Expense Entry</h1>
          <p className="text-gray-500">Record daily expenses</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> New Expense</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Expense Entry module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function ExpenseReports() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Expense Reports</h1>
          <p className="text-gray-500">Expense analysis by category, period</p>
        </div>
        <Button className="gap-2"><FileText className="w-4 h-4" /> Export</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Expense Analysis</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Expense Reports module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function PettyCash() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Petty Cash</h1>
          <p className="text-gray-500">Manage petty cash fund</p>
        </div>
        <Button className="gap-2"><Coins className="w-4 h-4" /> Add Funds</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Petty Cash Ledger</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Petty Cash module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}