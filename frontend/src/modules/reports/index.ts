import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { BarChart, TrendingUp, Package, FileText, Download, Users } from 'lucide-react'

export function SalesReports() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Sales Reports</h1>
          <p className="text-gray-500">Detailed sales analytics</p>
        </div>
        <Button className="gap-2"><Download className="w-4 h-4" /> Export</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Sales Analytics</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Sales Reports module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function ProfitLossReport() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Profit & Loss Report</h1>
          <p className="text-gray-500">Financial performance overview</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>P&L Statement</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Profit & Loss Report module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function StockReports() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Stock Reports</h1>
          <p className="text-gray-500">Inventory analytics and valuation</p>
        </div>
        <Button className="gap-2"><Download className="w-4 h-4" /> Export</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Stock Analysis</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Stock Reports module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function GSTReports() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">GST Reports</h1>
          <p className="text-gray-500">GSTR-1, GSTR-3B, and compliance reports</p>
        </div>
        <div className="flex gap-2">
          <Button className="gap-2"><FileText className="w-4 h-4" /> GSTR-1</Button>
          <Button className="gap-2"><FileText className="w-4 h-4" /> GSTR-3B</Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>GST Compliance</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">GST Reports module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function CounterPerformance() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Counter Performance</h1>
          <p className="text-gray-500">Multi-counter sales analysis</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Counter Metrics</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Counter Performance module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function TopProducts() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Top Products</h1>
          <p className="text-gray-500">Best selling items analysis</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Product Rankings</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Top Products module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function CustomReportBuilder() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Custom Report Builder</h1>
          <p className="text-gray-500">Build custom reports with drag & drop</p>
        </div>
        <Button className="gap-2"><Plus className="w-4 h-4" /> New Report</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Report Builder</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Custom Report Builder module - Coming soon</p>
        </CardContent>
      </Card>
    </div>
  )
}