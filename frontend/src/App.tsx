import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { Layout } from './shared/components/Layout'
import { Login } from './modules/auth/Login'
import { Dashboard } from './modules/dashboard/Dashboard'
import { POS } from './modules/pos/POS'
import { Products } from './modules/inventory/Products'
import { StockView } from './modules/inventory/StockView'
import { StockAdjustment } from './modules/inventory/StockAdjustment'
import { StockTransfer } from './modules/inventory/StockTransfer'
import { LowStockAlerts } from './modules/inventory/LowStockAlerts'
import { ExpiryManagement } from './modules/inventory/ExpiryManagement'
import { BarcodeLabels } from './modules/inventory/BarcodeLabels'
import { Suppliers } from './modules/purchases/Suppliers'
import { PurchaseOrders } from './modules/purchases/PurchaseOrders'
import { GoodsReceipt } from './modules/purchases/GoodsReceipt'
import { PurchaseReturns } from './modules/purchases/PurchaseReturns'
import { PayablesReport } from './modules/purchases/PayablesReport'
import { SalesRegister } from './modules/sales/SalesRegister'
import { SalesReturn } from './modules/sales/SalesReturn'
import { Quotations } from './modules/sales/Quotations'
import { Layaways } from './modules/sales/Layaways'
import { CustomerOutstanding } from './modules/sales/CustomerOutstanding'
import { Customers } from './modules/customers/Customers'
import { LoyaltyProgram } from './modules/customers/LoyaltyProgram'
import { CreditManagement } from './modules/customers/CreditManagement'
import { CustomerStatements } from './modules/customers/CustomerStatements'
import { SalesReports } from './modules/reports/SalesReports'
import { ProfitLossReport } from './modules/reports/ProfitLossReport'
import { StockReports } from './modules/reports/StockReports'
import { GSTReports } from './modules/reports/GSTReports'
import { CounterPerformance } from './modules/reports/CounterPerformance'
import { TopProducts } from './modules/reports/TopProducts'
import { CustomReportBuilder } from './modules/reports/CustomReportBuilder'
import { ExpenseEntry } from './modules/expenses/ExpenseEntry'
import { ExpenseReports } from './modules/expenses/ExpenseReports'
import { PettyCash } from './modules/expenses/PettyCash'
import { UserManagement } from './modules/users/UserManagement'
import { RolePermissions } from './modules/users/RolePermissions'
import { ActivityLog } from './modules/users/ActivityLog'
import { GeneralSettings } from './modules/settings/GeneralSettings'
import { CounterSetup } from './modules/settings/CounterSetup'
import { TaxSetup } from './modules/settings/TaxSetup'
import { BackupRestore } from './modules/settings/BackupRestore'
import { SyncSettings } from './modules/settings/SyncSettings'
import { HardwareConfig } from './modules/settings/HardwareConfig'
import { ProtectedRoute } from './shared/components/ProtectedRoute'

function App() {
  const { isAuthenticated, initializeAuth } = useAuthStore()

  // Initialize auth on app start
  React.useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* POS */}
        <Route path="/pos" element={<POS />} />
        
        {/* Inventory */}
        <Route path="/inventory/products" element={<Products />} />
        <Route path="/inventory/stock" element={<StockView />} />
        <Route path="/inventory/adjustment" element={<StockAdjustment />} />
        <Route path="/inventory/transfer" element={<StockTransfer />} />
        <Route path="/inventory/low-stock" element={<LowStockAlerts />} />
        <Route path="/inventory/expiry" element={<ExpiryManagement />} />
        <Route path="/inventory/barcode-labels" element={<BarcodeLabels />} />
        
        {/* Purchases */}
        <Route path="/purchases/suppliers" element={<Suppliers />} />
        <Route path="/purchases/orders" element={<PurchaseOrders />} />
        <Route path="/purchases/receipt" element={<GoodsReceipt />} />
        <Route path="/purchases/returns" element={<PurchaseReturns />} />
        <Route path="/purchases/payables" element={<PayablesReport />} />
        
        {/* Sales */}
        <Route path="/sales/register" element={<SalesRegister />} />
        <Route path="/sales/returns" element={<SalesReturn />} />
        <Route path="/sales/quotations" element={<Quotations />} />
        <Route path="/sales/layaways" element={<Layaways />} />
        <Route path="/sales/customer-outstanding" element={<CustomerOutstanding />} />
        
        {/* Customers */}
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/loyalty" element={<LoyaltyProgram />} />
        <Route path="/customers/credit" element={<CreditManagement />} />
        <Route path="/customers/statements" element={<CustomerStatements />} />
        
        {/* Reports */}
        <Route path="/reports/sales" element={<SalesReports />} />
        <Route path="/reports/profit-loss" element={<ProfitLossReport />} />
        <Route path="/reports/stock" element={<StockReports />} />
        <Route path="/reports/gst" element={<GSTReports />} />
        <Route path="/reports/counter-performance" element={<CounterPerformance />} />
        <Route path="/reports/top-products" element={<TopProducts />} />
        <Route path="/reports/custom" element={<CustomReportBuilder />} />
        
        {/* Expenses */}
        <Route path="/expenses/entry" element={<ExpenseEntry />} />
        <Route path="/expenses/reports" element={<ExpenseReports />} />
        <Route path="/expenses/petty-cash" element={<PettyCash />} />
        
        {/* Users */}
        <Route path="/users" element={<UserManagement />} />
        <Route path="/users/roles" element={<RolePermissions />} />
        <Route path="/users/activity-log" element={<ActivityLog />} />
        
        {/* Settings */}
        <Route path="/settings/general" element={<GeneralSettings />} />
        <Route path="/settings/counters" element={<CounterSetup />} />
        <Route path="/settings/tax" element={<TaxSetup />} />
        <Route path="/settings/backup" element={<BackupRestore />} />
        <Route path="/settings/sync" element={<SyncSettings />} />
        <Route path="/settings/hardware" element={<HardwareConfig />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default App