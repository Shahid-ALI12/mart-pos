// commands/users.rs - User CRUD + roles
use crate::commands::common::{db_err, pool, ListResponse};
use crate::database::models::{User, Role, UserWithRole};
use crate::database::DbState;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::SaltString};
use argon2::password_hash::rand_core::OsRng;
use serde::Deserialize;
use sqlx::Row;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn list_users(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    query: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
    active_only: Option<bool>,
) -> Result<ListResponse<UserWithRole>, String> {
    let pool = pool(&db_state)?;
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(20).clamp(1, 500);
    let offset = (page - 1) * page_size;
    let q = query.unwrap_or_default().trim().to_string();
    let pattern = if q.is_empty() { "%".to_string() } else { format!("%{}%", q) };
    let active = if active_only.unwrap_or(false) { 1i64 } else { 0i64 };

    let total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM users
           WHERE (name LIKE ? OR username LIKE ? OR ? = '')
             AND (is_active = 1 OR ? = 0)"#,
    )
    .bind(&pattern).bind(&pattern).bind(&q).bind(active)
    .fetch_one(&*pool).await.map_err(db_err)?;

    // ponytail: join users+roles inline instead of a separate repo struct
    let rows = sqlx::query(
        r#"SELECT u.id, u.username, u.password_hash, u.role_id, u.name,
                  u.phone, u.email, u.is_active, u.last_login,
                  u.must_change_password, u.created_at, u.updated_at,
                  r.name as role_name, r.permissions as role_permissions
           FROM users u JOIN roles r ON u.role_id = r.id
           WHERE (u.name LIKE ? OR u.username LIKE ? OR ? = '')
             AND (u.is_active = 1 OR ? = 0)
           ORDER BY u.name
           LIMIT ? OFFSET ?"#,
    )
    .bind(&pattern).bind(&pattern).bind(&q).bind(active)
    .bind(page_size).bind(offset)
    .fetch_all(&*pool).await
    .map_err(db_err)?
    .into_iter()
    .map(|r| {
        let user = User {
            id: r.try_get("id").unwrap_or(0),
            username: r.try_get("username").unwrap_or_default(),
            password_hash: r.try_get("password_hash").unwrap_or_default(),
            role_id: r.try_get("role_id").unwrap_or(0),
            name: r.try_get("name").unwrap_or_default(),
            phone: r.try_get("phone").ok(),
            email: r.try_get("email").ok(),
            is_active: r.try_get("is_active").unwrap_or(false),
            last_login: r.try_get("last_login").ok(),
            must_change_password: r.try_get("must_change_password").unwrap_or(false),
            created_at: r.try_get("created_at").unwrap_or_default(),
            updated_at: r.try_get("updated_at").unwrap_or_default(),
        };
        let role_name: String = r.try_get("role_name").unwrap_or_default();
        let role_permissions: String = r.try_get("role_permissions").unwrap_or_else(|_| "[]".to_string());
        UserWithRole { user, role_name, role_permissions }
    })
    .collect();

    Ok(ListResponse::new(rows, total, page, page_size))
}

#[derive(Deserialize)]
pub struct UserInput {
    pub username: String,
    pub password: String,
    pub name: String,
    pub role_id: i64,
    pub phone: Option<String>,
    pub email: Option<String>,
    #[serde(default = "default_true")]
    pub is_active: bool,
}
fn default_true() -> bool { true }

#[tauri::command]
pub async fn create_user(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: UserInput,
) -> Result<UserWithRole, String> {
    let pool = pool(&db_state)?;
    let username = input.username.trim().to_string();
    let name = input.name.trim().to_string();
    if username.is_empty() || name.is_empty() {
        return Err("Username and name are required".into());
    }
    if input.password.len() < 4 {
        return Err("Password must be at least 4 characters".into());
    }

    // Hash password with Argon2id
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2.hash_password(input.password.as_bytes(), &salt)
        .map_err(|e| format!("Password hashing failed: {}", e))?
        .to_string();

    let res = sqlx::query(
        r#"INSERT INTO users (username, password_hash, role_id, name, phone, email, is_active, must_change_password)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)"#,
    )
    .bind(&username)
    .bind(&hash)
    .bind(input.role_id)
    .bind(&name)
    .bind(&input.phone)
    .bind(&input.email)
    .bind(input.is_active as i64)
    .execute(&*pool).await
    .map_err(|e| {
        if let sqlx::Error::Database(ref de) = e {
            if de.is_unique_violation() { return "Username already exists".to_string(); }
        }
        db_err(e)
    })?;

    let id = res.last_insert_rowid();
    fetch_user_with_role(&pool, id).await
}

