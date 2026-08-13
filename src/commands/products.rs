// commands/products.rs - CRUD for products
//
// Schema (002_products_inventory.sql):
//   products(id, barcode, sku, name, category_id, brand_id, unit_id,
//            purchase_price, sale_price, min_sale_price, mrp,
//            gst_rate, hsn_code, reorder_level, max_stock_level,
//            track_expiry, track_batch, track_serial, is_active,
//            created_at, updated_at)
//
// SKU and barcode are UNIQUE.
// list_products joins with categories/brands/units and aggregates current stock
// from the `stock` table so the frontend can show "Name (Category) — 12 in stock".

use crate::commands::common::{db_err, pool, ListResponse};
use crate::database::models::{Product, ProductWithDetails};
use crate::database::DbState;
use tauri::{State, AppHandle};
use sqlx::Row;

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn list_products(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    query: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
    active_only: Option<bool>,
    category_id: Option<i64>,
    brand_id: Option<i64>,
) -> Result<ListResponse<ProductWithDetails>, String> {
    let pool = pool(&db_state)?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 500);
    let active_only = active_only.unwrap_or(true);
    let active_flag = if active_only { 1i64 } else { 0i64 };
    let offset = (page - 1) * page_size;
    let q = query.unwrap_or_default().trim().to_string();

    // Build a WHERE clause dynamically. SQLite is happy with `(?)` placeholders.
    // We bind search against name/sku/barcode with LIKE.
    let search_pattern = if q.is_empty() {
        "%".to_string()
    } else {
        format!("%{}%", q.replace('%', "\\%").replace('_', "\\_"))
    };

    let rows = sqlx::query(
        r#"SELECT p.id, p.barcode, p.sku, p.name, p.category_id, p.brand_id,
                  p.unit_id, p.purchase_price, p.sale_price, p.min_sale_price,
                  p.mrp, p.gst_rate, p.hsn_code, p.reorder_level,
                  p.max_stock_level, p.track_expiry, p.track_batch,
                  p.track_serial, p.is_active, p.created_at, p.updated_at,
                  c.name as category_name,
                  b.name as brand_name,
                  u.name as unit_name, u.short_name as unit_short_name,
                  COALESCE((
                      SELECT SUM(s.quantity - s.reserved_qty)
                      FROM stock s
                      WHERE s.product_id = p.id
                        AND s.variant_id IS NULL
                  ), 0) as current_stock
           FROM products p
           JOIN categories c ON c.id = p.category_id
           LEFT JOIN brands b ON b.id = p.brand_id
           JOIN units u ON u.id = p.unit_id
           WHERE (p.is_active = ? OR ? = 0)
             AND (p.name LIKE ? ESCAPE '\' OR p.sku LIKE ? ESCAPE '\' OR p.barcode LIKE ? ESCAPE '\')
             AND (? = 0 OR p.category_id = ?)
             AND (? = 0 OR p.brand_id = ?)
           ORDER BY p.name
           LIMIT ? OFFSET ?"#,
    )
    .bind(active_flag)
    .bind(active_flag)
    .bind(&search_pattern)
    .bind(&search_pattern)
    .bind(&search_pattern)
    .bind(category_id.unwrap_or(0))
    .bind(category_id)
    .bind(brand_id.unwrap_or(0))
    .bind(brand_id)
    .bind(page_size)
    .bind(offset)
    .fetch_all(&*pool)
    .await
    .map_err(db_err)?;

    let data: Vec<ProductWithDetails> = rows
        .iter()
        .map(|r| ProductWithDetails {
            product: Product {
                id: r.try_get("id").unwrap_or(0),
                barcode: r.try_get("barcode").ok(),
                sku: r.try_get("sku").unwrap_or_default(),
                name: r.try_get("name").unwrap_or_default(),
                category_id: r.try_get("category_id").unwrap_or(0),
                brand_id: r.try_get("brand_id").ok(),
                unit_id: r.try_get("unit_id").unwrap_or(0),
                purchase_price: r.try_get("purchase_price").unwrap_or(0.0),
                sale_price: r.try_get("sale_price").unwrap_or(0.0),
                min_sale_price: r.try_get("min_sale_price").ok(),
                mrp: r.try_get("mrp").ok(),
                gst_rate: r.try_get("gst_rate").unwrap_or(0.0),
                hsn_code: r.try_get("hsn_code").ok(),
                reorder_level: r.try_get("reorder_level").unwrap_or(0.0),
                max_stock_level: r.try_get("max_stock_level").ok(),
                track_expiry: r.try_get("track_expiry").unwrap_or(false),
                track_batch: r.try_get("track_batch").unwrap_or(false),
                track_serial: r.try_get("track_serial").unwrap_or(false),
                is_active: r.try_get("is_active").unwrap_or(true),
                created_at: r.try_get("created_at")
                    .unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
                updated_at: r.try_get("updated_at")
                    .unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
            },
            category_name: r.try_get("category_name").unwrap_or_default(),
            brand_name: r.try_get("brand_name").ok(),
            unit_name: r.try_get("unit_name").unwrap_or_default(),
            unit_short_name: r.try_get("unit_short_name").unwrap_or_default(),
            current_stock: r.try_get::<f64, _>("current_stock").unwrap_or(0.0),
        })
        .collect();

    // Total count for pagination (re-run the WHERE clause without LIMIT).
    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM products p
           WHERE (p.is_active = ? OR ? = 0)
             AND (p.name LIKE ? ESCAPE '\' OR p.sku LIKE ? ESCAPE '\' OR p.barcode LIKE ? ESCAPE '\')
             AND (? = 0 OR p.category_id = ?)
             AND (? = 0 OR p.brand_id = ?)"#,
    )
    .bind(active_flag)
    .bind(active_flag)
    .bind(&search_pattern)
    .bind(&search_pattern)
    .bind(&search_pattern)
    .bind(category_id.unwrap_or(0))
    .bind(category_id)
    .bind(brand_id.unwrap_or(0))
    .bind(brand_id)
    .fetch_one(&*pool)
    .await
    .map_err(db_err)?;

    Ok(ListResponse::new(data, total, page, page_size))
}

