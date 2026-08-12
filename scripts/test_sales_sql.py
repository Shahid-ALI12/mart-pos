"""Smoke-test the SQL inside `create_sales_invoice` (step 5).

This script applies all migrations to a fresh SQLite DB and replays the exact
SQL the Rust `create_sales_invoice` command will run, in the same order,
inside one Python transaction. The goal is to catch any SQL syntax error,
missing column, wrong type, or UNIQUE-constraint mismatch BEFORE shipping the
Rust code to the user's local cargo build.

Pass criteria:
  - Invoice row inserted with the right invoice_number and grand_total.
  - invoice_series in settings incremented atomically.
  - For each item: a sales_invoice_items row, a stock row decremented (or
    created with negative qty), and a stock_movements audit row.
  - For credit sales: customer.current_credit increased.
  - Loyalty points awarded on customer-attached sales.
  - A second sale on the SAME product+location+variant+batch finds and
    decrements the SAME stock row (proving the SELECT-then-UPDATE pattern
    works for repeat sales).
  - Rolling back a failed sale leaves no rows anywhere (atomicity).
"""

import json
import math
import os
import sqlite3
import tempfile


def rust_round(x):
    """Mirror Rust's `f64::round()` (round half away from zero) — NOT Python's
    banker's rounding `round()`. Python's `round(262.5)` returns 262, but
    Rust's `262.5_f64.round()` returns 263."""
    if x >= 0:
        return math.floor(x + 0.5)
    return math.ceil(x - 0.5)

MIGRATIONS = [
    "001_initial_schema.sql",
    "002_products_inventory.sql",
    "003_purchases.sql",
    "004_sales_customers.sql",
    "005_expenses_transfers_sync.sql",
    "006_user_fields.sql",
]


def apply_migrations(cur):
    base = os.path.join(os.path.dirname(__file__), "..", "src", "database", "migrations")
    base = os.path.abspath(base)
    for m in MIGRATIONS:
        with open(os.path.join(base, m)) as f:
            cur.executescript(f.read())


def seed_product(cur, *, prod_id, name="Test Product", sku="TP-1", sale_price=100.0,
                 purchase_price=60.0, gst_rate=5.0, opening_qty=50.0):
    """Insert a product, its category/unit, and an opening stock row."""
    cur.execute("INSERT INTO categories (name, is_active) VALUES (?, 1)", (f"Cat{prod_id}",))
    cat_id = cur.lastrowid
    cur.execute("INSERT INTO units (name, short_name, type, decimals, is_active) VALUES (?, ?, 'count', 0, 1)",
                (f"Unit{prod_id}", f"u{prod_id}"))
    unit_id = cur.lastrowid
    cur.execute(
        "INSERT INTO products (barcode, sku, name, category_id, unit_id, "
        "purchase_price, sale_price, gst_rate, is_active) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
        (f"890{prod_id:010d}", sku, name, cat_id, unit_id, purchase_price, sale_price, gst_rate),
    )
    pid = cur.lastrowid
    # Opening stock row at the Main Counter (location id=1, seeded by 001).
    cur.execute(
        "INSERT INTO stock (product_id, location_id, variant_id, batch_number, expiry_date, "
        "serial_number, quantity, reserved_qty, unit_cost, last_updated) "
        "VALUES (?, 1, NULL, NULL, NULL, NULL, ?, 0, ?, CURRENT_TIMESTAMP)",
        (pid, opening_qty, purchase_price),
    )
    return pid, unit_id, cat_id


def seed_customer(cur, *, name="Walk-in Customer"):
    cur.execute(
        "INSERT INTO customers (customer_code, name, customer_type, credit_limit, current_credit, "
        "loyalty_points, is_active) VALUES (?, ?, 'regular', 10000, 0, 0, 1)",
        (f"CUST-{name[:3].upper()}", name),
    )
    return cur.lastrowid


