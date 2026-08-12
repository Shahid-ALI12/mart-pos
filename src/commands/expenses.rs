use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn list_expenses() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_expense() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_expense() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn delete_expense() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn list_expense_categories() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
