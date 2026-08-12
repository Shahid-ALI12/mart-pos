use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn get_stock() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn get_stock_by_location() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn adjust_stock() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn transfer_stock() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn get_stock_movements() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
