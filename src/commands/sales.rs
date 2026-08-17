// commands/sales.rs - Sales invoices (POS billing)
//
// Implemented:
//   - create_sales_invoice  (ACID checkout, stock decrement, GST, loyalty, credit)
//   - list_sales_invoices    (paginated, optional date/status/customer filter)
//   - get_sales_invoice       (header + line items)
//   - hold_bill / get_held_bills / resume_held_bill
//
// Stubs (not yet needed):
//   update_sales_invoice, void_sales_invoice, list_si_items (covered by get),
//   sales returns, customer payments, quotations, layaways.

use crate::commands::auth::verify_token;
use crate::commands::common::{db_err, pool, ListResponse};
use crate::database::models::{
    ApiResponse, SalesInvoice, SalesInvoiceItem, HoldBill,
};
use crate::database::DbState;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tauri::{AppHandle, State};

/// Per-line-item input. camelCase keys arrive as snake_case via Tauri.
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
    pub expiry_date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateSalesInvoiceResult {
    pub id: i64,
    pub invoice_number: String,
    pub grand_total: f64,
}

// ----------------------------------------------------------------------------
// create_sales_invoice
// ----------------------------------------------------------------------------

#[tauri::command]
#[allow(clippy::too_many_arguments)]
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
    token: Option<String>,
) -> Result<CreateSalesInvoiceResult, String> {
    let pool = pool(&db_state)?;

    if items.is_empty() {
        return Err("Cannot create an invoice with no items".to_string());
    }

    let pm = payment_mode.as_str();
    if !matches!(pm, "cash" | "card" | "upi" | "credit" | "mixed") {
        return Err(format!("Invalid payment_mode: {}", pm));
    }

    let user_id: i64 = match token.as_deref() {
        Some(t) if !t.is_empty() => verify_token(&pool, t).await?.sub,
        _ => 1,
    };

    let subtotal: f64 = items.iter().map(|i| i.line_total).sum();
    let disc_amt = discount_amount.unwrap_or(0.0);
    let disc_pct = discount_percent.unwrap_or_else(|| {
        if subtotal > 0.0 { (disc_amt / subtotal) * 100.0 } else { 0.0 }
    });
    let taxable_amount = (subtotal - disc_amt).max(0.0);
    let cgst_total: f64 = items.iter().map(|i| i.cgst_amount.unwrap_or(0.0)).sum();
    let sgst_total: f64 = items.iter().map(|i| i.sgst_amount.unwrap_or(0.0)).sum();
    let igst_total: f64 = items.iter().map(|i| i.igst_amount.unwrap_or(0.0)).sum();
    let total_gst = cgst_total + sgst_total + igst_total;
    let raw_grand = taxable_amount + total_gst;
    let grand_total = raw_grand.round();
    let round_off = grand_total - raw_grand;

    let paid_amount = if pm == "credit" { 0.0 } else { grand_total };
    let change_amount = 0.0_f64;

    let mut tx = pool.begin().await.map_err(|e| format!("begin tx: {}", e))?;

    // invoice number from settings
    let prefix_raw: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'invoice_prefix'")
        .fetch_one(&mut *tx).await.map_err(db_err)?;
    let prefix: String = serde_json::from_str::<String>(&prefix_raw)
        .unwrap_or_else(|_| prefix_raw.trim_matches('"').to_string());

    let series_raw: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'invoice_series'")
        .fetch_one(&mut *tx).await.map_err(db_err)?;
    let series: i64 = match serde_json::from_str::<i64>(&series_raw) {
        Ok(n) => n,
        Err(_) => series_raw.trim_matches('"').parse::<i64>()
            .map_err(|e| format!("parse invoice_series '{}': {}", series_raw, e))?,
    };

    let invoice_number = format!("{}-{:06}", prefix, series);

    let next_series = series + 1;
    let next_series_json = serde_json::to_string(&next_series).unwrap_or_else(|_| next_series.to_string());
    sqlx::query("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'invoice_series'")
        .bind(&next_series_json)
        .execute(&mut *tx).await.map_err(db_err)?;

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
                   ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                   ?, ?, 'completed', 0, 0, ?, 0, 1,
                   CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
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
    .execute(&mut *tx).await
    .map_err(|e| format!("insert sales_invoice: {}", e))?;

    let invoice_id: i64 = invoice_result.last_insert_rowid();

    for item in &items {
        sqlx::query(
            r#"INSERT INTO sales_invoice_items
               (invoice_id, product_id, variant_id, unit_id,
                qty, free_qty, unit_price,
                discount_percent, discount_amount,
                gst_rate, cgst_amount, sgst_amount, igst_amount,
                line_total, cost_price,
                batch_number, expiry_date, serial_numbers)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
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
        .bind(None::<String>)
        .execute(&mut *tx).await
        .map_err(|e| format!("insert sales_invoice_item: {}", e))?;

        let existing_stock_id: Option<i64> = sqlx::query_scalar(
            r#"SELECT id FROM stock
               WHERE product_id = ? AND location_id = ?
                 AND variant_id IS ? AND batch_number IS ?
                 AND expiry_date IS ? AND serial_number IS NULL
               LIMIT 1"#,
        )
        .bind(item.product_id)
        .bind(counter_id)
        .bind(item.variant_id)
        .bind(item.batch_number.as_deref())
        .bind(item.expiry_date.as_deref())
        .fetch_optional(&mut *tx).await
        .map_err(|e| format!("select stock: {}", e))?;

        match existing_stock_id {
            Some(stock_id) => {
                sqlx::query("UPDATE stock SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?")
                    .bind(item.qty).bind(stock_id)
                    .execute(&mut *tx).await
                    .map_err(|e| format!("update stock: {}", e))?;
            }
            None => {
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
                .bind(-item.qty)
                .bind(item.cost_price)
                .execute(&mut *tx).await
                .map_err(|e| format!("insert stock: {}", e))?;
            }
        }

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
        .execute(&mut *tx).await
        .map_err(|e| format!("insert stock_movement: {}", e))?;
    }

    if let Some(cid) = customer_id {
        let earned = (grand_total * 0.01).floor() as i64;
        if earned > 0 {
            sqlx::query("UPDATE customers SET loyalty_points = loyalty_points + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(earned).bind(cid)
                .execute(&mut *tx).await
                .map_err(|e| format!("update customer loyalty_points: {}", e))?;
            sqlx::query("UPDATE sales_invoices SET loyalty_points_earned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(earned).bind(invoice_id)
                .execute(&mut *tx).await
                .map_err(|e| format!("update sales_invoice loyalty_points_earned: {}", e))?;
        }
        if pm == "credit" {
            let owe = grand_total - paid_amount;
            sqlx::query("UPDATE customers SET current_credit = current_credit + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(owe).bind(cid)
                .execute(&mut *tx).await
                .map_err(|e| format!("update customer current_credit: {}", e))?;
        }
    }

    tx.commit().await.map_err(|e| format!("commit: {}", e))?;

    Ok(CreateSalesInvoiceResult { id: invoice_id, invoice_number, grand_total })
}

// ----------------------------------------------------------------------------
// list_sales_invoices — paginated with optional filters
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn list_sales_invoices(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    query: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
    status: Option<String>,
    customer_id: Option<i64>,
    from_date: Option<String>,  // YYYY-MM-DD
    to_date: Option<String>,    // YYYY-MM-DD
) -> Result<ListResponse<SalesInvoice>, String> {
    let pool = pool(&db_state)?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 500);
    let offset = (page - 1) * page_size;
    let q = query.unwrap_or_default().trim().to_string();
    let search_pattern = if q.is_empty() { "%".to_string() } else { format!("%{}%", q) };
    let status_filter = status.unwrap_or_default();

    // ponytail: two queries (count + page) — simpler than window functions across SQLite versions
    let count_sql = r#"SELECT COUNT(*) FROM sales_invoices
                       WHERE (invoice_number LIKE ? OR ? = '')
                         AND (status = ? OR ? = '')
                         AND (customer_id = ? OR ? IS NULL)
                         AND (date(invoice_date) >= date(?) OR ? = '')
                         AND (date(invoice_date) <= date(?) OR ? = '')"#;

    let total: i64 = sqlx::query_scalar(count_sql)
        .bind(&search_pattern)
        .bind(&q)
        .bind(&status_filter)
        .bind(&status_filter)
        .bind(customer_id)
        .bind(customer_id)
        .bind(from_date.as_deref().unwrap_or(""))
        .bind(from_date.as_deref().unwrap_or(""))
        .bind(to_date.as_deref().unwrap_or(""))
        .bind(to_date.as_deref().unwrap_or(""))
        .fetch_one(&*pool).await
        .map_err(db_err)?;

    let page_sql = r#"SELECT id, invoice_number, counter_id, customer_id, user_id,
                             invoice_date, subtotal, discount_amount, discount_percent,
                             taxable_amount, cgst_amount, sgst_amount, igst_amount,
                             total_gst, round_off, grand_total, paid_amount, change_amount,
                             payment_mode, payment_details, status,
                             loyalty_points_earned, loyalty_points_redeemed, notes,
                             synced, sync_version, created_at, updated_at
                      FROM sales_invoices
                      WHERE (invoice_number LIKE ? OR ? = '')
                        AND (status = ? OR ? = '')
                        AND (customer_id = ? OR ? IS NULL)
                        AND (date(invoice_date) >= date(?) OR ? = '')
                        AND (date(invoice_date) <= date(?) OR ? = '')
                      ORDER BY invoice_date DESC, id DESC
                      LIMIT ? OFFSET ?"#;

    let rows = sqlx::query_as::<_, SalesInvoice>(page_sql)
        .bind(&search_pattern).bind(&q)
        .bind(&status_filter).bind(&status_filter)
        .bind(customer_id).bind(customer_id)
        .bind(from_date.as_deref().unwrap_or("")).bind(from_date.as_deref().unwrap_or(""))
        .bind(to_date.as_deref().unwrap_or("")).bind(to_date.as_deref().unwrap_or(""))
        .bind(page_size).bind(offset)
        .fetch_all(&*pool).await
        .map_err(db_err)?;

    Ok(ListResponse::new(rows, total, page, page_size))
}

// ----------------------------------------------------------------------------
// get_sales_invoice — header + line items in one round-trip
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct SalesInvoiceWithItems {
    #[serde(flatten)]
    pub invoice: SalesInvoice,
    pub items: Vec<SalesInvoiceItem>,
}

#[tauri::command]
pub async fn get_sales_invoice(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
) -> Result<SalesInvoiceWithItems, String> {
    let pool = pool(&db_state)?;

    let invoice = sqlx::query_as::<_, SalesInvoice>(
        r#"SELECT id, invoice_number, counter_id, customer_id, user_id,
                  invoice_date, subtotal, discount_amount, discount_percent,
                  taxable_amount, cgst_amount, sgst_amount, igst_amount,
                  total_gst, round_off, grand_total, paid_amount, change_amount,
                  payment_mode, payment_details, status,
                  loyalty_points_earned, loyalty_points_redeemed, notes,
                  synced, sync_version, created_at, updated_at
           FROM sales_invoices WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(&*pool).await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => format!("Invoice {} not found", id),
        other => db_err(other),
    })?;

    let items = sqlx::query_as::<_, SalesInvoiceItem>(
        r#"SELECT id, invoice_id, product_id, variant_id, unit_id,
                  qty, free_qty, unit_price, discount_percent, discount_amount,
                  gst_rate, cgst_amount, sgst_amount, igst_amount,
                  line_total, cost_price, batch_number, expiry_date, serial_numbers
           FROM sales_invoice_items WHERE invoice_id = ?
           ORDER BY id"#,
    )
    .bind(id)
    .fetch_all(&*pool).await
    .map_err(db_err)?;

    Ok(SalesInvoiceWithItems { invoice, items })
}

// ----------------------------------------------------------------------------
// hold_bill / get_held_bills / resume_held_bill
// ----------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct HoldBillInput {
    pub counter_id: i64,
    pub customer_id: Option<i64>,
    pub cart_data: String,  // JSON blob from frontend useCart
    pub subtotal: f64,
    pub discount_amount: Option<f64>,
    pub tax_amount: Option<f64>,
    pub grand_total: f64,
    pub token: Option<String>,
}

#[tauri::command]
pub async fn hold_bill(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: HoldBillInput,
) -> Result<HoldBill, String> {
    let pool = pool(&db_state)?;

    let user_id: i64 = match input.token.as_deref() {
        Some(t) if !t.is_empty() => verify_token(&pool, t).await?.sub,
        _ => 1,
    };

    // Generate hold number from settings series
    let raw: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'hold_series'")
        .fetch_one(&*pool).await
        .map_err(|e| format!("hold_series not found: {}", e))?;
    let series: i64 = serde_json::from_str::<i64>(&raw)
        .unwrap_or_else(|_| raw.trim_matches('"').parse().unwrap_or(1));
    let hold_number = format!("HOLD-{:04}", series);

    sqlx::query("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'hold_series'")
        .bind(serde_json::to_string(&(series + 1)).unwrap_or_else(|_| (series + 1).to_string()))
        .execute(&*pool).await.map_err(db_err)?;

    let disc = input.discount_amount.unwrap_or(0.0);
    let tax = input.tax_amount.unwrap_or(0.0);

    sqlx::query(
        r#"INSERT INTO hold_bills
           (hold_number, counter_id, user_id, customer_id, cart_data,
            subtotal, discount_amount, tax_amount, grand_total,
            created_at, resumed_at, resumed_by, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
                   CURRENT_TIMESTAMP, NULL, NULL, 'held')"#,
    )
    .bind(&hold_number)
    .bind(input.counter_id)
    .bind(user_id)
    .bind(input.customer_id)
    .bind(&input.cart_data)
    .bind(input.subtotal)
    .bind(disc)
    .bind(tax)
    .bind(input.grand_total)
    .execute(&*pool).await
    .map_err(|e| format!("insert hold_bill: {}", e))?;

    let id: i64 = sqlx::query_scalar("SELECT last_insert_rowid()")
        .fetch_one(&*pool).await.map_err(db_err)?;

    fetch_held_bill(&pool, id).await
}

#[tauri::command]
pub async fn get_held_bills(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    counter_id: Option<i64>,
) -> Result<Vec<HoldBill>, String> {
    let pool = pool(&db_state)?;

    let rows = sqlx::query_as::<_, HoldBill>(
        r#"SELECT id, hold_number, counter_id, user_id, customer_id,
                  cart_data, subtotal, discount_amount, tax_amount, grand_total,
                  created_at, resumed_at, resumed_by, status
           FROM hold_bills
           WHERE status = 'held' AND (counter_id = ? OR ? IS NULL)
           ORDER BY created_at DESC"#,
    )
    .bind(counter_id)
    .bind(counter_id)
    .fetch_all(&*pool).await
    .map_err(db_err)?;

    Ok(rows)
}

#[derive(Debug, Clone, Deserialize)]
pub struct ResumeHoldInput {
    pub id: i64,
    pub token: Option<String>,
}

#[tauri::command]
pub async fn resume_held_bill(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: ResumeHoldInput,
) -> Result<HoldBill, String> {
    let pool = pool(&db_state)?;

    let user_id: i64 = match input.token.as_deref() {
        Some(t) if !t.is_empty() => verify_token(&pool, t).await?.sub,
        _ => 1,
    };

    let res = sqlx::query(
        "UPDATE hold_bills SET status = 'resumed', resumed_at = CURRENT_TIMESTAMP, resumed_by = ? WHERE id = ? AND status = 'held'",
    )
    .bind(user_id)
    .bind(input.id)
    .execute(&*pool).await
    .map_err(db_err)?;

    if res.rows_affected() == 0 {
        return Err("Held bill not found or already resumed".to_string());
    }

    fetch_held_bill(&pool, input.id).await
}

async fn fetch_held_bill(pool: &crate::database::DbPool, id: i64) -> Result<HoldBill, String> {
    sqlx::query_as::<_, HoldBill>(
        r#"SELECT id, hold_number, counter_id, user_id, customer_id,
                  cart_data, subtotal, discount_amount, tax_amount, grand_total,
                  created_at, resumed_at, resumed_by, status
           FROM hold_bills WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(&**pool).await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Held bill not found".to_string(),
        other => db_err(other),
    })
}

