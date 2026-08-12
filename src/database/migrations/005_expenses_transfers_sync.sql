-- 005_expenses_transfers_sync.sql
-- Expenses, stock transfers, sync log, activity log

CREATE TABLE expense_categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO expense_categories (name, description) VALUES
('Rent', 'Shop/warehouse rent'),
('Electricity', 'Electricity bills'),
('Water', 'Water bills'),
('Internet', 'Internet/broadband'),
('Phone', 'Phone/mobile bills'),
('Salary', 'Staff salaries'),
('Maintenance', 'Equipment maintenance'),
('Stationery', 'Office supplies'),
('Marketing', 'Advertising/promotions'),
('Transport', 'Delivery/transport costs'),
('Bank Charges', 'Bank fees, payment gateway charges'),
('Insurance', 'Shop/stock insurance'),
('Licenses', 'Trade license, GST renewal'),
('Miscellaneous', 'Other expenses');

CREATE TABLE expenses (
    id INTEGER PRIMARY KEY,
    category_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    expense_date DATE NOT NULL,
    description TEXT,
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'card', 'upi', 'bank', 'cheque', 'other')),
    reference TEXT,  -- bill number, invoice ref
    attachment_path TEXT,  -- receipt scan path
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_exp_category ON expenses(category_id);
CREATE INDEX idx_exp_date ON expenses(expense_date);
CREATE INDEX idx_exp_created_by ON expenses(created_by);

-- Stock transfers between locations
CREATE TABLE stock_transfers (
    id INTEGER PRIMARY KEY,
    transfer_number TEXT UNIQUE NOT NULL,
    from_location_id INTEGER NOT NULL,
    to_location_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'in_transit', 'received', 'partial', 'cancelled')),
    requested_by INTEGER NOT NULL,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    dispatched_by INTEGER,
    dispatched_at DATETIME,
    received_by INTEGER,
    received_at DATETIME,
    notes TEXT,
    FOREIGN KEY (from_location_id) REFERENCES locations(id),
    FOREIGN KEY (to_location_id) REFERENCES locations(id),
    FOREIGN KEY (requested_by) REFERENCES users(id),
    FOREIGN KEY (dispatched_by) REFERENCES users(id),
    FOREIGN KEY (received_by) REFERENCES users(id)
);

CREATE INDEX idx_st_from ON stock_transfers(from_location_id);
CREATE INDEX idx_st_to ON stock_transfers(to_location_id);
CREATE INDEX idx_st_status ON stock_transfers(status);
CREATE INDEX idx_st_date ON stock_transfers(requested_at);

CREATE TABLE stock_transfer_items (
    id INTEGER PRIMARY KEY,
    transfer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    variant_id INTEGER,
    batch_number TEXT,
    expiry_date DATE,
    requested_qty REAL NOT NULL,
    dispatched_qty REAL DEFAULT 0,
    received_qty REAL DEFAULT 0,
    unit_cost REAL,
    notes TEXT,
    FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
);

CREATE INDEX idx_sti_transfer ON stock_transfer_items(transfer_id);
CREATE INDEX idx_sti_product ON stock_transfer_items(product_id);

-- Sync log for multi-counter replication
CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
    payload TEXT NOT NULL,  -- JSON of changed fields
    source_counter_id INTEGER NOT NULL,
    source_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced_to_all BOOLEAN DEFAULT 0,
    sync_version INTEGER DEFAULT 1
);

CREATE INDEX idx_sync_table_record ON sync_log(table_name, record_id);
CREATE INDEX idx_sync_counter ON sync_log(source_counter_id);
CREATE INDEX idx_sync_synced ON sync_log(synced_to_all);
CREATE INDEX idx_sync_created ON sync_log(created_at);

-- Activity log (audit trail for user actions)
CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,  -- 'login', 'logout', 'create', 'update', 'delete', 'print', 'export', 'backup', 'restore'
    entity_type TEXT,  -- 'product', 'sale', 'purchase', 'customer', 'user', etc.
    entity_id INTEGER,
    old_values TEXT,  -- JSON
    new_values TEXT,  -- JSON
    ip_address TEXT,
    device_info TEXT,
    success BOOLEAN DEFAULT 1,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_al_user ON activity_log(user_id);
CREATE INDEX idx_al_action ON activity_log(action);
CREATE INDEX idx_al_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_al_date ON activity_log(created_at);

-- Price lists (for wholesale/corporate customers)
CREATE TABLE price_lists (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_default BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE price_list_items (
    id INTEGER PRIMARY KEY,
    price_list_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    variant_id INTEGER,
    sale_price REAL NOT NULL,
    min_qty REAL DEFAULT 1,  -- quantity break
    FOREIGN KEY (price_list_id) REFERENCES price_lists(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    UNIQUE(price_list_id, product_id, variant_id, min_qty)
);

-- Opening stock (for initial setup / financial year start)
CREATE TABLE opening_stock (
    id INTEGER PRIMARY KEY,
    financial_year TEXT NOT NULL,  -- '2024-25'
    product_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    variant_id INTEGER,
    batch_number TEXT,
    expiry_date DATE,
    quantity REAL NOT NULL,
    unit_cost REAL NOT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(financial_year, product_id, location_id, variant_id, batch_number, expiry_date)
);

-- Financial year settings
CREATE TABLE financial_years (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,  -- '2024-25'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN DEFAULT 0,
    is_closed BOOLEAN DEFAULT 0,
    closed_at DATETIME,
    closed_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (closed_by) REFERENCES users(id)
);

INSERT INTO financial_years (name, start_date, end_date, is_current) VALUES
('2024-25', '2024-04-01', '2025-03-31', 1);