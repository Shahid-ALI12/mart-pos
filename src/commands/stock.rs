// commands/stock.rs - Stock queries, adjustments, movements
use crate::commands::common::{db_err, pool, ListResponse};
use crate::database::models::{StockWithDetails, StockMovement};
use crate::database::DbState;
use serde::Deserialize;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn get_stock(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    location_id: Option<i64>,
    query: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<ListResponse<StockWithDetails>, String> {
    let pool = pool(&db_state)?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 500);
    let offset = (page - 1) * page_size;
    let q = query.unwrap_or_default().trim().to_string();
    let pattern = if q.is_empty() { "%".to_string() } else { format!("%{}%", q) };

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM stock s JOIN products p ON s.product_id = p.id
           WHERE (p.name LIKE ? OR p.sku LIKE ? OR ? = '')
             AND (s.location_id = ? OR ? IS NULL)"#,
    )
    .bind(&pattern).bind(&pattern).bind(&q)
    .bind(location_id).bind(location_id)
    .fetch_one(&*pool).await.map_err(db_err)?;

    let rows = sqlx::query_as::<_, StockWithDetails>(
        r#"SELECT s.id, s.product_id, s.location_id, s.variant_id, s.batch_number,
                  s.expiry_date, s.serial_number, s.quantity, s.reserved_qty,
                  s.unit_cost, s.last_updated,
                  p.name as product_name, p.sku as product_sku, p.barcode as product_barcode,
                  (SELECT name FROM product_variants WHERE id = s.variant_id) as variant_name,
                  (SELECT name FROM locations WHERE id = s.location_id) as location_name,
                  (s.quantity - s.reserved_qty) as available_qty
           FROM stock s JOIN products p ON s.product_id = p.id
           WHERE (p.name LIKE ? OR p.sku LIKE ? OR ? = '')
             AND (s.location_id = ? OR ? IS NULL)
           ORDER BY p.name
           LIMIT ? OFFSET ?"#,
    )
    .bind(&pattern).bind(&pattern).bind(&q)
    .bind(location_id).bind(location_id)
    .bind(page_size).bind(offset)
    .fetch_all(&*pool).await.map_err(db_err)?;

    Ok(ListResponse::new(rows, total, page, page_size))
}

#[tauri::command]
pub async fn get_stock_by_location(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    location_id: i64,
) -> Result<Vec<StockWithDetails>, String> {
    let pool = pool(&db_state)?;
    let rows = sqlx::query_as::<_, StockWithDetails>(
        r#"SELECT s.id, s.product_id, s.location_id, s.variant_id, s.batch_number,
                  s.expiry_date, s.serial_number, s.quantity, s.reserved_qty,
                  s.unit_cost, s.last_updated,
                  p.name as product_name, p.sku as product_sku, p.barcode as product_barcode,
                  (SELECT name FROM product_variants WHERE id = s.variant_id) as variant_name,
                  (SELECT name FROM locations WHERE id = s.location_id) as location_name,
                  (s.quantity - s.reserved_qty) as available_qty
           FROM stock s JOIN products p ON s.product_id = p.id
           WHERE s.location_id = ? AND s.quantity != 0
           ORDER BY p.name"#,
    )
    .bind(location_id)
    .fetch_all(&*pool).await.map_err(db_err)?;
    Ok(rows)
}

#[derive(Deserialize)]
pub struct AdjustStockInput {
    pub product_id: i64,
    pub location_id: i64,
    pub variant_id: Option<i64>,
    pub batch_number: Option<String>,
    pub expiry_date: Option<String>,
    pub quantity_change: f64,  // signed: + for add, - for remove
    pub reason: Option<String>,
    pub user_id: i64,
}