def call_create_sales_invoice_sql(cur, *, counter_id, customer_id, user_id, items,
                                  payment_mode, payment_details=None,
                                  discount_amount=0.0, discount_percent=0.0, notes=None):
    """Replays the SQL the Rust command runs, in the same order, inside the
    caller's transaction. Returns (invoice_id, invoice_number, grand_total)."""
    assert items, "empty items list"

    pm = payment_mode
    assert pm in ("cash", "card", "upi", "credit", "mixed"), f"bad payment_mode {pm}"

    # Totals
    subtotal = sum(i["line_total"] for i in items)
    disc_amt = discount_amount or 0.0
    taxable_amount = max(subtotal - disc_amt, 0.0)
    cgst_total = sum(i.get("cgst_amount", 0.0) for i in items)
    sgst_total = sum(i.get("sgst_amount", 0.0) for i in items)
    igst_total = sum(i.get("igst_amount", 0.0) for i in items)
    total_gst = cgst_total + sgst_total + igst_total
    raw_grand = taxable_amount + total_gst
    grand_total = rust_round(raw_grand)
    round_off = grand_total - raw_grand
    paid_amount = 0.0 if pm == "credit" else grand_total
    change_amount = 0.0

    # Read invoice_prefix and invoice_series from settings (same as Rust).
    cur.execute("SELECT value FROM settings WHERE key = 'invoice_prefix'")
    prefix_raw = cur.fetchone()[0]
    prefix = json.loads(prefix_raw) if prefix_raw.startswith('"') else prefix_raw

    cur.execute("SELECT value FROM settings WHERE key = 'invoice_series'")
    series_raw = cur.fetchone()[0]
    try:
        series = json.loads(series_raw)
    except Exception:
        series = int(series_raw)

    invoice_number = f"{prefix}-{series:06d}"

    # Increment series atomically.
    cur.execute(
        "UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'invoice_series'",
        (json.dumps(series + 1),),
    )

    # Insert the sales_invoices header.
    cur.execute(
        r"""INSERT INTO sales_invoices
            (invoice_number, counter_id, customer_id, user_id, invoice_date,
             subtotal, discount_amount, discount_percent, taxable_amount,
             cgst_amount, sgst_amount, igst_amount, total_gst,
             round_off, grand_total, paid_amount, change_amount,
             payment_mode, payment_details, status,
             loyalty_points_earned, loyalty_points_redeemed, notes,
             synced, sync_version, created_at, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,

                    ?, ?, ?, ?,
                    ?, ?, 'completed',
                    0, 0, ?,
                    0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
        (invoice_number, counter_id, customer_id, user_id,
         subtotal, disc_amt, discount_percent, taxable_amount,
         cgst_total, sgst_total, igst_total, total_gst,
         round_off, grand_total, paid_amount, change_amount,
         pm, payment_details, notes),
    )
    invoice_id = cur.lastrowid

    # Per-item loop.
    for item in items:
        cur.execute(
            r"""INSERT INTO sales_invoice_items
                (invoice_id, product_id, variant_id, unit_id,
                 qty, free_qty, unit_price,
                 discount_percent, discount_amount,
                 gst_rate, cgst_amount, sgst_amount, igst_amount,
                 line_total, cost_price,
                 batch_number, expiry_date, serial_numbers)
                VALUES (?, ?, ?, ?,
                        ?, ?, ?,
                        ?, ?,
                        ?, ?, ?, ?,
                        ?, ?,
                        ?, ?, ?)""",
            (invoice_id, item["product_id"], item.get("variant_id"), item["unit_id"],
             item["qty"], item.get("free_qty", 0.0), item["unit_price"],
             item.get("discount_percent", 0.0), item.get("discount_amount", 0.0),
             item["gst_rate"], item.get("cgst_amount", 0.0), item.get("sgst_amount", 0.0), item.get("igst_amount", 0.0),
             item["line_total"], item["cost_price"],
             item.get("batch_number"), item.get("expiry_date"), None),
        )

        # Find matching stock row with NULL-safe IS comparison.
        cur.execute(
            r"""SELECT id FROM stock
                WHERE product_id = ?
                  AND location_id = ?
                  AND variant_id IS ?
                  AND batch_number IS ?
                  AND expiry_date IS ?
                  AND serial_number IS NULL
                LIMIT 1""",
            (item["product_id"], counter_id, item.get("variant_id"),
             item.get("batch_number"), item.get("expiry_date")),
        )
        row = cur.fetchone()
        if row:
            stock_id = row[0]
            cur.execute(
                "UPDATE stock SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?",
                (item["qty"], stock_id),
            )
        else:
            cur.execute(
                r"""INSERT INTO stock
                    (product_id, location_id, variant_id, batch_number, expiry_date,
                     serial_number, quantity, reserved_qty, unit_cost, last_updated)
                    VALUES (?, ?, ?, ?, ?, NULL, ?, 0, ?, CURRENT_TIMESTAMP)""",
                (item["product_id"], counter_id, item.get("variant_id"),
                 item.get("batch_number"), item.get("expiry_date"),
                 -item["qty"], item["cost_price"]),
            )

        # Audit row.
        cur.execute(
            r"""INSERT INTO stock_movements
                (product_id, location_id, variant_id, batch_number, expiry_date,
                 serial_number, movement_type, reference_type, reference_id,
                 quantity, unit_cost, unit_price, notes, user_id, created_at)
                VALUES (?, ?, ?, ?, ?, NULL, 'sale', 'sales_invoice', ?,
                        ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)""",
            (item["product_id"], counter_id, item.get("variant_id"),
             item.get("batch_number"), item.get("expiry_date"),
             invoice_id, -item["qty"], item["cost_price"], item["unit_price"],
             notes, user_id),
        )

    # Customer-side bookkeeping.
    if customer_id is not None:
        earned = int(grand_total * 0.01)  # floor() of positive
        if earned > 0:
            cur.execute(
                "UPDATE customers SET loyalty_points = loyalty_points + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (earned, customer_id),
            )
            cur.execute(
                "UPDATE sales_invoices SET loyalty_points_earned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (earned, invoice_id),
            )
        if pm == "credit":
            owe = grand_total - paid_amount
            cur.execute(
                "UPDATE customers SET current_credit = current_credit + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (owe, customer_id),
            )

    return invoice_id, invoice_number, grand_total


# ----------------------------------------------------------------------------

def expect(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print(f"  PASS  {msg}")


def run():
    db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    db.close()
    conn = sqlite3.connect(db.name)
    conn.execute("PRAGMA foreign_keys = ON;")
    cur = conn.cursor()
    apply_migrations(cur)
    conn.commit()

    # Sanity check default seed data.
    cur.execute("SELECT COUNT(*) FROM locations WHERE id = 1")
    expect(cur.fetchone()[0] == 1, "default location id=1 exists")
    cur.execute("SELECT COUNT(*) FROM users WHERE id = 1")
    expect(cur.fetchone()[0] == 1, "default admin user id=1 exists")
    cur.execute("SELECT value FROM settings WHERE key = 'invoice_prefix'")
    expect(cur.fetchone()[0] == '"INV"', "invoice_prefix default = 'INV'")
    cur.execute("SELECT value FROM settings WHERE key = 'invoice_series'")
    expect(cur.fetchone()[0] == '1', "invoice_series default = 1")
    print()

    # Seed a product with 50 in stock at Main Counter.
    prod_id, unit_id, _ = seed_product(cur, prod_id=1, name="Milk 1L", sku="MILK-1L",
                                       sale_price=50.0, purchase_price=40.0, gst_rate=5.0,
                                       opening_qty=50.0)
    cust_id = seed_customer(cur, name="Alice")
    print(f"  seeded product id={prod_id} unit_id={unit_id} customer_id={cust_id}")

    # --- Sale 1: cash, 2 units of Milk 1L ---
    print()
    print("== Sale 1: cash, 2 × Milk 1L ==")
    items1 = [{
        "product_id": prod_id, "variant_id": None, "unit_id": unit_id,
        "qty": 2.0, "free_qty": 0.0, "unit_price": 50.0,
        "discount_percent": 0.0, "discount_amount": 0.0,
        "gst_rate": 5.0,
        "cgst_amount": 2.5, "sgst_amount": 2.5, "igst_amount": 0.0,
        "line_total": 100.0, "cost_price": 40.0,
        "batch_number": None, "expiry_date": None,
    }]
    inv_id1, inv_no1, gt1 = call_create_sales_invoice_sql(
        cur, counter_id=1, customer_id=cust_id, user_id=1,
        items=items1, payment_mode="cash",
        payment_details=json.dumps([{"mode": "cash", "amount": 105.0}]),
    )
    print(f"  invoice_id={inv_id1} number={inv_no1} grand_total={gt1}")
    expect(inv_no1 == "INV-000001", "first invoice_number = INV-000001")
    expect(gt1 == 105, "grand_total = 100 (subtotal) + 5 (gst) = 105")

    # Stock check: 50 - 2 = 48
    cur.execute("SELECT quantity FROM stock WHERE product_id = ? AND location_id = 1", (prod_id,))
    expect(cur.fetchone()[0] == 48.0, "stock decremented from 50 to 48")

    # Movement audit
    cur.execute("SELECT COUNT(*) FROM stock_movements WHERE reference_type='sales_invoice' AND reference_id = ?", (inv_id1,))
    expect(cur.fetchone()[0] == 1, "1 stock_movement row for sale 1")
    cur.execute("SELECT quantity FROM stock_movements WHERE reference_id = ?", (inv_id1,))
    expect(cur.fetchone()[0] == -2.0, "movement quantity = -2")

    # Loyalty: 105 * 0.01 = 1.05 → floor = 1
    cur.execute("SELECT loyalty_points FROM customers WHERE id = ?", (cust_id,))
    expect(cur.fetchone()[0] == 1, "loyalty_points awarded = floor(105 * 0.01) = 1")

    # Series incremented to 2
    cur.execute("SELECT value FROM settings WHERE key = 'invoice_series'")
    expect(cur.fetchone()[0] == '2', "invoice_series incremented to 2 inside tx")
    conn.commit()  # mirror Rust's tx.commit() at the end of each sale

    # --- Sale 2: credit, 5 units of Milk 1L — same product, should reuse stock row ---
    print()
    print("== Sale 2: credit, 5 × Milk 1L ==")
    items2 = [{
        "product_id": prod_id, "variant_id": None, "unit_id": unit_id,
        "qty": 5.0, "free_qty": 0.0, "unit_price": 50.0,
        "discount_percent": 0.0, "discount_amount": 0.0,
        "gst_rate": 5.0,
        "cgst_amount": 6.25, "sgst_amount": 6.25, "igst_amount": 0.0,
        "line_total": 250.0, "cost_price": 40.0,
        "batch_number": None, "expiry_date": None,
    }]
    inv_id2, inv_no2, gt2 = call_create_sales_invoice_sql(
        cur, counter_id=1, customer_id=cust_id, user_id=1,
        items=items2, payment_mode="credit",
    )
    print(f"  invoice_id={inv_id2} number={inv_no2} grand_total={gt2}")
    expect(inv_no2 == "INV-000002", "second invoice_number = INV-000002")
    expect(gt2 == 263, "grand_total = 250 + 12.5 gst = 262.5 → round to 263")

    # Stock check: 48 - 5 = 43 (single row reused, not split)
    cur.execute("SELECT COUNT(*) FROM stock WHERE product_id = ? AND location_id = 1", (prod_id,))
    expect(cur.fetchone()[0] == 1, "stock still has exactly ONE row (UPDATE not INSERT)")
    cur.execute("SELECT quantity FROM stock WHERE product_id = ? AND location_id = 1", (prod_id,))
    expect(cur.fetchone()[0] == 43.0, "stock decremented from 48 to 43 (same row reused)")

    # Credit customer: current_credit += 263
    cur.execute("SELECT current_credit FROM customers WHERE id = ?", (cust_id,))
    expect(cur.fetchone()[0] == 263.0, "credit sale: customer.current_credit = 263")

    # Loyalty on credit sale too: 263 * 0.01 = 2.63 → 2
    cur.execute("SELECT loyalty_points FROM customers WHERE id = ?", (cust_id,))
    expect(cur.fetchone()[0] == 3, "loyalty_points after sale 2 = 1 + floor(263*0.01)=2 → 3")
    conn.commit()  # mirror Rust's tx.commit() at the end of each sale

    # --- Sale 3: brand new product with NO opening stock — should create negative row ---
    print()
    print("== Sale 3: cash, 1 × Bread (no opening stock) ==")
    prod_id2, unit_id2, _ = seed_product(cur, prod_id=2, name="Bread", sku="BREAD-1",
                                          sale_price=30.0, purchase_price=20.0, gst_rate=0.0,
                                          opening_qty=0.0)
    # Remove the empty stock row that seed_product added (so there's NO row at all).
    cur.execute("DELETE FROM stock WHERE product_id = ? AND location_id = 1", (prod_id2,))
    items3 = [{
        "product_id": prod_id2, "variant_id": None, "unit_id": unit_id2,
        "qty": 1.0, "free_qty": 0.0, "unit_price": 30.0,
        "discount_percent": 0.0, "discount_amount": 0.0,
        "gst_rate": 0.0,
        "cgst_amount": 0.0, "sgst_amount": 0.0, "igst_amount": 0.0,
        "line_total": 30.0, "cost_price": 20.0,
        "batch_number": None, "expiry_date": None,
    }]
    inv_id3, inv_no3, gt3 = call_create_sales_invoice_sql(
        cur, counter_id=1, customer_id=None, user_id=1,
        items=items3, payment_mode="cash",
    )
    print(f"  invoice_id={inv_id3} number={inv_no3} grand_total={gt3}")
    expect(gt3 == 30, "grand_total for bread = 30")
    cur.execute("SELECT COUNT(*) FROM stock WHERE product_id = ? AND location_id = 1", (prod_id2,))
    expect(cur.fetchone()[0] == 1, "stock row was INSERTed for product with no opening stock")
    cur.execute("SELECT quantity FROM stock WHERE product_id = ? AND location_id = 1", (prod_id2,))
    expect(cur.fetchone()[0] == -1.0, "newly-inserted stock row has quantity = -1 (negative)")
    conn.commit()  # mirror Rust's tx.commit() at the end of each sale
    print()

    # --- Atomicity test: a deliberately failing sale should roll back everything ---
    print("== Sale 4: deliberately failing sale (invalid FK) ==")
    # Product id 99999 doesn't exist → FK violation should fail the INSERT into
    # sales_invoice_items, and the entire transaction (including the
    # invoice_series increment and the invoice header insert) must roll back.
    try:
        call_create_sales_invoice_sql(
            cur, counter_id=1, customer_id=None, user_id=1,
            items=[{
                "product_id": 99999,  # does not exist
                "variant_id": None, "unit_id": 1,
                "qty": 1.0, "free_qty": 0.0, "unit_price": 1.0,
                "discount_percent": 0.0, "discount_amount": 0.0,
                "gst_rate": 0.0,
                "cgst_amount": 0.0, "sgst_amount": 0.0, "igst_amount": 0.0,
                "line_total": 1.0, "cost_price": 0.0,
                "batch_number": None, "expiry_date": None,
            }],
            payment_mode="cash",
        )
        # We expect sqlite3 to raise IntegrityError before reaching here.
        # Note: Python's sqlite3 does NOT enforce FK by default unless
        # PRAGMA foreign_keys=ON; we set it on the connection above.
        print("  WARN  expected IntegrityError was not raised — Python sqlite3 may not be enforcing FK")
    except sqlite3.IntegrityError as e:
        print(f"  PASS  IntegrityError raised as expected: {e}")
        # Rollback the failed Python-side transaction so we can verify state below.
        conn.rollback()

    # Verify state after rollback: invoice_series should still be 4 (sale 3
    # committed it to 4; sale 4's would-be increment to 5 should have rolled
    # back). Sale 4 would have been INV-000004.
    cur.execute("SELECT value FROM settings WHERE key = 'invoice_series'")
    series_after = cur.fetchone()[0]
    print(f"  (debug) invoice_series after rollback = {series_after!r}")
    expect(series_after == '4', f"after rollback, invoice_series unchanged at 4 (got {series_after!r})")
    # And no orphan invoice with the would-be number INV-000004
    cur.execute("SELECT COUNT(*) FROM sales_invoices WHERE invoice_number = 'INV-000004'")
    expect(cur.fetchone()[0] == 0, "no orphan invoice INV-000004 after rollback")
    # And the customer's credit balance must NOT have changed (still 263 from sale 2)
    cur.execute("SELECT current_credit FROM customers WHERE id = ?", (cust_id,))
    expect(cur.fetchone()[0] == 263.0, "customer.current_credit unchanged after rollback (still 263)")
    # And no stock_movement row should reference the rolled-back invoice
    cur.execute("SELECT COUNT(*) FROM stock_movements WHERE reference_id = ?", (4,))
    expect(cur.fetchone()[0] == 0, "no stock_movements row for the rolled-back invoice (id=4)")

    conn.commit()
    conn.close()
    os.unlink(db.name)

    print()
    print("=" * 60)
    print("ALL SALES SQL SMOKE TESTS PASSED")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
