import { Card, CardContent, CardHeader, CardTitle } from '../../shared/components/ui/card'
import { CardDescription } from '../../shared/components/ui/card'
import { Users, ShoppingCart, Package, Truck, IndianRupee as Rupee, TrendingUp, AlertTriangle, Clock, Search, CheckCircle, CreditCard, BarChart3 } from 'lucide-react'
import { formatCurrency, formatNumber } from '../../shared/utils'
import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'

interface DashboardStats {
  todaySales: number
  todayInvoices: number
  todayCustomers: number
  totalProducts: number
  lowStockCount: number
  expiringSoonCount: number
  totalOutstanding: number
  totalStockValue: number
  monthlySales: Array<{ month: string; sales: number }>
  topProducts: Array<{ name: string; qty: number; amount: number }>
  paymentModes: Array<{ mode: string; amount: number; count: number }>
}

export function Dashboard() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // No more getMockStats() fallback — if the backend is unreachable or
      // the command isn't registered yet, useQuery will surface the error
      // via the `error` state, and we render an explicit error UI below.
      return await invoke('get_dashboard_stats') as DashboardStats
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false, // don't silently retry a missing command forever
  })

  const statCards = [
    {
      title: "Today's Sales",
      value: formatCurrency(stats?.todaySales || 0),
      icon: Rupee,
      color: 'text-green-600 bg-green-100',
      change: '+12.5%',
      changeColor: 'text-green-600',
    },
    {
      title: "Today's Invoices",
      value: formatNumber(stats?.todayInvoices || 0, 0),
      icon: ShoppingCart,
      color: 'text-blue-600 bg-blue-100',
      change: '+8.2%',
      changeColor: 'text-green-600',
    },
    {
      title: 'Customers Today',
      value: formatNumber(stats?.todayCustomers || 0, 0),
      icon: Users,
      color: 'text-purple-600 bg-purple-100',
      change: '+5.1%',
      changeColor: 'text-green-600',
    },
    {
      title: 'Total Products',
      value: formatNumber(stats?.totalProducts || 0, 0),
      icon: Package,
      color: 'text-orange-600 bg-orange-100',
      change: '0%',
      changeColor: 'text-gray-600',
    },
    {
      title: 'Low Stock Alerts',
      value: formatNumber(stats?.lowStockCount || 0, 0),
      icon: AlertTriangle,
      color: 'text-red-600 bg-red-100',
      change: stats && stats.lowStockCount > 0 ? 'Action needed' : 'All good',
      changeColor: stats && stats.lowStockCount > 0 ? 'text-red-600' : 'text-green-600',
    },
    {
      title: 'Expiring Soon',
      value: formatNumber(stats?.expiringSoonCount || 0, 0),
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-100',
      change: stats && stats.expiringSoonCount > 0 ? 'Check expiry' : 'All good',
      changeColor: stats && stats.expiringSoonCount > 0 ? 'text-yellow-600' : 'text-green-600',
    },
    {
      title: 'Outstanding',
      value: formatCurrency(stats?.totalOutstanding || 0),
      icon: CreditCard,
      color: 'text-indigo-600 bg-indigo-100',
      change: 'Collect soon',
      changeColor: 'text-gray-600',
    },
    {
      title: 'Stock Value',
      value: formatCurrency(stats?.totalStockValue || 0),
      icon: TrendingUp,
      color: 'text-teal-600 bg-teal-100',
      change: 'Current valuation',
      changeColor: 'text-gray-600',
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return (
      <div className="text-center p-8 space-y-2">
        <p className="text-red-600 font-medium">Failed to load dashboard data</p>
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          The backend <code className="bg-gray-100 px-1 rounded">get_dashboard_stats</code> command
          is not registered yet (or returned an error). Until it is implemented,
          the dashboard cannot show live numbers. — {errMsg}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of your mart's performance</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
          </span>
          <span>Live Data</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className={`text-xs font-medium mt-1 ${stat.changeColor}`}>{stat.change}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales Trend</CardTitle>
            <CardDescription>Last 12 months sales performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <MonthlySalesChart data={stats?.monthlySales || []} />
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>Best performers this month</CardDescription>
          </CardHeader>
          <CardContent>
            <TopProductsTable products={stats?.topProducts || []} />
          </CardContent>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Payment Modes */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Modes (Today)</CardTitle>
            <CardDescription>Breakdown by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentModeChart data={stats?.paymentModes || []} />
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <QuickActions />
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Alerts & Notifications</CardTitle>
            <CardDescription>Items requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertsPanel 
              lowStockCount={stats?.lowStockCount || 0}
              expiringSoonCount={stats?.expiringSoonCount || 0}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MonthlySalesChart({ data }: { data: Array<{ month: string; sales: number }> }) {
  // Simple bar chart using CSS - replace with Recharts in production
  const maxSales = Math.max(...data.map(d => d.sales), 1)
  
  return (
    <div className="flex items-end justify-between h-full gap-2 px-2">
      {data.map((item, index) => (
        <div key={index} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-primary-600 rounded-t transition-all hover:bg-primary-700"
            style={{
              height: `${(item.sales / maxSales) * 100}%`,
              minHeight: '4px',
            }}
            title={formatCurrency(item.sales)}
          />
          <span className="text-xs text-gray-500">{item.month}</span>
          <span className="text-xs font-medium text-gray-900">
            {formatCurrency(item.sales).replace('₹', '')}
          </span>
        </div>
      ))}
    </div>
  )
}

function TopProductsTable({ products }: { products: Array<{ name: string; qty: number; amount: number }> }) {
  if (!products.length) {
    return <p className="text-gray-500 text-center py-4">No sales data yet</p>
  }

  return (
    <div className="space-y-3">
      {products.slice(0, 5).map((product, index) => (
        <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500 w-6">#{index + 1}</span>
            <div>
              <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">{product.name}</p>
              <p className="text-xs text-gray-500">Qty: {formatNumber(product.qty, 0)}</p>
            </div>
          </div>
          <span className="text-sm font-semibold text-gray-900">{formatCurrency(product.amount)}</span>
        </div>
      ))}
    </div>
  )
}

function PaymentModeChart({ data }: { data: Array<{ mode: string; amount: number; count: number }> }) {
  const total = data.reduce((sum, d) => sum + d.amount, 0) || 1
  
  const modeColors: Record<string, string> = {
    cash: 'bg-green-500',
    card: 'bg-blue-500',
    upi: 'bg-purple-500',
    credit: 'bg-orange-500',
    mixed: 'bg-gray-500',
  }

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.mode} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="capitalize text-gray-700">{item.mode}</span>
            <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${modeColors[item.mode] || 'bg-primary-500'} rounded-full transition-all`}
              style={{ width: `${(item.amount / total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 text-right">{item.count} transactions</p>
        </div>
      ))}
      {data.length === 0 && <p className="text-gray-500 text-center py-4">No transactions today</p>}
    </div>
  )
}

