// tests/schema_test.rs
//
// Verifies that the SQL migrations in `src/database/migrations/`:
//   1. Apply cleanly to a fresh in-memory SQLite database (no syntax errors,
//      no circular dependencies, no missing FK targets).
//   2. Seed the expected baseline data (admin user, default settings,
//      default units, default locations, default expense categories).
//   3. Enforce key CHECK / UNIQUE / FK constraints the way the application
//      expects — so a bad INSERT is rejected, not silently accepted.
//
// These tests do NOT exercise SQLCipher (the in-memory pool is plain SQLite).
// SQLCipher only changes how the file is encrypted at rest; the SQL the
// application runs is byte-for-byte identical. So we can use plain SQLite
// here for speed (no need to compile libsqlite3-sys with sqlcipher in CI).

use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::Row;
use sqlx::SqlitePool;

/// Spin up a fresh in-memory SQLite pool with all migrations applied.
/// Each test gets its own private database (in-memory + unique connection).
async fn fresh_db() -> SqlitePool {
    let options = SqliteConnectOptions::new()
        .filename(":memory:")
        .foreign_keys(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);

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

#[tokio::test]
async fn migrations_apply_cleanly() {
    // Just creating the pool + running migrations is the test. If any
    // migration has a syntax error or an invalid constraint, this panics
    // and the test fails with a clear message.
    let pool = fresh_db().await;
    pool.close().await;
}

#[tokio::test]
async fn admin_user_is_seeded_with_valid_argon2_hash() {
    let pool = fresh_db().await;

    let row = sqlx::query("SELECT username, password_hash, role_id, is_active FROM users WHERE id = 1")
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch admin row");

    assert_eq!(row.get::<String, _>("username"), "admin");
    assert_eq!(row.get::<i64, _>("role_id"), 1);
    assert!(row.get::<bool, _>("is_active"));

    let hash: String = row.get("password_hash");
    // The hash must be a valid PHC string — starts with $argon2id$ and has
    // the expected parameter block. Full Argon2 verification happens in
    // the auth test (which would need the argon2 crate as a dev-dependency);
    // here we just check the format.
    assert!(
        hash.starts_with("$argon2id$v=19$m=19456,t=2,p=1$"),
        "Admin password hash is not a valid Argon2id PHC string: {}",
        hash
    );
}

#[tokio::test]
async fn default_roles_are_seeded() {
    let pool = fresh_db().await;

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM roles")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 4, "Expected 4 default roles (admin, manager, cashier, stockist)");

    let admin_perms: String = sqlx::query_scalar("SELECT permissions FROM roles WHERE name = 'admin'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(admin_perms, "[\"*\"]", "Admin should have wildcard permissions");
}

#[tokio::test]
async fn default_settings_are_seeded() {
    let pool = fresh_db().await;

    // Spot-check a few critical settings the sales flow depends on.
    let invoice_prefix: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'invoice_prefix'")
        .fetch_one(&pool)
        .await
        .unwrap();
    // Settings are stored as JSON strings — text values are double-quoted.
    assert_eq!(invoice_prefix, "\"INV\"");

    let invoice_series: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'invoice_series'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(invoice_series, "1", "Invoice series should start at 1");
}

#[tokio::test]
async fn default_units_are_seeded() {
    let pool = fresh_db().await;

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM units")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 10, "Expected 10 default units (pcs, kg, g, L, ml, m, cm, box, pack, dz)");

    // The CHECK constraint on `type` should reject anything outside the enum.
    let result = sqlx::query("INSERT INTO units (id, name, short_name, type, decimals) VALUES (999, 'Bad', 'bad', 'invalid', 0)")
        .execute(&pool)
        .await;
    assert!(
        result.is_err(),
        "CHECK constraint on units.type should reject 'invalid' — got Ok"
    );
}

#[tokio::test]
async fn unique_constraint_on_sku_and_barcode_is_enforced() {
    let pool = fresh_db().await;

    // Need a category and unit to insert a product.
    sqlx::query("INSERT INTO categories (id, name, gst_rate, is_active) VALUES (100, 'TestCat', 0, 1)")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO products (id, sku, name, category_id, unit_id, purchase_price, sale_price, gst_rate, reorder_level, track_expiry, track_batch, track_serial, is_active) VALUES (1, 'SKU001', 'Widget', 100, 1, 10, 20, 0, 0, 0, 0, 0, 1)")
        .execute(&pool)
        .await
        .unwrap();

    // Inserting a second product with the same SKU must fail.
    let dup = sqlx::query("INSERT INTO products (id, sku, name, category_id, unit_id, purchase_price, sale_price, gst_rate, reorder_level, track_expiry, track_batch, track_serial, is_active) VALUES (2, 'SKU001', 'Dupe', 100, 1, 10, 20, 0, 0, 0, 0, 0, 1)")
        .execute(&pool)
        .await;
    assert!(dup.is_err(), "UNIQUE constraint on products.sku should reject duplicates");
}

#[tokio::test]
async fn foreign_key_on_sales_invoice_user_is_enforced() {
    let pool = fresh_db().await;

    // counter_id must reference an existing location; user_id must reference
    // an existing user. Both should fail.
    let bad_user = sqlx::query(
        "INSERT INTO sales_invoices (invoice_number, counter_id, user_id, payment_mode)
         VALUES ('TEST-001', 1, 9999, 'cash')",
    )
    .execute(&pool)
    .await;
    assert!(
        bad_user.is_err(),
        "FK on sales_invoices.user_id should reject non-existent user"
    );

    let bad_counter = sqlx::query(
        "INSERT INTO sales_invoices (invoice_number, counter_id, user_id, payment_mode)
         VALUES ('TEST-002', 9999, 1, 'cash')",
    )
    .execute(&pool)
    .await;
    assert!(
        bad_counter.is_err(),
        "FK on sales_invoices.counter_id should reject non-existent location"
    );
}

#[tokio::test]
async fn payment_mode_check_constraint_rejects_invalid_values() {
    let pool = fresh_db().await;

    // Valid modes are: cash, card, upi, credit, mixed. Anything else must fail.
    let bad_mode = sqlx::query(
        "INSERT INTO sales_invoices (invoice_number, counter_id, user_id, payment_mode)
         VALUES ('TEST-CHECK', 1, 1, 'bitcoin')",
    )
    .execute(&pool)
    .await;
    assert!(
        bad_mode.is_err(),
        "CHECK constraint on sales_invoices.payment_mode should reject 'bitcoin'"
    );

    // Sanity: a valid mode should be accepted.
    let good_mode = sqlx::query(
        "INSERT INTO sales_invoices (invoice_number, counter_id, user_id, payment_mode)
         VALUES ('TEST-OK', 1, 1, 'upi')",
    )
    .execute(&pool)
    .await;
    assert!(good_mode.is_ok(), "Valid payment_mode 'upi' should be accepted");
}

#[tokio::test]
async fn migration_006_adds_must_change_password_column() {
    let pool = fresh_db().await;

    // Migration 006 added `must_change_password` to the users table.
    // The admin should have it set to 1 (must change on first login).
    let row = sqlx::query("SELECT must_change_password FROM users WHERE id = 1")
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch admin row");

    let must_change: bool = row.get("must_change_password");
    assert!(must_change, "Default admin should have must_change_password=true");
}
