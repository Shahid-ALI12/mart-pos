import { ReactNode, useState } from 'react'
import { Outlet, NavLink, useLocation, Navigate, type Location as RouterLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  Users,
  FileText,
  BarChart3,
  Receipt,
  CreditCard,
  Settings,
  Menu,
  X,
  LogOut,
  User,
  Shield,
  Activity,
  Box,
  Tag,
  RotateCcw,
  ClipboardList,
  Warehouse,
  AlertTriangle,
  ScanLine,
  StickyNote,
  Building2,
  Key,
  History,
  Calculator,
  FileSpreadsheet,
  type LucideIcon,
} from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../utils'
import { formatCurrency } from '../utils'

interface NavItem {
  title: string
  href: string
  icon: LucideIcon
  permission?: string
  children?: NavItem[]
  badge?: string | number
}

const navigation: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'POS (Billing)', href: '/pos', icon: ShoppingCart, permission: 'pos.read' },
  {
    title: 'Inventory',
    href: '#',
    icon: Package,
    permission: 'inventory.read',
    children: [
      { title: 'Products', href: '/inventory/products', icon: Box },
      { title: 'Stock View', href: '/inventory/stock', icon: Warehouse },
      { title: 'Stock Adjustment', href: '/inventory/adjustment', icon: RotateCcw },
      { title: 'Stock Transfer', href: '/inventory/transfer', icon: Truck },
      { title: 'Low Stock Alerts', href: '/inventory/low-stock', icon: AlertTriangle },
      { title: 'Expiry Management', href: '/inventory/expiry', icon: Clock },
      { title: 'Barcode Labels', href: '/inventory/barcode-labels', icon: ScanLine },
    ],
  },
  {
    title: 'Purchases',
    href: '#',
    icon: Truck,
    permission: 'purchases.read',
    children: [
      { title: 'Suppliers', href: '/purchases/suppliers', icon: Building2 },
      { title: 'Purchase Orders', href: '/purchases/orders', icon: ClipboardList },
      { title: 'Goods Receipt (GRN)', href: '/purchases/receipt', icon: Package },
      { title: 'Purchase Returns', href: '/purchases/returns', icon: RotateCcw },
      { title: 'Payables Report', href: '/purchases/payables', icon: FileText },
    ],
  },
  {
    title: 'Sales',
    href: '#',
    icon: Receipt,
    permission: 'sales.read',
    children: [
      { title: 'Sales Register', href: '/sales/register', icon: FileText },
      { title: 'Sales Returns', href: '/sales/returns', icon: RotateCcw },
      { title: 'Quotations', href: '/sales/quotations', icon: StickyNote },
      { title: 'Layaways', href: '/sales/layaways', icon: Tag },
      { title: 'Customer Outstanding', href: '/sales/customer-outstanding', icon: CreditCard },
    ],
  },
  {
    title: 'Customers',
    href: '#',
    icon: Users,
    permission: 'customers.read',
    children: [
      { title: 'All Customers', href: '/customers', icon: Users },
      { title: 'Loyalty Program', href: '/customers/loyalty', icon: Star },
      { title: 'Credit Management', href: '/customers/credit', icon: CreditCard },
      { title: 'Statements', href: '/customers/statements', icon: FileText },
    ],
  },
  {
    title: 'Reports',
    href: '#',
    icon: BarChart3,
    permission: 'reports.read',
    children: [
      { title: 'Sales Reports', href: '/reports/sales', icon: ShoppingCart },
      { title: 'Profit & Loss', href: '/reports/profit-loss', icon: Calculator },
      { title: 'Stock Reports', href: '/reports/stock', icon: Box },
      { title: 'GST Reports', href: '/reports/gst', icon: FileSpreadsheet },
      { title: 'Counter Performance', href: '/reports/counter-performance', icon: Activity },
      { title: 'Top Products', href: '/reports/top-products', icon: TrendingUp },
      { title: 'Custom Reports', href: '/reports/custom', icon: FileText },
    ],
  },
  {
    title: 'Expenses',
    href: '#',
    icon: CreditCard,
    permission: 'expenses.read',
    children: [
      { title: 'Expense Entry', href: '/expenses/entry', icon: Plus },
      { title: 'Expense Reports', href: '/expenses/reports', icon: FileText },
      { title: 'Petty Cash', href: '/expenses/petty-cash', icon: Wallet },
    ],
  },
  {
    title: 'Users & Roles',
    href: '#',
    icon: Shield,
    permission: 'users.read',
    children: [
      { title: 'User Management', href: '/users', icon: Users },
      { title: 'Roles & Permissions', href: '/users/roles', icon: Key },
      { title: 'Activity Log', href: '/users/activity-log', icon: History },
    ],
  },
  {
    title: 'Settings',
    href: '#',
    icon: Settings,
    permission: 'settings.read',
    children: [
      { title: 'General', href: '/settings/general', icon: Building2 },
      { title: 'Counters', href: '/settings/counters', icon: Monitor },
      { title: 'Tax & GST', href: '/settings/tax', icon: Calculator },
      { title: 'Backup & Restore', href: '/settings/backup', icon: Database },
      { title: 'Sync Settings', href: '/settings/sync', icon: RotateCcw },
      { title: 'Hardware', href: '/settings/hardware', icon: Cpu },
    ],
  },
]

