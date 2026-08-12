// commands/units.rs - CRUD for measurement units
//
// Schema (002_products_inventory.sql):
//   units(id, name, short_name, type, decimals, is_active)
//
// units.type is one of: 'count', 'weight', 'volume', 'length'.
// decimals controls how many decimal places to show in the UI.

use crate::commands::common::{db_err, pool};
use crate::database::models::Unit;
use crate::database::DbState;
use tauri::{State, AppHandle};

const VALID_TYPES: &[&str] = &["count", "weight", "volume", "length"];

#[tauri::command]
pub async fn list_units(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    active_only: Option<bool>,
    unit_type: Option<String>,
) -> Result<Vec<Unit>, String> {
    let pool = pool(&db_state)?;
    let active_only = active_only.unwrap_or(true);
    let active_flag = if active_only { 1i64 } else { 0i64 };

    // Note: column is named `type` in SQL — must be escaped with double quotes
    // or backticks in queries (SQLite treats both).
    let rows = if let Some(ut) = unit_type {
        if !VALID_TYPES.contains(&ut.as_str()) {
            return Err(format!(
                "Invalid unit type '{}'. Must be one of: {}",
                ut,
                VALID_TYPES.join(", ")
            ));
        }
        sqlx::query_as::<_, Unit>(
            r#"SELECT id, name, short_name, type as "type_", decimals, is_active
               FROM units
               WHERE (is_active = ? OR ? = 0) AND type = ?
               ORDER BY name"#,
        )
        .bind(active_flag)
        .bind(active_flag)
        .bind(ut)
        .fetch_all(&*pool)
        .await
    } else {
        sqlx::query_as::<_, Unit>(
            r#"SELECT id, name, short_name, type as "type_", decimals, is_active
               FROM units
               WHERE is_active = ? OR ? = 0
               ORDER BY name"#,
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
pub struct UnitInput {
    pub name: String,
    pub short_name: String,
    pub r#type: String, // 'type' is a reserved word in Rust, use r#type
    #[serde(default)]
    pub decimals: i64,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_true() -> bool { true }

#[tauri::command]
pub async fn create_unit(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: UnitInput,
) -> Result<Unit, String> {
    let pool = pool(&db_state)?;
    let name = input.name.trim().to_string();
    let short_name = input.short_name.trim().to_string();

    if name.is_empty() {
        return Err("Unit name is required".to_string());
    }
    if short_name.is_empty() {
        return Err("Unit short_name is required".to_string());
    }
    if !VALID_TYPES.contains(&input.r#type.as_str()) {
        return Err(format!(
            "Invalid unit type '{}'. Must be one of: {}",
            input.r#type,
            VALID_TYPES.join(", ")
        ));
    }

    let _ = sqlx::query(
        r#"INSERT INTO units (name, short_name, type, decimals, is_active)
           VALUES (?, ?, ?, ?, ?)"#,
    )
    .bind(&name)
    .bind(&short_name)
    .bind(&input.r#type)
    .bind(input.decimals)
    .bind(input.is_active as i64)
    .execute(&*pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref de) = e {
            if de.is_unique_violation() {
                return "A unit with this name or short_name already exists".to_string();
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
pub struct UnitUpdateInput {
    pub id: i64,
    pub name: String,
    pub short_name: String,
    pub r#type: String,
    pub decimals: i64,
    pub is_active: bool,
}

#[tauri::command]
pub async fn update_unit(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: UnitUpdateInput,
) -> Result<Unit, String> {
    let pool = pool(&db_state)?;
    let name = input.name.trim().to_string();
    let short_name = input.short_name.trim().to_string();

    if name.is_empty() {
        return Err("Unit name cannot be empty".to_string());
    }
    if short_name.is_empty() {
        return Err("Unit short_name cannot be empty".to_string());
    }
    if !VALID_TYPES.contains(&input.r#type.as_str()) {
        return Err(format!(
            "Invalid unit type '{}'. Must be one of: {}",
            input.r#type,
            VALID_TYPES.join(", ")
        ));
    }

    let res = sqlx::query(
        r#"UPDATE units
           SET name = ?, short_name = ?, type = ?, decimals = ?, is_active = ?
           WHERE id = ?"#,
    )
    .bind(&name)
    .bind(&short_name)
    .bind(&input.r#type)
    .bind(input.decimals)
    .bind(input.is_active as i64)
    .bind(input.id)
    .execute(&*pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref de) = e {
            if de.is_unique_violation() {
                return "A unit with this name or short_name already exists".to_string();
            }
        }
        db_err(e)
    })?;

    if res.rows_affected() == 0 {
        return Err("Unit not found".to_string());
    }

    fetch_by_id(&pool, input.id).await
}

#[tauri::command]
pub async fn delete_unit(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
    hard: Option<bool>,
) -> Result<String, String> {
    let pool = pool(&db_state)?;
    let hard = hard.unwrap_or(false);

    if hard {
        let prod_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM products WHERE unit_id = ?",
        )
        .bind(id)
        .fetch_one(&*pool)
        .await
        .map_err(db_err)?;
        if prod_count > 0 {
            return Err(format!(
                "Cannot delete: {} products use this unit. Reassign them first.",
                prod_count
            ));
        }

        // Also block if any unit_conversions reference it.
        let conv_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM unit_conversions WHERE from_unit_id = ? OR to_unit_id = ?",
        )
        .bind(id)
        .bind(id)
        .fetch_one(&*pool)
        .await
        .map_err(db_err)?;
        if conv_count > 0 {
            return Err(format!(
                "Cannot delete: {} unit conversions reference this unit.",
                conv_count
            ));
        }

        sqlx::query("DELETE FROM units WHERE id = ?")
            .bind(id)
            .execute(&*pool)
            .await
            .map_err(db_err)?;
        Ok(format!("Unit {} permanently deleted", id))
    } else {
        let res = sqlx::query("UPDATE units SET is_active = 0 WHERE id = ?")
            .bind(id)
            .execute(&*pool)
            .await
            .map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err("Unit not found".to_string());
        }
        Ok(format!("Unit {} archived (soft-deleted)", id))
    }
}

async fn fetch_by_id(pool: &crate::database::DbPool, id: i64) -> Result<Unit, String> {
    sqlx::query_as::<_, Unit>(
        r#"SELECT id, name, short_name, type as "type_", decimals, is_active
           FROM units WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(&**pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Unit not found".to_string(),
        other => db_err(other),
    })
}
