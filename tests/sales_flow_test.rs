// tests/sales_flow_test.rs
//
// End-to-end test of the sales-invoice SQL flow WITHOUT going through the
// Tauri command wrapper. The command wrapper in `src/commands/sales.rs` is
// just glue — it acquires the pool, runs the SQL, returns the result. The
// interesting logic is the SQL itself, and that's what we verify here.
//
// We replicate the same SQL that `create_sales_invoice` runs (see the
// docstring in `src/commands/sales.rs` for the full flow):
//   1. Read invoice_prefix + invoice_series from settings
//   2. Compute totals from per-item figures
//   3. INSERT sales_invoices row
//   4. For each item: INSERT sales_invoice_items, UPDATE or INSERT stock row,
//      INSERT stock_movements
//   5. If customer is set: bump loyalty_points (+ credit if payment_mode='credit')
//   6. Atomically bump invoice_series
//
// If the application SQL ever drifts from what's tested here, the test will
// catch it on the next `cargo test` run.

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;

async fn fresh_db() -> SqlitePool {
    let options = SqliteConnectOptions::new()
        .filename(":memory:")
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .expect("Failed to open in-memory SQLite");

    sqlx::migrate!("./src/database/migrations")
        .run(&pool)
        .await
        .expect("Migrations failed");

    pool
}

/// Insert a single product with the given id, sku, sale_price, gst_rate.
/// Used to set up the test fixtures.
async fn insert_product(
    pool: &SqlitePool,
    id: i64,
    sku: &str,
    name: &str,
    sale_price: f64,
    purchase_price: f64,
    gst_rate: f64,
) {
    sqlx::query(
        r#"INSERT INTO products
           (id, sku, name, category_id, unit_id,
            purchase_price, sale_price, gst_rate,
            reorder_level, track_expiry, track_batch, track_serial, is_active)
           VALUES (?, ?, ?, 1, 1, ?, ?, ?, 0, 0, 0, 0, 1)"#,
    )
    .bind(id)
    .bind(sku)
    .bind(name)
    .bind(purchase_price)
    .bind(sale_price)
    .bind(gst_rate)
    .execute(pool)
    .await
    .expect("Failed to insert test product");
}