// Missing icons - using available ones
import { Star, Plus, Wallet, TrendingUp, Monitor, Database, Cpu, Clock } from 'lucide-react'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { user, logout, hasPermission } = useAuthStore()

  const filteredNavigation = navigation.filter((item) => {
    if (!item.permission) return true
    return hasPermission(item.permission)
  })

  const isActive = (href: string) => {
    if (href === '#') return false
    return location.pathname === href || location.pathname.startsWith(href + '/')
  }

  const hasActiveChild = (item: NavItem) => {
    return item.children?.some((child) => isActive(child.href)) ?? false
  }

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-200 transition-all duration-200',
          collapsed ? 'w-16' : 'w-64',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center justify-between h-16 px-4 border-b border-gray-200', collapsed && 'justify-center')}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <span className="font-semibold text-lg text-gray-900">Mart POS</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(collapsed && 'mx-auto')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1" aria-label="Main navigation">
          {filteredNavigation.map((item) => (
            <NavItemComponent
              key={item.href}
              item={item}
              isActive={isActive(item.href) || hasActiveChild(item)}
              collapsed={collapsed}
              location={location}
            />
          ))}
        </nav>

        {/* User Info */}
        <div className={cn('p-4 border-t border-gray-200', collapsed && 'items-center')}>
          {!collapsed && user && (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate capitalize">{user.role_name}</p>
              </div>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              className="w-full mt-2 justify-start gap-2"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          )}
          {collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Content */}
      <div className={cn('flex flex-1 flex-col lg:pl-64', collapsed && 'lg:pl-16')}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex-1" />
          
          {/* Quick Stats / Notifications could go here */}
          <div className="flex items-center gap-4">
            {/* Sync status indicator */}
            <SyncStatus />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItemComponent({ item, isActive, collapsed, location }: {
  item: NavItem
  isActive: boolean
  collapsed: boolean
  location: RouterLocation
}) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = item.children && item.children.length > 0

  if (hasChildren) {
    const childActive = item.children?.some((child) => location.pathname === child.href || location.pathname.startsWith(child.href + '/')) ?? false
    
    return (
      <div className="group">
        <button
          onClick={() => !collapsed && setExpanded(!expanded)}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full',
            childActive || isActive
              ? 'bg-primary-50 text-primary-700'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
            collapsed && 'justify-center px-2'
          )}
          aria-expanded={expanded}
        >
          <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {!collapsed && <span className="truncate">{item.title}</span>}
          {!collapsed && (
            <span className="ml-auto flex items-center gap-1">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          )}
        </button>
        
        {!collapsed && expanded && (
          <ul className="mt-1 ml-10 space-y-1 border-l border-gray-200 pl-2 animate-in slide-in-from-top-2 duration-200">
            {item.children?.map((child) => (
              <li key={child.href}>
                <NavLink
                  to={child.href}
                  className={({ isActive }) => cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <child.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{child.title}</span>
                  {child.badge && (
                    <span className="ml-auto px-1.5 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                      {child.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.href}
      className={({ isActive }) => cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full',
        isActive
          ? 'bg-primary-50 text-primary-700'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
        collapsed && 'justify-center px-2'
      )}
      title={collapsed ? item.title : undefined}
    >
      <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.title}</span>}
      {item.badge && !collapsed && (
        <span className="ml-auto px-1.5 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
          {item.badge}
        </span>
      )}
    </NavLink>
  )
}

import { ChevronUp, ChevronDown } from 'lucide-react'

function SyncStatus() {
  // This would connect to actual sync status
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
      </span>
      Synced
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}