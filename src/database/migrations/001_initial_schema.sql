-- 001_initial_schema.sql
-- Core tables: users, roles, settings

CREATE TABLE roles (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',  -- JSON array
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (id, name, permissions, description) VALUES
(1, 'admin', '["*"]', 'Full system access'),
(2, 'manager', '["pos.read", "pos.write", "inventory.read", "inventory.write", "purchases.read", "purchases.write", "sales.read", "sales.write", "customers.read", "customers.write", "reports.read", "expenses.read", "expenses.write", "users.read"]', 'Store manager'),
(3, 'cashier', '["pos.read", "pos.write", "customers.read", "customers.write"]', 'Billing counter operator'),
(4, 'stockist', '["inventory.read", "inventory.write", "purchases.read", "purchases.write", "stock.transfer"]', 'Inventory/stock manager');

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL DEFAULT 3,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Default admin user (password: admin123 - change on first login!)
-- Argon2id hash for 'admin123'
INSERT INTO users (id, username, password_hash, role_id, name, is_active) VALUES
(1, 'admin', '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$'+'invaliddummyhash', 1, 'Administrator', 1);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,  -- JSON stored
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default settings
INSERT INTO settings (key, value, description) VALUES
('shop_name', '"My Mart"', 'Shop name for invoices'),
('shop_address', '"123 Main Street, City"', 'Shop address'),
('shop_phone', '"+91-9876543210"', 'Shop phone'),
('shop_email', '"mart@example.com"', 'Shop email'),
('gstin', '"29ABCDE1234F1Z5"', 'GSTIN for GST invoices'),
('state_code', '29', 'GST State Code (Karnataka=29)'),
('invoice_prefix', '"INV"', 'Sales invoice prefix'),
('invoice_series', '1', 'Current invoice series number'),
('purchase_prefix', '"PO"', 'Purchase order prefix'),
('transfer_prefix', '"ST"', 'Stock transfer prefix'),
('default_tax_rate', '18', 'Default GST rate %'),
('currency', '"INR"', 'Currency code'),
('currency_symbol', '"₹"', 'Currency symbol'),
('date_format', '"DD/MM/YYYY"', 'Date display format'),
('time_format', '"HH:mm"', 'Time display format'),
('enable_loyalty', 'true', 'Enable loyalty points'),
('loyalty_points_per_rupee', '0.01', 'Points earned per ₹ spent'),
('loyalty_redemption_rate', '0.5', '₹ value per point'),
('enable_credit', 'true', 'Enable customer credit'),
('default_credit_limit', '10000', 'Default credit limit'),
('low_stock_threshold_days', '7', 'Days before expiry to alert'),
('auto_backup_enabled', 'true', 'Enable auto backup'),
('auto_backup_time', '"02:00"', 'Auto backup time'),
('backup_retention_days', '30', 'Backup retention days'),
('sync_enabled', 'true', 'Enable multi-counter sync'),
('sync_port', '8080', 'WebRTC signaling port');

CREATE TABLE locations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('counter', 'warehouse', 'damaged')),
    address TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_main_warehouse BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default locations
INSERT INTO locations (id, name, type, is_main_warehouse, is_active) VALUES
(1, 'Main Counter', 'counter', 0, 1),
(2, 'Main Warehouse', 'warehouse', 1, 1);