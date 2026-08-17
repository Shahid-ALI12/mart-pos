// commands/purchases.rs - Purchase orders, invoices (GRN), returns, supplier payments
//
// Implemented: list/get/create for purchase orders and purchase invoices
// Stubs: purchase returns, supplier payments (implement when the UI lands)

use crate::commands::common::{db_err, pool, ListResponse};
use crate::database::models::{
    ApiResponse, PurchaseOrder, PurchaseInvoice, PurchaseOrderItem, PurchaseInvoiceItem,
};
use crate::database::DbState;
use serde::Deserialize;
use tauri::{AppHandle, State};

// ---------------------------------------------------------------------------
// Purchase Orders
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn list_purchase_orders(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    query: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
    supplier_id: Option<i64>,
    status: Option<String>,
) -> Result<ListResponse<PurchaseOrder>, String> {
    let pool = pool(&db_state)?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 500);
    let offset = (page - 1) * page_size;
    let q = query.unwrap_or_default().trim().to_string();
    let pattern = if q.is_empty() { "%".to_string() } else { format!("%{}%", q) };
    let status_filter = status.unwrap_or_default();

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM purchase_orders
           WHERE (po_number LIKE ? OR ? = '')
             AND (supplier_id = ? OR ? IS NULL)
             AND (status = ? OR ? = '')"#,
    )
    .bind(&pattern).bind(&q)
    .bind(supplier_id).bind(supplier_id)
    .bind(&status_filter).bind(&status_filter)
    .fetch_one(&*pool).await.map_err(db_err)?;

    let rows = sqlx::query_as::<_, PurchaseOrder>(
        r#"SELECT id, po_number, supplier_id, location_id, status,
                  order_date, expected_date, total_amount, discount_amount,
                  discount_percent, tax_amount, round_off, grand_total,
                  paid_amount, notes, terms_conditions, created_by,
                  approved_by, approved_at, created_at, updated_at
           FROM purchase_orders
           WHERE (po_number LIKE ? OR ? = '')
             AND (supplier_id = ? OR ? IS NULL)
             AND (status = ? OR ? = '')
           ORDER BY order_date DESC, id DESC
           LIMIT ? OFFSET ?"#,
    )
    .bind(&pattern).bind(&q)
    .bind(supplier_id).bind(supplier_id)
    .bind(&status_filter).bind(&status_filter)
    .bind(page_size).bind(offset)
    .fetch_all(&*pool).await.map_err(db_err)?;

    Ok(ListResponse::new(rows, total, page, page_size))
}

#[tauri::command]
pub async fn get_purchase_order(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
) -> Result<PurchaseOrder, String> {
    let pool = pool(&db_state)?;
    sqlx::query_as::<_, PurchaseOrder>(
        r#"SELECT id, po_number, supplier_id, location_id, status,
                  order_date, expected_date, total_amount, discount_amount,
                  discount_percent, tax_amount, round_off, grand_total,
                  paid_amount, notes, terms_conditions, created_by,
                  approved_by, approved_at, created_at, updated_at
           FROM purchase_orders WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(&*pool).await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Purchase order not found".to_string(),
        other => db_err(other),
    })
}

#[derive(Deserialize)]
pub struct PoItemInput {
    pub product_id: i64,
    pub variant_id: Option<i64>,
    pub unit_id: i64,
    pub ordered_qty: f64,
    pub unit_price: f64,
    pub discount_percent: Option<f64>,
    pub gst_rate: Option<f64>,
}

#[derive(Deserialize)]
pub struct CreatePoInput {
    pub supplier_id: i64,
    pub location_id: i64,
    pub order_date: String,
    pub expected_date: Option<String>,
    pub items: Vec<PoItemInput>,
    pub discount_amount: Option<f64>,
    pub notes: Option<String>,
    pub created_by: i64,
}

