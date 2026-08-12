-- 003_purchases.sql
-- Suppliers, purchase orders, purchase invoices (GRN), purchase returns

CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    gstin TEXT,
    state_code INTEGER,
    payment_terms_days INTEGER DEFAULT 30,
    opening_balance REAL DEFAULT 0,  -- payable to supplier (positive = we owe them)
    credit_limit REAL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_gstin ON suppliers(gstin);

CREATE TABLE purchase_orders (
    id INTEGER PRIMARY KEY,
    po_number TEXT UNIQUE NOT NULL,
    supplier_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'partial', 'received', 'cancelled')),
    order_date DATE NOT NULL,
    expected_date DATE,
    total_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    round_off REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    notes TEXT,
    terms_conditions TEXT,
    created_by INTEGER NOT NULL,
    approved_by INTEGER,
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_date ON purchase_orders(order_date);

CREATE TABLE purchase_order_items (
    id INTEGER PRIMARY KEY,
    po_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    variant_id INTEGER,
    unit_id INTEGER NOT NULL,
    ordered_qty REAL NOT NULL,
    received_qty REAL DEFAULT 0,
    unit_price REAL NOT NULL,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    gst_rate REAL NOT NULL,
    gst_amount REAL DEFAULT 0,
    line_total REAL NOT NULL,
    notes TEXT,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE INDEX idx_poi_po ON purchase_order_items(po_id);
CREATE INDEX idx_poi_product ON purchase_order_items(product_id);

CREATE TABLE purchase_invoices (
    id INTEGER PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    po_id INTEGER,
    supplier_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    invoice_date DATE NOT NULL,
    bill_number TEXT,  -- supplier's bill number
    bill_date DATE,
    total_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    round_off REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'cancelled')),
    payment_mode TEXT,  -- 'cash', 'bank', 'upi', 'cheque', 'credit'
    payment_ref TEXT,
    notes TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_pi_supplier ON purchase_invoices(supplier_id);
CREATE INDEX idx_pi_date ON purchase_invoices(invoice_date);
CREATE INDEX idx_pi_status ON purchase_invoices(status);
CREATE INDEX idx_pi_po ON purchase_invoices(po_id);

CREATE TABLE purchase_invoice_items (
    id INTEGER PRIMARY KEY,
    pi_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    variant_id INTEGER,
    unit_id INTEGER NOT NULL,
    qty REAL NOT NULL,
    free_qty REAL DEFAULT 0,
    unit_price REAL NOT NULL,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    gst_rate REAL NOT NULL,
    cgst_amount REAL DEFAULT 0,
    sgst_amount REAL DEFAULT 0,
    igst_amount REAL DEFAULT 0,
    line_total REAL NOT NULL,
    batch_number TEXT,
    expiry_date DATE,
    notes TEXT,
    FOREIGN KEY (pi_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE INDEX idx_pii_pi ON purchase_invoice_items(pi_id);
CREATE INDEX idx_pii_product ON purchase_invoice_items(product_id);

CREATE TABLE purchase_returns (
    id INTEGER PRIMARY KEY,
    return_number TEXT UNIQUE NOT NULL,
    pi_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    return_date DATE NOT NULL,
    total_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    refund_mode TEXT,  -- 'cash', 'bank', 'credit_note', 'replacement'
    refund_ref TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    reason TEXT,
    notes TEXT,
    created_by INTEGER NOT NULL,
    approved_by INTEGER,
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pi_id) REFERENCES purchase_invoices(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE INDEX idx_pr_supplier ON purchase_returns(supplier_id);
CREATE INDEX idx_pr_date ON purchase_returns(return_date);

CREATE TABLE purchase_return_items (
    id INTEGER PRIMARY KEY,
    pr_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    variant_id INTEGER,
    unit_id INTEGER NOT NULL,
    qty REAL NOT NULL,
    unit_price REAL NOT NULL,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    gst_rate REAL NOT NULL,
    cgst_amount REAL DEFAULT 0,
    sgst_amount REAL DEFAULT 0,
    igst_amount REAL DEFAULT 0,
    line_total REAL NOT NULL,
    batch_number TEXT,
    expiry_date DATE,
    reason TEXT,
    FOREIGN KEY (pr_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (unit_id) REFERENCES units(id)
);

-- Supplier payments (payables)
CREATE TABLE supplier_payments (
    id INTEGER PRIMARY KEY,
    supplier_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_mode TEXT NOT NULL,
    reference_number TEXT,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    paid_by INTEGER NOT NULL,
    notes TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (paid_by) REFERENCES users(id)
);

CREATE INDEX idx_sp_supplier ON supplier_payments(supplier_id);
CREATE INDEX idx_sp_date ON supplier_payments(payment_date);