#[tauri::command]
pub async fn get_product(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
) -> Result<ProductWithDetails, String> {
    let pool = pool(&db_state)?;

    let row = sqlx::query(
        r#"SELECT p.id, p.barcode, p.sku, p.name, p.category_id, p.brand_id,
                  p.unit_id, p.purchase_price, p.sale_price, p.min_sale_price,
                  p.mrp, p.gst_rate, p.hsn_code, p.reorder_level,
                  p.max_stock_level, p.track_expiry, p.track_batch,
                  p.track_serial, p.is_active, p.created_at, p.updated_at,
                  c.name as category_name,
                  b.name as brand_name,
                  u.name as unit_name, u.short_name as unit_short_name,
                  COALESCE((
                      SELECT SUM(s.quantity - s.reserved_qty)
                      FROM stock s
                      WHERE s.product_id = p.id
                        AND s.variant_id IS NULL
                  ), 0) as current_stock
           FROM products p
           JOIN categories c ON c.id = p.category_id
           LEFT JOIN brands b ON b.id = p.brand_id
           JOIN units u ON u.id = p.unit_id
           WHERE p.id = ?"#,
    )
    .bind(id)
    .fetch_optional(&*pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| "Product not found".to_string())?;

    let product = ProductWithDetails {
        product: Product {
            id: row.try_get("id").unwrap_or(0),
            barcode: row.try_get("barcode").ok(),
            sku: row.try_get("sku").unwrap_or_default(),
            name: row.try_get("name").unwrap_or_default(),
            category_id: row.try_get("category_id").unwrap_or(0),
            brand_id: row.try_get("brand_id").ok(),
            unit_id: row.try_get("unit_id").unwrap_or(0),
            purchase_price: row.try_get("purchase_price").unwrap_or(0.0),
            sale_price: row.try_get("sale_price").unwrap_or(0.0),
            min_sale_price: row.try_get("min_sale_price").ok(),
            mrp: row.try_get("mrp").ok(),
            gst_rate: row.try_get("gst_rate").unwrap_or(0.0),
            hsn_code: row.try_get("hsn_code").ok(),
            reorder_level: row.try_get("reorder_level").unwrap_or(0.0),
            max_stock_level: row.try_get("max_stock_level").ok(),
            track_expiry: row.try_get("track_expiry").unwrap_or(false),
            track_batch: row.try_get("track_batch").unwrap_or(false),
            track_serial: row.try_get("track_serial").unwrap_or(false),
            is_active: row.try_get("is_active").unwrap_or(true),
            created_at: row.try_get("created_at")
                .unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
            updated_at: row.try_get("updated_at")
                .unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
        },
        category_name: row.try_get("category_name").unwrap_or_default(),
        brand_name: row.try_get("brand_name").ok(),
        unit_name: row.try_get("unit_name").unwrap_or_default(),
        unit_short_name: row.try_get("unit_short_name").unwrap_or_default(),
        current_stock: row.try_get::<f64, _>("current_stock").unwrap_or(0.0),
    };

    Ok(product)
}

