// commands/suppliers.rs - CRUD for suppliers
use crate::commands::common::{db_err, pool, ListResponse};
use crate::database::models::Supplier;
use crate::database::DbState;
use serde::Deserialize;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn list_suppliers(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    query: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
    active_only: Option<bool>,
) -> Result<ListResponse<Supplier>, String> {
    let pool = pool(&db_state)?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 500);
    let offset = (page - 1) * page_size;
    let q = query.unwrap_or_default().trim().to_string();
    let pattern = if q.is_empty() { "%".to_string() } else { format!("%{}%", q) };
    let active = if active_only.unwrap_or(true) { 1i64 } else { 0i64 };

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM suppliers
           WHERE (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR gstin LIKE ? OR ? = '')
             AND (is_active = 1 OR ? = 0)"#,
    )
    .bind(&pattern).bind(&pattern).bind(&pattern).bind(&pattern)
    .bind(&q).bind(active)
    .fetch_one(&*pool).await.map_err(db_err)?;

    let rows = sqlx::query_as::<_, Supplier>(
        r#"SELECT id, name, contact_person, phone, email, address, gstin,
                  state_code, payment_terms_days, opening_balance, credit_limit,
                  is_active, created_at, updated_at
           FROM suppliers
           WHERE (name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR gstin LIKE ? OR ? = '')
             AND (is_active = 1 OR ? = 0)
           ORDER BY name
           LIMIT ? OFFSET ?"#,
    )
    .bind(&pattern).bind(&pattern).bind(&pattern).bind(&pattern)
    .bind(&q).bind(active)
    .bind(page_size).bind(offset)
    .fetch_all(&*pool).await.map_err(db_err)?;

    Ok(ListResponse::new(rows, total, page, page_size))
}

#[tauri::command]
pub async fn get_supplier(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
) -> Result<Supplier, String> {
    let pool = pool(&db_state)?;
    sqlx::query_as::<_, Supplier>(
        r#"SELECT id, name, contact_person, phone, email, address, gstin,
                  state_code, payment_terms_days, opening_balance, credit_limit,
                  is_active, created_at, updated_at
           FROM suppliers WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(&*pool).await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Supplier not found".to_string(),
        other => db_err(other),
    })
}

#[derive(Deserialize)]
pub struct SupplierInput {
    pub name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub gstin: Option<String>,
    pub state_code: Option<i64>,
    #[serde(default = "default_30")]
    pub payment_terms_days: i64,
    #[serde(default)]
    pub opening_balance: f64,
    pub credit_limit: Option<f64>,
    #[serde(default = "default_true")]
    pub is_active: bool,
}
fn default_30() -> i64 { 30 }
fn default_true() -> bool { true }

#[tauri::command]
pub async fn create_supplier(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: SupplierInput,
) -> Result<Supplier, String> {
    let pool = pool(&db_state)?;
    let name = input.name.trim().to_string();
    if name.is_empty() { return Err("Supplier name is required".into()); }

    let res = sqlx::query(
        r#"INSERT INTO suppliers
           (name, contact_person, phone, email, address, gstin, state_code,
            payment_terms_days, opening_balance, credit_limit, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&name)
    .bind(&input.contact_person)
    .bind(&input.phone)
    .bind(&input.email)
    .bind(&input.address)
    .bind(&input.gstin)
    .bind(input.state_code)
    .bind(input.payment_terms_days)
    .bind(input.opening_balance)
    .bind(input.credit_limit)
    .bind(input.is_active as i64)
    .execute(&*pool).await
    .map_err(|e| map_supplier_err(e))?;

    let id = res.last_insert_rowid();
    fetch_supplier(&pool, id).await
}

#[derive(Deserialize)]
pub struct SupplierUpdateInput {
    pub id: i64,
    pub name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub gstin: Option<String>,
    pub state_code: Option<i64>,
    pub payment_terms_days: i64,
    pub opening_balance: f64,
    pub credit_limit: Option<f64>,
    pub is_active: bool,
}

#[tauri::command]
pub async fn update_supplier(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: SupplierUpdateInput,
) -> Result<Supplier, String> {
    let pool = pool(&db_state)?;
    let name = input.name.trim().to_string();
    if name.is_empty() { return Err("Supplier name cannot be empty".into()); }

    let res = sqlx::query(
        r#"UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?,
            address = ?, gstin = ?, state_code = ?, payment_terms_days = ?,
            opening_balance = ?, credit_limit = ?, is_active = ?,
            updated_at = CURRENT_TIMESTAMP WHERE id = ?"#,
    )
    .bind(&name)
    .bind(&input.contact_person)
    .bind(&input.phone)
    .bind(&input.email)
    .bind(&input.address)
    .bind(&input.gstin)
    .bind(input.state_code)
    .bind(input.payment_terms_days)
    .bind(input.opening_balance)
    .bind(input.credit_limit)
    .bind(input.is_active as i64)
    .bind(input.id)
    .execute(&*pool).await
    .map_err(map_supplier_err)?;

    if res.rows_affected() == 0 { return Err("Supplier not found".into()); }
    fetch_supplier(&pool, input.id).await
}

#[tauri::command]
pub async fn delete_supplier(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
    hard: Option<bool>,
) -> Result<String, String> {
    let pool = pool(&db_state)?;
    if hard.unwrap_or(false) {
        sqlx::query("DELETE FROM suppliers WHERE id = ?")
            .bind(id).execute(&*pool).await.map_err(db_err)?;
        Ok(format!("Supplier {} permanently deleted", id))
    } else {
        let res = sqlx::query("UPDATE suppliers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(id).execute(&*pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 { return Err("Supplier not found".into()); }
        Ok(format!("Supplier {} archived", id))
    }
}

async fn fetch_supplier(pool: &crate::database::DbPool, id: i64) -> Result<Supplier, String> {
    sqlx::query_as::<_, Supplier>(
        r#"SELECT id, name, contact_person, phone, email, address, gstin,
                  state_code, payment_terms_days, opening_balance, credit_limit,
                  is_active, created_at, updated_at FROM suppliers WHERE id = ?"#,
    )
    .bind(id).fetch_one(&**pool).await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Supplier not found".to_string(),
        other => db_err(other),
    })
}

fn map_supplier_err(e: sqlx::Error) -> String {
    if let sqlx::Error::Database(ref de) = e {
        if de.is_unique_violation() { return "A supplier with this name already exists".into(); }
    }
    db_err(e)
}
