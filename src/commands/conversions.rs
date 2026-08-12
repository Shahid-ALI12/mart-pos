// commands/conversions.rs - CRUD for unit conversions
//
// Schema (002_products_inventory.sql):
//   unit_conversions(id, product_id, from_unit_id, to_unit_id, factor, is_active)
//   UNIQUE(product_id, from_unit_id, to_unit_id)
//
// Example: 1 box = 12 pieces (factor=12, from=box, to=pieces).

use crate::commands::common::{db_err, pool};
use crate::database::models::UnitConversion;
use crate::database::DbState;
use tauri::{State, AppHandle};

#[tauri::command]
pub async fn list_conversions(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    product_id: Option<i64>,
    active_only: Option<bool>,
) -> Result<Vec<UnitConversion>, String> {
    let pool = pool(&db_state)?;
    let active_only = active_only.unwrap_or(true);
    let active_flag = if active_only { 1i64 } else { 0i64 };

    let rows = if let Some(pid) = product_id {
        sqlx::query_as::<_, UnitConversion>(
            r#"SELECT id, product_id, from_unit_id, to_unit_id, factor, is_active
               FROM unit_conversions
               WHERE product_id = ?
                 AND (is_active = ? OR ? = 0)"#,
        )
        .bind(pid)
        .bind(active_flag)
        .bind(active_flag)
        .fetch_all(&*pool)
        .await
    } else {
        sqlx::query_as::<_, UnitConversion>(
            r#"SELECT id, product_id, from_unit_id, to_unit_id, factor, is_active
               FROM unit_conversions
               WHERE is_active = ? OR ? = 0"#,
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
pub struct ConversionInput {
    pub product_id: i64,
    pub from_unit_id: i64,
    pub to_unit_id: i64,
    #[serde(default = "default_one")]
    pub factor: f64,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_true() -> bool { true }
fn default_one() -> f64 { 1.0 }

#[tauri::command]
pub async fn create_conversion(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: ConversionInput,
) -> Result<UnitConversion, String> {
    let pool = pool(&db_state)?;

    if input.from_unit_id == input.to_unit_id {
        return Err("from_unit_id and to_unit_id must differ".to_string());
    }
    if input.factor <= 0.0 {
        return Err("factor must be positive".to_string());
    }

    let _ = sqlx::query(
        r#"INSERT INTO unit_conversions
           (product_id, from_unit_id, to_unit_id, factor, is_active)
           VALUES (?, ?, ?, ?, ?)"#,
    )
    .bind(input.product_id)
    .bind(input.from_unit_id)
    .bind(input.to_unit_id)
    .bind(input.factor)
    .bind(input.is_active as i64)
    .execute(&*pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref de) = e {
            if de.is_unique_violation() {
                return "A conversion between these two units already exists for this product".to_string();
            }
            if de.is_foreign_key_violation() {
                return "Referenced product/unit does not exist".to_string();
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
pub struct ConversionUpdateInput {
    pub id: i64,
    pub factor: f64,
    pub is_active: bool,
}

#[tauri::command]
pub async fn update_conversion(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: ConversionUpdateInput,
) -> Result<UnitConversion, String> {
    let pool = pool(&db_state)?;
    if input.factor <= 0.0 {
        return Err("factor must be positive".to_string());
    }

    let res = sqlx::query(
        "UPDATE unit_conversions SET factor = ?, is_active = ? WHERE id = ?",
    )
    .bind(input.factor)
    .bind(input.is_active as i64)
    .bind(input.id)
    .execute(&*pool)
    .await
    .map_err(db_err)?;

    if res.rows_affected() == 0 {
        return Err("Conversion not found".to_string());
    }

    fetch_by_id(&pool, input.id).await
}

#[tauri::command]
pub async fn delete_conversion(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
) -> Result<String, String> {
    let pool = pool(&db_state)?;
    let res = sqlx::query("DELETE FROM unit_conversions WHERE id = ?")
        .bind(id)
        .execute(&*pool)
        .await
        .map_err(db_err)?;
    if res.rows_affected() == 0 {
        return Err("Conversion not found".to_string());
    }
    Ok(format!("Conversion {} deleted", id))
}

async fn fetch_by_id(pool: &crate::database::DbPool, id: i64) -> Result<UnitConversion, String> {
    sqlx::query_as::<_, UnitConversion>(
        "SELECT id, product_id, from_unit_id, to_unit_id, factor, is_active FROM unit_conversions WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&**pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Conversion not found".to_string(),
        other => db_err(other),
    })
}
