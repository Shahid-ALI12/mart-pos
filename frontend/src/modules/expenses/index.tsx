// modules/expenses/index.tsx — Expense entry + reports + categories
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Plus, X, Coins, Receipt, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '@/shared/utils'
import type { Expense, ExpenseCategory } from '@/shared/types'

export function ExpenseEntry() {
  const [page] = useState(1)
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page],
    queryFn: async () => {
      const res = await invoke<{ data: Expense[]; total: number; page: number; total_pages: number }>(
        'list_expenses', { page, pageSize: 20 }
      )
      return res
    },
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="w-6 h-6" /> Expense Entry</h1><p className="text-gray-500">Record daily expenses</p></div>
        <Button className="gap-2" onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New Expense</Button>
      </div>
      {showForm && <ExpenseForm onClose={() => setShowForm(false)} />}
      <Card>
        <CardHeader><CardTitle>Expenses ({data?.total ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-gray-500 text-center py-8">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Mode</TableHead><TableHead className="text-right">Amount</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-gray-500 py-8">No expenses yet</TableCell></TableRow>}
                {data?.data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.expense_date)}</TableCell>
                    <TableCell>{e.description || '—'}</TableCell>
                    <TableCell className="capitalize">{e.payment_mode}</TableCell>
                    <TableCell className="text-right">{formatCurrency(e.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ExpenseForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const { data: categories } = useQuery({ queryKey: ['expense-categories'], queryFn: () => invoke<ExpenseCategory[]>('list_expense_categories') })

  const [categoryId, setCategoryId] = useState<number>(categories?.[0]?.id ?? 1)
  const [amount, setAmount] = useState(0)
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [paymentMode, setPaymentMode] = useState('cash')

  const mut = useMutation({
    mutationFn: () => invoke('create_expense', { input: { categoryId, amount, expenseDate, description: description || null, paymentMode, reference: null, createdBy: 1 } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense recorded'); onClose() },
    onError: (e: any) => toast.error(String(e)),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>New Expense</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Category</Label>
            <select className="w-full rounded border px-3 py-2" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Amount *</Label><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
            <div><Label>Date</Label><Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} /></div>
          </div>
          <div><Label>Payment Mode</Label>
            <select className="w-full rounded border px-3 py-2" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              <option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option>
              <option value="bank">Bank</option><option value="cheque">Cheque</option><option value="other">Other</option>
            </select>
          </div>
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <Button className="w-full" onClick={() => mut.mutate()} disabled={mut.isPending || amount <= 0}>{mut.isPending ? 'Saving...' : 'Save'}</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function ExpenseReports() {
  const { data } = useQuery({ queryKey: ['expense-report'], queryFn: async () => {
    // ponytail: reusing list_expenses for a simple total — no separate report endpoint yet
    const res = await invoke<{ data: Expense[]; total: number }>('list_expenses', { pageSize: 500 })
    const total = res.data.reduce((sum, e) => sum + e.amount, 0)
    const byCategory = res.data.reduce((acc, e) => {
      acc[e.category_id] = (acc[e.category_id] || 0) + e.amount
      return acc
    }, {} as Record<number, number>)
    return { total, byCategory, items: res.data }
  }})
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><FileText className="w-6 h-6" /> Expense Reports</h1>
      <Card>
        <CardHeader><CardTitle>Expense Analysis</CardTitle></CardHeader>
        <CardContent>
          <p className="text-2xl font-bold mb-4">Total: {formatCurrency(data?.total ?? 0)}</p>
          {(data?.items?.length ?? 0) === 0 ? <p className="text-gray-500 text-center py-8">No expenses recorded</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {data?.items?.map((e: Expense) => <TableRow key={e.id}><TableCell>{formatDate(e.expense_date)}</TableCell><TableCell>{e.description || '—'}</TableCell><TableCell className="text-right">{formatCurrency(e.amount)}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function PettyCash() {
  return <div className="p-6"><h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Coins className="w-6 h-6" /> Petty Cash</h1><Card><CardContent><p className="text-gray-500 text-center py-8">Petty cash management — coming when needed. Use Expense Entry for now.</p></CardContent></Card></div>
}
