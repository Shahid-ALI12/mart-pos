// commands/sales.rs - Sales invoices (POS billing)
//
// This module implements the core POS checkout flow as a single ACID
// transaction. `create_sales_invoice` is the only command implemented in
// step 5; the other commands (list/get/return/hold/quote/layaway) remain
// stubs for now and will be filled in by later steps.
//
// Flow (all inside one transaction):
//   1. Resolve user_id from token (fallback to admin id=1 if token absent
//      — backward-compat for the frontend, which currently doesn't pass one).
//   2. Validate inputs (non-empty items, valid payment_mode).
//   3. Compute totals from per-item figures the frontend already calculated:
//      subtotal = SUM(line_total)
//      taxable_amount = subtotal - invoice_discount
//      total_gst      = SUM(cgst + sgst + igst)
//      grand_total    = (taxable_amount + total_gst).round()
//      round_off      = grand_total - raw_total  (signed, can be ±)
//   4. Generate invoice_number from settings (invoice_prefix + zero-padded series).
//   5. Atomically increment invoice_series inside the same tx (no gaps on rollback).
//   6. INSERT sales_invoices row (status='completed').
//   7. For each line item:
//        a. INSERT sales_invoice_items row.
//        b. Locate matching stock row with NULL-safe equality (SQLite `IS`).
//           - If found: UPDATE quantity = quantity - ?.
//           - If not found: INSERT a fresh stock row with quantity = -?
//             (negative stock is allowed; stock_movements audit will show why).
//        c. INSERT stock_movements (movement_type='sale', reference_type='sales_invoice',
//           reference_id=invoice_id, quantity=-qty).
//   8. If customer_id is Some:
//        - loyalty_points += floor(grand_total * 0.01)  (per settings default 0.01/₹)
//        - if payment_mode == 'credit': current_credit += grand_total
//   9. COMMIT.
//  10. Return { id, invoice_number, grand_total } to the frontend.
//
// If ANY step fails, the transaction is dropped (=> rolled back) by `?`,
// so stock cannot be deducted without a corresponding invoice, and vice versa.

use crate::commands::auth::verify_token;
use crate::commands::common::{db_err, pool};
use crate::database::models::ApiResponse;
use crate::database::DbState;
use serde::{Deserialize, Serialize};
use tauri::command;
use tauri::{AppHandle, State};

/// Per-line-item input. Field names are snake_case; Tauri auto-converts the
/// frontend's camelCase keys (productId → product_id, etc.).
#[derive(Debug, Clone, Deserialize)]
pub struct SalesItemInput {
    pub product_id: i64,
    pub variant_id: Option<i64>,
    pub unit_id: i64,
    pub qty: f64,
    pub free_qty: Option<f64>,
    pub unit_price: f64,
    pub discount_percent: Option<f64>,
    pub discount_amount: Option<f64>,
    pub gst_rate: f64,
    pub cgst_amount: Option<f64>,
    pub sgst_amount: Option<f64>,
    pub igst_amount: Option<f64>,
    pub line_total: f64,
    pub cost_price: f64,
    pub batch_number: Option<String>,
    /// ISO date string "YYYY-MM-DD" — stored as TEXT in the DB column (DATE).
    pub expiry_date: Option<String>,
}

/// Result returned to the frontend after a successful sale.
/// Frontend reads `result.invoiceNumber` and `result.id` (camelCase via Tauri).
#[derive(Debug, Clone, Serialize)]
pub struct CreateSalesInvoiceResult {
    pub id: i64,
    pub invoice_number: String,
    pub grand_total: f64,
}

