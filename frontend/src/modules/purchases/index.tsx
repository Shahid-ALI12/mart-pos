// modules/purchases/index.tsx — Suppliers + Purchase Orders + GRN
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import toast from 'react-hot-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { Plus, Search, X, Truck, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '@/shared/utils'
import type { Supplier, PurchaseOrder, PurchaseInvoice } from '@/shared/types'

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------
export function Suppliers() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', query, page],
    queryFn: async () => {
      const res = await invoke<{ data: Supplier[]; total: number; page: number; total_pages: number }>(
        'list_suppliers', { query: query || null, page, pageSize: 20 }
      )
      return res
    },
  })

  const qc = useQueryClient()
  const deleteMut = useMutation({
    mutationFn: (id: number) => invoke('delete_supplier', { id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Supplier archived') },
    onError: (e: any) => toast.error(String(e)),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold">Suppliers</h1><p className="text-gray-500">Manage supplier information</p></div>
        <Button className="gap-2" onClick={() => { setEditing(null); setShowForm(true) }}><Plus className="w-4 h-4" /> Add Supplier</Button>
      </div>
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search suppliers..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} className="pl-10 max-w-md" />
      </div>
      {showForm && <SupplierForm supplier={editing} onClose={() => setShowForm(false)} />}
      <Card>
        <CardHeader><CardTitle>Supplier List ({data?.total ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-gray-500 text-center py-8">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Contact Person</TableHead><TableHead>Phone</TableHead>
                  <TableHead>GSTIN</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-8">No suppliers yet</TableCell></TableRow>}
                {data?.data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.contact_person || '—'}</TableCell>
                    <TableCell>{s.phone || '—'}</TableCell>
                    <TableCell>{s.gstin || '—'}</TableCell>
                    <TableCell className="text-right">{s.opening_balance > 0 ? formatCurrency(s.opening_balance) : '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setShowForm(true) }}>Edit</Button>
                      {' '}<Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(s.id)}>Delete</Button>
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

function SupplierForm({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(supplier?.name || '')
  const [contactPerson, setContactPerson] = useState(supplier?.contact_person || '')
  const [phone, setPhone] = useState(supplier?.phone || '')
  const [email, setEmail] = useState(supplier?.email || '')
  const [address, setAddress] = useState(supplier?.address || '')
  const [gstin, setGstin] = useState(supplier?.gstin || '')
  const [paymentTerms, setPaymentTerms] = useState(supplier?.payment_terms_days ?? 30)

  const mut = useMutation({
    mutationFn: async () => {
      const input = { name, contactPerson: contactPerson || null, phone: phone || null, email: email || null, address: address || null, gstin: gstin || null, paymentTermsDays: paymentTerms, openingBalance: supplier?.opening_balance ?? 0, creditLimit: supplier?.credit_limit ?? null, isActive: true }
      if (supplier) await invoke('update_supplier', { input: { ...input, id: supplier.id } })
      else await invoke('create_supplier', { input })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); toast.success(supplier ? 'Supplier updated' : 'Supplier created'); onClose() },
    onError: (e: any) => toast.error(String(e)),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{supplier ? 'Edit Supplier' : 'New Supplier'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Contact Person</Label><Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>GSTIN</Label><Input value={gstin} onChange={(e) => setGstin(e.target.value)} /></div>
            <div><Label>Payment Terms (days)</Label><Input type="number" value={paymentTerms} onChange={(e) => setPaymentTerms(Number(e.target.value))} /></div>
          </div>
          <Button className="w-full" onClick={() => mut.mutate()} disabled={mut.isPending || !name.trim()}>{mut.isPending ? 'Saving...' : 'Save'}</Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Purchase Orders
// ---------------------------------------------------------------------------
export function PurchaseOrders() {
  const [page] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', page],
    queryFn: async () => {
      const res = await invoke<{ data: PurchaseOrder[]; total: number; page: number; total_pages: number }>(
        'list_purchase_orders', { page, pageSize: 20 }
      )
      return res
    },
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold">Purchase Orders</h1><p className="text-gray-500">View purchase orders</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle>Purchase Orders ({data?.total ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-gray-500 text-center py-8">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO #</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-gray-500 py-8">No purchase orders yet</TableCell></TableRow>}
                {data?.data.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.po_number}</TableCell>
                    <TableCell>{formatDate(po.order_date)}</TableCell>
                    <TableCell><Badge>{po.status}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(po.grand_total)}</TableCell>
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

// ---------------------------------------------------------------------------
// Goods Receipt (Purchase Invoices / GRN)
// ---------------------------------------------------------------------------
export function GoodsReceipt() {
  const [page] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['purchase-invoices', page],
    queryFn: async () => {
      const res = await invoke<{ data: PurchaseInvoice[]; total: number; page: number; total_pages: number }>(
        'list_purchase_invoices', { page, pageSize: 20 }
      )
      return res
    },
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="w-6 h-6" /> Goods Receipt</h1><p className="text-gray-500">Received stock records (GRN)</p></div>
      </div>
      <Card>
        <CardHeader><CardTitle>Goods Receipts ({data?.total ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-gray-500 text-center py-8">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GRN #</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-gray-500 py-8">No receipts yet</TableCell></TableRow>}
                {data?.data.map((pi) => (
                  <TableRow key={pi.id}>
                    <TableCell className="font-medium">{pi.invoice_number}</TableCell>
                    <TableCell>{formatDate(pi.invoice_date)}</TableCell>
                    <TableCell><Badge>{pi.status}</Badge></TableCell>
                    <TableCell className="text-right">{formatCurrency(pi.grand_total)}</TableCell>
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

// ponytail: stubs — implement when needed
export function PurchaseReturns() {
  return <div className="p-6"><h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><FileText className="w-6 h-6" /> Purchase Returns</h1><Card><CardContent><p className="text-gray-500 text-center py-8">Purchase return workflow — coming when needed.</p></CardContent></Card></div>
}
export function PayablesReport() {
  const { data } = useQuery({ queryKey: ['supplier-outstanding'], queryFn: () => invoke('get_supplier_outstanding') })
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Payables Report</h1>
      <Card>
        <CardHeader><CardTitle>Payables Summary</CardTitle></CardHeader>
        <CardContent>
          {(data as any)?.suppliers?.length === 0 ? <p className="text-gray-500 text-center py-8">No outstanding payables</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead className="text-right">Payable</TableHead></TableRow></TableHeader>
              <TableBody>
                {(data as any)?.suppliers?.map((s: any) => (
                  <TableRow key={s[0]}><TableCell>{s[1]}</TableCell><TableCell className="text-right">{formatCurrency(s[2])}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!!(data as any) && <p className="text-right mt-4 font-bold">Total: {formatCurrency((data as any).total_payable ?? 0)}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
