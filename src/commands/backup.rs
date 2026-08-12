use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn create_backup() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn restore_backup() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn list_backups() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