#[tauri::command]
pub async fn adjust_stock(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: AdjustStockInput,
) -> Result<String, String> {
    let pool = pool(&db_state)?;

    let mut tx = pool.begin().await.map_err(|e| format!("begin tx: {}", e))?;

    let existing: Option<i64> = sqlx::query_scalar(
        r#"SELECT id FROM stock
           WHERE product_id = ? AND location_id = ?
             AND variant_id IS ? AND batch_number IS ?
             AND expiry_date IS ? AND serial_number IS NULL
           LIMIT 1"#,
    )
    .bind(input.product_id).bind(input.location_id)
    .bind(input.variant_id)
    .bind(input.batch_number.as_deref())
    .bind(input.expiry_date.as_deref())
    .fetch_optional(&mut *tx).await.map_err(db_err)?;

    match existing {
        Some(sid) => {
            sqlx::query("UPDATE stock SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(input.quantity_change).bind(sid)
                .execute(&mut *tx).await.map_err(db_err)?;
        }
        None => {
            sqlx::query(
                r#"INSERT INTO stock
                   (product_id, location_id, variant_id, batch_number, expiry_date,
                    serial_number, quantity, reserved_qty, unit_cost, last_updated)
                   VALUES (?, ?, ?, ?, ?, NULL, ?, 0, 0, CURRENT_TIMESTAMP)"#,
            )
            .bind(input.product_id).bind(input.location_id)
            .bind(input.variant_id)
            .bind(input.batch_number.as_deref())
            .bind(input.expiry_date.as_deref())
            .bind(input.quantity_change)
            .execute(&mut *tx).await.map_err(db_err)?;
        }
    }

    sqlx::query(
        r#"INSERT INTO stock_movements
           (product_id, location_id, variant_id, batch_number, expiry_date,
            serial_number, movement_type, reference_type, reference_id,
            quantity, unit_cost, unit_price, notes, user_id, created_at)
           VALUES (?, ?, ?, ?, ?, NULL, 'adjustment', NULL, NULL,
                   ?, NULL, NULL, ?, ?, CURRENT_TIMESTAMP)"#,
    )
    .bind(input.product_id).bind(input.location_id)
    .bind(input.variant_id)
    .bind(input.batch_number.as_deref())
    .bind(input.expiry_date.as_deref())
    .bind(input.quantity_change)
    .bind(input.reason.as_deref())
    .bind(input.user_id)
    .execute(&mut *tx).await.map_err(db_err)?;

    tx.commit().await.map_err(|e| format!("commit: {}", e))?;

    Ok(format!("Stock adjusted by {}", input.quantity_change))
}

#[tauri::command]
pub async fn transfer_stock() -> Result<String, String> {
    Err("Use transfers::create_stock_transfer instead".into())
}

#[tauri::command]
pub async fn get_stock_movements(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    product_id: Option<i64>,
    location_id: Option<i64>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<ListResponse<StockMovement>, String> {
    let pool = pool(&db_state)?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(50).clamp(1, 500);
    let offset = (page - 1) * page_size;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM stock_movements
         WHERE (product_id = ? OR ? IS NULL) AND (location_id = ? OR ? IS NULL)",
    )
    .bind(product_id).bind(product_id)
    .bind(location_id).bind(location_id)
    .fetch_one(&*pool).await.map_err(db_err)?;

    let rows = sqlx::query_as::<_, StockMovement>(
        r#"SELECT id, product_id, location_id, variant_id, batch_number,
                  expiry_date, serial_number, movement_type, reference_type,
                  reference_id, quantity, unit_cost, unit_price, notes,
                  user_id, created_at
           FROM stock_movements
           WHERE (product_id = ? OR ? IS NULL) AND (location_id = ? OR ? IS NULL)
           ORDER BY created_at DESC, id DESC
           LIMIT ? OFFSET ?"#,
    )
    .bind(product_id).bind(product_id)
    .bind(location_id).bind(location_id)
    .bind(page_size).bind(offset)
    .fetch_all(&*pool).await.map_err(db_err)?;

    Ok(ListResponse::new(rows, total, page, page_size))
}
