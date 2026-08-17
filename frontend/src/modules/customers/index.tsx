// modules/customers/index.tsx — Customers list + CRUD
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Plus, Search, X, Award, CreditCard, FileText } from 'lucide-react'
import { formatCurrency } from '@/shared/utils'
import type { Customer } from '@/shared/types'

type CustomerType = 'walkin' | 'regular' | 'wholesale' | 'corporate'

export function Customers() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', query, page],
    queryFn: async () => {
      const res = await invoke<{ data: Customer[]; total: number; page: number; total_pages: number }>(
        'list_customers', { query: query || null, page, pageSize: 20 }
      )
      return res
    },
  })

  const qc = useQueryClient()
  const deleteMut = useMutation({
    mutationFn: (id: number) => invoke('delete_customer', { id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer archived') },
    onError: (e: any) => toast.error(String(e)),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-gray-500">Manage customer database</p>
        </div>
        <Button className="gap-2" onClick={() => { setEditing(null); setShowForm(true) }}><Plus className="w-4 h-4" /> Add Customer</Button>
      </div>
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search by name, code, or phone..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} className="pl-10 max-w-md" />
      </div>

      {showForm && <CustomerForm customer={editing} onClose={() => setShowForm(false)} />}

      <Card>
        <CardHeader><CardTitle>Customer List ({data?.total ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-gray-500 text-center py-8">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead><TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Loyalty</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-gray-500 py-8">No customers yet</TableCell></TableRow>}
                {data?.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.customer_code}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.phone || '—'}</TableCell>
                    <TableCell className="capitalize">{c.customer_type}</TableCell>
                    <TableCell className="text-right">{c.current_credit > 0 ? formatCurrency(c.current_credit) : '—'}</TableCell>
                    <TableCell className="text-right">{c.loyalty_points}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(c); setShowForm(true) }}>Edit</Button>
                      {' '}
                      <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(c.id)}>Delete</Button>
                    </TableCell>
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

function CustomerForm({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(customer?.name || '')
  const [phone, setPhone] = useState(customer?.phone || '')
  const [email, setEmail] = useState(customer?.email || '')
  const [address, setAddress] = useState(customer?.address || '')
  const [gstin, setGstin] = useState(customer?.gstin || '')
  const [creditLimit, setCreditLimit] = useState(customer?.credit_limit || 0)
  const [customerType, setCustomerType] = useState<CustomerType>((customer?.customer_type as CustomerType) || 'walkin')

  const mut = useMutation({
    mutationFn: async () => {
      if (customer) {
        await invoke('update_customer', { input: { id: customer.id, name, phone: phone || null, email: email || null, address: address || null, gstin: gstin || null, creditLimit, customerType, priceListId: null, isActive: true } })
      } else {
        await invoke('create_customer', { input: { name, phone: phone || null, email: email || null, address: address || null, gstin: gstin || null, creditLimit, customerType, priceListId: null, isActive: true } })
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success(customer ? 'Customer updated' : 'Customer created'); onClose() },
    onError: (e: any) => toast.error(String(e)),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{customer ? 'Edit Customer' : 'New Customer'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div><Label>GSTIN</Label><Input value={gstin} onChange={(e) => setGstin(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Credit Limit</Label><Input type="number" value={creditLimit} onChange={(e) => setCreditLimit(Number(e.target.value))} /></div>
            <div><Label>Type</Label>
              <select className="w-full rounded border px-3 py-2" value={customerType} onChange={(e) => setCustomerType(e.target.value as CustomerType)}>
                <option value="walkin">Walk-in</option><option value="regular">Regular</option>
                <option value="wholesale">Wholesale</option><option value="corporate">Corporate</option>
              </select>
            </div>
          </div>
          <Button className="w-full" onClick={() => mut.mutate()} disabled={mut.isPending}>{mut.isPending ? 'Saving...' : 'Save'}</Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ponytail: these are secondary pages — implement when needed
export function LoyaltyProgram() {
  return <div className="p-6"><h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Award className="w-6 h-6" /> Loyalty Program</h1><Card><CardContent><p className="text-gray-500 text-center py-8">Loyalty points shown in customer list. Dedicated config page coming when needed.</p></CardContent></Card></div>
}
export function CreditManagement() {
  return <div className="p-6"><h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><CreditCard className="w-6 h-6" /> Credit Management</h1><Card><CardContent><p className="text-gray-500 text-center py-8">Credit limits are managed per-customer. See Customers page.</p></CardContent></Card></div>
}
export function CustomerStatements() {
  return <div className="p-6"><h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><FileText className="w-6 h-6" /> Customer Statements</h1><Card><CardContent><p className="text-gray-500 text-center py-8">Statement generation — coming when needed.</p></CardContent></Card></div>
}