#[derive(Deserialize)]
pub struct UserUpdateInput {
    pub id: i64,
    pub name: String,
    pub role_id: i64,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub is_active: bool,
    // Optional password — if provided, reset it
    pub new_password: Option<String>,
}

#[tauri::command]
pub async fn update_user(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: UserUpdateInput,
) -> Result<UserWithRole, String> {
    let pool = pool(&db_state)?;
    let name = input.name.trim().to_string();
    if name.is_empty() { return Err("Name cannot be empty".into()); }

    if let Some(ref pw) = input.new_password {
        if pw.len() < 4 { return Err("Password must be at least 4 characters".into()); }
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2.hash_password(pw.as_bytes(), &salt)
            .map_err(|e| format!("Password hashing failed: {}", e))?
            .to_string();
        sqlx::query("UPDATE users SET name = ?, role_id = ?, phone = ?, email = ?, is_active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(&name).bind(input.role_id)
            .bind(&input.phone).bind(&input.email)
            .bind(input.is_active as i64)
            .bind(&hash).bind(input.id)
            .execute(&*pool).await.map_err(db_err)?;
    } else {
        sqlx::query("UPDATE users SET name = ?, role_id = ?, phone = ?, email = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(&name).bind(input.role_id)
            .bind(&input.phone).bind(&input.email)
            .bind(input.is_active as i64)
            .bind(input.id)
            .execute(&*pool).await.map_err(db_err)?;
    }

    fetch_user_with_role(&pool, input.id).await
}

#[tauri::command]
pub async fn delete_user(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    id: i64,
) -> Result<String, String> {
    let pool = pool(&db_state)?;
    if id == 1 { return Err("Cannot delete the default admin user".into()); }
    let res = sqlx::query("UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(id).execute(&*pool).await.map_err(db_err)?;
    if res.rows_affected() == 0 { return Err("User not found".into()); }
    Ok(format!("User {} archived", id))
}

#[tauri::command]
pub async fn get_roles(
    _app: AppHandle,
    db_state: State<'_, DbState>,
) -> Result<Vec<Role>, String> {
    let pool = pool(&db_state)?;
    let rows = sqlx::query_as::<_, Role>(
        "SELECT id, name, permissions, description, created_at FROM roles ORDER BY id",
    )
    .fetch_all(&*pool).await.map_err(db_err)?;
    Ok(rows)
}

async fn fetch_user_with_role(pool: &crate::database::DbPool, id: i64) -> Result<UserWithRole, String> {
    let row = sqlx::query(
        r#"SELECT u.id, u.username, u.password_hash, u.role_id, u.name,
                  u.phone, u.email, u.is_active, u.last_login,
                  u.must_change_password, u.created_at, u.updated_at,
                  r.name as role_name, r.permissions as role_permissions
           FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?"#,
    )
    .bind(id)
    .fetch_one(&**pool).await
    .map_err(|e| match e {
        sqlx::Error::RowNotFound => "User not found".to_string(),
        other => db_err(other),
    })?;

    let user = User {
        id: row.try_get("id").unwrap_or(0),
        username: row.try_get("username").unwrap_or_default(),
        password_hash: row.try_get("password_hash").unwrap_or_default(),
        role_id: row.try_get("role_id").unwrap_or(0),
        name: row.try_get("name").unwrap_or_default(),
        phone: row.try_get("phone").ok(),
        email: row.try_get("email").ok(),
        is_active: row.try_get("is_active").unwrap_or(false),
        last_login: row.try_get("last_login").ok(),
        must_change_password: row.try_get("must_change_password").unwrap_or(false),
        created_at: row.try_get("created_at").unwrap_or_default(),
        updated_at: row.try_get("updated_at").unwrap_or_default(),
    };
    let role_name: String = row.try_get("role_name").unwrap_or_default();
    let role_permissions: String = row.try_get("role_permissions").unwrap_or_else(|_| "[]".to_string());

    Ok(UserWithRole { user, role_name, role_permissions })
}
