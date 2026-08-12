"""Smoke-test the SQL queries used in the new CRUD command implementations.

This script applies all migrations to a fresh SQLite DB and exercises the
queries that our Rust code will execute, using Python sqlite3 + parameterized
queries that mirror the Rust sqlx::query calls exactly (column-by-column).

Goal: catch any SQL syntax error, missing column, wrong JOIN, etc. BEFORE
shipping the Rust code to the user's local cargo build.
"""
import sqlite3
import tempfile
import os

MIGRATIONS = [
    "001_initial_schema.sql",
    "002_products_inventory.sql",
    "003_purchases.sql",
    "004_sales_customers.sql",
    "005_expenses_transfers_sync.sql",
    "006_user_fields.sql",
]

def run():
    db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    db.close()
    conn = sqlite3.connect(db.name)
    cur = conn.cursor()

    # This script lives at <repo>/scripts/test_crud_sql.py — migrations are one level up.
    base = os.path.join(os.path.dirname(__file__), "..", "src", "database", "migrations")
    base = os.path.abspath(base)

    for m in MIGRATIONS:
        with open(os.path.join(base, m)) as f:
            cur.executescript(f.read())
        print(f"  migrated: {m}")
    print()

    # ---- Categories ----
    print("== categories ==")

    # list with active_only filter
    cur.execute(
        "SELECT id, name, parent_id, gst_rate, hsn_code, description, is_active, created_at, updated_at "
        "FROM categories WHERE is_active = ? OR ? = 0 ORDER BY name",
        (1, 1),
    )
    print(f"  list_categories(active_only=1): {len(cur.fetchall())} rows")

    # create (and re-fetch by name)
    cur.execute(
        "INSERT INTO categories (name, parent_id, gst_rate, hsn_code, description, is_active) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        ("TestCategory", None, 5.0, "0401", "Test desc", 1),
    )
    cat_id = cur.lastrowid
    print(f"  create_category: id={cat_id}")

    # full update
    cur.execute(
        "UPDATE categories SET name = ?, parent_id = ?, gst_rate = ?, hsn_code = ?, "
        "description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        ("TestCategoryRenamed", None, 12.0, "0402", "Renamed", 1, cat_id),
    )
    print(f"  update_category: rows_affected={cur.rowcount}")

    # soft delete
    cur.execute(
        "UPDATE categories SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (cat_id,),
    )
    print(f"  soft_delete: rows_affected={cur.rowcount}")

    # hard delete (after reassigning no FKs)
    cur.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
    print(f"  hard_delete: rows_affected={cur.rowcount}")
    print()

    # ---- Brands ----
    print("== brands ==")
    cur.execute(
        "SELECT id, name, description, is_active, created_at FROM brands "
        "WHERE is_active = ? OR ? = 0 ORDER BY name",
        (1, 1),
    )
    print(f"  list_brands: {len(cur.fetchall())} rows")

    cur.execute(
        "INSERT INTO brands (name, description, is_active) VALUES (?, ?, ?)",
        ("TestBrand", "Brand desc", 1),
    )
    brand_id = cur.lastrowid
    print(f"  create_brand: id={brand_id}")

    cur.execute(
        "UPDATE brands SET name = ?, description = ?, is_active = ? WHERE id = ?",
        ("TestBrandRenamed", "Renamed", 1, brand_id),
    )
    print(f"  update_brand: rows_affected={cur.rowcount}")
    print()

    # ---- Units ----
    print("== units ==")
    # Note: column 'type' is a reserved word — must be quoted in SQL.
    cur.execute(
        'SELECT id, name, short_name, type as "type_", decimals, is_active '
        "FROM units WHERE is_active = ? OR ? = 0 ORDER BY name",
        (1, 1),
    )
    print(f"  list_units: {len(cur.fetchall())} rows")

    cur.execute(
        "INSERT INTO units (name, short_name, type, decimals, is_active) VALUES (?, ?, ?, ?, ?)",
        ("TestUnit", "tu", "count", 0, 1),
    )
    unit_id = cur.lastrowid
    print(f"  create_unit: id={unit_id}")

    cur.execute(
        'UPDATE units SET name = ?, short_name = ?, type = ?, decimals = ?, is_active = ? WHERE id = ?',
        ("TestUnitRenamed", "tur", "count", 0, 1, unit_id),
    )
    print(f"  update_unit: rows_affected={cur.rowcount}")
    print()

    # ---- Products ----
    print("== products ==")
    # Need a category, unit, optional brand.
    cur.execute("INSERT INTO categories (name, is_active) VALUES (?, 1)", ("ProdCat",))
    prod_cat_id = cur.lastrowid
    cur.execute("INSERT INTO brands (name, is_active) VALUES (?, 1)", ("ProdBrand",))
    prod_brand_id = cur.lastrowid
    cur.execute("INSERT INTO units (name, short_name, type, decimals, is_active) VALUES (?, ?, ?, ?, 1)",
                ("ProdUnit", "pu", "count", 0))
    prod_unit_id = cur.lastrowid

    # list query with the JOIN + subquery for current_stock
    list_sql = (
        "SELECT p.id, p.barcode, p.sku, p.name, p.category_id, p.brand_id, "
        "p.unit_id, p.purchase_price, p.sale_price, p.min_sale_price, "
        "p.mrp, p.gst_rate, p.hsn_code, p.reorder_level, "
        "p.max_stock_level, p.track_expiry, p.track_batch, "
        "p.track_serial, p.is_active, p.created_at, p.updated_at, "
        "c.name as category_name, b.name as brand_name, "
        "u.name as unit_name, u.short_name as unit_short_name, "
        "COALESCE((SELECT SUM(s.quantity - s.reserved_qty) FROM stock s "
        "         WHERE s.product_id = p.id AND s.variant_id IS NULL), 0) as current_stock "
        "FROM products p "
        "JOIN categories c ON c.id = p.category_id "
        "LEFT JOIN brands b ON b.id = p.brand_id "
        "JOIN units u ON u.id = p.unit_id "
        "WHERE (p.is_active = ? OR ? = 0) "
        "  AND (p.name LIKE ? ESCAPE '\\' OR p.sku LIKE ? ESCAPE '\\' OR p.barcode LIKE ? ESCAPE '\\') "
        "  AND (? = 0 OR p.category_id = ?) "
        "  AND (? = 0 OR p.brand_id = ?) "
        "ORDER BY p.name LIMIT ? OFFSET ?"
    )
    cur.execute(list_sql, (1, 1, "%", "%", "%", 0, None, 0, None, 20, 0))
    print(f"  list_products(empty search): {len(cur.fetchall())} rows")

    # insert
    cur.execute(
        "INSERT INTO products (barcode, sku, name, category_id, brand_id, unit_id, "
        "purchase_price, sale_price, min_sale_price, mrp, gst_rate, hsn_code, "
        "reorder_level, max_stock_level, track_expiry, track_batch, track_serial, is_active) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("8901234500001", "TEST-PROD-001", "Test Product", prod_cat_id, prod_brand_id, prod_unit_id,
         10.0, 15.0, 12.0, 16.0, 5.0, "0401", 5, 100, 1, 1, 0, 1),
    )
    prod_id = cur.lastrowid
    print(f"  create_product: id={prod_id}")

    # get_product (single)
    cur.execute(
        "SELECT p.id, p.barcode, p.sku, p.name, p.category_id, p.brand_id, "
        "p.unit_id, p.purchase_price, p.sale_price, p.min_sale_price, "
        "p.mrp, p.gst_rate, p.hsn_code, p.reorder_level, "
        "p.max_stock_level, p.track_expiry, p.track_batch, "
        "p.track_serial, p.is_active, p.created_at, p.updated_at, "
        "c.name as category_name, b.name as brand_name, "
        "u.name as unit_name, u.short_name as unit_short_name, "
        "COALESCE((SELECT SUM(s.quantity - s.reserved_qty) FROM stock s "
        "         WHERE s.product_id = p.id AND s.variant_id IS NULL), 0) as current_stock "
        "FROM products p "
        "JOIN categories c ON c.id = p.category_id "
        "LEFT JOIN brands b ON b.id = p.brand_id "
        "JOIN units u ON u.id = p.unit_id "
        "WHERE p.id = ?",
        (prod_id,),
    )
    row = cur.fetchone()
    print(f"  get_product: name={row[3]}, current_stock={row[25]}")

    # count(*) for pagination
    cur.execute(
        "SELECT COUNT(*) FROM products p "
        "WHERE (p.is_active = ? OR ? = 0) "
        "  AND (p.name LIKE ? ESCAPE '\\' OR p.sku LIKE ? ESCAPE '\\' OR p.barcode LIKE ? ESCAPE '\\') "
        "  AND (? = 0 OR p.category_id = ?) "
        "  AND (? = 0 OR p.brand_id = ?)",
        (1, 1, "%", "%", "%", 0, None, 0, None),
    )
    print(f"  count for pagination: {cur.fetchone()[0]}")

    # search with EXACT barcode match priority
    search_sql = (
        "SELECT p.id, p.barcode, p.sku, p.name "
        "FROM products p "
        "WHERE p.is_active = 1 "
        "  AND (p.name LIKE ? ESCAPE '\\' OR p.sku LIKE ? ESCAPE '\\' OR p.barcode LIKE ? ESCAPE '\\' OR p.barcode = ?) "
        "ORDER BY CASE WHEN p.barcode = ? THEN 0 ELSE 1 END, p.name LIMIT ?"
    )
    cur.execute(search_sql, ("%Test%", "%Test%", "%Test%", "8901234500001", "8901234500001", 25))
    print(f"  search_products('Test'): {len(cur.fetchall())} rows")

    # low_stock query
    low_stock_sql = (
        "SELECT p.id, p.sku, p.name, "
        "COALESCE((SELECT SUM(s2.quantity - s2.reserved_qty) FROM stock s2 "
        "         WHERE s2.product_id = p.id AND s2.variant_id IS NULL), 0) as current_stock "
        "FROM products p "
        "JOIN categories c ON c.id = p.category_id "
        "LEFT JOIN brands b ON b.id = p.brand_id "
        "JOIN units u ON u.id = p.unit_id "
        "LEFT JOIN stock s ON s.product_id = p.id AND s.variant_id IS NULL "
        "WHERE p.is_active = 1 "
        "GROUP BY p.id "
        "HAVING current_stock <= p.reorder_level "
        "ORDER BY current_stock ASC, p.name"
    )
    cur.execute(low_stock_sql)
    print(f"  get_low_stock: {len(cur.fetchall())} rows")
    print()

    # ---- Variants ----
    print("== variants ==")
    cur.execute(
        "SELECT id, product_id, variant_name, barcode, sku, sale_price, purchase_price, mrp, is_active, created_at "
        "FROM product_variants WHERE product_id = ? AND (is_active = ? OR ? = 0) ORDER BY variant_name",
        (prod_id, 1, 1),
    )
    print(f"  list_variants: {len(cur.fetchall())} rows")

    cur.execute(
        "INSERT INTO product_variants (product_id, variant_name, barcode, sku, sale_price, purchase_price, mrp, is_active) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (prod_id, "500ml", "8901234500011", "TEST-VAR-001", 17.0, 11.0, 18.0, 1),
    )
    var_id = cur.lastrowid
    print(f"  create_variant: id={var_id}")
    print()

    # ---- Conversions ----
    print("== conversions ==")
    cur.execute(
        "SELECT id, product_id, from_unit_id, to_unit_id, factor, is_active "
        "FROM unit_conversions WHERE product_id = ? AND (is_active = ? OR ? = 0)",
        (prod_id, 1, 1),
    )
    print(f"  list_conversions: {len(cur.fetchall())} rows")

    # Insert second unit so we can convert between two.
    cur.execute(
        "INSERT INTO units (name, short_name, type, decimals, is_active) VALUES (?, ?, ?, ?, 1)",
        ("ProdUnit2", "pu2", "count", 0),
    )
    prod_unit2_id = cur.lastrowid

    cur.execute(
        "INSERT INTO unit_conversions (product_id, from_unit_id, to_unit_id, factor, is_active) "
        "VALUES (?, ?, ?, ?, ?)",
        (prod_id, prod_unit_id, prod_unit2_id, 12.0, 1),
    )
    conv_id = cur.lastrowid
    print(f"  create_conversion: id={conv_id}")

    # UNIQUE(product_id, from_unit_id, to_unit_id) — should fail on duplicate.
    try:
        cur.execute(
            "INSERT INTO unit_conversions (product_id, from_unit_id, to_unit_id, factor, is_active) "
            "VALUES (?, ?, ?, ?, ?)",
            (prod_id, prod_unit_id, prod_unit2_id, 24.0, 1),
        )
        print("  FAIL: duplicate conversion should have raised!")
        return 1
    except sqlite3.IntegrityError as e:
        print(f"  UNIQUE(product_id, from_unit_id, to_unit_id): correctly rejected ({e})")

    conn.close()
    os.unlink(db.name)

    print()
    print("=" * 60)
    print("ALL SQL SMOKE TESTS PASSED")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
