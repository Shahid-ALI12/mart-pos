use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn list_categories() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_category() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_category() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn delete_category() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
