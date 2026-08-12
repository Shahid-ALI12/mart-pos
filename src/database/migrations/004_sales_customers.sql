-- 004_sales_customers.sql
-- Customers, sales invoices, sales returns, payments, quotations, layaways

CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    customer_code TEXT UNIQUE NOT NULL,  -- auto-generated: CUST001
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    gstin TEXT,
    state_code INTEGER,
    credit_limit REAL DEFAULT 0,
    current_credit REAL DEFAULT 0,  -- outstanding amount (positive = they owe us)
    loyalty_points INTEGER DEFAULT 0,
    customer_type TEXT DEFAULT 'walkin' CHECK (customer_type IN ('walkin', 'regular', 'wholesale', 'corporate')),
    price_list_id INTEGER,  -- for special pricing
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_code ON customers(customer_code);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_gstin ON customers(gstin);
CREATE INDEX idx_customers_type ON customers(customer_type);

CREATE TABLE sales_invoices (
    id INTEGER PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    counter_id INTEGER NOT NULL,
    customer_id INTEGER,
    user_id INTEGER NOT NULL,
    invoice_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    subtotal REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    discount_percent REAL DEFAULT 0,
    taxable_amount REAL DEFAULT 0,
    cgst_amount REAL DEFAULT 0,
    sgst_amount REAL DEFAULT 0,
    igst_amount REAL DEFAULT 0,
    total_gst REAL DEFAULT 0,
    round_off REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    change_amount REAL DEFAULT 0,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'card', 'upi', 'credit', 'mixed')),
    payment_details TEXT,  -- JSON: [{"mode": "cash", "amount": 500}, {"mode": "upi", "amount": 300}]
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'returned', 'partial_return', 'cancelled', 'on_hold', 'draft')),
    loyalty_points_earned INTEGER DEFAULT 0,
    loyalty_points_redeemed INTEGER DEFAULT 0,
    notes TEXT,
    synced BOOLEAN DEFAULT 0,
    sync_version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (counter_id) REFERENCES locations(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_si_counter ON sales_invoices(counter_id);
CREATE INDEX idx_si_customer ON sales_invoices(customer_id);
CREATE INDEX idx_si_user ON sales_invoices(user_id);
CREATE INDEX idx_si_date ON sales_invoices(invoice_date);
CREATE INDEX idx_si_status ON sales_invoices(status);
CREATE INDEX idx_si_synced ON sales_invoices(synced);

CREATE TABLE sales_invoice_items (
    id INTEGER PRIMARY KEY,
    invoice_id INTEGER NOT NULL,
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
    cost_price REAL NOT NULL,  -- for profit calculation (FIFO)
    batch_number TEXT,
    expiry_date DATE,
    serial_numbers TEXT,  -- JSON array for serialized items
    FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE INDEX idx_sii_invoice ON sales_invoice_items(invoice_id);
CREATE INDEX idx_sii_product ON sales_invoice_items(product_id);
CREATE INDEX idx_sii_batch ON sales_invoice_items(batch_number);

CREATE TABLE sales_returns (
    id INTEGER PRIMARY KEY,
    return_number TEXT UNIQUE NOT NULL,
    original_invoice_id INTEGER NOT NULL,
    customer_id INTEGER,
    counter_id INTEGER NOT NULL,
    return_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    subtotal REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    refund_mode TEXT CHECK (refund_mode IN ('cash', 'card', 'upi', 'credit_note', 'exchange')),
    refund_ref TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    reason TEXT,
    notes TEXT,
    processed_by INTEGER,
    processed_at DATETIME,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (original_invoice_id) REFERENCES sales_invoices(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (counter_id) REFERENCES locations(id),
    FOREIGN KEY (processed_by) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_sr_invoice ON sales_returns(original_invoice_id);
CREATE INDEX idx_sr_customer ON sales_returns(customer_id);
CREATE INDEX idx_sr_date ON sales_returns(return_date);

CREATE TABLE sales_return_items (
    id INTEGER PRIMARY KEY,
    sr_id INTEGER NOT NULL,
    original_item_id INTEGER NOT NULL,
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
    condition TEXT CHECK (condition IN ('saleable', 'damaged', 'expired')),
    restock_location_id INTEGER,
    FOREIGN KEY (sr_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
    FOREIGN KEY (original_item_id) REFERENCES sales_invoice_items(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (unit_id) REFERENCES units(id),
    FOREIGN KEY (restock_location_id) REFERENCES locations(id)
);

-- Customer payments (against credit)
CREATE TABLE customer_payments (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'card', 'upi', 'cheque', 'bank', 'other')),
    reference_number TEXT,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    received_by INTEGER NOT NULL,
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (received_by) REFERENCES users(id)
);

CREATE INDEX idx_cp_customer ON customer_payments(customer_id);
CREATE INDEX idx_cp_date ON customer_payments(payment_date);

-- Quotations
CREATE TABLE quotations (
    id INTEGER PRIMARY KEY,
    quote_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER,
    counter_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    quote_date DATE NOT NULL,
    valid_until DATE,
    subtotal REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),
    converted_invoice_id INTEGER,
    notes TEXT,
    terms_conditions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (counter_id) REFERENCES locations(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (converted_invoice_id) REFERENCES sales_invoices(id)
);

CREATE INDEX idx_qt_customer ON quotations(customer_id);
CREATE INDEX idx_qt_status ON quotations(status);
CREATE INDEX idx_qt_date ON quotations(quote_date);

CREATE TABLE quotation_items (
    id INTEGER PRIMARY KEY,
    quote_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    variant_id INTEGER,
    unit_id INTEGER NOT NULL,
    qty REAL NOT NULL,
    unit_price REAL NOT NULL,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    gst_rate REAL NOT NULL,
    line_total REAL NOT NULL,
    FOREIGN KEY (quote_id) REFERENCES quotations(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (unit_id) REFERENCES units(id)
);

-- Layaways (partial payment holds)
CREATE TABLE layaways (
    id INTEGER PRIMARY KEY,
    layaway_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    counter_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATE,
    subtotal REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    paid_amount REAL DEFAULT 0,
    balance_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'expired')),
    notes TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (counter_id) REFERENCES locations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_lw_customer ON layaways(customer_id);
CREATE INDEX idx_lw_status ON layaways(status);

CREATE TABLE layaway_items (
    id INTEGER PRIMARY KEY,
    layaway_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    variant_id INTEGER,
    unit_id INTEGER NOT NULL,
    qty REAL NOT NULL,
    unit_price REAL NOT NULL,
    discount_percent REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    gst_rate REAL NOT NULL,
    line_total REAL NOT NULL,
    FOREIGN KEY (layaway_id) REFERENCES layaways(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE TABLE layaway_payments (
    id INTEGER PRIMARY KEY,
    layaway_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_mode TEXT NOT NULL,
    reference_number TEXT,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    received_by INTEGER NOT NULL,
    notes TEXT,
    FOREIGN KEY (layaway_id) REFERENCES layaways(id) ON DELETE CASCADE,
    FOREIGN KEY (received_by) REFERENCES users(id)
);

-- Hold bills (parked bills for queue management)
CREATE TABLE hold_bills (
    id INTEGER PRIMARY KEY,
    hold_number TEXT UNIQUE NOT NULL,
    counter_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    customer_id INTEGER,
    cart_data TEXT NOT NULL,  -- JSON of cart items
    subtotal REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    grand_total REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resumed_at DATETIME,
    resumed_by INTEGER,
    status TEXT DEFAULT 'held' CHECK (status IN ('held', 'resumed', 'cancelled')),
    FOREIGN KEY (counter_id) REFERENCES locations(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (resumed_by) REFERENCES users(id)
);

CREATE INDEX idx_hb_counter ON hold_bills(counter_id);
CREATE INDEX idx_hb_status ON hold_bills(status);