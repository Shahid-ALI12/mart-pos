use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn list_stock_transfers() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_stock_transfer() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_stock_transfer() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn receive_stock_transfer() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
