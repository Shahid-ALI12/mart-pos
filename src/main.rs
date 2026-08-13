// main.rs - Tauri application entry point
//
// This is a thin binary wrapper around the `mart_pos` library crate (see
// `src/lib.rs`). All real logic lives in the library so that integration
// tests under `tests/` can import the same code paths. The Tauri command
// handler list and the `.setup()` hook remain here because they need the
// `tauri::generate_handler!` / `tauri::generate_context!` macros, which
// only work inside the binary crate.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tracing::{info, error};

// Pull modules from the library crate.
use mart_pos::database::{Database, DbState};
use mart_pos::commands::*;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tauri=warn,sqlx=warn".into())
        )
        .init();

    info!("Starting Mart POS application");

    // Migrations are now owned by the backend (sqlx::migrate!) — see database/mod.rs.
    // tauri-plugin-sql is kept as a passthrough plugin for any future frontend
    // direct DB access, but it no longer preloads or auto-migrates the DB.
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        // .plugin(tauri_plugin_global_shortcut::Builder::new()
        //     .with_shortcuts(["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12"])
        //     .build()?)
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        // .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DbState::default())
        .invoke_handler(tauri::generate_handler![
            // Auth commands
            auth::login,
            auth::logout,
            auth::get_current_user,
            auth::change_password,
            // User management
            users::list_users,
            users::create_user,
            users::update_user,
            users::delete_user,
            users::get_roles,
            // Settings
            settings::get_settings,
            settings::update_setting,
            // Categories
            categories::list_categories,
            categories::create_category,
            categories::update_category,
            categories::delete_category,
            // Brands
            brands::list_brands,
            brands::create_brand,
            brands::update_brand,
            brands::delete_brand,
            // Units
            units::list_units,
            units::create_unit,
            units::update_unit,
            units::delete_unit,
            // Products
            products::list_products,
            products::get_product,
            products::create_product,
            products::update_product,
            products::delete_product,
            products::search_products,
            products::get_low_stock,
            // Product variants
            variants::list_variants,
            variants::create_variant,
            variants::update_variant,
            variants::delete_variant,
            // Unit conversions
            conversions::list_conversions,
            conversions::create_conversion,
            conversions::update_conversion,
            conversions::delete_conversion,
            // Stock
            stock::get_stock,
            stock::get_stock_by_location,
            stock::adjust_stock,
            stock::transfer_stock,
            stock::get_stock_movements,
            // Suppliers
            suppliers::list_suppliers,
            suppliers::get_supplier,
            suppliers::create_supplier,
            suppliers::update_supplier,
            suppliers::delete_supplier,
            // Purchase orders
            purchases::list_purchase_orders,
            purchases::get_purchase_order,
            purchases::create_purchase_order,
            purchases::update_purchase_order,
            purchases::delete_purchase_order,
            purchases::list_po_items,
            // Purchase invoices (GRN)
            purchases::list_purchase_invoices,
            purchases::get_purchase_invoice,
            purchases::create_purchase_invoice,
            purchases::update_purchase_invoice,
            purchases::list_pi_items,
            // Purchase returns
            purchases::list_purchase_returns,
            purchases::create_purchase_return,
            // Supplier payments
            purchases::list_supplier_payments,
            purchases::create_supplier_payment,
            // Customers
            customers::list_customers,
            customers::get_customer,
            customers::create_customer,
            customers::update_customer,
            customers::delete_customer,
            customers::search_customers,
            // Sales invoices (POS)
            sales::list_sales_invoices,
            sales::get_sales_invoice,
            sales::create_sales_invoice,
            sales::update_sales_invoice,
            sales::void_sales_invoice,
            sales::list_si_items,
            sales::hold_bill,
            sales::get_held_bills,
            sales::resume_held_bill,
            // Sales returns
            sales::list_sales_returns,
            sales::create_sales_return,
            // Customer payments
            sales::list_customer_payments,
            sales::create_customer_payment,
            // Quotations
            sales::list_quotations,
            sales::create_quotation,
            sales::convert_quotation,
            // Layaways
            sales::list_layaways,
            sales::create_layaway,
            sales::make_layaway_payment,
            // Expenses
            expenses::list_expenses,
            expenses::create_expense,
            expenses::update_expense,
            expenses::delete_expense,
            expenses::list_expense_categories,
            // Stock transfers
            transfers::list_stock_transfers,
            transfers::create_stock_transfer,
            transfers::update_stock_transfer,
            transfers::receive_stock_transfer,
            // Reports
            reports::get_sales_report,
            reports::get_profit_loss_report,
            reports::get_stock_report,
            reports::get_gst_report,
            reports::get_counter_performance,
            reports::get_top_products,
            reports::get_slow_moving_products,
            reports::get_customer_outstanding,
            reports::get_supplier_outstanding,
            // Sync
            sync::get_sync_status,
            sync::trigger_sync,
            sync::get_pending_changes,
            // Hardware
            hardware::list_printers,
            hardware::print_receipt,
            hardware::open_cash_drawer,
            hardware::list_scanners,
            hardware::list_scales,
            hardware::read_scale,
            hardware::list_pole_displays,
            hardware::write_pole_display,
            // Backup/Restore
            backup::create_backup,
            backup::restore_backup,
            backup::list_backups,
        ])
        .setup(|app| {
            // Initialize database connection synchronously
            let app_handle = app.handle().clone();
            let db_state = app.state::<DbState>().inner().clone();
            
            // Initialize database synchronously
            let rt = tokio::runtime::Runtime::new().unwrap();
            let init_result: Result<(), anyhow::Error> = rt.block_on(async {
                if let Err(e) = Database::initialize(&app_handle, &db_state).await {
                    error!("Failed to initialize database: {}", e);
                } else {
                    info!("Database initialized successfully");
                }
                Ok(())
            });
            let _ = init_result;
            
                        // Set up global shortcuts for POS
            // TODO: Implement global shortcuts when plugin API is confirmed
            // let app_handle = app.handle().clone();
            // app.global_shortcut().on_shortcut("f1", move |_| {
            //     // F1 - Payment screen
            //     let _ = app_handle.emit("global-shortcut", "f1");
            // });
            // 
            // let app_handle = app.handle().clone();
            // app.global_shortcut().on_shortcut("f2", move |_| {
            //     // F2 - Hold bill
            //     let _ = app_handle.emit("global-shortcut", "f2");
            // });
            // 
            // let app_handle = app.handle().clone();
            // app.global_shortcut().on_shortcut("f3", move |_| {
            //     // F3 - Customer search
            //     let _ = app_handle.emit("global-shortcut", "f3");
            // });
            // 
            // let app_handle = app.handle().clone();
            // app.global_shortcut().on_shortcut("f4", move |_| {
            //     // F4 - Return mode
            //     let _ = app_handle.emit("global-shortcut", "f4");
            // });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    
    Ok(())
}