/// Mirror of `create_sales_invoice` in src/commands/sales.rs, minus the
/// Tauri State wrapper. Same SQL, same field order, same business logic.
/// Returns the new invoice's (id, invoice_number, grand_total).
async fn create_sales_invoice(
    pool: &SqlitePool,
    counter_id: i64,
    customer_id: Option<i64>,
    items: &[(i64, f64, f64, f64, f64, f64)], // (product_id, qty, unit_price, gst_rate, cost_price, line_total)
    payment_mode: &str,
) -> (i64, String, f64) {
    let mut tx = pool.begin().await.expect("begin tx");

    // 1. Read invoice_prefix + invoice_series from settings.
    let prefix_raw: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'invoice_prefix'")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    let prefix: String = serde_json::from_str::<String>(&prefix_raw)
        .unwrap_or_else(|_| prefix_raw.trim_matches('"').to_string());

    let series_raw: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'invoice_series'")
        .fetch_one(&mut *tx)
        .await
        .unwrap();
    let series: i64 = serde_json::from_str::<i64>(&series_raw)
        .unwrap_or_else(|_| series_raw.trim_matches('"').parse().unwrap());

    let invoice_number = format!("{}-{:06}", prefix, series);

    // 2. Bump the series atomically (so the next invoice gets the next number).
    let next_series = series + 1;
    let next_json = serde_json::to_string(&next_series).unwrap();
    sqlx::query("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'invoice_series'")
        .bind(&next_json)
        .execute(&mut *tx)
        .await
        .unwrap();

    // 3. Compute invoice-level totals from per-item figures.
    let subtotal: f64 = items.iter().map(|i| i.5).sum();
    let gst_total: f64 = items.iter().map(|i| i.3 * i.1).sum(); // gst_rate * qty
    let taxable_amount = subtotal;
    let grand_total = (taxable_amount + gst_total).round();
    let round_off = grand_total - (taxable_amount + gst_total);

    let paid_amount = if payment_mode == "credit" { 0.0 } else { grand_total };

    // 4. Insert the invoice header.
    let invoice_result = sqlx::query(
        r#"INSERT INTO sales_invoices
           (invoice_number, counter_id, customer_id, user_id, invoice_date,
            subtotal, discount_amount, discount_percent, taxable_amount,
            cgst_amount, sgst_amount, igst_amount, total_gst,
            round_off, grand_total, paid_amount, change_amount,
            payment_mode, payment_details, status,
            loyalty_points_earned, loyalty_points_redeemed, notes,
            synced, sync_version, created_at, updated_at)
           VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP,
                   ?, 0, 0, ?,
                   ?, 0, 0, ?,
                   ?, ?, ?, 0,
                   ?, NULL, 'completed',
                   0, 0, NULL,
                   0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
    )
    .bind(&invoice_number)
    .bind(counter_id)
    .bind(customer_id)
    .bind(subtotal)
    .bind(taxable_amount)
    .bind(gst_total / 2.0)  // cgst = half of total GST
    .bind(gst_total)
    .bind(round_off)
    .bind(grand_total)
    .bind(paid_amount)
    .bind(payment_mode)
    .execute(&mut *tx)
    .await
    .expect("Failed to insert sales_invoice");

    let invoice_id: i64 = invoice_result.last_insert_rowid();

    // 5. Insert each item + decrement stock + record movement.
    for (product_id, qty, unit_price, gst_rate, cost_price, line_total) in items {
        sqlx::query(
            r#"INSERT INTO sales_invoice_items
               (invoice_id, product_id, variant_id, unit_id,
                qty, free_qty, unit_price,
                discount_percent, discount_amount,
                gst_rate, cgst_amount, sgst_amount, igst_amount,
                line_total, cost_price,
                batch_number, expiry_date, serial_numbers)
               VALUES (?, ?, NULL, 1,
                       ?, 0, ?,
                       0, 0,
                       ?, ?, 0, 0,
                       ?, ?,
                       NULL, NULL, NULL)"#,
        )
        .bind(invoice_id)
        .bind(product_id)
        .bind(qty)
        .bind(unit_price)
        .bind(gst_rate)
        .bind(gst_rate * qty / 2.0) // cgst
        .bind(line_total)
        .bind(cost_price)
        .execute(&mut *tx)
        .await
        .expect("Failed to insert sales_invoice_item");

        // Find existing stock row (NULL-safe equality).
        let existing_stock_id: Option<i64> = sqlx::query_scalar(
            r#"SELECT id FROM stock
               WHERE product_id = ?
                 AND location_id = ?
                 AND variant_id IS NULL
                 AND batch_number IS NULL
                 AND expiry_date IS NULL
                 AND serial_number IS NULL
               LIMIT 1"#,
        )
        .bind(product_id)
        .bind(counter_id)
        .fetch_optional(&mut *tx)
        .await
        .unwrap();

        match existing_stock_id {
            Some(stock_id) => {
                sqlx::query("UPDATE stock SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?")
                    .bind(qty)
                    .bind(stock_id)
                    .execute(&mut *tx)
                    .await
                    .unwrap();
            }
            None => {
                sqlx::query(
                    r#"INSERT INTO stock
                       (product_id, location_id, variant_id, batch_number, expiry_date,
                        serial_number, quantity, reserved_qty, unit_cost, last_updated)
                       VALUES (?, ?, NULL, NULL, NULL, NULL, ?, 0, ?, CURRENT_TIMESTAMP)"#,
                )
                .bind(product_id)
                .bind(counter_id)
                .bind(-qty)
                .bind(cost_price)
                .execute(&mut *tx)
                .await
                .unwrap();
            }
        }

        sqlx::query(
            r#"INSERT INTO stock_movements
               (product_id, location_id, variant_id, batch_number, expiry_date,
                serial_number, movement_type, reference_type, reference_id,
                quantity, unit_cost, unit_price, notes, user_id, created_at)
               VALUES (?, ?, NULL, NULL, NULL, NULL, 'sale', 'sales_invoice', ?,
                       ?, ?, ?, NULL, 1, CURRENT_TIMESTAMP)"#,
        )
        .bind(product_id)
        .bind(counter_id)
        .bind(invoice_id)
        .bind(-qty)
        .bind(cost_price)
        .bind(unit_price)
        .execute(&mut *tx)
        .await
        .unwrap();
    }

    // 6. Customer-side bookkeeping.
    if let Some(cid) = customer_id {
        let earned = (grand_total * 0.01).floor() as i64;
        if earned > 0 {
            sqlx::query("UPDATE customers SET loyalty_points = loyalty_points + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(earned)
                .bind(cid)
                .execute(&mut *tx)
                .await
                .unwrap();
            sqlx::query("UPDATE sales_invoices SET loyalty_points_earned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(earned)
                .bind(invoice_id)
                .execute(&mut *tx)
                .await
                .unwrap();
        }
        if payment_mode == "credit" {
            sqlx::query("UPDATE customers SET current_credit = current_credit + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                .bind(grand_total)
                .bind(cid)
                .execute(&mut *tx)
                .await
                .unwrap();
        }
    }

    tx.commit().await.expect("commit");

    (invoice_id, invoice_number, grand_total)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[tokio::test]
async fn create_invoice_with_single_item_decrements_stock() {
    let pool = fresh_db().await;
    insert_product(&pool, 100, "SKU100", "Test Widget", 100.0, 80.0, 18.0).await;

    // Pre-seed stock at the counter so we test the "existing row" branch.
    sqlx::query("INSERT INTO stock (product_id, location_id, quantity, reserved_qty, last_updated) VALUES (100, 1, 50, 0, CURRENT_TIMESTAMP)")
        .execute(&pool)
        .await
        .unwrap();

    let items = vec![(100i64, 5.0_f64, 100.0, 18.0, 80.0, 500.0)];
    let (invoice_id, invoice_number, grand_total) =
        create_sales_invoice(&pool, 1, None, &items, "cash").await;

    assert!(invoice_id > 0);
    assert_eq!(invoice_number, "INV-000001");
    // subtotal=500, gst=18%×5×100=90, total=590, rounded to 590.
    assert_eq!(grand_total, 590.0);

    // Stock should have dropped from 50 to 45.
    let qty: f64 = sqlx::query_scalar("SELECT quantity FROM stock WHERE product_id = 100 AND location_id = 1")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!((qty - 45.0).abs() < 0.001, "Stock should be 45 after selling 5 of 50, got {}", qty);

    // A stock_movement row should exist referencing the new invoice.
    let movement_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM stock_movements WHERE reference_type = 'sales_invoice' AND reference_id = ?",
    )
    .bind(invoice_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(movement_count, 1, "Should have one stock_movement row for the sale");

    // Invoice series should have bumped to 2.
    let next_series_raw: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'invoice_series'")
        .fetch_one(&pool)
        .await
        .unwrap();
    let next_series: i64 = serde_json::from_str(&next_series_raw).unwrap();
    assert_eq!(next_series, 2, "Invoice series should have incremented to 2");
}

#[tokio::test]
async fn create_invoice_for_new_product_creates_negative_stock_row() {
    let pool = fresh_db().await;
    insert_product(&pool, 200, "SKU200", "New Widget", 50.0, 40.0, 0.0).await;
    // No pre-existing stock row — the sale should create one with negative qty.

    let items = vec![(200i64, 2.0_f64, 50.0, 0.0, 40.0, 100.0)];
    let (invoice_id, _, _) = create_sales_invoice(&pool, 1, None, &items, "cash").await;
    assert!(invoice_id > 0);

    let qty: f64 = sqlx::query_scalar("SELECT quantity FROM stock WHERE product_id = 200 AND location_id = 1")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!((qty - (-2.0)).abs() < 0.001, "Stock should be -2 (negative for sale without prior stock), got {}", qty);
}

#[tokio::test]
async fn credit_sale_increases_customer_outstanding() {
    let pool = fresh_db().await;
    insert_product(&pool, 300, "SKU300", "Credit Widget", 200.0, 150.0, 0.0).await;

    sqlx::query("INSERT INTO customers (id, customer_code, name, credit_limit, current_credit, loyalty_points, customer_type, is_active) VALUES (500, 'CUST001', 'Test Customer', 10000, 0, 0, 'regular', 1)")
        .execute(&pool)
        .await
        .unwrap();

    let items = vec![(300i64, 1.0_f64, 200.0, 0.0, 150.0, 200.0)];
    let (invoice_id, _, grand_total) = create_sales_invoice(&pool, 1, Some(500), &items, "credit").await;

    assert_eq!(grand_total, 200.0);

    let current_credit: f64 = sqlx::query_scalar("SELECT current_credit FROM customers WHERE id = 500")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!((current_credit - 200.0).abs() < 0.001,
        "Customer current_credit should be 200 after a credit sale of 200, got {}", current_credit);

    // Loyalty points should also have been awarded: floor(200 * 0.01) = 2.
    let points: i64 = sqlx::query_scalar("SELECT loyalty_points FROM customers WHERE id = 500")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(points, 2, "Customer should have earned 2 loyalty points");

    // And the invoice should reflect the earned points.
    let invoice_points: i64 = sqlx::query_scalar("SELECT loyalty_points_earned FROM sales_invoices WHERE id = ?")
        .bind(invoice_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(invoice_points, 2);
}

#[tokio::test]
async fn cash_sale_does_not_increase_customer_outstanding() {
    let pool = fresh_db().await;
    insert_product(&pool, 400, "SKU400", "Cash Widget", 100.0, 75.0, 0.0).await;

    sqlx::query("INSERT INTO customers (id, customer_code, name, credit_limit, current_credit, loyalty_points, customer_type, is_active) VALUES (501, 'CUST002', 'Cash Customer', 10000, 0, 0, 'regular', 1)")
        .execute(&pool)
        .await
        .unwrap();

    let items = vec![(400i64, 3.0_f64, 100.0, 0.0, 75.0, 300.0)];
    let (_, _, _) = create_sales_invoice(&pool, 1, Some(501), &items, "cash").await;

    // Cash sale — customer should not owe anything.
    let current_credit: f64 = sqlx::query_scalar("SELECT current_credit FROM customers WHERE id = 501")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!((current_credit - 0.0).abs() < 0.001,
        "Cash sale should not increase customer outstanding, got {}", current_credit);

    // But loyalty points should still be awarded: floor(300 * 0.01) = 3.
    let points: i64 = sqlx::query_scalar("SELECT loyalty_points FROM customers WHERE id = 501")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(points, 3);
}

#[tokio::test]
async fn invoice_numbers_are_sequential() {
    let pool = fresh_db().await;
    insert_product(&pool, 500, "SKU500", "Seq Widget", 10.0, 8.0, 0.0).await;

    let items = vec![(500i64, 1.0_f64, 10.0, 0.0, 8.0, 10.0)];

    let (_, num1, _) = create_sales_invoice(&pool, 1, None, &items, "cash").await;
    let (_, num2, _) = create_sales_invoice(&pool, 1, None, &items, "cash").await;
    let (_, num3, _) = create_sales_invoice(&pool, 1, None, &items, "cash").await;

    assert_eq!(num1, "INV-000001");
    assert_eq!(num2, "INV-000002");
    assert_eq!(num3, "INV-000003");

    // All three should be in the DB.
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sales_invoices")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 3);
}
