// commands/reports.rs - Sales, profit, stock, GST, top products reports
//
// All report commands return serde_json::Value so the frontend can shape
// charts/tables without one struct per report variant.

use crate::commands::common::{db_err, pool};
use crate::database::DbState;
use serde_json::{json, Value};
use sqlx::Row;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn get_sales_report(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<Value, String> {
    let pool = pool(&db_state)?;
    let from = from_date.unwrap_or_else(|| "2000-01-01".to_string());
    let to = to_date.unwrap_or_else(|| "9999-12-31".to_string());

    let total_sales: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(grand_total), 0) FROM sales_invoices
         WHERE status = 'completed' AND date(invoice_date) >= date(?) AND date(invoice_date) <= date(?)",
    )
    .bind(&from).bind(&to)
    .fetch_one(&*pool).await.map_err(db_err)?;

    let total_invoices: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sales_invoices
         WHERE status = 'completed' AND date(invoice_date) >= date(?) AND date(invoice_date) <= date(?)",
    )
    .bind(&from).bind(&to)
    .fetch_one(&*pool).await.map_err(db_err)?;

    let avg_sale = if total_invoices > 0 { total_sales / total_invoices as f64 } else { 0.0 };

    // Daily breakdown for charts
    let daily: Vec<(String, f64)> = sqlx::query(
        r#"SELECT date(invoice_date) as d, SUM(grand_total) as total
           FROM sales_invoices
           WHERE status = 'completed' AND date(invoice_date) >= date(?) AND date(invoice_date) <= date(?)
           GROUP BY date(invoice_date) ORDER BY d"#,
    )
    .bind(&from).bind(&to)
    .fetch_all(&*pool).await
    .map_err(db_err)?
    .into_iter()
    .map(|r| {
        let d: String = r.try_get("d").unwrap_or_default();
        let total: f64 = r.try_get("total").unwrap_or(0.0);
        (d, total)
    }).collect();

    // Payment mode breakdown
    let by_mode: Vec<(String, f64)> = sqlx::query(
        r#"SELECT payment_mode, SUM(grand_total) as total
           FROM sales_invoices
           WHERE status = 'completed' AND date(invoice_date) >= date(?) AND date(invoice_date) <= date(?)
           GROUP BY payment_mode"#,
    )
    .bind(&from).bind(&to)
    .fetch_all(&*pool).await
    .map_err(db_err)?
    .into_iter()
    .map(|r| {
        let m: String = r.try_get("payment_mode").unwrap_or_default();
        let t: f64 = r.try_get("total").unwrap_or(0.0);
        (m, t)
    }).collect();

    Ok(json!({
        "total_sales": total_sales,
        "total_invoices": total_invoices,
        "average_sale": avg_sale,
        "daily": daily,
        "by_payment_mode": by_mode,
    }))
}

#[tauri::command]
pub async fn get_profit_loss_report(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<Value, String> {
    let pool = pool(&db_state)?;
    let from = from_date.unwrap_or_else(|| "2000-01-01".to_string());
    let to = to_date.unwrap_or_else(|| "9999-12-31".to_string());

    let revenue: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(grand_total), 0) FROM sales_invoices
         WHERE status = 'completed' AND date(invoice_date) >= date(?) AND date(invoice_date) <= date(?)",
    )
    .bind(&from).bind(&to)
    .fetch_one(&*pool).await.map_err(db_err)?;

    // COGS = SUM(qty * cost_price) from sales_invoice_items, joined to invoices for date filter
    let cogs: f64 = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(si.qty * si.cost_price), 0)
           FROM sales_invoice_items si
           JOIN sales_invoices inv ON si.invoice_id = inv.id
           WHERE inv.status = 'completed'
             AND date(inv.invoice_date) >= date(?) AND date(inv.invoice_date) <= date(?)"#,
    )
    .bind(&from).bind(&to)
    .fetch_one(&*pool).await.map_err(db_err)?;

    let expenses: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses
         WHERE date(expense_date) >= date(?) AND date(expense_date) <= date(?)",
    )
    .bind(&from).bind(&to)
    .fetch_one(&*pool).await.map_err(db_err)?;

    let gross_profit = revenue - cogs;
    let net_profit = gross_profit - expenses;

    Ok(json!({
        "revenue": revenue,
        "cogs": cogs,
        "gross_profit": gross_profit,
        "expenses": expenses,
        "net_profit": net_profit,
        "gross_margin": if revenue > 0.0 { (gross_profit / revenue) * 100.0 } else { 0.0 },
        "net_margin": if revenue > 0.0 { (net_profit / revenue) * 100.0 } else { 0.0 },
    }))
}

