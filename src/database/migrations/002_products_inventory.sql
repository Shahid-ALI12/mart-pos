-- 002_products_inventory.sql
-- Products, categories, brands, units, variants, stock

CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id INTEGER,
    gst_rate REAL DEFAULT 0,
    hsn_code TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE INDEX idx_categories_parent ON categories(parent_id);

CREATE TABLE brands (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE units (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('count', 'weight', 'volume', 'length')),
    decimals INTEGER DEFAULT 0,  -- decimal places allowed
    is_active BOOLEAN DEFAULT 1
);

-- Default units
INSERT INTO units (id, name, short_name, type, decimals) VALUES
(1, 'Pieces', 'pcs', 'count', 0),
(2, 'Kilogram', 'kg', 'weight', 3),
(3, 'Gram', 'g', 'weight', 2),
(4, 'Liter', 'L', 'volume', 3),
(5, 'Milliliter', 'ml', 'volume', 1),
(6, 'Meter', 'm', 'length', 2),
(7, 'Centimeter', 'cm', 'length', 1),
(8, 'Box', 'box', 'count', 0),
(9, 'Pack', 'pack', 'count', 0),
(10, 'Dozen', 'dz', 'count', 0);

CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    barcode TEXT UNIQUE,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    brand_id INTEGER,
    unit_id INTEGER NOT NULL,  -- base unit
    purchase_price REAL NOT NULL DEFAULT 0,
    sale_price REAL NOT NULL DEFAULT 0,
    min_sale_price REAL,
    mrp REAL,
    gst_rate REAL NOT NULL DEFAULT 0,
    hsn_code TEXT,
    reorder_level REAL DEFAULT 10,
    max_stock_level REAL,
    track_expiry BOOLEAN DEFAULT 0,
    track_batch BOOLEAN DEFAULT 0,
    track_serial BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name ON products(name);

CREATE TABLE product_variants (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    variant_name TEXT NOT NULL,  -- '500ml', '1kg', 'Red/M'
    barcode TEXT UNIQUE,
    sku TEXT UNIQUE,
    sale_price REAL,
    purchase_price REAL,
    mrp REAL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_barcode ON product_variants(barcode);

CREATE TABLE unit_conversions (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    from_unit_id INTEGER NOT NULL,
    to_unit_id INTEGER NOT NULL,
    factor REAL NOT NULL,  -- e.g., 1 box = 12 pcs
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (from_unit_id) REFERENCES units(id),
    FOREIGN KEY (to_unit_id) REFERENCES units(id),
    UNIQUE(product_id, from_unit_id, to_unit_id)
);

-- Stock per location (with batch/expiry support)
CREATE TABLE stock (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    variant_id INTEGER,
    batch_number TEXT,
    expiry_date DATE,
    serial_number TEXT,  -- for serialized items
    quantity REAL NOT NULL DEFAULT 0,  -- in base unit
    reserved_qty REAL DEFAULT 0,  -- reserved for pending orders
    unit_cost REAL,  -- cost price at this location/batch
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    UNIQUE(product_id, location_id, variant_id, batch_number, expiry_date, serial_number)
);

CREATE INDEX idx_stock_product ON stock(product_id);
CREATE INDEX idx_stock_location ON stock(location_id);
CREATE INDEX idx_stock_expiry ON stock(expiry_date);
CREATE INDEX idx_stock_batch ON stock(batch_number);

-- Stock movements (audit trail)
CREATE TABLE stock_movements (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    variant_id INTEGER,
    batch_number TEXT,
    expiry_date DATE,
    serial_number TEXT,
    movement_type TEXT NOT NULL CHECK (movement_type IN (
        'purchase', 'sale', 'sale_return', 'purchase_return',
        'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out',
        'waste', 'expired', 'damaged', 'opening_stock'
    )),
    reference_type TEXT,  -- 'purchase_order', 'purchase_invoice', 'sales_invoice', 'stock_adjustment', 'transfer_note'
    reference_id INTEGER,
    quantity REAL NOT NULL,  -- +ve for in, -ve for out
    unit_cost REAL,
    unit_price REAL,  -- sale price if applicable
    notes TEXT,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_location ON stock_movements(location_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX idx_stock_movements_ref ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(created_at);