// commands/auth.rs - Authentication commands
use crate::database::{Database, DbState};
use crate::database::models::{User, UserWithRole, LoginRequest, LoginResponse};
use tauri::{State, AppHandle};
use argon2::{Argon2, PasswordHash, PasswordVerifier};
use sqlx::Row;
use anyhow::Result;

fn get_pool(db_state: &DbState) -> Result<crate::database::DbPool, String> {
    Database::get_pool(db_state).map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn login(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    username: String,
    password: String,
) -> Result<LoginResponse, String> {
    let pool = get_pool(&db_state)?;
    
    let user_row = sqlx::query(
        r#"
        SELECT u.id, u.username, u.password_hash, u.role_id, u.name, u.phone, u.email,
               u.is_active, u.last_login, u.created_at, u.updated_at,
               r.name as role_name, r.permissions as role_permissions
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.username = ? AND u.is_active = 1
        "#,
    )
    .bind(username)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let row = user_row.ok_or("Invalid username or password")?;
    
    // Verify password
    let password_hash: String = row.try_get("password_hash").map_err(|_| "Invalid password hash")?;
    let parsed_hash = PasswordHash::new(&password_hash).map_err(|_| "Invalid password hash")?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| "Invalid username or password")?;

    // Update last login
    let user_id: i64 = row.try_get("id").unwrap_or(0);
    sqlx::query("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(user_id)
        .execute(&*pool)
        .await
        .ok();

    // Parse permissions
    let role_permissions: String = row.try_get("role_permissions").unwrap_or_else(|_| "[]".to_string());
    let permissions: Vec<String> = serde_json::from_str(&role_permissions)
        .unwrap_or_else(|_| vec!["*".to_string()]);

    let user = UserWithRole {
        user: User {
            id: user_id,
            username: row.try_get("username").unwrap_or_default(),
            password_hash: password_hash,
            role_id: row.try_get("role_id").unwrap_or(3),
            name: row.try_get("name").unwrap_or_default(),
            phone: row.try_get("phone").ok(),
            email: row.try_get("email").ok(),
            is_active: row.try_get("is_active").unwrap_or(true),
            last_login: row.try_get("last_login").ok(),
            created_at: row.try_get("created_at").unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
            updated_at: row.try_get("updated_at").unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
        },
        role_name: row.try_get("role_name").unwrap_or_default(),
        role_permissions: role_permissions,
    };

    // Generate simple token (in production use proper JWT)
    let token = format!("{}:{}", user.user.id, chrono::Utc::now().timestamp());

    Ok(LoginResponse {
        user,
        token,
        permissions,
    })
}

#[tauri::command]
pub async fn logout() -> Result<String, String> {
    Ok("Logged out".to_string())
}

#[tauri::command]
pub async fn get_current_user(
    _app: AppHandle,
    _db_state: State<'_, DbState>,
) -> Result<LoginResponse, String> {
    Err("Not implemented".to_string())
}

#[tauri::command]
pub async fn change_password(
    _app: AppHandle,
    _db_state: State<'_, DbState>,
    _old_password: String,
    _new_password: String,
) -> Result<String, String> {
    Err("Not implemented".to_string())
}