// ----------------------------------------------------------------------------
// create_sales_invoice — the only real implementation in this module for step 5
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn create_sales_invoice(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    counter_id: i64,
    customer_id: Option<i64>,
    items: Vec<SalesItemInput>,
    payment_mode: String,
    payment_details: Option<String>,
    discount_amount: Option<f64>,
    discount_percent: Option<f64>,
    notes: Option<String>,
    /// Optional JWT — if provided, the user_id is taken from its claims.
    /// If absent, defaults to admin (id=1) for backward compatibility with
    /// the frontend's current call site. Step 6+ will start passing the token.
    token: Option<String>,
) -> Result<CreateSalesInvoiceResult, String> {
    let pool = pool(&db_state)?;

    if items.is_empty() {
        return Err("Cannot create an invoice with no items".to_string());
    }

    // Validate payment_mode against the CHECK constraint on the column.
    let pm = payment_mode.as_str();
    if !matches!(pm, "cash" | "card" | "upi" | "credit" | "mixed") {
        return Err(format!("Invalid payment_mode: {}", pm));
    }

    // Resolve the acting user. Token is optional for now — see docstring.
    let user_id: i64 = match token.as_deref() {
        Some(t) if !t.is_empty() => verify_token(&pool, t).await?.sub,
        _ => 1,
    };

    // ---- Compute invoice-level totals from per-item figures ----
    let subtotal: f64 = items.iter().map(|i| i.line_total).sum();
    let disc_amt = discount_amount.unwrap_or(0.0);
    let disc_pct = discount_percent.unwrap_or_else(|| {
        if subtotal > 0.0 {
            (disc_amt / subtotal) * 100.0
        } else {
            0.0
        }
    });
    let taxable_amount = (subtotal - disc_amt).max(0.0);
    let cgst_total: f64 = items.iter().map(|i| i.cgst_amount.unwrap_or(0.0)).sum();
    let sgst_total: f64 = items.iter().map(|i| i.sgst_amount.unwrap_or(0.0)).sum();
    let igst_total: f64 = items.iter().map(|i| i.igst_amount.unwrap_or(0.0)).sum();
    let total_gst = cgst_total + sgst_total + igst_total;
    let raw_grand = taxable_amount + total_gst;
    let grand_total = raw_grand.round();
    let round_off = grand_total - raw_grand;

    // For cash/card/upi/mixed we treat the sale as fully paid at the counter;
    // change computation is the frontend's responsibility. For credit sales
    // the customer owes the full amount (paid_amount = 0).
    let paid_amount = if pm == "credit" { 0.0 } else { grand_total };
    let change_amount = 0.0_f64;

    // ---- Begin transaction ----
    let mut tx = pool.begin().await.map_err(|e| format!("begin tx: {}", e))?;

    // ---- Generate invoice number from settings ----
    // settings stores values as JSON strings: '"INV"' for text, '1' for numbers.
    let prefix_raw: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'invoice_prefix'")
        .fetch_one(&mut *tx)
        .await
        .map_err(db_err)?;
    let prefix: String = serde_json::from_str::<String>(&prefix_raw)
        .unwrap_or_else(|_| prefix_raw.trim_matches('"').to_string());

    let series_raw: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'invoice_series'")
        .fetch_one(&mut *tx)
        .await
        .map_err(db_err)?;
    // `invoice_series` is stored as a JSON number (e.g. the text "1").
    // serde_json parses that directly into i64. If for any reason the stored
    // value is wrapped in quotes (legacy "1"), we fall back to a plain int parse.
    let series: i64 = match serde_json::from_str::<i64>(&series_raw) {
        Ok(n) => n,
        Err(_) => series_raw
            .trim_matches('"')
            .parse::<i64>()
            .map_err(|e| format!("parse invoice_series '{}': {}", series_raw, e))?,
    };

    let invoice_number = format!("{}-{:06}", prefix, series);

    // Increment series atomically (inside tx → rolls back if anything later fails).
    let next_series = series + 1;
    let next_series_json =
        serde_json::to_string(&next_series).unwrap_or_else(|_| next_series.to_string());
    sqlx::query("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'invoice_series'")
        .bind(&next_series_json)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;

    // ---- Insert the sales_invoice header ----
    let invoice_result = sqlx::query(
        r#"INSERT INTO sales_invoices
           (invoice_number, counter_id, customer_id, user_id, invoice_date,
            subtotal, discount_amount, discount_percent, taxable_amount,
            cgst_amount, sgst_amount, igst_amount, total_gst,
            round_off, grand_total, paid_amount, change_amount,
            payment_mode, payment_details, status,
            loyalty_points_earned, loyalty_points_redeemed, notes,
            synced, sync_version, created_at, updated_at)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP,
                   ?, ?, ?, ?,
                   ?, ?, ?, ?,
                   ?, ?, ?, ?,
                   ?, ?, 'completed',
                   0, 0, ?,
                   0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
    )
    .bind(&invoice_number)
    .bind(counter_id)
    .bind(customer_id)
    .bind(user_id)
    .bind(subtotal)
    .bind(disc_amt)
    .bind(disc_pct)
    .bind(taxable_amount)
    .bind(cgst_total)
    .bind(sgst_total)
    .bind(igst_total)
    .bind(total_gst)
    .bind(round_off)
    .bind(grand_total)
    .bind(paid_amount)
    .bind(change_amount)
    .bind(pm)
    .bind(payment_details.as_deref())
    .bind(notes.as_deref())
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("insert sales_invoice: {}", e))?;

    let invoice_id: i64 = invoice_result.last_insert_rowid();

    // ---- Process each line item ----
    for item in &items {
        // (a) Insert the sales_invoice_items row
        sqlx::query(
            r#"INSERT INTO sales_invoice_items
               (invoice_id, product_id, variant_id, unit_id,
                qty, free_qty, unit_price,
                discount_percent, discount_amount,
                gst_rate, cgst_amount, sgst_amount, igst_amount,
                line_total, cost_price,
                batch_number, expiry_date, serial_numbers)
               VALUES (?, ?, ?, ?,
                       ?, ?, ?,
                       ?, ?,
                       ?, ?, ?, ?,
                       ?, ?,
                       ?, ?, ?)"#,
        )
        .bind(invoice_id)
        .bind(item.product_id)
        .bind(item.variant_id)
        .bind(item.unit_id)
        .bind(item.qty)
        .bind(item.free_qty.unwrap_or(0.0))
        .bind(item.unit_price)
        .bind(item.discount_percent.unwrap_or(0.0))
        .bind(item.discount_amount.unwrap_or(0.0))
        .bind(item.gst_rate)
        .bind(item.cgst_amount.unwrap_or(0.0))
        .bind(item.sgst_amount.unwrap_or(0.0))
        .bind(item.igst_amount.unwrap_or(0.0))
        .bind(item.line_total)
        .bind(item.cost_price)
        .bind(item.batch_number.as_deref())
        .bind(item.expiry_date.as_deref())
        .bind(None::<String>) // serial_numbers — TODO when serialized items land
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("insert sales_invoice_item: {}", e))?;

        // (b) Find the matching stock row using NULL-safe equality.
        // SQLite's `IS` operator treats NULL = NULL as TRUE (unlike `=`),
        // which is exactly what we need for the optional variant_id / batch_number
        // / expiry_date columns of the UNIQUE key.
        let existing_stock_id: Option<i64> = sqlx::query_scalar(
            r#"SELECT id FROM stock
               WHERE product_id = ?
                 AND location_id = ?
                 AND variant_id IS ?
                 AND batch_number IS ?
                 AND expiry_date IS ?
                 AND serial_number IS NULL
               LIMIT 1"#,
        )
        .bind(item.product_id)
        .bind(counter_id)
        .bind(item.variant_id)
        .bind(item.batch_number.as_deref())
        .bind(item.expiry_date.as_deref())
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| format!("select stock: {}", e))?;

        match existing_stock_id {
            Some(stock_id) => {
                // Decrement the existing row.
                sqlx::query(
                    "UPDATE stock SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?",
                )
                .bind(item.qty)
                .bind(stock_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("update stock: {}", e))?;
            }
            None => {
                // No matching row — create one with negative quantity.
                // The stock_movements audit trail below explains why.
                sqlx::query(
                    r#"INSERT INTO stock
                       (product_id, location_id, variant_id, batch_number, expiry_date,
                        serial_number, quantity, reserved_qty, unit_cost, last_updated)
                       VALUES (?, ?, ?, ?, ?, NULL, ?, 0, ?, CURRENT_TIMESTAMP)"#,
                )
                .bind(item.product_id)
                .bind(counter_id)
                .bind(item.variant_id)
                .bind(item.batch_number.as_deref())
                .bind(item.expiry_date.as_deref())
                .bind(-item.qty) // new row starts negative
                .bind(item.cost_price)
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("insert stock: {}", e))?;
            }
        }

        // (c) Audit row — stock_movements.
        sqlx::query(
            r#"INSERT INTO stock_movements
               (product_id, location_id, variant_id, batch_number, expiry_date,
                serial_number, movement_type, reference_type, reference_id,
                quantity, unit_cost, unit_price, notes, user_id, created_at)
               VALUES (?, ?, ?, ?, ?, NULL, 'sale', 'sales_invoice', ?,
                       ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"#,
        )
        .bind(item.product_id)
        .bind(counter_id)
        .bind(item.variant_id)
        .bind(item.batch_number.as_deref())
        .bind(item.expiry_date.as_deref())
        .bind(invoice_id)
        .bind(-item.qty)
        .bind(item.cost_price)
        .bind(item.unit_price)
        .bind(notes.as_deref())
        .bind(user_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("insert stock_movement: {}", e))?;
    }

    // ---- Customer-side bookkeeping ----
    if let Some(cid) = customer_id {
        // Loyalty points earned (1 point per ₹100 by default, since
        // loyalty_points_per_rupee = 0.01).
        let earned = (grand_total * 0.01).floor() as i64;
        if earned > 0 {
            sqlx::query(
                "UPDATE customers SET loyalty_points = loyalty_points + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            )
            .bind(earned)
            .bind(cid)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("update customer loyalty_points: {}", e))?;

            // Reflect the earned points on the invoice row too.
            sqlx::query(
                "UPDATE sales_invoices SET loyalty_points_earned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            )
            .bind(earned)
            .bind(invoice_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("update sales_invoice loyalty_points_earned: {}", e))?;
        }

        // Credit sale: customer owes the full amount.
        if pm == "credit" {
            let owe = grand_total - paid_amount; // = grand_total for credit
            sqlx::query(
                "UPDATE customers SET current_credit = current_credit + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            )
            .bind(owe)
            .bind(cid)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("update customer current_credit: {}", e))?;
        }
    }

    // ---- Commit ----
    tx.commit().await.map_err(|e| format!("commit: {}", e))?;

    Ok(CreateSalesInvoiceResult {
        id: invoice_id,
        invoice_number,
        grand_total,
    })
}

// ----------------------------------------------------------------------------
// Stubs — these remain no-ops for step 5. They'll be implemented in later steps.
// ----------------------------------------------------------------------------

#[command]
pub async fn list_sales_invoices() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn get_sales_invoice() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn update_sales_invoice() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn void_sales_invoice() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn list_si_items() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn hold_bill() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn get_held_bills() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn resume_held_bill() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn list_sales_returns() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn create_sales_return() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn list_customer_payments() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn create_customer_payment() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn list_quotations() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn create_quotation() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn convert_quotation() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn list_layaways() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn create_layaway() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[command]
pub async fn make_layaway_payment() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
