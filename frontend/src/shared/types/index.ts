// Shared types for the frontend
export interface User {
  id: number
  username: string
  role_id: number
  name: string
  phone?: string
  email?: string
  is_active: boolean
  last_login?: string
  created_at: string
  updated_at: string
}

export interface Role {
  id: number
  name: string
  permissions: string // JSON array
  description?: string
  created_at: string
}

export interface UserWithRole extends User {
  role_name: string
  role_permissions: string
}

export interface Category {
  id: number
  name: string
  parent_id?: number
  gst_rate: number
  hsn_code?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Brand {
  id: number
  name: string
  description?: string
  is_active: boolean
  created_at: string
}

export interface Unit {
  id: number
  name: string
  short_name: string
  type: 'count' | 'weight' | 'volume' | 'length'
  decimals: number
  is_active: boolean
}

export interface Product {
  id: number
  barcode?: string
  sku: string
  name: string
  category_id: number
  brand_id?: number
  unit_id: number
  purchase_price: number
  sale_price: number
  min_sale_price?: number
  mrp?: number
  gst_rate: number
  hsn_code?: string
  reorder_level: number
  max_stock_level?: number
  track_expiry: boolean
  track_batch: boolean
  track_serial: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductWithDetails extends Product {
  category_name: string
  brand_name?: string
  unit_name: string
  unit_short_name: string
  current_stock: number
}

export interface ProductVariant {
  id: number
  product_id: number
  variant_name: string
  barcode?: string
  sku?: string
  sale_price?: number
  purchase_price?: number
  mrp?: number
  is_active: boolean
  created_at: string
}

export interface UnitConversion {
  id: number
  product_id: number
  from_unit_id: number
  to_unit_id: number
  factor: number
  is_active: boolean
}

export interface Stock {
  id: number
  product_id: number
  location_id: number
  variant_id?: number
  batch_number?: string
  expiry_date?: string
  serial_number?: string
  quantity: number
  reserved_qty: number
  unit_cost?: number
  last_updated: string
}

export interface StockWithDetails extends Stock {
  product_name: string
  product_sku: string
  product_barcode?: string
  variant_name?: string
  location_name: string
  available_qty: number
}

export interface Supplier {
  id: number
  name: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  gstin?: string
  state_code?: number
  payment_terms_days: number
  opening_balance: number
  credit_limit?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PurchaseOrder {
  id: number
  po_number: string
  supplier_id: number
  location_id: number
  status: 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'
  order_date: string
  expected_date?: string
  total_amount: number
  discount_amount: number
  discount_percent: number
  tax_amount: number
  round_off: number
  grand_total: number
  paid_amount: number
  notes?: string
  terms_conditions?: string
  created_by: number
  approved_by?: number
  approved_at?: string
  created_at: string
  updated_at: string
}

export interface PurchaseOrderItem {
  id: number
  po_id: number
  product_id: number
  variant_id?: number
  unit_id: number
  ordered_qty: number
  received_qty: number
  unit_price: number
  discount_percent: number
  discount_amount: number
  gst_rate: number
  gst_amount: number
  line_total: number
  notes?: string
}

export interface PurchaseInvoice {
  id: number
  invoice_number: string
  po_id?: number
  supplier_id: number
  location_id: number
  invoice_date: string
  bill_number?: string
  bill_date?: string
  total_amount: number
  discount_amount: number
  discount_percent: number
  tax_amount: number
  round_off: number
  grand_total: number
  paid_amount: number
  status: 'pending' | 'partial' | 'paid' | 'cancelled'
  payment_mode?: string
  payment_ref?: string
  notes?: string
  created_by: number
  created_at: string
  updated_at: string
}

export interface Customer {
  id: number
  customer_code: string
  name: string
  phone?: string
  email?: string
  address?: string
  gstin?: string
  state_code?: number
  credit_limit: number
  current_credit: number
  loyalty_points: number
  customer_type: 'walkin' | 'regular' | 'wholesale' | 'corporate'
  price_list_id?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SalesInvoice {
  id: number
  invoice_number: string
  counter_id: number
  customer_id?: number
  user_id: number
  invoice_date: string
  subtotal: number
  discount_amount: number
  discount_percent: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_gst: number
  round_off: number
  grand_total: number
  paid_amount: number
  change_amount: number
  payment_mode: 'cash' | 'card' | 'upi' | 'credit' | 'mixed'
  payment_details?: string // JSON
  status: 'completed' | 'returned' | 'partial_return' | 'cancelled' | 'on_hold' | 'draft'
  loyalty_points_earned: number
  loyalty_points_redeemed: number
  notes?: string
  synced: boolean
  sync_version: number
  created_at: string
  updated_at: string
}

export interface SalesInvoiceItem {
  id: number
  invoice_id: number
  product_id: number
  variant_id?: number
  unit_id: number
  qty: number
  free_qty: number
  unit_price: number
  discount_percent: number
  discount_amount: number
  gst_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  line_total: number
  cost_price: number
  batch_number?: string
  expiry_date?: string
  serial_numbers?: string
}

export interface Location {
  id: number
  name: string
  type: 'counter' | 'warehouse' | 'damaged'
  address?: string
  is_active: boolean
  is_main_warehouse: boolean
  created_at: string
}

export interface ExpenseCategory {
  id: number
  name: string
  description?: string
  is_active: boolean
  created_at: string
}

export interface Expense {
  id: number
  category_id: number
  amount: number
  expense_date: string
  description?: string
  payment_mode: 'cash' | 'card' | 'upi' | 'bank' | 'cheque' | 'other'
  reference?: string
  attachment_path?: string
  created_by: number
  created_at: string
  updated_at: string
}

export interface StockTransfer {
  id: number
  transfer_number: string
  from_location_id: number
  to_location_id: number
  status: 'pending' | 'dispatched' | 'in_transit' | 'received' | 'partial' | 'cancelled'
  requested_by: number
  requested_at: string
  dispatched_by?: number
  dispatched_at?: string
  received_by?: number
  received_at?: string
  notes?: string
}

export interface StockTransferItem {
  id: number
  transfer_id: number
  product_id: number
  variant_id?: number
  batch_number?: string
  expiry_date?: string
  requested_qty: number
  dispatched_qty: number
  received_qty: number
  unit_cost?: number
  notes?: string
}

export interface SyncLog {
  id: number
  table_name: string
  record_id: number
  operation: 'insert' | 'update' | 'delete'
  payload: string // JSON
  source_counter_id: number
  source_user_id?: number
  created_at: string
  synced_to_all: boolean
  sync_version: number
}

export interface Settings {
  key: string
  value: string // JSON
  description?: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// POS Cart Types
export interface CartItem {
  id: string // temp ID for cart
  product_id: number
  variant_id?: number
  product: ProductWithDetails
  variant?: ProductVariant
  unit_id: number
  qty: number
  free_qty: number
  unit_price: number
  discount_percent: number
  discount_amount: number
  gst_rate: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  line_total: number
  cost_price: number
  batch_number?: string
  expiry_date?: string
}

// Payment Types
export interface PaymentDetail {
  mode: 'cash' | 'card' | 'upi' | 'credit'
  amount: number
  reference?: string
  card_type?: string
  upi_id?: string
  cheque_number?: string
  bank_name?: string
}

export interface HoldBill {
  id: number
  hold_number: string
  counter_id: number
  user_id: number
  customer_id?: number
  cart_data: string // JSON
  subtotal: number
  discount_amount: number
  tax_amount: number
  grand_total: number
  created_at: string
  resumed_at?: string
  resumed_by?: number
  status: 'held' | 'resumed' | 'cancelled'
}

// Report Types
export interface SalesReportData {
  period: string
  total_sales: number
  total_invoices: number
  average_invoice_value: number
  total_gst: number
  total_discount: number
  cash_sales: number
  card_sales: number
  upi_sales: number
  credit_sales: number
  top_products: Array<{ product_id: number; name: string; qty: number; amount: number }>
  hourly_sales: Array<{ hour: number; amount: number }>
  payment_mode_breakdown: Array<{ mode: string; amount: number; count: number }>
}

export interface ProfitLossData {
  period: string
  revenue: number
  cogs: number
  gross_profit: number
  gross_margin: number
  expenses: number
  net_profit: number
  net_margin: number
  by_category: Array<{ category: string; revenue: number; cogs: number; profit: number; margin: number }>
  by_product: Array<{ product_id: number; name: string; qty: number; revenue: number; cogs: number; profit: number; margin: number }>
}

export interface StockReportData {
  total_products: number
  total_stock_value: number
  low_stock_count: number
  out_of_stock_count: number
  expiring_soon_count: number
  expired_count: number
  by_category: Array<{ category: string; products: number; value: number }>
  by_location: Array<{ location: string; products: number; value: number }>
  top_value_items: Array<{ product_id: number; name: string; qty: number; value: number }>
  slow_moving: Array<{ product_id: number; name: string; qty: number; days_since_sale: number }>
}

export interface GSTReportData {
  period: string
  b2b_invoices: Array<any>
  b2c_invoices: Array<any>
  hsn_summary: Array<{ hsn_code: string; description: string; qty: number; taxable: number; cgst: number; sgst: number; igst: number }>
  total_taxable: number
  total_cgst: number
  total_sgst: number
  total_igst: number
}