#[tauri::command]
pub async fn search_products(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<ProductWithDetails>, String> {
    // Lightweight search for the POS barcode/search box. Returns at most `limit`
    // rows (default 25) — no pagination wrapper, just a flat array.
    let pool = pool(&db_state)?;
    let limit = limit.unwrap_or(25).clamp(1, 200);
    let q = query.trim();
    if q.is_empty() {
        return Ok(Vec::new());
    }
    let pattern = format!("%{}%", q.replace('%', "\\%").replace('_', "\\_"));

    let rows = sqlx::query(
        r#"SELECT p.id, p.barcode, p.sku, p.name, p.category_id, p.brand_id,
                  p.unit_id, p.purchase_price, p.sale_price, p.min_sale_price,
                  p.mrp, p.gst_rate, p.hsn_code, p.reorder_level,
                  p.max_stock_level, p.track_expiry, p.track_batch,
                  p.track_serial, p.is_active, p.created_at, p.updated_at,
                  c.name as category_name,
                  b.name as brand_name,
                  u.name as unit_name, u.short_name as unit_short_name,
                  COALESCE((
                      SELECT SUM(s.quantity - s.reserved_qty)
                      FROM stock s
                      WHERE s.product_id = p.id
                        AND s.variant_id IS NULL
                  ), 0) as current_stock
           FROM products p
           JOIN categories c ON c.id = p.category_id
           LEFT JOIN brands b ON b.id = p.brand_id
           JOIN units u ON u.id = p.unit_id
           WHERE p.is_active = 1
             AND (p.name LIKE ? ESCAPE '\' OR p.sku LIKE ? ESCAPE '\' OR p.barcode LIKE ? ESCAPE '\' OR p.barcode = ?)
           ORDER BY
             CASE WHEN p.barcode = ? THEN 0 ELSE 1 END,
             p.name
           LIMIT ?"#,
    )
    .bind(&pattern)
    .bind(&pattern)
    .bind(&pattern)
    .bind(q)
    .bind(q)
    .bind(limit)
    .fetch_all(&*pool)
    .await
    .map_err(db_err)?;

    let data: Vec<ProductWithDetails> = rows
        .iter()
        .map(|r| ProductWithDetails {
            product: Product {
                id: r.try_get("id").unwrap_or(0),
                barcode: r.try_get("barcode").ok(),
                sku: r.try_get("sku").unwrap_or_default(),
                name: r.try_get("name").unwrap_or_default(),
                category_id: r.try_get("category_id").unwrap_or(0),
                brand_id: r.try_get("brand_id").ok(),
                unit_id: r.try_get("unit_id").unwrap_or(0),
                purchase_price: r.try_get("purchase_price").unwrap_or(0.0),
                sale_price: r.try_get("sale_price").unwrap_or(0.0),
                min_sale_price: r.try_get("min_sale_price").ok(),
                mrp: r.try_get("mrp").ok(),
                gst_rate: r.try_get("gst_rate").unwrap_or(0.0),
                hsn_code: r.try_get("hsn_code").ok(),
                reorder_level: r.try_get("reorder_level").unwrap_or(0.0),
                max_stock_level: r.try_get("max_stock_level").ok(),
                track_expiry: r.try_get("track_expiry").unwrap_or(false),
                track_batch: r.try_get("track_batch").unwrap_or(false),
                track_serial: r.try_get("track_serial").unwrap_or(false),
                is_active: r.try_get("is_active").unwrap_or(true),
                created_at: r.try_get("created_at")
                    .unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
                updated_at: r.try_get("updated_at")
                    .unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
            },
            category_name: r.try_get("category_name").unwrap_or_default(),
            brand_name: r.try_get("brand_name").ok(),
            unit_name: r.try_get("unit_name").unwrap_or_default(),
            unit_short_name: r.try_get("unit_short_name").unwrap_or_default(),
            current_stock: r.try_get::<f64, _>("current_stock").unwrap_or(0.0),
        })
        .collect();

    Ok(data)
}

#[derive(serde::Deserialize)]
pub struct ProductInput {
    pub barcode: Option<String>,
    pub sku: String,
    pub name: String,
    pub category_id: i64,
    pub brand_id: Option<i64>,
    pub unit_id: i64,
    #[serde(default)]
    pub purchase_price: f64,
    #[serde(default)]
    pub sale_price: f64,
    pub min_sale_price: Option<f64>,
    pub mrp: Option<f64>,
    #[serde(default)]
    pub gst_rate: f64,
    pub hsn_code: Option<String>,
    #[serde(default = "default_reorder")]
    pub reorder_level: f64,
    pub max_stock_level: Option<f64>,
    #[serde(default)]
    pub track_expiry: bool,
    #[serde(default)]
    pub track_batch: bool,
    #[serde(default)]
    pub track_serial: bool,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_true() -> bool { true }
fn default_reorder() -> f64 { 10.0 }

#[tauri::command]
pub async fn create_product(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: ProductInput,
) -> Result<ProductWithDetails, String> {
    let pool = pool(&db_state)?;
    let sku = input.sku.trim().to_string();
    let name = input.name.trim().to_string();
    let barcode = input.barcode.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

    if sku.is_empty() {
        return Err("SKU is required".to_string());
    }
    if name.is_empty() {
        return Err("Product name is required".to_string());
    }
    if input.sale_price < 0.0 || input.purchase_price < 0.0 {
        return Err("Prices cannot be negative".to_string());
    }

    let _ = sqlx::query(
        r#"INSERT INTO products
           (barcode, sku, name, category_id, brand_id, unit_id,
            purchase_price, sale_price, min_sale_price, mrp,
            gst_rate, hsn_code, reorder_level, max_stock_level,
            track_expiry, track_batch, track_serial, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&barcode)
    .bind(&sku)
    .bind(&name)
    .bind(input.category_id)
    .bind(input.brand_id)
    .bind(input.unit_id)
    .bind(input.purchase_price)
    .bind(input.sale_price)
    .bind(input.min_sale_price)
    .bind(input.mrp)
    .bind(input.gst_rate)
    .bind(&input.hsn_code)
    .bind(input.reorder_level)
    .bind(input.max_stock_level)
    .bind(input.track_expiry as i64)
    .bind(input.track_batch as i64)
    .bind(input.track_serial as i64)
    .bind(input.is_active as i64)
    .execute(&*pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref de) = e {
            if de.is_unique_violation() {
                let msg = de.message();
                if msg.contains("sku") {
                    return "A product with this SKU already exists".to_string();
                }
                if msg.contains("barcode") {
                    return "A product with this barcode already exists".to_string();
                }
                return "Duplicate value — unique constraint violated".to_string();
            }
            if de.is_foreign_key_violation() {
                return "Referenced category/brand/unit does not exist".to_string();
            }
        }
        db_err(e)
    })?;

    let id: i64 = sqlx::query_scalar("SELECT last_insert_rowid()")
        .fetch_one(&*pool)
        .await
        .map_err(db_err)?;

    // Reuse get_product to fetch the joined row.
    get_product_inner(&pool, id).await
}

#[derive(serde::Deserialize)]
pub struct ProductUpdateInput {
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
}

#[tauri::command]
pub async fn update_product(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: ProductUpdateInput,
) -> Result<ProductWithDetails, String> {
    let pool = pool(&db_state)?;
    let sku = input.sku.trim().to_string();
    let name = input.name.trim().to_string();
    let barcode = input.barcode.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

    if sku.is_empty() {
        return Err("SKU cannot be empty".to_string());
    }
    if name.is_empty() {
        return Err("Product name cannot be empty".to_string());
    }

    let res = sqlx::query(
        r#"UPDATE products
           SET barcode = ?, sku = ?, name = ?, category_id = ?, brand_id = ?,
               unit_id = ?, purchase_price = ?, sale_price = ?,
               min_sale_price = ?, mrp = ?, gst_rate = ?, hsn_code = ?,
               reorder_level = ?, max_stock_level = ?,
               track_expiry = ?, track_batch = ?, track_serial = ?,
               is_active = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?"#,
    )
    .bind(&barcode)
    .bind(&sku)
    .bind(&name)
    .bind(input.category_id)
    .bind(input.brand_id)
    .bind(input.unit_id)
    .bind(input.purchase_price)
    .bind(input.sale_price)
    .bind(input.min_sale_price)
    .bind(input.mrp)
    .bind(input.gst_rate)
    .bind(&input.hsn_code)
    .bind(input.reorder_level)
    .bind(input.max_stock_level)
    .bind(input.track_expiry as i64)
    .bind(input.track_batch as i64)
    .bind(input.track_serial as i64)
    .bind(input.is_active as i64)
    .bind(input.id)
    .execute(&*pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref de) = e {
            if de.is_unique_violation() {
                let msg = de.message();
                if msg.contains("sku") {
                    return "Another product already uses this SKU".to_string();
                }
                if msg.contains("barcode") {
                    return "Another product already uses this barcode".to_string();
                }
            }
            if de.is_foreign_key_violation() {
                return "Referenced category/brand/unit does not exist".to_string();
            }
        }
        db_err(e)
    })?;

    if res.rows_affected() == 0 {
        return Err("Product not found".to_string());
    }

    get_product_inner(&pool, input.id).await
}

