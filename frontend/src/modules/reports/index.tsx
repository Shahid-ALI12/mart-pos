// modules/reports/index.tsx — Sales, P&L, Stock, GST, Top Products reports
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Download, BarChart, TrendingUp, Package } from 'lucide-react'
import { formatCurrency } from '@/shared/utils'

function DateRange({ from, setFrom, to, setTo, onRun }: any) {
  return (
    <div className="flex items-end gap-4 mb-6">
      <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <Button onClick={onRun}>Run Report</Button>
    </div>
  )
}

export function SalesReports() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data } = useQuery({
    queryKey: ['sales-report', from, to],
    queryFn: () => invoke('get_sales_report', { fromDate: from || null, toDate: to || null }),
  })
  const r: any = data
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><BarChart className="w-6 h-6" /> Sales Reports</h1><p className="text-gray-500">Sales analytics overview</p></div>
      </div>
      <DateRange from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={() => {}} />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardHeader><CardTitle className="text-sm">Total Sales</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(r?.total_sales ?? 0)}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Total Invoices</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{r?.total_invoices ?? 0}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Average Sale</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(r?.average_sale ?? 0)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Payment Mode Breakdown</CardTitle></CardHeader>
        <CardContent>
          {(r?.by_payment_mode?.length ?? 0) === 0 ? <p className="text-gray-500 text-center py-8">No data</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Mode</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {r?.by_payment_mode?.map((m: any) => <TableRow key={m[0]}><TableCell className="capitalize">{m[0]}</TableCell><TableCell className="text-right">{formatCurrency(m[1])}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function ProfitLossReport() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data } = useQuery({
    queryKey: ['pl-report', from, to],
    queryFn: () => invoke('get_profit_loss_report', { fromDate: from || null, toDate: to || null }),
  })
  const r: any = data
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6" /> Profit & Loss Report</h1><p className="text-gray-500">Financial performance</p></div>
      </div>
      <DateRange from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={() => {}} />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card><CardHeader><CardTitle className="text-sm">Revenue</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-green-600">{formatCurrency(r?.revenue ?? 0)}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">COGS</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-red-600">{formatCurrency(r?.cogs ?? 0)}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Gross Profit</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(r?.gross_profit ?? 0)} ({(r?.gross_margin ?? 0).toFixed(1)}%)</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Expenses</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-red-600">{formatCurrency(r?.expenses ?? 0)}</p></CardContent></Card>
        <Card className="col-span-2"><CardHeader><CardTitle className="text-sm">Net Profit</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(r?.net_profit ?? 0)} ({(r?.net_margin ?? 0).toFixed(1)}%)</p></CardContent></Card>
      </div>
    </div>
  )
}

export function StockReports() {
  const { data } = useQuery({ queryKey: ['stock-report'], queryFn: () => invoke('get_stock_report') })
  const r: any = data
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold flex items-center gap-2"><Package className="w-6 h-6" /> Stock Reports</h1><p className="text-gray-500">Inventory valuation</p></div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardHeader><CardTitle className="text-sm">Total Items</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{r?.total_items ?? 0}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Stock Value (cost)</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(r?.total_stock_value ?? 0)}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Retail Value</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(r?.total_retail_value ?? 0)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Low Stock Items: {r?.low_stock_count ?? 0}</CardTitle></CardHeader>
        <CardContent>
          {(r?.items?.length ?? 0) === 0 ? <p className="text-gray-500 text-center py-8">No stock data</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
              <TableBody>
                {r?.items?.filter((i: any) => i[2] <= 0).map((i: any, idx: number) => <TableRow key={idx}><TableCell>{i[0]}</TableCell><TableCell>{i[1]}</TableCell><TableCell className="text-right text-red-600">{i[2]}</TableCell><TableCell className="text-right">—</TableCell></TableRow>)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function GSTReports() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data } = useQuery({
    queryKey: ['gst-report', from, to],
    queryFn: () => invoke('get_gst_report', { fromDate: from || null, toDate: to || null }),
  })
  const r: any = data
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold">GST Reports</h1><p className="text-gray-500">GST compliance summary</p></div>
      </div>
      <DateRange from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={() => {}} />
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card><CardHeader><CardTitle className="text-sm">Taxable Amount</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(r?.total_taxable ?? 0)}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">CGST</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(r?.total_cgst ?? 0)}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">SGST</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(r?.total_sgst ?? 0)}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Total GST</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{formatCurrency(r?.total_gst ?? 0)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>GST by Rate</CardTitle></CardHeader>
        <CardContent>
          {(r?.by_rate?.length ?? 0) === 0 ? <p className="text-gray-500 text-center py-8">No data</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Rate</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">CGST</TableHead><TableHead className="text-right">SGST</TableHead></TableRow></TableHeader>
              <TableBody>
                {r?.by_rate?.map((row: any, idx: number) => <TableRow key={idx}><TableCell>{row[0]}%</TableCell><TableCell className="text-right">{formatCurrency(row[1])}</TableCell><TableCell className="text-right">{formatCurrency(row[2])}</TableCell><TableCell className="text-right">{formatCurrency(row[3])}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function CounterPerformance() {
  const { data } = useQuery({ queryKey: ['counter-perf'], queryFn: () => invoke('get_counter_performance') })
  const r: any = data
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Counter Performance</h1>
      <Card>
        <CardHeader><CardTitle>Counter Metrics</CardTitle></CardHeader>
        <CardContent>
          {(r?.counters?.length ?? 0) === 0 ? <p className="text-gray-500 text-center py-8">No data</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Counter</TableHead><TableHead className="text-right">Invoices</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {r?.counters?.map((c: any, idx: number) => <TableRow key={idx}><TableCell>Counter {c[0]}</TableCell><TableCell className="text-right">{c[1]}</TableCell><TableCell className="text-right">{formatCurrency(c[2])}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function TopProducts() {
  const { data } = useQuery({ queryKey: ['top-products'], queryFn: () => invoke('get_top_products') })
  const r: any = data
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Top Products</h1>
      <Card>
        <CardHeader><CardTitle>Product Rankings</CardTitle></CardHeader>
        <CardContent>
          {(r?.products?.length ?? 0) === 0 ? <p className="text-gray-500 text-center py-8">No data</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Qty Sold</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {r?.products?.map((p: any, idx: number) => <TableRow key={idx}><TableCell>{p[0]}</TableCell><TableCell>{p[1]}</TableCell><TableCell className="text-right">{p[2]}</TableCell><TableCell className="text-right">{formatCurrency(p[3])}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function CustomReportBuilder() {
  return <div className="p-6"><h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Download className="w-6 h-6" /> Custom Report Builder</h1><Card><CardContent><p className="text-gray-500 text-center py-8">Custom report builder — coming when needed. Use the individual report pages above.</p></CardContent></Card></div>
}
