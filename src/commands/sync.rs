use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn get_sync_status() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn trigger_sync() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn get_pending_changes() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