#[tauri::command]
pub async fn delete_product(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
    hard: Option<bool>,
) -> Result<String, String> {
    let pool = pool(&db_state)?;
    let hard = hard.unwrap_or(false);

    if hard {
        // Block if any stock movements reference this product.
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM stock_movements WHERE product_id = ?",
        )
        .bind(id)
        .fetch_one(&*pool)
        .await
        .map_err(db_err)?;
        if count > 0 {
            return Err(format!(
                "Cannot delete: {} stock movements reference this product. Archive instead.",
                count
            ));
        }
        sqlx::query("DELETE FROM products WHERE id = ?")
            .bind(id)
            .execute(&*pool)
            .await
            .map_err(db_err)?;
        Ok(format!("Product {} permanently deleted", id))
    } else {
        let res = sqlx::query("UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(id)
            .execute(&*pool)
            .await
            .map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err("Product not found".to_string());
        }
        Ok(format!("Product {} archived (soft-deleted)", id))
    }
}

/// Get products whose current stock has fallen at or below the reorder_level.
/// Returns a flat list (no pagination wrapper) — the UI typically shows these
/// in a small alert panel.
#[tauri::command]
pub async fn get_low_stock(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    location_id: Option<i64>,
    include_zero: Option<bool>,
) -> Result<Vec<ProductWithDetails>, String> {
    let pool = pool(&db_state)?;
    let include_zero = include_zero.unwrap_or(true);

    let location_clause = if location_id.is_some() {
        "AND s.location_id = ?"
    } else {
        ""
    };

    // Build the SQL as an owned String first so the borrow lives long enough
    // for the `q.bind(...)` calls below. Passing `&format!(...)` directly to
    // `sqlx::query` would create a temporary that is dropped at the end of
    // the statement, but `q` borrows from it.
    let sql = format!(
        r#"SELECT p.id, p.barcode, p.sku, p.name, p.category_id, p.brand_id,
                  p.unit_id, p.purchase_price, p.sale_price, p.min_sale_price,
                  p.mrp, p.gst_rate, p.hsn_code, p.reorder_level,
                  p.max_stock_level, p.track_expiry, p.track_batch,
                  p.track_serial, p.is_active, p.created_at, p.updated_at,
                  c.name as category_name,
                  b.name as brand_name,
                  u.name as unit_name, u.short_name as unit_short_name,
                  COALESCE((
                      SELECT SUM(s2.quantity - s2.reserved_qty)
                      FROM stock s2
                      WHERE s2.product_id = p.id
                        AND s2.variant_id IS NULL
                        {loc_clause_full}
                  ), 0) as current_stock
           FROM products p
           JOIN categories c ON c.id = p.category_id
           LEFT JOIN brands b ON b.id = p.brand_id
           JOIN units u ON u.id = p.unit_id
           LEFT JOIN stock s ON s.product_id = p.id AND s.variant_id IS NULL {loc_clause}
           WHERE p.is_active = 1
           GROUP BY p.id
           HAVING current_stock <= p.reorder_level {zero_clause}
           ORDER BY current_stock ASC, p.name"#,
        loc_clause_full = if location_id.is_some() { "AND s2.location_id = ?" } else { "" },
        loc_clause = location_clause,
        zero_clause = if include_zero { "" } else { "AND current_stock > 0" }
    );
    let mut q = sqlx::query(&sql);

    if let Some(lid) = location_id {
        q = q.bind(lid).bind(lid);
    }

    let rows = q.fetch_all(&*pool).await.map_err(db_err)?;

    let data: Vec<ProductWithDetails> = rows
        .iter()
        .map(|r| ProductWithDetails {
            product: Product {
                id: r.try_get("id").unwrap_or(0),
                barcode: r.try_get("barcode").ok(),
                sku: r.try_get("sku").unwrap_or_default(),
                name: r.try_get("name").unwrap_or_default(),
                category_id: r.try_get("category_id").unwrap_or(0),
                brand_id: r.try_get("brand_id").ok(),
                unit_id: r.try_get("unit_id").unwrap_or(0),
                purchase_price: r.try_get("purchase_price").unwrap_or(0.0),
                sale_price: r.try_get("sale_price").unwrap_or(0.0),
                min_sale_price: r.try_get("min_sale_price").ok(),
                mrp: r.try_get("mrp").ok(),
                gst_rate: r.try_get("gst_rate").unwrap_or(0.0),
                hsn_code: r.try_get("hsn_code").ok(),
                reorder_level: r.try_get("reorder_level").unwrap_or(0.0),
                max_stock_level: r.try_get("max_stock_level").ok(),
                track_expiry: r.try_get("track_expiry").unwrap_or(false),
                track_batch: r.try_get("track_batch").unwrap_or(false),
                track_serial: r.try_get("track_serial").unwrap_or(false),
                is_active: r.try_get("is_active").unwrap_or(true),
                created_at: r.try_get("created_at")
                    .unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
                updated_at: r.try_get("updated_at")
                    .unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
            },
            category_name: r.try_get("category_name").unwrap_or_default(),
            brand_name: r.try_get("brand_name").ok(),
            unit_name: r.try_get("unit_name").unwrap_or_default(),
            unit_short_name: r.try_get("unit_short_name").unwrap_or_default(),
            current_stock: r.try_get::<f64, _>("current_stock").unwrap_or(0.0),
        })
        .collect();

    Ok(data)
}