#[tauri::command]
pub async fn create_purchase_order(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: CreatePoInput,
) -> Result<PurchaseOrder, String> {
    let pool = pool(&db_state)?;
    if input.items.is_empty() { return Err("PO must have at least one item".into()); }

    // Generate PO number
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM purchase_orders")
        .fetch_one(&*pool).await.map_err(db_err)?;
    let po_number = format!("PO-{:06}", count + 1);

    // Compute totals
    let mut total_amount = 0.0;
    for item in &input.items {
        let gross = item.ordered_qty * item.unit_price;
        let disc = gross * item.discount_percent.unwrap_or(0.0) / 100.0;
        total_amount += gross - disc;
    }
    let discount_amount = input.discount_amount.unwrap_or(0.0);
    let tax_amount = 0.0; // ponytail: computed from GST rates at GRN time
    let grand_total = (total_amount - discount_amount + tax_amount).round();
    let round_off = grand_total - (total_amount - discount_amount + tax_amount);

    let mut tx = pool.begin().await.map_err(|e| format!("begin tx: {}", e))?;

    let res = sqlx::query(
        r#"INSERT INTO purchase_orders
           (po_number, supplier_id, location_id, status, order_date, expected_date,
            total_amount, discount_amount, discount_percent, tax_amount, round_off,
            grand_total, paid_amount, notes, created_by)
           VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, 0, ?, ?, 0, ?, ?)"#,
    )
    .bind(&po_number)
    .bind(input.supplier_id)
    .bind(input.location_id)
    .bind(&input.order_date)
    .bind(input.expected_date.as_deref())
    .bind(total_amount)
    .bind(discount_amount)
    .bind(tax_amount)
    .bind(round_off)
    .bind(grand_total)
    .bind(input.notes.as_deref())
    .bind(input.created_by)
    .execute(&mut *tx).await
    .map_err(|e| format!("insert PO: {}", e))?;

    let po_id = res.last_insert_rowid();

    for item in &input.items {
        let gross = item.ordered_qty * item.unit_price;
        let disc = gross * item.discount_percent.unwrap_or(0.0) / 100.0;
        let line_total = gross - disc;
        sqlx::query(
            r#"INSERT INTO purchase_order_items
               (po_id, product_id, variant_id, unit_id, ordered_qty, received_qty,
                unit_price, discount_percent, discount_amount, gst_rate, gst_amount, line_total)
               VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0, ?)"#,
        )
        .bind(po_id)
        .bind(item.product_id)
        .bind(item.variant_id)
        .bind(item.unit_id)
        .bind(item.ordered_qty)
        .bind(item.unit_price)
        .bind(item.discount_percent.unwrap_or(0.0))
        .bind(item.gst_rate.unwrap_or(0.0))
        .bind(line_total)
        .execute(&mut *tx).await
        .map_err(|e| format!("insert PO item: {}", e))?;
    }

    tx.commit().await.map_err(|e| format!("commit: {}", e))?;

    fetch_po(&pool, po_id).await
}

async fn fetch_po(pool: &crate::database::DbPool, id: i64) -> Result<PurchaseOrder, String> {
    sqlx::query_as::<_, PurchaseOrder>(
        r#"SELECT id, po_number, supplier_id, location_id, status,
                  order_date, expected_date, total_amount, discount_amount,
                  discount_percent, tax_amount, round_off, grand_total,
                  paid_amount, notes, terms_conditions, created_by,
                  approved_by, approved_at, created_at, updated_at
           FROM purchase_orders WHERE id = ?"#,
    )
    .bind(id).fetch_one(&**pool).await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Purchase order not found".to_string(),
        other => db_err(other),
    })
}

#[tauri::command]
pub async fn update_purchase_order() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::message("PO editing not yet supported".to_string()))
}

#[tauri::command]
pub async fn delete_purchase_order(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
) -> Result<String, String> {
    let pool = pool(&db_state)?;
    // Only allow deleting draft POs
    let res = sqlx::query("DELETE FROM purchase_orders WHERE id = ? AND status = 'draft'")
        .bind(id).execute(&*pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err("PO not found or not in draft status (only drafts can be deleted)".into());
    }
    Ok(format!("PO {} deleted", id))
}

