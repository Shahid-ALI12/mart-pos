// commands/expenses.rs - Expense CRUD + expense categories
use crate::commands::common::{db_err, pool, ListResponse};
use crate::database::models::{Expense, ExpenseCategory};
use crate::database::DbState;
use serde::Deserialize;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn list_expenses(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    query: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
    category_id: Option<i64>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<ListResponse<Expense>, String> {
    let pool = pool(&db_state)?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 500);
    let offset = (page - 1) * page_size;
    let q = query.unwrap_or_default().trim().to_string();
    let pattern = if q.is_empty() { "%".to_string() } else { format!("%{}%", q) };

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM expenses
           WHERE (description LIKE ? OR ? = '')
             AND (category_id = ? OR ? IS NULL)
             AND (date(expense_date) >= date(?) OR ? = '')
             AND (date(expense_date) <= date(?) OR ? = '')"#,
    )
    .bind(&pattern).bind(&q)
    .bind(category_id).bind(category_id)
    .bind(from_date.as_deref().unwrap_or("")).bind(from_date.as_deref().unwrap_or(""))
    .bind(to_date.as_deref().unwrap_or("")).bind(to_date.as_deref().unwrap_or(""))
    .fetch_one(&*pool).await.map_err(db_err)?;

    let rows = sqlx::query_as::<_, Expense>(
        r#"SELECT id, category_id, amount, expense_date, description,
                  payment_mode, reference, attachment_path, created_by,
                  created_at, updated_at
           FROM expenses
           WHERE (description LIKE ? OR ? = '')
             AND (category_id = ? OR ? IS NULL)
             AND (date(expense_date) >= date(?) OR ? = '')
             AND (date(expense_date) <= date(?) OR ? = '')
           ORDER BY expense_date DESC, id DESC
           LIMIT ? OFFSET ?"#,
    )
    .bind(&pattern).bind(&q)
    .bind(category_id).bind(category_id)
    .bind(from_date.as_deref().unwrap_or("")).bind(from_date.as_deref().unwrap_or(""))
    .bind(to_date.as_deref().unwrap_or("")).bind(to_date.as_deref().unwrap_or(""))
    .bind(page_size).bind(offset)
    .fetch_all(&*pool).await.map_err(db_err)?;

    Ok(ListResponse::new(rows, total, page, page_size))
}

#[derive(Deserialize)]
pub struct ExpenseInput {
    pub category_id: i64,
    pub amount: f64,
    pub expense_date: String,
    pub description: Option<String>,
    pub payment_mode: String,
    pub reference: Option<String>,
    pub created_by: i64,
}

#[tauri::command]
pub async fn create_expense(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: ExpenseInput,
) -> Result<Expense, String> {
    let pool = pool(&db_state)?;
    if input.amount <= 0.0 { return Err("Expense amount must be positive".into()); }
    if !matches!(input.payment_mode.as_str(), "cash" | "card" | "upi" | "bank" | "cheque" | "other") {
        return Err(format!("Invalid payment_mode: {}", input.payment_mode));
    }

    let res = sqlx::query(
        r#"INSERT INTO expenses
           (category_id, amount, expense_date, description, payment_mode,
            reference, attachment_path, created_by)
           VALUES (?, ?, ?, ?, ?, ?, NULL, ?)"#,
    )
    .bind(input.category_id)
    .bind(input.amount)
    .bind(&input.expense_date)
    .bind(input.description.as_deref())
    .bind(&input.payment_mode)
    .bind(input.reference.as_deref())
    .bind(input.created_by)
    .execute(&*pool).await.map_err(db_err)?;

    let id = res.last_insert_rowid();
    fetch_expense(&pool, id).await
}

#[derive(Deserialize)]
pub struct ExpenseUpdateInput {
    pub id: i64,
    pub category_id: i64,
    pub amount: f64,
    pub expense_date: String,
    pub description: Option<String>,
    pub payment_mode: String,
    pub reference: Option<String>,
}

#[tauri::command]
pub async fn update_expense(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: ExpenseUpdateInput,
) -> Result<Expense, String> {
    let pool = pool(&db_state)?;
    let res = sqlx::query(
        r#"UPDATE expenses SET category_id = ?, amount = ?, expense_date = ?,
            description = ?, payment_mode = ?, reference = ?,
            updated_at = CURRENT_TIMESTAMP WHERE id = ?"#,
    )
    .bind(input.category_id)
    .bind(input.amount)
    .bind(&input.expense_date)
    .bind(input.description.as_deref())
    .bind(&input.payment_mode)
    .bind(input.reference.as_deref())
    .bind(input.id)
    .execute(&*pool).await.map_err(db_err)?;

    if res.rows_affected() == 0 { return Err("Expense not found".into()); }
    fetch_expense(&pool, input.id).await
}

#[tauri::command]
pub async fn delete_expense(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
) -> Result<String, String> {
    let pool = pool(&db_state)?;
    let res = sqlx::query("DELETE FROM expenses WHERE id = ?")
        .bind(id).execute(&*pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 { return Err("Expense not found".into()); }
    Ok(format!("Expense {} deleted", id))
}

#[tauri::command]
pub async fn list_expense_categories(
    _app: AppHandle,
    db_state: State<'_, DbState>,
) -> Result<Vec<ExpenseCategory>, String> {
    let pool = pool(&db_state)?;
    let rows = sqlx::query_as::<_, ExpenseCategory>(
        "SELECT id, name, description, is_active, created_at FROM expense_categories WHERE is_active = 1 ORDER BY name",
    )
    .fetch_all(&*pool).await.map_err(db_err)?;
    Ok(rows)
}

async fn fetch_expense(pool: &crate::database::DbPool, id: i64) -> Result<Expense, String> {
    sqlx::query_as::<_, Expense>(
        r#"SELECT id, category_id, amount, expense_date, description,
                  payment_mode, reference, attachment_path, created_by,
                  created_at, updated_at FROM expenses WHERE id = ?"#,
    )
    .bind(id).fetch_one(&**pool).await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "Expense not found".to_string(),
        other => db_err(other),
    })
}
