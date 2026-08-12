// database/models.rs
use serde::{Deserialize, Serialize};
use chrono::{DateTime, NaiveDate, NaiveDateTime};
use sqlx::FromRow;
use uuid::Uuid;

// Roles
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Role {
    pub id: i64,
    pub name: String,
    pub permissions: String,  // JSON array
    pub description: Option<String>,
    pub created_at: NaiveDateTime,
}

// Users
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: i64,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role_id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub is_active: bool,
    pub last_login: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserWithRole {
    #[serde(flatten)]
    pub user: User,
    pub role_name: String,
    pub role_permissions: String,
}

// Settings
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Setting {
    pub key: String,
    pub value: String,  // JSON
    pub description: Option<String>,
    pub updated_at: NaiveDateTime,
}

// Categories
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub parent_id: Option<i64>,
    pub gst_rate: f64,
    pub hsn_code: Option<String>,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Brands
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Brand {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
}

// Units
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Unit {
    pub id: i64,
    pub name: String,
    pub short_name: String,
    pub type_: String,  // 'count', 'weight', 'volume', 'length'
    pub decimals: i64,
    pub is_active: bool,
}

// Products
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Product {
    pub id: i64,
    pub barcode: Option<String>,
    pub sku: String,
    pub name: String,
    pub category_id: i64,
    pub brand_id: Option<i64>,
    pub unit_id: i64,
    pub purchase_price: f64,
    pub sale_price: f64,
    pub min_sale_price: Option<f64>,
    pub mrp: Option<f64>,
    pub gst_rate: f64,
    pub hsn_code: Option<String>,
    pub reorder_level: f64,
    pub max_stock_level: Option<f64>,
    pub track_expiry: bool,
    pub track_batch: bool,
    pub track_serial: bool,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductWithDetails {
    #[serde(flatten)]
    pub product: Product,
    pub category_name: String,
    pub brand_name: Option<String>,
    pub unit_name: String,
    pub unit_short_name: String,
    pub current_stock: f64,
}

// Product variants
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProductVariant {
    pub id: i64,
    pub product_id: i64,
    pub variant_name: String,
    pub barcode: Option<String>,
    pub sku: Option<String>,
    pub sale_price: Option<f64>,
    pub purchase_price: Option<f64>,
    pub mrp: Option<f64>,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
}

// Unit conversions
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UnitConversion {
    pub id: i64,
    pub product_id: i64,
    pub from_unit_id: i64,
    pub to_unit_id: i64,
    pub factor: f64,
    pub is_active: bool,
}

// Stock
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Stock {
    pub id: i64,
    pub product_id: i64,
    pub location_id: i64,
    pub variant_id: Option<i64>,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub serial_number: Option<String>,
    pub quantity: f64,
    pub reserved_qty: f64,
    pub unit_cost: Option<f64>,
    pub last_updated: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockWithDetails {
    #[serde(flatten)]
    pub stock: Stock,
    pub product_name: String,
    pub product_sku: String,
    pub product_barcode: Option<String>,
    pub variant_name: Option<String>,
    pub location_name: String,
    pub available_qty: f64,  // quantity - reserved_qty
}

// Stock movements
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StockMovement {
    pub id: i64,
    pub product_id: i64,
    pub location_id: i64,
    pub variant_id: Option<i64>,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub serial_number: Option<String>,
    pub movement_type: String,
    pub reference_type: Option<String>,
    pub reference_id: Option<i64>,
    pub quantity: f64,
    pub unit_cost: Option<f64>,
    pub unit_price: Option<f64>,
    pub notes: Option<String>,
    pub user_id: i64,
    pub created_at: NaiveDateTime,
}

// Suppliers
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Supplier {
    pub id: i64,
    pub name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub gstin: Option<String>,
    pub state_code: Option<i64>,
    pub payment_terms_days: i64,
    pub opening_balance: f64,
    pub credit_limit: Option<f64>,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Purchase Orders
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PurchaseOrder {
    pub id: i64,
    pub po_number: String,
    pub supplier_id: i64,
    pub location_id: i64,
    pub status: String,
    pub order_date: NaiveDate,
    pub expected_date: Option<NaiveDate>,
    pub total_amount: f64,
    pub discount_amount: f64,
    pub discount_percent: f64,
    pub tax_amount: f64,
    pub round_off: f64,
    pub grand_total: f64,
    pub paid_amount: f64,
    pub notes: Option<String>,
    pub terms_conditions: Option<String>,
    pub created_by: i64,
    pub approved_by: Option<i64>,
    pub approved_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Purchase Order Items
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PurchaseOrderItem {
    pub id: i64,
    pub po_id: i64,
    pub product_id: i64,
    pub variant_id: Option<i64>,
    pub unit_id: i64,
    pub ordered_qty: f64,
    pub received_qty: f64,
    pub unit_price: f64,
    pub discount_percent: f64,
    pub discount_amount: f64,
    pub gst_rate: f64,
    pub gst_amount: f64,
    pub line_total: f64,
    pub notes: Option<String>,
}

// Purchase Invoices (GRN)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PurchaseInvoice {
    pub id: i64,
    pub invoice_number: String,
    pub po_id: Option<i64>,
    pub supplier_id: i64,
    pub location_id: i64,
    pub invoice_date: NaiveDate,
    pub bill_number: Option<String>,
    pub bill_date: Option<NaiveDate>,
    pub total_amount: f64,
    pub discount_amount: f64,
    pub discount_percent: f64,
    pub tax_amount: f64,
    pub round_off: f64,
    pub grand_total: f64,
    pub paid_amount: f64,
    pub status: String,
    pub payment_mode: Option<String>,
    pub payment_ref: Option<String>,
    pub notes: Option<String>,
    pub created_by: i64,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Purchase Invoice Items
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PurchaseInvoiceItem {
    pub id: i64,
    pub pi_id: i64,
    pub product_id: i64,
    pub variant_id: Option<i64>,
    pub unit_id: i64,
    pub qty: f64,
    pub free_qty: f64,
    pub unit_price: f64,
    pub discount_percent: f64,
    pub discount_amount: f64,
    pub gst_rate: f64,
    pub cgst_amount: f64,
    pub sgst_amount: f64,
    pub igst_amount: f64,
    pub line_total: f64,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

// Customers
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Customer {
    pub id: i64,
    pub customer_code: String,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub gstin: Option<String>,
    pub state_code: Option<i64>,
    pub credit_limit: f64,
    pub current_credit: f64,
    pub loyalty_points: i64,
    pub customer_type: String,
    pub price_list_id: Option<i64>,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Sales Invoices
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SalesInvoice {
    pub id: i64,
    pub invoice_number: String,
    pub counter_id: i64,
    pub customer_id: Option<i64>,
    pub user_id: i64,
    pub invoice_date: NaiveDateTime,
    pub subtotal: f64,
    pub discount_amount: f64,
    pub discount_percent: f64,
    pub taxable_amount: f64,
    pub cgst_amount: f64,
    pub sgst_amount: f64,
    pub igst_amount: f64,
    pub total_gst: f64,
    pub round_off: f64,
    pub grand_total: f64,
    pub paid_amount: f64,
    pub change_amount: f64,
    pub payment_mode: String,
    pub payment_details: Option<String>,  // JSON
    pub status: String,
    pub loyalty_points_earned: i64,
    pub loyalty_points_redeemed: i64,
    pub notes: Option<String>,
    pub synced: bool,
    pub sync_version: i64,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Sales Invoice Items
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SalesInvoiceItem {
    pub id: i64,
    pub invoice_id: i64,
    pub product_id: i64,
    pub variant_id: Option<i64>,
    pub unit_id: i64,
    pub qty: f64,
    pub free_qty: f64,
    pub unit_price: f64,
    pub discount_percent: f64,
    pub discount_amount: f64,
    pub gst_rate: f64,
    pub cgst_amount: f64,
    pub sgst_amount: f64,
    pub igst_amount: f64,
    pub line_total: f64,
    pub cost_price: f64,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub serial_numbers: Option<String>,  // JSON array
}

// Locations
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Location {
    pub id: i64,
    pub name: String,
    pub type_: String,
    pub address: Option<String>,
    pub is_active: bool,
    pub is_main_warehouse: bool,
    pub created_at: NaiveDateTime,
}

// Expense Categories
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ExpenseCategory {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
}

// Expenses
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Expense {
    pub id: i64,
    pub category_id: i64,
    pub amount: f64,
    pub expense_date: NaiveDate,
    pub description: Option<String>,
    pub payment_mode: String,
    pub reference: Option<String>,
    pub attachment_path: Option<String>,
    pub created_by: i64,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Stock Transfers
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StockTransfer {
    pub id: i64,
    pub transfer_number: String,
    pub from_location_id: i64,
    pub to_location_id: i64,
    pub status: String,
    pub requested_by: i64,
    pub requested_at: NaiveDateTime,
    pub dispatched_by: Option<i64>,
    pub dispatched_at: Option<NaiveDateTime>,
    pub received_by: Option<i64>,
    pub received_at: Option<NaiveDateTime>,
    pub notes: Option<String>,
}

// Stock Transfer Items
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StockTransferItem {
    pub id: i64,
    pub transfer_id: i64,
    pub product_id: i64,
    pub variant_id: Option<i64>,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub requested_qty: f64,
    pub dispatched_qty: f64,
    pub received_qty: f64,
    pub unit_cost: Option<f64>,
    pub notes: Option<String>,
}

// Sync Log
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SyncLog {
    pub id: i64,
    pub table_name: String,
    pub record_id: i64,
    pub operation: String,
    pub payload: String,  // JSON
    pub source_counter_id: i64,
    pub source_user_id: Option<i64>,
    pub created_at: NaiveDateTime,
    pub synced_to_all: bool,
    pub sync_version: i64,
}

// Activity Log
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ActivityLog {
    pub id: i64,
    pub user_id: i64,
    pub action: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<i64>,
    pub old_values: Option<String>,  // JSON
    pub new_values: Option<String>,  // JSON
    pub ip_address: Option<String>,
    pub device_info: Option<String>,
    pub success: bool,
    pub error_message: Option<String>,
    pub created_at: NaiveDateTime,
}

// Price Lists
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PriceList {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Price List Items
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PriceListItem {
    pub id: i64,
    pub price_list_id: i64,
    pub product_id: i64,
    pub variant_id: Option<i64>,
    pub sale_price: f64,
    pub min_qty: f64,
}

// Opening Stock
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OpeningStock {
    pub id: i64,
    pub financial_year: String,
    pub product_id: i64,
    pub location_id: i64,
    pub variant_id: Option<i64>,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub quantity: f64,
    pub unit_cost: f64,
    pub created_by: i64,
    pub created_at: NaiveDateTime,
}

// Financial Years
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FinancialYear {
    pub id: i64,
    pub name: String,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub is_current: bool,
    pub is_closed: bool,
    pub closed_at: Option<NaiveDateTime>,
    pub closed_by: Option<i64>,
    pub created_at: NaiveDateTime,
}

// Hold Bills
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HoldBill {
    pub id: i64,
    pub hold_number: String,
    pub counter_id: i64,
    pub user_id: i64,
    pub customer_id: Option<i64>,
    pub cart_data: String,  // JSON
    pub subtotal: f64,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub grand_total: f64,
    pub created_at: NaiveDateTime,
    pub resumed_at: Option<NaiveDateTime>,
    pub resumed_by: Option<i64>,
    pub status: String,
}

// Quotations
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Quotation {
    pub id: i64,
    pub quote_number: String,
    pub customer_id: Option<i64>,
    pub counter_id: i64,
    pub user_id: i64,
    pub quote_date: NaiveDate,
    pub valid_until: Option<NaiveDate>,
    pub subtotal: f64,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub grand_total: f64,
    pub status: String,
    pub converted_invoice_id: Option<i64>,
    pub notes: Option<String>,
    pub terms_conditions: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// Layaways
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Layaway {
    pub id: i64,
    pub layaway_number: String,
    pub customer_id: i64,
    pub counter_id: i64,
    pub user_id: i64,
    pub created_date: NaiveDateTime,
    pub due_date: Option<NaiveDate>,
    pub subtotal: f64,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub grand_total: f64,
    pub paid_amount: f64,
    pub balance_amount: f64,
    pub status: String,
    pub notes: Option<String>,
}

// Request/Response DTOs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub user: UserWithRole,
    pub token: String,  // Simple session token
    pub permissions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub total_pages: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub message: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self { success: true, data: Some(data), error: None, message: None }
    }
    pub fn error(error: String) -> Self {
        Self { success: false, data: None, error: Some(error), message: None }
    }
    pub fn message(message: String) -> Self {
        Self { success: true, data: None, error: None, message: Some(message) }
    }
}