function QuickActions() {
  const actions = [
    { label: 'New Sale', href: '/pos', icon: ShoppingCart, color: 'bg-green-100 text-green-700' },
    { label: 'Add Product', href: '/inventory/products', icon: Package, color: 'bg-blue-100 text-blue-700' },
    { label: 'New Purchase', href: '/purchases/orders', icon: Truck, color: 'bg-purple-100 text-purple-700' },
    { label: 'Add Customer', href: '/customers', icon: Users, color: 'bg-orange-100 text-orange-700' },
    { label: 'Stock Check', href: '/inventory/stock', icon: Search, color: 'bg-teal-100 text-teal-700' },
    { label: 'View Reports', href: '/reports/sales', icon: BarChart3, color: 'bg-indigo-100 text-indigo-700' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map((action) => (
        <a
          key={action.label}
          href={action.href}
          className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.color}`}>
            <action.icon className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium text-gray-700 text-center">{action.label}</span>
        </a>
      ))}
    </div>
  )
}

function AlertsPanel({ lowStockCount, expiringSoonCount }: { lowStockCount: number; expiringSoonCount: number }) {
  const alerts = []
  
  if (lowStockCount > 0) {
    alerts.push({
      icon: AlertTriangle,
      color: 'text-red-600 bg-red-50 border-red-200',
      title: `${lowStockCount} product${lowStockCount > 1 ? 's' : ''} below reorder level`,
      action: 'View Low Stock',
      href: '/inventory/low-stock',
    })
  }
  
  if (expiringSoonCount > 0) {
    alerts.push({
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      title: `${expiringSoonCount} product${expiringSoonCount > 1 ? 's' : ''} expiring within 30 days`,
      action: 'Check Expiry',
      href: '/inventory/expiry',
    })
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mx-auto mb-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-gray-600">All good! No alerts at the moment.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <div key={index} className={`p-4 rounded-lg border ${alert.color}`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${alert.color.replace('bg-', 'bg-').replace('text-', 'bg-').replace('border-', 'bg-')}`}>
              <alert.icon className="h-4 w-4" style={{ color: alert.color.split(' ')[0].replace('text-', '') }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{alert.title}</p>
            </div>
            <a
              href={alert.href}
              className="text-sm font-medium hover:underline"
              style={{ color: alert.color.split(' ')[0].replace('text-', '') }}
            >
              {alert.action}
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
