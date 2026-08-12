use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn list_variants() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_variant() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_variant() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn delete_variant() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