// ----------------------------------------------------------------------------
// Stubs — remain no-ops; implement when the UI for these lands.
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn update_sales_invoice() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::message("Invoice editing not yet supported — void and re-create instead".to_string()))
}

#[tauri::command]
pub async fn void_sales_invoice(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
    token: Option<String>,
) -> Result<String, String> {
    let pool = pool(&db_state)?;

    let user_id: i64 = match token.as_deref() {
        Some(t) if !t.is_empty() => verify_token(&pool, t).await?.sub,
        _ => 1,
    };

    let mut tx = pool.begin().await.map_err(|e| format!("begin tx: {}", e))?;

    // Mark invoice as cancelled
    let res = sqlx::query("UPDATE sales_invoices SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'completed'")
        .bind(id)
        .execute(&mut *tx).await
        .map_err(db_err)?;

    if res.rows_affected() == 0 {
        return Err("Invoice not found or not in 'completed' status".to_string());
    }

    // Reverse stock deductions for each line item.
    // ponytail: stock reversal restores qty to the counter/location bucket
    // without batch/expiry matching. Acceptable for single-batch-per-product stores;
    // do per-batch reversal if multi-batch inventory is ever used.
    let item_rows = sqlx::query(
        r#"SELECT product_id, variant_id, qty, batch_number, expiry_date
           FROM sales_invoice_items WHERE invoice_id = ?"#,
    )
    .bind(id)
    .fetch_all(&mut *tx).await
    .map_err(db_err)?;

    let counter_id: i64 = sqlx::query_scalar("SELECT counter_id FROM sales_invoices WHERE id = ?")
        .bind(id)
        .fetch_one(&mut *tx).await
        .map_err(db_err)?;

    for row in item_rows {
        let product_id: i64 = row.try_get("product_id").map_err(|_| "bad row")?;
        let variant_id: Option<i64> = row.try_get("variant_id").map_err(|_| "bad row")?;
        let qty: f64 = row.try_get("qty").map_err(|_| "bad row")?;
        let batch_number: Option<String> = row.try_get("batch_number").map_err(|_| None)?;
        let expiry_date: Option<String> = row.try_get("expiry_date").map_err(|_| None)?;

        if qty > 0.0 {
            // Restore stock — find matching row, increment
            let existing: Option<i64> = sqlx::query_scalar(
                r#"SELECT id FROM stock
                   WHERE product_id = ? AND location_id = ?
                     AND variant_id IS ? AND batch_number IS ?
                     AND expiry_date IS ? AND serial_number IS NULL
                   LIMIT 1"#,
            )
            .bind(product_id).bind(counter_id)
            .bind(variant_id)
            .bind(batch_number.as_deref())
            .bind(expiry_date.as_deref())
            .fetch_optional(&mut *tx).await
            .map_err(db_err)?;

            match existing {
                Some(sid) => {
                    sqlx::query("UPDATE stock SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?")
                        .bind(qty).bind(sid)
                        .execute(&mut *tx).await.map_err(db_err)?;
                }
                None => {
                    sqlx::query(
                        r#"INSERT INTO stock
                           (product_id, location_id, variant_id, batch_number, expiry_date,
                            serial_number, quantity, reserved_qty, unit_cost, last_updated)
                           VALUES (?, ?, ?, ?, ?, NULL, ?, 0, 0, CURRENT_TIMESTAMP)"#,
                    )
                    .bind(product_id).bind(counter_id)
                    .bind(variant_id)
                    .bind(batch_number.as_deref())
                    .bind(expiry_date.as_deref())
                    .bind(qty)
                    .execute(&mut *tx).await.map_err(db_err)?;
                }
            }

            // Audit the reversal
            sqlx::query(
                r#"INSERT INTO stock_movements
                   (product_id, location_id, variant_id, batch_number, expiry_date,
                    serial_number, movement_type, reference_type, reference_id,
                    quantity, unit_cost, unit_price, notes, user_id, created_at)
                   VALUES (?, ?, ?, ?, ?, NULL, 'void_sale', 'sales_invoice', ?,
                           ?, NULL, NULL, 'Voided invoice', ?, CURRENT_TIMESTAMP)"#,
            )
            .bind(product_id).bind(counter_id)
            .bind(variant_id)
            .bind(batch_number.as_deref())
            .bind(expiry_date.as_deref())
            .bind(id)
            .bind(qty)
            .bind(user_id)
            .execute(&mut *tx).await.map_err(db_err)?;
        }
    }

    tx.commit().await.map_err(|e| format!("commit: {}", e))?;

    Ok(format!("Invoice {} voided, stock restored", id))
}

