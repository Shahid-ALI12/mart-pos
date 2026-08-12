// commands/auth.rs - Authentication commands with JWT (HMAC-SHA256)
//
// Token strategy:
//   - Login returns a signed JWT containing user_id, role, permissions, exp, iat, jti.
//   - The HMAC secret is stored in the `settings` table (key='jwt_secret').
//     On first run, a 64-char random secret is generated and persisted.
//   - `get_current_user` accepts the token as a parameter, verifies signature + expiry,
//     re-fetches the freshest user row from the DB, and returns a refreshed LoginResponse.
//   - `change_password` requires the token (so the user is authenticated), verifies the
//     old password, hashes the new one with Argon2id, updates the DB, and clears the
//     `must_change_password` flag (so the seeded admin can be un-locked after first change).
//   - `logout` is a no-op on the server (stateless JWT). The frontend clears its persisted
//     state. A token blacklist via `jti` is a future enhancement.

use crate::database::{Database, DbState, DbPool};
use crate::database::models::{Claims, User, UserWithRole, LoginResponse};
use tauri::{State, AppHandle};
use argon2::{
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
    password_hash::rand_core::OsRng,
    password_hash::SaltString,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use sqlx::Row;
use anyhow::Result;
use rand::Rng;

const TOKEN_TTL_SECONDS: i64 = 24 * 60 * 60; // 24 hours
const JWT_SECRET_KEY: &str = "jwt_secret";

fn get_pool(db_state: &DbState) -> Result<DbPool, String> {
    Database::get_pool(db_state).map_err(|e| format!("Database error: {}", e))
}

// ----------------------------------------------------------------------------
// JWT helpers
// ----------------------------------------------------------------------------

/// Read the HMAC secret from the `settings` table. If absent, generate a fresh
/// 64-char alphanumeric secret, persist it, and return it.
async fn get_or_create_jwt_secret(pool: &DbPool) -> Result<String, String> {
    let row = sqlx::query("SELECT value FROM settings WHERE key = ?")
        .bind(JWT_SECRET_KEY)
        .fetch_optional(&**pool)
        .await
        .map_err(|e| format!("Failed to read jwt_secret: {}", e))?;

    if let Some(row) = row {
        let raw: String = row.try_get("value").map_err(|_| "Invalid jwt_secret row".to_string())?;
        // Settings values are stored as JSON strings, e.g. "\"abc...\"" — unwrap one level.
        let secret: String = serde_json::from_str(&raw)
            .unwrap_or_else(|_| raw.trim_matches('"').to_string());
        if secret.len() >= 32 {
            return Ok(secret);
        }
    }

    // Generate a new 64-char secret
    let secret: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(64)
        .map(char::from)
        .collect();

    let json_secret = serde_json::to_string(&secret).unwrap_or_else(|_| format!("\"{}\"", secret));
    sqlx::query(
        "INSERT INTO settings (key, value, description) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(JWT_SECRET_KEY)
    .bind(&json_secret)
    .bind("HMAC-SHA256 secret used to sign JWTs (auto-generated, do not share)")
    .execute(&**pool)
    .await
    .map_err(|e| format!("Failed to persist jwt_secret: {}", e))?;

    Ok(secret)
}

/// Build a signed JWT for the given user + permissions.
async fn create_token(pool: &DbPool, user_id: i64, role_id: i64, permissions: Vec<String>) -> Result<String, String> {
    let now = chrono::Utc::now().timestamp() as usize;
    let exp = now + (TOKEN_TTL_SECONDS as usize);

    // jti: a random 16-char id, unique per token. Used later if we add a blacklist.
    let jti: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(16)
        .map(char::from)
        .collect();

    let claims = Claims {
        sub: user_id,
        role_id,
        permissions: permissions.clone(),
        exp,
        iat: now,
        jti,
    };

    let secret = get_or_create_jwt_secret(pool).await?;
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| format!("Failed to sign token: {}", e))?;

    Ok(token)
}

/// Verify a JWT's signature + expiry and return the claims.
async fn verify_token(pool: &DbPool, token: &str) -> Result<Claims, String> {
    let secret = get_or_create_jwt_secret(pool).await?;
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(), // default validates exp and rejects future iat
    )
    .map_err(|e| match e.kind() {
        jsonwebtoken::errors::ErrorKind::ExpiredSignature => "Token expired".to_string(),
        jsonwebtoken::errors::ErrorKind::InvalidSignature => "Invalid token signature".to_string(),
        _ => format!("Invalid token: {}", e),
    })?;
    Ok(token_data.claims)
}

// ----------------------------------------------------------------------------
// Password hashing
// ----------------------------------------------------------------------------

/// Hash a password with Argon2id using the same defaults as Argon2::default()
/// (m=19456, t=2, p=1, hash_len=32). Returns a PHC string.
fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Failed to hash password: {}", e))?;
    Ok(hash.to_string())
}

// ----------------------------------------------------------------------------
// User fetching
// ----------------------------------------------------------------------------

