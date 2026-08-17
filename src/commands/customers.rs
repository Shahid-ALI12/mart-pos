// commands/customers.rs - CRUD + search for customers
use crate::commands::common::{db_err, pool, ListResponse};
use crate::database::models::Customer;
use crate::database::DbState;
use serde::Deserialize;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn list_customers(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    query: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
    active_only: Option<bool>,
) -> Result<ListResponse<Customer>, String> {
    let pool = pool(&db_state)?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 500);
    let offset = (page - 1) * page_size;
    let q = query.unwrap_or_default().trim().to_string();
    let pattern = if q.is_empty() { "%".to_string() } else { format!("%{}%", q) };
    let active = if active_only.unwrap_or(true) { 1i64 } else { 0i64 };

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM customers
           WHERE (name LIKE ? OR customer_code LIKE ? OR phone LIKE ? OR ? = '')
             AND (is_active = 1 OR ? = 0)"#,
    )
    .bind(&pattern).bind(&pattern).bind(&pattern)
    .bind(&q).bind(active)
    .fetch_one(&*pool).await.map_err(db_err)?;

    let rows = sqlx::query_as::<_, Customer>(
        r#"SELECT id, customer_code, name, phone, email, address, gstin,
                  state_code, credit_limit, current_credit, loyalty_points,
                  customer_type, price_list_id, is_active, created_at, updated_at
           FROM customers
           WHERE (name LIKE ? OR customer_code LIKE ? OR phone LIKE ? OR ? = '')
             AND (is_active = 1 OR ? = 0)
           ORDER BY name
           LIMIT ? OFFSET ?"#,
    )
    .bind(&pattern).bind(&pattern).bind(&pattern)
    .bind(&q).bind(active)
    .bind(page_size).bind(offset)
    .fetch_all(&*pool).await.map_err(db_err)?;

    Ok(ListResponse::new(rows, total, page, page_size))
}

#[tauri::command]
pub async fn get_customer(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
) -> Result<Customer, String> {
    let pool = pool(&db_state)?;
    sqlx::query_as::<_, Customer>(
        r#"SELECT id, customer_code, name, phone, email, address, gstin,
                  state_code, credit_limit, current_credit, loyalty_points,
                  customer_type, price_list_id, is_active, created_at, updated_at
           FROM customers WHERE id = ?"#,
    )
    .bind(id)
    .fetch_one(&*pool).await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Customer not found".to_string(),
        other => db_err(other),
    })
}

#[tauri::command]
pub async fn search_customers(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<Customer>, String> {
    let pool = pool(&db_state)?;
    let limit = limit.unwrap_or(20).clamp(1, 100);
    let q = query.trim();
    if q.is_empty() { return Ok(vec![]); }
    let pattern = format!("%{}%", q);

    let rows = sqlx::query_as::<_, Customer>(
        r#"SELECT id, customer_code, name, phone, email, address, gstin,
                  state_code, credit_limit, current_credit, loyalty_points,
                  customer_type, price_list_id, is_active, created_at, updated_at
           FROM customers
           WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ? OR customer_code LIKE ?)
           ORDER BY name LIMIT ?"#,
    )
    .bind(&pattern).bind(&pattern).bind(&pattern)
    .bind(limit)
    .fetch_all(&*pool).await.map_err(db_err)?;

    Ok(rows)
}

#[derive(Deserialize)]
pub struct CustomerInput {
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub gstin: Option<String>,
    pub state_code: Option<i64>,
    #[serde(default)]
    pub credit_limit: f64,
    pub customer_type: Option<String>,  // defaults to 'walkin'
    pub price_list_id: Option<i64>,
    #[serde(default = "default_true")]
    pub is_active: bool,
}
fn default_true() -> bool { true }

