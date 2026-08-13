// tests/export_types.rs
//
// Drives ts-rs to emit one .ts file per annotated Rust struct into
// `frontend/src/shared/types/bindings/`. Run via either:
//
//   cargo test --test export_types
//   pnpm gen-types         # from the repo root (delegates to cargo)
//
// The generated files are NOT checked into git (see .gitignore). They are
// regenerated on demand whenever the Rust models change. The frontend's
// hand-written `shared/types/index.ts` remains the primary import surface;
// it re-exports from `./bindings/*` for types where the Rust definition
// is the source of truth, and keeps stricter union types (e.g.
// `payment_mode: 'cash' | 'card' | ...`) where the frontend wants more
// precision than what ts-rs can infer from `String` columns.
//
// Why an integration test rather than a unit test?
//   - Integration tests live in `tests/` and compile against the library
//     crate, so they don't clutter the production binary.
//   - We can run JUST the type export with `cargo test --test export_types`
//     without paying for the rest of the test suite.

use mart_pos::database::models::*;

#[test]
fn export_all_types_to_typescript() {
    // Core entities
    Role::export().expect("Failed to export Role");
    User::export().expect("Failed to export User");
    UserWithRole::export().expect("Failed to export UserWithRole");
    Setting::export().expect("Failed to export Setting");

    // Catalog
    Category::export().expect("Failed to export Category");
    Brand::export().expect("Failed to export Brand");
    Unit::export().expect("Failed to export Unit");
    Product::export().expect("Failed to export Product");
    ProductWithDetails::export().expect("Failed to export ProductWithDetails");
    ProductVariant::export().expect("Failed to export ProductVariant");
    UnitConversion::export().expect("Failed to export UnitConversion");

    // Inventory
    Stock::export().expect("Failed to export Stock");
    StockWithDetails::export().expect("Failed to export StockWithDetails");
    StockMovement::export().expect("Failed to export StockMovement");

    // Purchases
    Supplier::export().expect("Failed to export Supplier");
    PurchaseOrder::export().expect("Failed to export PurchaseOrder");
    PurchaseOrderItem::export().expect("Failed to export PurchaseOrderItem");
    PurchaseInvoice::export().expect("Failed to export PurchaseInvoice");
    PurchaseInvoiceItem::export().expect("Failed to export PurchaseInvoiceItem");

    // Sales
    Customer::export().expect("Failed to export Customer");
    SalesInvoice::export().expect("Failed to export SalesInvoice");
    SalesInvoiceItem::export().expect("Failed to export SalesInvoiceItem");

    // Locations / expenses / transfers
    Location::export().expect("Failed to export Location");
    ExpenseCategory::export().expect("Failed to export ExpenseCategory");
    Expense::export().expect("Failed to export Expense");
    StockTransfer::export().expect("Failed to export StockTransfer");
    StockTransferItem::export().expect("Failed to export StockTransferItem");

    // Sync + audit
    SyncLog::export().expect("Failed to export SyncLog");
    ActivityLog::export().expect("Failed to export ActivityLog");

    // Pricing
    PriceList::export().expect("Failed to export PriceList");
    PriceListItem::export().expect("Failed to export PriceListItem");

    // Period / opening balances
    OpeningStock::export().expect("Failed to export OpeningStock");
    FinancialYear::export().expect("Failed to export FinancialYear");

    // Sales-adjacent flows
    HoldBill::export().expect("Failed to export HoldBill");
    Quotation::export().expect("Failed to export Quotation");
    Layaway::export().expect("Failed to export Layaway");

    // Auth / API surface
    LoginRequest::export().expect("Failed to export LoginRequest");
    LoginResponse::export().expect("Failed to export LoginResponse");
    Claims::export().expect("Failed to export Claims");

    // Generic wrappers — ts-rs emits them as generic TS interfaces.
    PaginatedResponse::<User>::export().expect("Failed to export PaginatedResponse<User>");
    ApiResponse::<User>::export().expect("Failed to export ApiResponse<User>");
}
