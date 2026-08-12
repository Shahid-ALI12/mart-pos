use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn list_users() -> Result<ApiResponse<Vec<()>>, String> {
    Ok(ApiResponse::success(vec![]))
}
#[command]
pub async fn create_user() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_user() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn delete_user() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn get_roles() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
