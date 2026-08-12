// commands/brands.rs - CRUD for product brands
//
// Schema (002_products_inventory.sql):
//   brands(id, name, description, is_active, created_at)
//
// brands.name is UNIQUE. Deletes are soft (set is_active = 0) by default.

use crate::commands::common::{db_err, pool};
use crate::database::models::Brand;
use crate::database::DbState;
use tauri::{State, AppHandle};

#[tauri::command]
pub async fn list_brands(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    active_only: Option<bool>,
) -> Result<Vec<Brand>, String> {
    let pool = pool(&db_state)?;
    let active_only = active_only.unwrap_or(true);
    let active_flag = if active_only { 1i64 } else { 0i64 };

    let rows = sqlx::query_as::<_, Brand>(
        r#"SELECT id, name, description, is_active, created_at
           FROM brands
           WHERE is_active = ? OR ? = 0
           ORDER BY name"#,
    )
    .bind(active_flag)
    .bind(active_flag)
    .fetch_all(&*pool)
    .await
    .map_err(db_err)?;

    Ok(rows)
}

#[derive(serde::Deserialize)]
pub struct BrandInput {
    pub name: String,
    pub description: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_true() -> bool { true }

#[tauri::command]
pub async fn create_brand(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: BrandInput,
) -> Result<Brand, String> {
    let pool = pool(&db_state)?;
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("Brand name is required".to_string());
    }

    let _ = sqlx::query(
        "INSERT INTO brands (name, description, is_active) VALUES (?, ?, ?)",
    )
    .bind(&name)
    .bind(&input.description)
    .bind(input.is_active as i64)
    .execute(&*pool)
    .await
    .map_err(map_db_err)?;

    let id: i64 = sqlx::query_scalar("SELECT last_insert_rowid()")
        .fetch_one(&*pool)
        .await
        .map_err(db_err)?;

    fetch_by_id(&pool, id).await
}

#[derive(serde::Deserialize)]
pub struct BrandUpdateInput {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
}

#[tauri::command]
pub async fn update_brand(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: BrandUpdateInput,
) -> Result<Brand, String> {
    let pool = pool(&db_state)?;
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("Brand name cannot be empty".to_string());
    }

    let res = sqlx::query(
        "UPDATE brands SET name = ?, description = ?, is_active = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(&input.description)
    .bind(input.is_active as i64)
    .bind(input.id)
    .execute(&*pool)
    .await
    .map_err(map_db_err)?;

    if res.rows_affected() == 0 {
        return Err("Brand not found".to_string());
    }

    fetch_by_id(&pool, input.id).await
}

#[tauri::command]
pub async fn delete_brand(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
    hard: Option<bool>,
) -> Result<String, String> {
    let pool = pool(&db_state)?;
    let hard = hard.unwrap_or(false);

    if hard {
        let prod_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM products WHERE brand_id = ?",
        )
        .bind(id)
        .fetch_one(&*pool)
        .await
        .map_err(db_err)?;
        if prod_count > 0 {
            return Err(format!(
                "Cannot delete: {} products still reference this brand. Reassign them first.",
                prod_count
            ));
        }

        sqlx::query("DELETE FROM brands WHERE id = ?")
            .bind(id)
            .execute(&*pool)
            .await
            .map_err(db_err)?;
        Ok(format!("Brand {} permanently deleted", id))
    } else {
        let res = sqlx::query("UPDATE brands SET is_active = 0 WHERE id = ?")
            .bind(id)
            .execute(&*pool)
            .await
            .map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err("Brand not found".to_string());
        }
        Ok(format!("Brand {} archived (soft-deleted)", id))
    }
}

async fn fetch_by_id(pool: &crate::database::DbPool, id: i64) -> Result<Brand, String> {
    sqlx::query_as::<_, Brand>(
        "SELECT id, name, description, is_active, created_at FROM brands WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&**pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Brand not found".to_string(),
        other => db_err(other),
    })
}

fn map_db_err(e: sqlx::Error) -> String {
    if let sqlx::Error::Database(ref de) = e {
        if de.is_unique_violation() {
            return "A brand with this name already exists".to_string();
        }
    }
    db_err(e)
}
