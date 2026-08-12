use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn get_settings() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_setting() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