#[tauri::command]
pub async fn list_po_items(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    po_id: i64,
) -> Result<Vec<PurchaseOrderItem>, String> {
    let pool = pool(&db_state)?;
    let rows = sqlx::query_as::<_, PurchaseOrderItem>(
        r#"SELECT id, po_id, product_id, variant_id, unit_id, ordered_qty,
                  received_qty, unit_price, discount_percent, discount_amount,
                  gst_rate, gst_amount, line_total, notes
           FROM purchase_order_items WHERE po_id = ? ORDER BY id"#,
    )
    .bind(po_id)
    .fetch_all(&*pool).await.map_err(db_err)?;
    Ok(rows)
}

// ---------------------------------------------------------------------------
// Purchase Invoices (GRN — Goods Receipt Note)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn list_purchase_invoices(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    query: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
    supplier_id: Option<i64>,
) -> Result<ListResponse<PurchaseInvoice>, String> {
    let pool = pool(&db_state)?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 500);
    let offset = (page - 1) * page_size;
    let q = query.unwrap_or_default().trim().to_string();
    let pattern = if q.is_empty() { "%".to_string() } else { format!("%{}%", q) };

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM purchase_invoices
           WHERE (invoice_number LIKE ? OR ? = '')
             AND (supplier_id = ? OR ? IS NULL)"#,
    )
    .bind(&pattern).bind(&q)
    .bind(supplier_id).bind(supplier_id)
    .fetch_one(&*pool).await.map_err(db_err)?;

    let rows = sqlx::query_as::<_, PurchaseInvoice>(
        r#"SELECT id, invoice_number, po_id, supplier_id, location_id,
                  invoice_date, bill_number, bill_date, total_amount,
                  discount_amount, discount_percent, tax_amount, round_off,
                  grand_total, paid_amount, status, payment_mode, payment_ref,
                  notes, created_by, created_at, updated_at
           FROM purchase_invoices
           WHERE (invoice_number LIKE ? OR ? = '')
             AND (supplier_id = ? OR ? IS NULL)
           ORDER BY invoice_date DESC, id DESC
           LIMIT ? OFFSET ?"#,
    )
    .bind(&pattern).bind(&q)
    .bind(supplier_id).bind(supplier_id)
    .bind(page_size).bind(offset)
    .fetch_all(&*pool).await.map_err(db_err)?;

    Ok(ListResponse::new(rows, total, page, page_size))
}

#[tauri::command]
pub async fn get_purchase_invoice(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
) -> Result<PurchaseInvoice, String> {
    let pool = pool(&db_state)?;
    sqlx::query_as::<_, PurchaseInvoice>(
        r#"SELECT id, invoice_number, po_id, supplier_id, location_id,
                  invoice_date, bill_number, bill_date, total_amount,
                  discount_amount, discount_percent, tax_amount, round_off,
                  grand_total, paid_amount, status, payment_mode, payment_ref,
                  notes, created_by, created_at, updated_at
           FROM purchase_invoices WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(&*pool).await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Purchase invoice not found".to_string(),
        other => db_err(other),
    })
}

#[derive(Deserialize)]
pub struct PiItemInput {
    pub product_id: i64,
    pub variant_id: Option<i64>,
    pub unit_id: i64,
    pub qty: f64,
    pub free_qty: Option<f64>,
    pub unit_price: f64,
    pub discount_percent: Option<f64>,
    pub gst_rate: Option<f64>,
    pub batch_number: Option<String>,
    pub expiry_date: Option<String>,
}

#[derive(Deserialize)]
pub struct CreatePiInput {
    pub po_id: Option<i64>,
    pub supplier_id: i64,
    pub location_id: i64,
    pub invoice_date: String,
    pub bill_number: Option<String>,
    pub bill_date: Option<String>,
    pub items: Vec<PiItemInput>,
    pub discount_amount: Option<f64>,
    pub payment_mode: Option<String>,
    pub notes: Option<String>,
    pub created_by: i64,
}

