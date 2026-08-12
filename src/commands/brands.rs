use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn list_brands() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_brand() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_brand() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn delete_brand() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
