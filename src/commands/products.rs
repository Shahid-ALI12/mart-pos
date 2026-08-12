use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn list_products() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn get_product() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_product() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_product() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn delete_product() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn search_products() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn get_low_stock() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