#[tauri::command]
pub async fn get_stock_report(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    location_id: Option<i64>,
) -> Result<Value, String> {
    let pool = pool(&db_state)?;

    let rows: Vec<(String, String, f64, Option<f64>, f64)> = sqlx::query(
        r#"SELECT p.name, p.sku, COALESCE(s.quantity, 0) as qty,
                  s.unit_cost, p.sale_price
           FROM products p
           LEFT JOIN stock s ON p.id = s.product_id AND (s.location_id = ? OR ? IS NULL)
           WHERE p.is_active = 1
           ORDER BY p.name"#,
    )
    .bind(location_id).bind(location_id)
    .fetch_all(&*pool).await
    .map_err(db_err)?
    .into_iter()
    .map(|r| {
        let name: String = r.try_get("name").unwrap_or_default();
        let sku: String = r.try_get("sku").unwrap_or_default();
        let qty: f64 = r.try_get("qty").unwrap_or(0.0);
        let cost: Option<f64> = r.try_get("unit_cost").ok();
        let price: f64 = r.try_get("sale_price").unwrap_or(0.0);
        (name, sku, qty, cost, price)
    }).collect();

    let total_items: i64 = rows.len() as i64;
    let total_stock_value: f64 = rows.iter()
        .filter_map(|(_, _, qty, cost, _)| cost.map(|c| qty * c))
        .sum();
    let total_retail_value: f64 = rows.iter()
        .map(|(_, _, qty, _, price)| qty * price)
        .sum();
    let low_stock_count: i64 = rows.iter()
        .filter(|(_, _, qty, _, _)| *qty <= 0.0)
        .count() as i64;

    Ok(json!({
        "items": rows,
        "total_items": total_items,
        "total_stock_value": total_stock_value,
        "total_retail_value": total_retail_value,
        "low_stock_count": low_stock_count,
    }))
}