// Inner helper used by both create_product and update_product (avoids the
// public command's tauri::State argument).
async fn get_product_inner(
    pool: &crate::database::DbPool,
    id: i64,
) -> Result<ProductWithDetails, String> {
    let row = sqlx::query(
        r#"SELECT p.id, p.barcode, p.sku, p.name, p.category_id, p.brand_id,
                  p.unit_id, p.purchase_price, p.sale_price, p.min_sale_price,
                  p.mrp, p.gst_rate, p.hsn_code, p.reorder_level,
                  p.max_stock_level, p.track_expiry, p.track_batch,
                  p.track_serial, p.is_active, p.created_at, p.updated_at,
                  c.name as category_name,
                  b.name as brand_name,
                  u.name as unit_name, u.short_name as unit_short_name,
                  COALESCE((
                      SELECT SUM(s.quantity - s.reserved_qty)
                      FROM stock s
                      WHERE s.product_id = p.id
                        AND s.variant_id IS NULL
                  ), 0) as current_stock
           FROM products p
           JOIN categories c ON c.id = p.category_id
           LEFT JOIN brands b ON b.id = p.brand_id
           JOIN units u ON u.id = p.unit_id
           WHERE p.id = ?"#,
    )
    .bind(id)
    .fetch_optional(&**pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| "Product not found after insert".to_string())?;

    Ok(ProductWithDetails {
        product: Product {
            id: row.try_get("id").unwrap_or(0),
            barcode: row.try_get("barcode").ok(),
            sku: row.try_get("sku").unwrap_or_default(),
            name: row.try_get("name").unwrap_or_default(),
            category_id: row.try_get("category_id").unwrap_or(0),
            brand_id: row.try_get("brand_id").ok(),
            unit_id: row.try_get("unit_id").unwrap_or(0),
            purchase_price: row.try_get("purchase_price").unwrap_or(0.0),
            sale_price: row.try_get("sale_price").unwrap_or(0.0),
            min_sale_price: row.try_get("min_sale_price").ok(),
            mrp: row.try_get("mrp").ok(),
            gst_rate: row.try_get("gst_rate").unwrap_or(0.0),
            hsn_code: row.try_get("hsn_code").ok(),
            reorder_level: row.try_get("reorder_level").unwrap_or(0.0),
            max_stock_level: row.try_get("max_stock_level").ok(),
            track_expiry: row.try_get("track_expiry").unwrap_or(false),
            track_batch: row.try_get("track_batch").unwrap_or(false),
            track_serial: row.try_get("track_serial").unwrap_or(false),
            is_active: row.try_get("is_active").unwrap_or(true),
            created_at: row.try_get("created_at")
                .unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
            updated_at: row.try_get("updated_at")
                .unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
        },
        category_name: row.try_get("category_name").unwrap_or_default(),
        brand_name: row.try_get("brand_name").ok(),
        unit_name: row.try_get("unit_name").unwrap_or_default(),
        unit_short_name: row.try_get("unit_short_name").unwrap_or_default(),
        current_stock: row.try_get::<f64, _>("current_stock").unwrap_or(0.0),
    })
}
