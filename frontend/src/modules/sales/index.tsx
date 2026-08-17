// modules/sales/index.tsx — Sales Register + secondary pages
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Plus, Search } from 'lucide-react'
import { formatCurrency, formatDateTime } from '@/shared/utils'
import type { SalesInvoice } from '@/shared/types'

export function SalesRegister() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-invoices', query, page],
    queryFn: async () => {
      const res = await invoke<{ data: SalesInvoice[]; total: number; page: number; total_pages: number }>(
        'list_sales_invoices', { query: query || null, page, pageSize: 20 }
      )
      return res
    },
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sales Register</h1>
          <p className="text-gray-500">View all sales invoices</p>
        </div>
        <Link to="/pos"><Button className="gap-2"><Plus className="w-4 h-4" /> New Sale</Button></Link>
      </div>
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by invoice number..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          className="pl-10 max-w-md"
        />
      </div>
      <Card>
        <CardHeader><CardTitle>Sales Invoices ({data?.total ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-gray-500 text-center py-8">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">No invoices yet</TableCell>
                  </TableRow>
                )}
                {data?.data.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{formatDateTime(inv.invoice_date)}</TableCell>
                    <TableCell className="capitalize">{inv.payment_mode}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inv.grand_total)}</TableCell>
                    <TableCell><Badge variant={inv.status === 'completed' ? 'default' : 'secondary'}>{inv.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {data && data.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">Page {data.page} of {data.total_pages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ponytail: these secondary pages are stubs — implement when the corresponding features are needed
export function SalesReturn() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Sales Returns</h1>
      <Card><CardContent><p className="text-gray-500 text-center py-8">Sales return workflow — coming when needed. Use void invoice from Sales Register for now.</p></CardContent></Card>
    </div>
  )
}
export function Quotations() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Quotations</h1>
      <Card><CardContent><p className="text-gray-500 text-center py-8">Quotation module — coming when needed.</p></CardContent></Card>
    </div>
  )
}
export function Layaways() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Layaways</h1>
      <Card><CardContent><p className="text-gray-500 text-center py-8">Layaway module — coming when needed.</p></CardContent></Card>
    </div>
  )
}
export function CustomerOutstanding() {
  const { data } = useQuery({
    queryKey: ['customer-outstanding'],
    queryFn: () => invoke('get_customer_outstanding'),
  })
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Customer Outstanding</h1>
      <Card>
        <CardHeader><CardTitle>Outstanding Report</CardTitle></CardHeader>
        <CardContent>
          {(data as any)?.customers?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No outstanding balances</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead className="text-right">Owing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data as any)?.customers?.map((c: any) => (
                  <TableRow key={c[0]}>
                    <TableCell>{c[1]}</TableCell><TableCell>{c[2]}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c[3])}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!!(data as any) && <p className="text-right mt-4 font-bold">Total: {formatCurrency((data as any).total_outstanding ?? 0)}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