#[tauri::command]
pub async fn get_gst_report(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<Value, String> {
    let pool = pool(&db_state)?;
    let from = from_date.unwrap_or_else(|| "2000-01-01".to_string());
    let to = to_date.unwrap_or_else(|| "9999-12-31".to_string());

    let rows: Vec<(f64, f64, f64, f64)> = sqlx::query(
        r#"SELECT si.gst_rate,
                  SUM(si.line_total - si.discount_amount) as taxable,
                  SUM(si.cgst_amount) as cgst,
                  SUM(si.sgst_amount) as sgst
           FROM sales_invoice_items si
           JOIN sales_invoices inv ON si.invoice_id = inv.id
           WHERE inv.status = 'completed'
             AND date(inv.invoice_date) >= date(?) AND date(inv.invoice_date) <= date(?)
           GROUP BY si.gst_rate ORDER BY si.gst_rate"#,
    )
    .bind(&from).bind(&to)
    .fetch_all(&*pool).await
    .map_err(db_err)?
    .into_iter()
    .map(|r| {
        let rate: f64 = r.try_get("gst_rate").unwrap_or(0.0);
        let taxable: f64 = r.try_get("taxable").unwrap_or(0.0);
        let cgst: f64 = r.try_get("cgst").unwrap_or(0.0);
        let sgst: f64 = r.try_get("sgst").unwrap_or(0.0);
        (rate, taxable, cgst, sgst)
    }).collect();

    let total_taxable: f64 = rows.iter().map(|(_, t, _, _)| *t).sum();
    let total_cgst: f64 = rows.iter().map(|(_, _, c, _)| *c).sum();
    let total_sgst: f64 = rows.iter().map(|(_, _, _, s)| *s).sum();
    let total_igst: f64 = 0.0;

    Ok(json!({
        "by_rate": rows,
        "total_taxable": total_taxable,
        "total_cgst": total_cgst,
        "total_sgst": total_sgst,
        "total_igst": total_igst,
        "total_gst": total_cgst + total_sgst + total_igst,
    }))
}

#[tauri::command]
pub async fn get_counter_performance(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<Value, String> {
    let pool = pool(&db_state)?;
    let from = from_date.unwrap_or_else(|| "2000-01-01".to_string());
    let to = to_date.unwrap_or_else(|| "9999-12-31".to_string());

    let rows: Vec<(i64, i64, f64)> = sqlx::query(
        r#"SELECT counter_id, COUNT(*) as inv_count, SUM(grand_total) as total
           FROM sales_invoices
           WHERE status = 'completed'
             AND date(invoice_date) >= date(?) AND date(invoice_date) <= date(?)
           GROUP BY counter_id ORDER BY total DESC"#,
    )
    .bind(&from).bind(&to)
    .fetch_all(&*pool).await
    .map_err(db_err)?
    .into_iter()
    .map(|r| {
        let c: i64 = r.try_get("counter_id").unwrap_or(0);
        let n: i64 = r.try_get("inv_count").unwrap_or(0);
        let t: f64 = r.try_get("total").unwrap_or(0.0);
        (c, n, t)
    }).collect();

    Ok(json!({ "counters": rows }))
}

#[tauri::command]
pub async fn get_top_products(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    from_date: Option<String>,
    to_date: Option<String>,
    limit: Option<i64>,
) -> Result<Value, String> {
    let pool = pool(&db_state)?;
    let from = from_date.unwrap_or_else(|| "2000-01-01".to_string());
    let to = to_date.unwrap_or_else(|| "9999-12-31".to_string());
    let limit = limit.unwrap_or(20).clamp(1, 100);

    let rows: Vec<(String, String, f64, f64)> = sqlx::query(
        r#"SELECT p.name, p.sku, SUM(si.qty) as qty_sold, SUM(si.line_total) as revenue
           FROM sales_invoice_items si
           JOIN products p ON si.product_id = p.id
           JOIN sales_invoices inv ON si.invoice_id = inv.id
           WHERE inv.status = 'completed'
             AND date(inv.invoice_date) >= date(?) AND date(inv.invoice_date) <= date(?)
           GROUP BY si.product_id
           ORDER BY revenue DESC LIMIT ?"#,
    )
    .bind(&from).bind(&to).bind(limit)
    .fetch_all(&*pool).await
    .map_err(db_err)?
    .into_iter()
    .map(|r| {
        let n: String = r.try_get("name").unwrap_or_default();
        let s: String = r.try_get("sku").unwrap_or_default();
        let q: f64 = r.try_get("qty_sold").unwrap_or(0.0);
        let rev: f64 = r.try_get("revenue").unwrap_or(0.0);
        (n, s, q, rev)
    }).collect();

    Ok(json!({ "products": rows }))
}

#[tauri::command]
pub async fn get_slow_moving_products(
    _app: AppHandle,
    db_state: State<'_, DbState>,
    days: Option<i64>,
) -> Result<Value, String> {
    let pool = pool(&db_state)?;
    let days = days.unwrap_or(30);

    let rows: Vec<(String, String, f64)> = sqlx::query(
        r#"SELECT p.name, p.sku, COALESCE(s.quantity, 0) as qty
           FROM products p
           LEFT JOIN stock s ON p.id = s.product_id
           LEFT JOIN sales_invoice_items si ON p.id = si.product_id
           LEFT JOIN sales_invoices inv ON si.invoice_id = inv.id AND inv.invoice_date >= date('now', ?)
           WHERE p.is_active = 1 AND si.id IS NULL
           ORDER BY p.name"#,
    )
    .bind(format!("-{} days", days))
    .fetch_all(&*pool).await
    .map_err(db_err)?
    .into_iter()
    .map(|r| {
        let n: String = r.try_get("name").unwrap_or_default();
        let s: String = r.try_get("sku").unwrap_or_default();
        let q: f64 = r.try_get("qty").unwrap_or(0.0);
        (n, s, q)
    }).collect();

    Ok(json!({ "products": rows }))
}

#[tauri::command]
pub async fn get_customer_outstanding(
    _app: AppHandle,
    db_state: State<'_, DbState>,
) -> Result<Value, String> {
    let pool = pool(&db_state)?;

    let rows: Vec<(i64, String, String, f64)> = sqlx::query(
        r#"SELECT id, customer_code, name, current_credit
           FROM customers WHERE current_credit > 0
           ORDER BY current_credit DESC"#,
    )
    .fetch_all(&*pool).await
    .map_err(db_err)?
    .into_iter()
    .map(|r| {
        let id: i64 = r.try_get("id").unwrap_or(0);
        let code: String = r.try_get("customer_code").unwrap_or_default();
        let name: String = r.try_get("name").unwrap_or_default();
        let credit: f64 = r.try_get("current_credit").unwrap_or(0.0);
        (id, code, name, credit)
    }).collect();

    let total: f64 = rows.iter().map(|(_, _, _, c)| *c).sum();

    Ok(json!({ "customers": rows, "total_outstanding": total }))
}

#[tauri::command]
pub async fn get_supplier_outstanding(
    _app: AppHandle,
    db_state: State<'_, DbState>,
) -> Result<Value, String> {
    let pool = pool(&db_state)?;

    let rows: Vec<(i64, String, f64)> = sqlx::query(
        r#"SELECT id, name, opening_balance
           FROM suppliers WHERE opening_balance > 0
           ORDER BY opening_balance DESC"#,
    )
    .fetch_all(&*pool).await
    .map_err(db_err)?
    .into_iter()
    .map(|r| {
        let id: i64 = r.try_get("id").unwrap_or(0);
        let name: String = r.try_get("name").unwrap_or_default();
        let bal: f64 = r.try_get("opening_balance").unwrap_or(0.0);
        (id, name, bal)
    }).collect();

    let total: f64 = rows.iter().map(|(_, _, b)| *b).sum();

    Ok(json!({ "suppliers": rows, "total_payable": total }))
}
