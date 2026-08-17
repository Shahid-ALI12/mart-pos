// commands/settings.rs - Store settings (key-value)
use crate::commands::common::{db_err, pool};
use crate::database::DbState;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn get_settings(
    _app: AppHandle,
    db_state: State<'_, DbState>,
) -> Result<serde_json::Value, String> {
    let pool = pool(&db_state)?;

    let rows = sqlx::query("SELECT key, value FROM settings")
        .fetch_all(&*pool).await
        .map_err(db_err)?;

    let mut settings = serde_json::Map::new();
    for row in rows {
        use sqlx::Row;
        let key: String = row.try_get("key").unwrap_or_default();
        let value: String = row.try_get("value").unwrap_or_default();
        settings.insert(key, serde_json::Value::String(value));
    }

    Ok(serde_json::Value::Object(settings))
}

#[derive(Deserialize)]
pub struct UpdateSettingInput {
    pub key: String,
    pub value: String,
}

#[tauri::command]
pub async fn update_setting(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    input: UpdateSettingInput,
) -> Result<String, String> {
    let pool = pool(&db_state)?;

    let res = sqlx::query(
        "UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
    )
    .bind(&input.value)
    .bind(&input.key)
    .execute(&*pool).await
    .map_err(db_err)?;

    if res.rows_affected() == 0 {
        // Key doesn't exist — INSERT it
        sqlx::query("INSERT INTO settings (key, value, description) VALUES (?, ?, NULL)")
            .bind(&input.key)
            .bind(&input.value)
            .execute(&*pool).await
            .map_err(db_err)?;
    }

    Ok(format!("Setting '{}' updated", input.key))
}
