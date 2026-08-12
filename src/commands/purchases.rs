use crate::database::models::ApiResponse;
use tauri::command;

#[command]
pub async fn list_purchase_orders() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn get_purchase_order() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_purchase_order() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_purchase_order() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn delete_purchase_order() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn list_po_items() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn list_purchase_invoices() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn get_purchase_invoice() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_purchase_invoice() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn update_purchase_invoice() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn list_pi_items() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn list_purchase_returns() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_purchase_return() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn list_supplier_payments() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
#[command]
pub async fn create_supplier_payment() -> Result<ApiResponse<()>, String> { Ok(ApiResponse::success(())) }