#[tauri::command]
pub async fn create_customer(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: CustomerInput,
) -> Result<Customer, String> {
    let pool = pool(&db_state)?;
    let name = input.name.trim().to_string();
    if name.is_empty() { return Err("Customer name is required".into()); }

    // Auto-generate customer code: CUST<next_sequence>
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM customers")
        .fetch_one(&*pool).await.map_err(db_err)?;
    let customer_code = format!("CUST{:04}", count + 1);

    let ctype = input.customer_type.unwrap_or_else(|| "walkin".to_string());
    // Validate against CHECK constraint
    if !matches!(ctype.as_str(), "walkin" | "regular" | "wholesale" | "corporate") {
        return Err(format!("Invalid customer_type: {}", ctype));
    }

    let res = sqlx::query(
        r#"INSERT INTO customers
           (customer_code, name, phone, email, address, gstin, state_code,
            credit_limit, current_credit, loyalty_points, customer_type,
            price_list_id, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)"#,
    )
    .bind(&customer_code)
    .bind(&name)
    .bind(&input.phone)
    .bind(&input.email)
    .bind(&input.address)
    .bind(&input.gstin)
    .bind(input.state_code)
    .bind(input.credit_limit)
    .bind(&ctype)
    .bind(input.price_list_id)
    .bind(input.is_active as i64)
    .execute(&*pool).await
    .map_err(|e| map_customer_err(e))?;

    let id = res.last_insert_rowid();
    fetch_customer(&pool, id).await
}

#[derive(Deserialize)]
pub struct CustomerUpdateInput {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub gstin: Option<String>,
    pub state_code: Option<i64>,
    pub credit_limit: f64,
    pub customer_type: String,
    pub price_list_id: Option<i64>,
    pub is_active: bool,
}

#[tauri::command]
pub async fn update_customer(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: CustomerUpdateInput,
) -> Result<Customer, String> {
    let pool = pool(&db_state)?;
    let name = input.name.trim().to_string();
    if name.is_empty() { return Err("Customer name cannot be empty".into()); }
    if !matches!(input.customer_type.as_str(), "walkin" | "regular" | "wholesale" | "corporate") {
        return Err(format!("Invalid customer_type: {}", input.customer_type));
    }

    let res = sqlx::query(
        r#"UPDATE customers SET name = ?, phone = ?, email = ?, address = ?,
            gstin = ?, state_code = ?, credit_limit = ?, customer_type = ?,
            price_list_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?"#,
    )
    .bind(&name)
    .bind(&input.phone)
    .bind(&input.email)
    .bind(&input.address)
    .bind(&input.gstin)
    .bind(input.state_code)
    .bind(input.credit_limit)
    .bind(&input.customer_type)
    .bind(input.price_list_id)
    .bind(input.is_active as i64)
    .bind(input.id)
    .execute(&*pool).await
    .map_err(map_customer_err)?;

    if res.rows_affected() == 0 { return Err("Customer not found".into()); }
    fetch_customer(&pool, input.id).await
}

#[tauri::command]
pub async fn delete_customer(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
    hard: Option<bool>,
) -> Result<String, String> {
    let pool = pool(&db_state)?;
    if hard.unwrap_or(false) {
        sqlx::query("DELETE FROM customers WHERE id = ?")
            .bind(id).execute(&*pool).await.map_err(db_err)?;
        Ok(format!("Customer {} permanently deleted", id))
    } else {
        let res = sqlx::query("UPDATE customers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(id).execute(&*pool).await.map_err(db_err)?;
        if res.rows_affected() == 0 { return Err("Customer not found".into()); }
        Ok(format!("Customer {} archived", id))
    }
}

async fn fetch_customer(pool: &crate::database::DbPool, id: i64) -> Result<Customer, String> {
    sqlx::query_as::<_, Customer>(
        r#"SELECT id, customer_code, name, phone, email, address, gstin,
                  state_code, credit_limit, current_credit, loyalty_points,
                  customer_type, price_list_id, is_active, created_at, updated_at
           FROM customers WHERE id = ?"#,
    )
    .bind(id).fetch_one(&**pool).await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Customer not found".to_string(),
        other => db_err(other),
    })
}

fn map_customer_err(e: sqlx::Error) -> String {
    if let sqlx::Error::Database(ref de) = e {
        if de.is_unique_violation() { return "A customer with this code or phone already exists".into(); }
    }
    db_err(e)
}
