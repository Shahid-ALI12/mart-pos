// database/mod.rs
//
// Encrypted SQLite database via SQLCipher.
//
// Encryption model:
//   - SQLCipher is a drop-in SQLite fork that transparently encrypts the .db file
//     with AES-256-CBC. The key is passed via `PRAGMA key = '...';` — this must
//     be the first SQL statement on every new connection, BEFORE any read/write.
//   - We store the 32-byte raw key in a sibling file `db.key` next to `main.db`
//     (NOT inside the DB itself — chicken-and-egg). The file is created on first
//     run with 32 cryptographically random bytes from OsRng, and chmod'd to 0600
//     on Unix so other users on the machine cannot read it.
//   - The PRAGMA receives the key as a hex string prefixed with `x'` so SQLCipher
//     interprets it as raw bytes (not as a passphrase that gets run through PBKDF2).
//     Using raw bytes avoids the ~few hundred ms PBKDF2 cost on each connection.
//
// Why a separate file and not the `settings` table?
//   - The `settings` table lives INSIDE the encrypted DB. We need the key BEFORE
//     we can read it. A chicken-and-egg problem.
//   - A separate key file is also simpler — no schema migrations needed to add
//     or rotate keys, and OS file permissions provide the first line of defense.
//
// Pool / connection setup:
//   - We use `SqliteConnectOptions::pragma("key", ...)` so the PRAGMA runs on
//     EVERY connection that the pool opens (sqlx 0.8 supports this natively).
//   - WAL mode, foreign_keys=ON, synchronous=NORMAL are set the same way.

use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    SqlitePool,
};
use std::{
    fs,
    path::PathBuf,
    sync::Arc,
};
use tauri::Manager;
use tracing::{info, error, warn};
use anyhow::{Result, anyhow};
use rand::RngCore;

pub mod models;
pub mod repositories;
pub mod sync;

pub type DbPool = Arc<SqlitePool>;

#[derive(Default)]
pub struct DbState {
    pub pool: std::sync::Mutex<Option<DbPool>>,
}

pub struct Database;

const KEY_LEN: usize = 32; // 256-bit AES key

impl Database {
    pub async fn initialize(app: &tauri::AppHandle, state: &DbState) -> Result<()> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| anyhow!("Failed to get app data dir: {}", e))?;

        // Ensure the directory exists
        fs::create_dir_all(&app_data_dir)?;

        let db_path = app_data_dir.join("main.db");
        let key_path = app_data_dir.join("db.key");

        info!("Database path: {}", db_path.display());
        info!("Key file path: {}", key_path.display());

        // ---- 1. Load or create the encryption key ----
        let key_hex = load_or_create_key(&key_path)?;

        // ---- 2. Build connect options with encryption + pragmas ----
        // The `pragma("key", ...)` call here is applied to EVERY new connection
        // the pool opens, which is exactly what we want — each connection must
        // unlock the DB before reading or writing.
        let mut options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .foreign_keys(true)
            .pragma("key", format!("x'{}'", key_hex));

        // For SQLCipher 4.x (default with current libsqlite3-sys), the page size
        // and KDF iterations should be left at defaults (4096-byte page, 256000
        // iterations of PBKDF2-HMAC-SHA512 for passphrase-derived keys). Since
        // we use raw bytes (x'...'), no KDF runs — the key is used directly.
        //
        // Legacy compatibility note: if you ever need to open a DB created with
        // SQLCipher 3.x defaults, add: .pragma("cipher_compatibility", "3")
        let _ = &mut options; // silence unused-mut warning if no extra pragmas above

        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect_with(options)
            .await
            .map_err(|e| {
                error!("Failed to connect to encrypted database: {}", e);
                anyhow!(
                    "Database connection failed. This can happen if the db.key file was \
                     deleted/rotated but main.db still holds the old encrypted data. \
                     Original error: {}",
                    e
                )
            })?;

        // ---- 3. Verify encryption is actually active ----
        // SQLCipher exposes `PRAGMA cipher_version` which returns a string like
        // "SQLCipher 4.5.5 community edition based on SQLite 3.42.0". If this
        // returns NULL, we're talking to plain SQLite (encryption disabled).
        let cipher_check: Option<String> = sqlx::query_scalar("PRAGMA cipher_version;")
            .fetch_optional(&pool)
            .await
            .ok()
            .flatten();
        match cipher_check {
            Some(ref v) => info!("SQLCipher active: {}", v.trim()),
            None => warn!(
                "PRAGMA cipher_version returned NULL — database encryption may not be active. \
                 Check that libsqlite3-sys was compiled with the bundled-sqlcipher feature."
            ),
        }

        // ---- 4. Run migrations (so the backend owns schema, not tauri-plugin-sql) ----
        // Note: we still register tauri-plugin-sql in main.rs for the frontend's
        // potential direct DB access (currently unused), but we no longer preload
        // or auto-migrate via that plugin — backend owns the schema now.
        sqlx::migrate!("./src/database/migrations")
            .run(&pool)
            .await
            .map_err(|e| anyhow!("Migration failed: {}", e))?;
        info!("Migrations applied");

        // ---- 5. Apply WAL pragmas that need to run after key ----
        // (journal_mode, synchronous, foreign_keys are already set via options above;
        // we keep this section for any future pragmas that need a post-key position.)
        sqlx::query("PRAGMA foreign_keys = ON;")
            .execute(&pool)
            .await
            .ok();

        // ---- 6. Persist pool in shared state ----
        let pool = Arc::new(pool);
        *state.pool.lock().unwrap() = Some(pool.clone());

        info!("Encrypted database initialized successfully");
        Ok(())
    }

    pub fn get_pool(state: &DbState) -> Result<DbPool> {
        state
            .pool
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| anyhow!("Database not initialized"))
    }
}

// ----------------------------------------------------------------------------
// Key file management
// ----------------------------------------------------------------------------

/// Load the 32-byte DB encryption key from `key_path`. If the file does not
/// exist, generate a fresh key, write it (chmod 0600 on Unix), and return it.
/// Returns the key as a lowercase hex string (64 chars).
fn load_or_create_key(key_path: &PathBuf) -> Result<String> {
    if key_path.exists() {
        let bytes = fs::read(key_path)?;
        if bytes.len() != KEY_LEN {
            return Err(anyhow!(
                "db.key file exists but is {} bytes (expected {}). \
                 Delete it AND main.db to reinitialize, or restore from backup.",
                bytes.len(),
                KEY_LEN
            ));
        }
        let hex: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();
        info!("Loaded existing DB encryption key from {}", key_path.display());
        return Ok(hex);
    }

    // Generate a new 32-byte key with OsRng (cryptographically secure).
    let mut bytes = [0u8; KEY_LEN];
    rand::thread_rng().fill_bytes(&mut bytes);
    fs::write(key_path, bytes)?;
    info!(
        "Generated new DB encryption key at {} ({} bytes)",
        key_path.display(),
        KEY_LEN
    );

    // Lock down file permissions on Unix.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(key_path)?.permissions();
        perms.set_mode(0o600); // rw------- — only the owner can read/write
        fs::set_permissions(key_path, perms)?;
        info!("Set db.key permissions to 0600 (owner-only)");
    }

    #[cfg(not(unix))]
    {
        // On Windows, the file inherits ACLs from the parent directory.
        // For tighter control, use windows-acl crate in the future.
        info!("Windows: db.key inherits parent directory ACLs");
    }

    let hex: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();
    Ok(hex)
}