#[tauri::command]
pub async fn list_si_items(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    invoice_id: i64,
) -> Result<Vec<SalesInvoiceItem>, String> {
    let pool = pool(&db_state)?;

    let rows = sqlx::query_as::<_, SalesInvoiceItem>(
        r#"SELECT id, invoice_id, product_id, variant_id, unit_id,
                  qty, free_qty, unit_price, discount_percent, discount_amount,
                  gst_rate, cgst_amount, sgst_amount, igst_amount,
                  line_total, cost_price, batch_number, expiry_date, serial_numbers
           FROM sales_invoice_items WHERE invoice_id = ?
           ORDER BY id"#,
    )
    .bind(invoice_id)
    .fetch_all(&*pool).await
    .map_err(db_err)?;

    Ok(rows)
}

// ---- Sales returns, customer payments, quotations, layaways ----
// Stubs: implement when the corresponding frontend screens need them.

#[tauri::command]
pub async fn list_sales_returns() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[tauri::command]
pub async fn create_sales_return() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[tauri::command]
pub async fn list_customer_payments() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[tauri::command]
pub async fn create_customer_payment() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[tauri::command]
pub async fn list_quotations() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[tauri::command]
pub async fn create_quotation() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[tauri::command]
pub async fn convert_quotation() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[tauri::command]
pub async fn list_layaways() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[tauri::command]
pub async fn create_layaway() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[tauri::command]
pub async fn make_layaway_payment() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