#[tauri::command]
pub async fn create_purchase_invoice(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: CreatePiInput,
) -> Result<PurchaseInvoice, String> {
    let pool = pool(&db_state)?;
    if input.items.is_empty() { return Err("Invoice must have at least one item".into()); }

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM purchase_invoices")
        .fetch_one(&*pool).await.map_err(db_err)?;
    let invoice_number = format!("GRN-{:06}", count + 1);

    // Compute totals
    let mut total_amount = 0.0;
    let mut tax_amount = 0.0;
    for item in &input.items {
        let gross = item.qty * item.unit_price;
        let disc = gross * item.discount_percent.unwrap_or(0.0) / 100.0;
        let net = gross - disc;
        let gst = net * item.gst_rate.unwrap_or(0.0) / 100.0;
        total_amount += net;
        tax_amount += gst;
    }
    let discount_amount = input.discount_amount.unwrap_or(0.0);
    let raw_total = total_amount - discount_amount + tax_amount;
    let grand_total = raw_total.round();
    let round_off = grand_total - raw_total;

    let mut tx = pool.begin().await.map_err(|e| format!("begin tx: {}", e))?;

    let res = sqlx::query(
        r#"INSERT INTO purchase_invoices
           (invoice_number, po_id, supplier_id, location_id, invoice_date,
            bill_number, bill_date, total_amount, discount_amount, discount_percent,
            tax_amount, round_off, grand_total, paid_amount, status,
            payment_mode, payment_ref, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'received',
                   ?, NULL, ?, ?)"#,
    )
    .bind(&invoice_number)
    .bind(input.po_id)
    .bind(input.supplier_id)
    .bind(input.location_id)
    .bind(&input.invoice_date)
    .bind(input.bill_number.as_deref())
    .bind(input.bill_date.as_deref())
    .bind(total_amount)
    .bind(discount_amount)
    .bind(tax_amount)
    .bind(round_off)
    .bind(grand_total)
    .bind(grand_total) // paid_amount = grand_total (received = paid)
    .bind(input.payment_mode.as_deref())
    .bind(input.notes.as_deref())
    .bind(input.created_by)
    .execute(&mut *tx).await
    .map_err(|e| format!("insert GRN: {}", e))?;

    let pi_id = res.last_insert_rowid();

    for item in &input.items {
        let gross = item.qty * item.unit_price;
        let disc = gross * item.discount_percent.unwrap_or(0.0) / 100.0;
        let net = gross - disc;
        let gst = net * item.gst_rate.unwrap_or(0.0) / 100.0;
        let cgst = gst / 2.0;
        let sgst = gst / 2.0;
        let line_total = net + gst;

        sqlx::query(
            r#"INSERT INTO purchase_invoice_items
               (pi_id, product_id, variant_id, unit_id, qty, free_qty, unit_price,
                discount_percent, discount_amount, gst_rate, cgst_amount, sgst_amount,
                igst_amount, line_total, batch_number, expiry_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?, ?)"#,
        )
        .bind(pi_id)
        .bind(item.product_id)
        .bind(item.variant_id)
        .bind(item.unit_id)
        .bind(item.qty)
        .bind(item.free_qty.unwrap_or(0.0))
        .bind(item.unit_price)
        .bind(item.discount_percent.unwrap_or(0.0))
        .bind(item.gst_rate.unwrap_or(0.0))
        .bind(cgst)
        .bind(sgst)
        .bind(line_total)
        .bind(item.batch_number.as_deref())
        .bind(item.expiry_date.as_deref())
        .execute(&mut *tx).await
        .map_err(|e| format!("insert GRN item: {}", e))?;

        // Add stock
        let existing: Option<i64> = sqlx::query_scalar(
            r#"SELECT id FROM stock
               WHERE product_id = ? AND location_id = ?
                 AND variant_id IS ? AND batch_number IS ?
                 AND expiry_date IS ? AND serial_number IS NULL
               LIMIT 1"#,
        )
        .bind(item.product_id).bind(input.location_id)
        .bind(item.variant_id)
        .bind(item.batch_number.as_deref())
        .bind(item.expiry_date.as_deref())
        .fetch_optional(&mut *tx).await
        .map_err(db_err)?;

        match existing {
            Some(sid) => {
                sqlx::query("UPDATE stock SET quantity = quantity + ?, unit_cost = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?")
                    .bind(item.qty).bind(item.unit_price).bind(sid)
                    .execute(&mut *tx).await.map_err(db_err)?;
            }
            None => {
                sqlx::query(
                    r#"INSERT INTO stock
                       (product_id, location_id, variant_id, batch_number, expiry_date,
                        serial_number, quantity, reserved_qty, unit_cost, last_updated)
                       VALUES (?, ?, ?, ?, ?, NULL, ?, 0, ?, CURRENT_TIMESTAMP)"#,
                )
                .bind(item.product_id).bind(input.location_id)
                .bind(item.variant_id)
                .bind(item.batch_number.as_deref())
                .bind(item.expiry_date.as_deref())
                .bind(item.qty)
                .bind(item.unit_price)
                .execute(&mut *tx).await.map_err(db_err)?;
            }
        }

        // Stock movement audit
        sqlx::query(
            r#"INSERT INTO stock_movements
               (product_id, location_id, variant_id, batch_number, expiry_date,
                serial_number, movement_type, reference_type, reference_id,
                quantity, unit_cost, unit_price, notes, user_id, created_at)
               VALUES (?, ?, ?, ?, ?, NULL, 'purchase', 'purchase_invoice', ?,
                       ?, ?, NULL, ?, ?, CURRENT_TIMESTAMP)"#,
        )
        .bind(item.product_id).bind(input.location_id)
        .bind(item.variant_id)
        .bind(item.batch_number.as_deref())
        .bind(item.expiry_date.as_deref())
        .bind(pi_id)
        .bind(item.qty)
        .bind(item.unit_price)
        .bind(input.notes.as_deref())
        .bind(input.created_by)
        .execute(&mut *tx).await.map_err(db_err)?;
    }

    tx.commit().await.map_err(|e| format!("commit: {}", e))?;

    fetch_pi(&pool, pi_id).await
}

