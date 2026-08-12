use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn list_conversions() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_conversion() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_conversion() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn delete_conversion() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
