use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn list_suppliers() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn get_supplier() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_supplier() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_supplier() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn delete_supplier() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