async fn fetch_pi(pool: &crate::database::DbPool, id: i64) -> Result<PurchaseInvoice, String> {
    sqlx::query_as::<_, PurchaseInvoice>(
        r#"SELECT id, invoice_number, po_id, supplier_id, location_id,
                  invoice_date, bill_number, bill_date, total_amount,
                  discount_amount, discount_percent, tax_amount, round_off,
                  grand_total, paid_amount, status, payment_mode, payment_ref,
                  notes, created_by, created_at, updated_at
           FROM purchase_invoices WHERE id = ?"#,
    )
    .bind(id).fetch_one(&**pool).await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Purchase invoice not found".to_string(),
        other => db_err(other),
    })
}

#[tauri::command]
pub async fn update_purchase_invoice() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::message("GRN editing not yet supported".to_string()))
}

#[tauri::command]
pub async fn list_pi_items(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    pi_id: i64,
) -> Result<Vec<PurchaseInvoiceItem>, String> {
    let pool = pool(&db_state)?;
    let rows = sqlx::query_as::<_, PurchaseInvoiceItem>(
        r#"SELECT id, pi_id, product_id, variant_id, unit_id, qty, free_qty,
                  unit_price, discount_percent, discount_amount, gst_rate,
                  cgst_amount, sgst_amount, igst_amount, line_total,
                  batch_number, expiry_date, notes
           FROM purchase_invoice_items WHERE pi_id = ? ORDER BY id"#,
    )
    .bind(pi_id)
    .fetch_all(&*pool).await.map_err(db_err)?;
    Ok(rows)
}

// ---------------------------------------------------------------------------
// Purchase returns + supplier payments — remain stubs
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn list_purchase_returns() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[tauri::command]
pub async fn create_purchase_return() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[tauri::command]
pub async fn list_supplier_payments() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
#[tauri::command]
pub async fn create_supplier_payment() -> Result<ApiResponse<()>, String> {
    Ok(ApiResponse::success(()))
}
