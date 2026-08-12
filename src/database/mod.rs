// database/mod.rs
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool, Row};
use std::sync::Arc;
use tauri::Manager;
use tracing::{info, error};
use anyhow::Result;

pub mod models;
pub mod repositories;
pub mod sync;

pub type DbPool = Arc<SqlitePool>;

#[derive(Default)]
pub struct DbState {
    pub pool: std::sync::Mutex<Option<DbPool>>,
}

pub struct Database;

impl Database {
    pub async fn initialize(app: &tauri::AppHandle, state: &DbState) -> Result<()> {
        let db_path = app
            .path()
            .app_data_dir()
            .expect("Failed to get app data dir")
            .join("main.db");

        // Ensure directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
        
        info!("Connecting to database: {}", db_url);

        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect(&db_url)
            .await?;

        // Enable WAL mode for better concurrency
        sqlx::query("PRAGMA journal_mode = WAL;")
            .execute(&pool)
            .await?;
        
        sqlx::query("PRAGMA synchronous = NORMAL;")
            .execute(&pool)
            .await?;
        
        sqlx::query("PRAGMA foreign_keys = ON;")
            .execute(&pool)
            .await?;

        // Set encryption key if configured (from settings)
        // For now, we'll use SQLCipher via tauri-plugin-sql

        let pool = Arc::new(pool);
        *state.pool.lock().unwrap() = Some(pool.clone());

        info!("Database connection established");
        Ok(())
    }

    pub fn get_pool(state: &DbState) -> Result<DbPool> {
        state.pool.lock().unwrap()
            .clone()
            .ok_or_else(|| anyhow::anyhow!("Database not initialized"))
    }
}