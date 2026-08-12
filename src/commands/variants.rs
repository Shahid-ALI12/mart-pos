// commands/variants.rs - CRUD for product variants
//
// Schema (002_products_inventory.sql):
//   product_variants(id, product_id, variant_name, barcode, sku,
//                    sale_price, purchase_price, mrp, is_active, created_at)
//
// A variant represents a size/flavor/color/etc. of a parent product.
// Variant barcode and sku are UNIQUE (nullable).

use crate::commands::common::{db_err, pool};
use crate::database::models::ProductVariant;
use crate::database::DbState;
use tauri::{State, AppHandle};

#[tauri::command]
pub async fn list_variants(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    product_id: Option<i64>,
    active_only: Option<bool>,
) -> Result<Vec<ProductVariant>, String> {
    let pool = pool(&db_state)?;
    let active_only = active_only.unwrap_or(true);
    let active_flag = if active_only { 1i64 } else { 0i64 };

    let rows = if let Some(pid) = product_id {
        sqlx::query_as::<_, ProductVariant>(
            r#"SELECT id, product_id, variant_name, barcode, sku,
                      sale_price, purchase_price, mrp, is_active, created_at
               FROM product_variants
               WHERE product_id = ?
                 AND (is_active = ? OR ? = 0)
               ORDER BY variant_name"#,
        )
        .bind(pid)
        .bind(active_flag)
        .bind(active_flag)
        .fetch_all(&*pool)
        .await
    } else {
        sqlx::query_as::<_, ProductVariant>(
            r#"SELECT id, product_id, variant_name, barcode, sku,
                      sale_price, purchase_price, mrp, is_active, created_at
               FROM product_variants
               WHERE is_active = ? OR ? = 0
               ORDER BY variant_name"#,
        )
        .bind(active_flag)
        .bind(active_flag)
        .fetch_all(&*pool)
        .await
    }
    .map_err(db_err)?;

    Ok(rows)
}

#[derive(serde::Deserialize)]
pub struct VariantInput {
    pub product_id: i64,
    pub variant_name: String,
    pub barcode: Option<String>,
    pub sku: Option<String>,
    pub sale_price: Option<f64>,
    pub purchase_price: Option<f64>,
    pub mrp: Option<f64>,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_true() -> bool { true }

#[tauri::command]
pub async fn create_variant(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: VariantInput,
) -> Result<ProductVariant, String> {
    let pool = pool(&db_state)?;
    let variant_name = input.variant_name.trim().to_string();
    if variant_name.is_empty() {
        return Err("Variant name is required".to_string());
    }
    let barcode = input.barcode.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let sku = input.sku.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

    // Validate prices.
    if let Some(p) = input.sale_price { if p < 0.0 { return Err("sale_price cannot be negative".into()); } }
    if let Some(p) = input.purchase_price { if p < 0.0 { return Err("purchase_price cannot be negative".into()); } }
    if let Some(p) = input.mrp { if p < 0.0 { return Err("mrp cannot be negative".into()); } }

    let _ = sqlx::query(
        r#"INSERT INTO product_variants
           (product_id, variant_name, barcode, sku, sale_price, purchase_price, mrp, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(input.product_id)
    .bind(&variant_name)
    .bind(&barcode)
    .bind(&sku)
    .bind(input.sale_price)
    .bind(input.purchase_price)
    .bind(input.mrp)
    .bind(input.is_active as i64)
    .execute(&*pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref de) = e {
            if de.is_unique_violation() {
                let msg = de.message();
                if msg.contains("barcode") {
                    return "Another variant already uses this barcode".to_string();
                }
                if msg.contains("sku") {
                    return "Another variant already uses this SKU".to_string();
                }
            }
            if de.is_foreign_key_violation() {
                return "Parent product does not exist".to_string();
            }
        }
        db_err(e)
    })?;

    let id: i64 = sqlx::query_scalar("SELECT last_insert_rowid()")
        .fetch_one(&*pool)
        .await
        .map_err(db_err)?;

    fetch_by_id(&pool, id).await
}

#[derive(serde::Deserialize)]
pub struct VariantUpdateInput {
    pub id: i64,
    pub variant_name: String,
    pub barcode: Option<String>,
    pub sku: Option<String>,
    pub sale_price: Option<f64>,
    pub purchase_price: Option<f64>,
    pub mrp: Option<f64>,
    pub is_active: bool,
}

#[tauri::command]
pub async fn update_variant(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: VariantUpdateInput,
) -> Result<ProductVariant, String> {
    let pool = pool(&db_state)?;
    let variant_name = input.variant_name.trim().to_string();
    if variant_name.is_empty() {
        return Err("Variant name cannot be empty".to_string());
    }
    let barcode = input.barcode.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let sku = input.sku.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

    let res = sqlx::query(
        r#"UPDATE product_variants
           SET variant_name = ?, barcode = ?, sku = ?,
               sale_price = ?, purchase_price = ?, mrp = ?, is_active = ?
           WHERE id = ?"#,
    )
    .bind(&variant_name)
    .bind(&barcode)
    .bind(&sku)
    .bind(input.sale_price)
    .bind(input.purchase_price)
    .bind(input.mrp)
    .bind(input.is_active as i64)
    .bind(input.id)
    .execute(&*pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref de) = e {
            if de.is_unique_violation() {
                let msg = de.message();
                if msg.contains("barcode") {
                    return "Another variant already uses this barcode".to_string();
                }
                if msg.contains("sku") {
                    return "Another variant already uses this SKU".to_string();
                }
            }
        }
        db_err(e)
    })?;

    if res.rows_affected() == 0 {
        return Err("Variant not found".to_string());
    }

    fetch_by_id(&pool, input.id).await
}

#[tauri::command]
pub async fn delete_variant(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
    hard: Option<bool>,
) -> Result<String, String> {
    let pool = pool(&db_state)?;
    let hard = hard.unwrap_or(false);

    if hard {
        // Schema has ON DELETE CASCADE on product_variants → stock and
        // stock_movements rows for this variant will also be deleted.
        // We warn if there's current stock to lose.
        let stock_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM stock WHERE variant_id = ? AND quantity > 0",
        )
        .bind(id)
        .fetch_one(&*pool)
        .await
        .map_err(db_err)?;
        if stock_count > 0 {
            return Err(format!(
                "Cannot hard-delete: {} stock rows still hold quantity for this variant. \
                 Adjust to 0 first or archive instead.",
                stock_count
            ));
        }

        sqlx::query("DELETE FROM product_variants WHERE id = ?")
            .bind(id)
            .execute(&*pool)
            .await
            .map_err(db_err)?;
        Ok(format!("Variant {} permanently deleted", id))
    } else {
        let res = sqlx::query("UPDATE product_variants SET is_active = 0 WHERE id = ?")
            .bind(id)
            .execute(&*pool)
            .await
            .map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err("Variant not found".to_string());
        }
        Ok(format!("Variant {} archived (soft-deleted)", id))
    }
}

async fn fetch_by_id(pool: &crate::database::DbPool, id: i64) -> Result<ProductVariant, String> {
    sqlx::query_as::<_, ProductVariant>(
        r#"SELECT id, product_id, variant_name, barcode, sku,
                  sale_price, purchase_price, mrp, is_active, created_at
           FROM product_variants WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(&**pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Variant not found".to_string(),
        other => db_err(other),
    })
}
