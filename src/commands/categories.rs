// commands/categories.rs - CRUD for product categories
//
// Schema (002_products_inventory.sql):
//   categories(id, name, parent_id, gst_rate, hsn_code, description, is_active,
//              created_at, updated_at)
//
// Conventions:
//   - list_* return plain `Vec<T>` (frontend uses these for dropdowns).
//   - create/update return the freshly fetched row (`T`) so the caller doesn't
//     need a separate refresh round-trip.
//   - delete soft-deletes by setting is_active = 0 (preserves FK integrity —
//     existing invoices still reference the category id).
//   - A hard delete is supported only when no FK references the row.

use crate::commands::common::{db_err, pool};
use crate::database::models::Category;
use tauri::{State, AppHandle};
use crate::database::DbState;

#[tauri::command]
pub async fn list_categories(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    active_only: Option<bool>,
) -> Result<Vec<Category>, String> {
    let pool = pool(&db_state)?;
    let active_only = active_only.unwrap_or(true);

    // SQLite has no native BOOLEAN type, so `is_active = ?` with bool gets
    // stored as 1/0. We bind as i64 for clarity.
    let active_flag = if active_only { 1i64 } else { 0i64 };

    let rows = sqlx::query_as::<_, Category>(
        r#"SELECT id, name, parent_id, gst_rate, hsn_code, description,
                  is_active, created_at, updated_at
           FROM categories
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

/// Input for creating a new category. `parent_id` is optional (null = top-level).
#[derive(serde::Deserialize)]
pub struct CategoryInput {
    pub name: String,
    pub parent_id: Option<i64>,
    #[serde(default)]
    pub gst_rate: f64,
    pub hsn_code: Option<String>,
    pub description: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
}

fn default_true() -> bool { true }

#[tauri::command]
pub async fn create_category(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: CategoryInput,
) -> Result<Category, String> {
    let pool = pool(&db_state)?;
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("Category name is required".to_string());
    }

    let _ = sqlx::query(
        r#"INSERT INTO categories (name, parent_id, gst_rate, hsn_code, description, is_active)
           VALUES (?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&name)
    .bind(input.parent_id)
    .bind(input.gst_rate)
    .bind(&input.hsn_code)
    .bind(&input.description)
    .bind(input.is_active as i64)
    .execute(&*pool)
    .await
    .map_err(|e| map_db_err(e, "category"))?;

    let id = last_insert_id(&pool).await?;
    fetch_by_id(&pool, id).await
}

/// Full-replacement update (PATCH-style is awkward with Tauri's param binding).
#[derive(serde::Deserialize)]
pub struct CategoryUpdateInput {
    pub id: i64,
    pub name: String,
    pub parent_id: Option<i64>,
    pub gst_rate: f64,
    pub hsn_code: Option<String>,
    pub description: Option<String>,
    pub is_active: bool,
}

#[tauri::command]
pub async fn update_category(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: CategoryUpdateInput,
) -> Result<Category, String> {
    let pool = pool(&db_state)?;
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("Category name cannot be empty".to_string());
    }

    let res = sqlx::query(
        r#"UPDATE categories
           SET name = ?, parent_id = ?, gst_rate = ?, hsn_code = ?,
               description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?"#,
    )
    .bind(&name)
    .bind(input.parent_id)
    .bind(input.gst_rate)
    .bind(&input.hsn_code)
    .bind(&input.description)
    .bind(input.is_active as i64)
    .bind(input.id)
    .execute(&*pool)
    .await
    .map_err(|e| map_db_err(e, "category"))?;

    if res.rows_affected() == 0 {
        return Err("Category not found".to_string());
    }

    fetch_by_id(&pool, input.id).await
}

#[tauri::command]
pub async fn delete_category(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
    hard: Option<bool>,
) -> Result<String, String> {
    let pool = pool(&db_state)?;
    let hard = hard.unwrap_or(false);

    if hard {
        let child_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM categories WHERE parent_id = ?",
        )
        .bind(id)
        .fetch_one(&*pool)
        .await
        .map_err(db_err)?;
        if child_count > 0 {
            return Err(format!(
                "Cannot delete: {} sub-categories still reference this category. Move or delete them first.",
                child_count
            ));
        }

        let prod_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM products WHERE category_id = ?",
        )
        .bind(id)
        .fetch_one(&*pool)
        .await
        .map_err(db_err)?;
        if prod_count > 0 {
            return Err(format!(
                "Cannot delete: {} products still reference this category. Reassign them first.",
                prod_count
            ));
        }

        sqlx::query("DELETE FROM categories WHERE id = ?")
            .bind(id)
            .execute(&*pool)
            .await
            .map_err(db_err)?;
        Ok(format!("Category {} permanently deleted", id))
    } else {
        let res = sqlx::query(
            "UPDATE categories SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(id)
        .execute(&*pool)
        .await
        .map_err(db_err)?;
        if res.rows_affected() == 0 {
            return Err("Category not found".to_string());
        }
        Ok(format!("Category {} archived (soft-deleted)", id))
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async fn last_insert_id(pool: &crate::database::DbPool) -> Result<i64, String> {
    let id: i64 = sqlx::query_scalar("SELECT last_insert_rowid()")
        .fetch_one(&**pool)
        .await
        .map_err(db_err)?;
    Ok(id)
}

async fn fetch_by_id(pool: &crate::database::DbPool, id: i64) -> Result<Category, String> {
    sqlx::query_as::<_, Category>(
        r#"SELECT id, name, parent_id, gst_rate, hsn_code, description,
                  is_active, created_at, updated_at
           FROM categories WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(&**pool)
    .await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Category not found".to_string(),
        other => db_err(other),
    })
}

fn map_db_err(e: sqlx::Error, entity: &str) -> String {
    if let sqlx::Error::Database(ref de) = e {
        if de.is_unique_violation() {
            return format!("A {} with this name already exists", entity);
        }
        if de.is_foreign_key_violation() {
            return "Referenced parent does not exist".to_string();
        }
    }
    db_err(e)
}