/// Fetch a single user joined with role, by user_id.
async fn fetch_user_with_role(pool: &DbPool, user_id: i64) -> Result<UserWithRole, String> {
    let row = sqlx::query(
        r#"
        SELECT u.id, u.username, u.password_hash, u.role_id, u.name, u.phone, u.email,
               u.is_active, u.last_login, u.must_change_password, u.created_at, u.updated_at,
               r.name as role_name, r.permissions as role_permissions
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = ? AND u.is_active = 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&**pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?
    .ok_or_else(|| "User not found or inactive".to_string())?;

    let password_hash: String = row.try_get("password_hash").unwrap_or_default();
    let role_permissions: String = row.try_get("role_permissions").unwrap_or_else(|_| "[]".to_string());
    let user_id_db: i64 = row.try_get("id").unwrap_or(0);

    let user = User {
        id: user_id_db,
        username: row.try_get("username").unwrap_or_default(),
        password_hash,
        role_id: row.try_get("role_id").unwrap_or(3),
        name: row.try_get("name").unwrap_or_default(),
        phone: row.try_get("phone").ok(),
        email: row.try_get("email").ok(),
        is_active: row.try_get("is_active").unwrap_or(true),
        last_login: row.try_get("last_login").ok(),
        must_change_password: row.try_get("must_change_password").unwrap_or(false),
        created_at: row.try_get("created_at").unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
        updated_at: row.try_get("updated_at").unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
    };

    Ok(UserWithRole {
        user,
        role_name: row.try_get("role_name").unwrap_or_default(),
        role_permissions,
    })
}

// ----------------------------------------------------------------------------
// Tauri commands
// ----------------------------------------------------------------------------

#[tauri::command]
pub async fn login(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    username: String,
    password: String,
) -> Result<LoginResponse, String> {
    let pool = get_pool(&db_state)?;

    let row = sqlx::query(
        r#"
        SELECT u.id, u.username, u.password_hash, u.role_id, u.name, u.phone, u.email,
               u.is_active, u.last_login, u.must_change_password, u.created_at, u.updated_at,
               r.name as role_name, r.permissions as role_permissions
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.username = ? AND u.is_active = 1
        "#,
    )
    .bind(username)
    .fetch_optional(&*pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?
    .ok_or_else(|| "Invalid username or password".to_string())?;

    let password_hash: String = row.try_get("password_hash").map_err(|_| "Invalid password hash".to_string())?;
    let parsed_hash = PasswordHash::new(&password_hash).map_err(|_| "Invalid stored password hash".to_string())?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| "Invalid username or password")?;

    let user_id: i64 = row.try_get("id").unwrap_or(0);
    let role_id: i64 = row.try_get("role_id").unwrap_or(3);
    let role_permissions: String = row.try_get("role_permissions").unwrap_or_else(|_| "[]".to_string());
    let permissions: Vec<String> = serde_json::from_str(&role_permissions)
        .unwrap_or_else(|_| vec!["*".to_string()]);

    // Update last_login
    sqlx::query("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(user_id)
        .execute(&*pool)
        .await
        .ok();

    let user_with_role = fetch_user_with_role(&pool, user_id).await?;
    let token = create_token(&pool, user_id, role_id, permissions.clone()).await?;

    Ok(LoginResponse {
        user: user_with_role,
        token,
        permissions,
    })
}

#[tauri::command]
pub async fn logout() -> Result<String, String> {
    // Stateless JWT: server-side logout is a no-op. Frontend clears persisted state.
    // A future enhancement could blacklist the token's `jti` until its `exp`.
    Ok("Logged out".to_string())
}

#[tauri::command]
pub async fn get_current_user(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    token: String,
) -> Result<LoginResponse, String> {
    let pool = get_pool(&db_state)?;
    let claims = verify_token(&pool, &token).await?;

    // Re-fetch user (so role/permissions changes since login are reflected).
    let user_with_role = fetch_user_with_role(&pool, claims.sub).await?;

    // Issue a fresh token (sliding expiration) so the user stays logged in
    // as long as they keep making requests within TTL.
    let refreshed_token = create_token(
        &pool,
        claims.sub,
        user_with_role.user.role_id,
        claims.permissions.clone(),
    )
    .await?;

    Ok(LoginResponse {
        user: user_with_role,
        token: refreshed_token,
        permissions: claims.permissions,
    })
}

#[tauri::command]
pub async fn change_password(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    token: String,
    old_password: String,
    new_password: String,
) -> Result<String, String> {
    // Validate new password strength (very minimal — extend as needed).
    if new_password.len() < 6 {
        return Err("New password must be at least 6 characters".to_string());
    }
    if new_password == old_password {
        return Err("New password must differ from the current one".to_string());
    }

    let pool = get_pool(&db_state)?;
    let claims = verify_token(&pool, &token).await?;
    let user_id = claims.sub;

    // Fetch the current password hash and verify the old password.
    let row = sqlx::query("SELECT password_hash FROM users WHERE id = ? AND is_active = 1")
        .bind(user_id)
        .fetch_optional(&*pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "User not found or inactive".to_string())?;

    let current_hash: String = row.try_get("password_hash").map_err(|_| "Invalid stored hash".to_string())?;
    let parsed = PasswordHash::new(&current_hash).map_err(|_| "Invalid stored password hash".to_string())?;
    Argon2::default()
        .verify_password(old_password.as_bytes(), &parsed)
        .map_err(|_| "Current password is incorrect".to_string())?;

    // Hash the new password and persist.
    let new_hash = hash_password(&new_password)?;
    sqlx::query(
        r#"
        UPDATE users
        SET password_hash = ?,
            must_change_password = 0,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#,
    )
    .bind(&new_hash)
    .bind(user_id)
    .execute(&*pool)
    .await
    .map_err(|e| format!("Failed to update password: {}", e))?;

    Ok("Password changed successfully".to_string())
}
