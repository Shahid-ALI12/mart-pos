use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn list_units() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_unit() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_unit() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn delete_unit() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
