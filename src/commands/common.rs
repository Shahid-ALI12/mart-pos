// commands/common.rs
//
// Shared helpers for the Tauri command handlers.

use crate::database::{Database, DbState, DbPool};
use serde::Serialize;

/// Generic paginated list response. Frontend expects `{ data, total, page, page_size, total_pages }`.
/// For lists that are not paginated (e.g. dropdowns), the simpler `Vec<T>` is returned directly.
#[derive(Debug, Clone, Serialize)]
pub struct ListResponse<T> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub total_pages: i64,
}

impl<T> ListResponse<T> {
    pub fn new(data: Vec<T>, total: i64, page: i64, page_size: i64) -> Self {
        let total_pages = if page_size > 0 {
            (total + page_size - 1) / page_size
        } else {
            1
        };
        Self { data, total, page, page_size, total_pages }
    }
}

/// Acquire the DB pool from shared state, returning a `String` error suitable
/// for `Result<_, String>` returned by Tauri commands.
pub fn pool(db_state: &DbState) -> Result<DbPool, String> {
    Database::get_pool(db_state).map_err(|e| format!("Database not initialized: {}", e))
}

/// Convert any Display-able error into a `String` for Tauri command results.
pub fn db_err<E: std::fmt::Display>(e: E) -> String {
    format!("Database error: {}", e)
}
