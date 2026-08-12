# Mart POS/ERP System

A comprehensive desktop POS and ERP system for large general stores/marts with multi-counter support, inventory management, billing, reports, and GST compliance.

## Features

- **Multi-counter POS** - Multiple billing counters with real-time sync
- **Inventory Management** - Stock tracking, variants, units, expiry, batch management
- **Purchase Management** - Suppliers, Purchase Orders, Goods Receipt Notes, Returns
- **Sales & Billing** - Fast POS screen, multiple payment modes, hold/retrieve bills
- **Customer CRM** - Loyalty points, credit management, statements
- **Reports** - Sales, Profit/Loss, Stock, GST (GSTR-1/3B), Custom reports
- **Expenses** - Category-wise expense tracking
- **Multi-counter Sync** - LAN peer-to-peer sync via WebRTC
- **Hardware Integration** - Barcode scanner, thermal printer, cash drawer, weighing scale
- **GST Compliance** - HSN codes, GST rates, invoice series, GSTR export

## Tech Stack

- **Framework**: Tauri v2 (Rust + Web frontend)
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **State**: Zustand + TanStack Query
- **Database**: SQLite (sqlx) with SQLCipher encryption
- **Sync**: WebRTC DataChannels (LAN P2P)
- **Printing**: ESC/POS thermal printer support

## Project Structure

```
mart-pos/
├── src/                      # Rust backend (Tauri)
│   ├── main.rs
│   ├── database/
│   │   ├── migrations/       # SQLx migrations
│   │   ├── models/           # Data models
│   │   ├── repositories/     # Data access layer
│   │   └── sync/             # WebRTC sync engine
│   ├── commands/             # Tauri invoke handlers
│   └── utils/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── modules/          # Feature modules
│   │   ├── shared/           # Shared components, hooks, utils
│   │   ├── stores/           # Zustand stores
│   │   └── services/         # API calls
│   └── package.json
├── Cargo.toml
├── tauri.conf.json
└── README.md
```

## Getting Started

### Prerequisites

- Rust (latest stable) - https://rustup.rs/
- Node.js 18+ - https://nodejs.org/
- pnpm (recommended) - `npm install -g pnpm`

### Development Setup

```bash
# Clone the repository
git clone https://github.com/Shahid-ALI12/mart-pos.git
cd mart-pos

# Install frontend dependencies
cd frontend && pnpm install && cd ..

# Run development server (starts both Rust backend and Vite frontend)
cargo tauri dev
```

### Building for Production

```bash
# Build the application
cargo tauri build

# Output: src-tauri/target/release/bundle/
# - MSI installer (Windows)
# - AppImage/Deb/RPM (Linux)
# - DMG (macOS)
```

## Database Schema

The system uses a normalized SQLite schema with tables for:
- Users & Roles (RBAC)
- Categories, Brands, Units, Products, Variants
- Stock (multi-location with batch/expiry tracking)
- Stock Movements (audit trail)
- Suppliers, Purchase Orders, Purchase Invoices (GRN)
- Customers, Sales Invoices, Sales Returns
- Payments, Expenses
- Stock Transfers (inter-location)
- Settings, Sync Log

See `src/database/migrations/` for complete schema.

## Multi-Counter Architecture

```
┌─────────────┐     WebRTC DataChannel      ┌─────────────┐
│  Counter 1  │ ◄─────────────────────────► │  Counter 2  │
│  (SQLite)   │   Event Sourcing + CRDT     │  (SQLite)   │
└─────────────┘                             └─────────────┘
       ▲                                           ▲
       └──────────────────┬────────────────────────┘
                          ▼
                 ┌─────────────┐
                 │  Warehouse  │
                 │  (Main DB)  │
                 └─────────────┘
```

- SQLite WAL mode for concurrent access
- Event sourcing: every change → `sync_log` → broadcast to peers
- Offline-first: changes queued locally, synced when peers connect
- Conflict resolution: last-write-wins + manual merge for critical data

## Hardware Integration

Supported hardware via Tauri commands:
- **Barcode Scanners** - USB HID (keyboard wedge) + camera (QuaggaJS)
- **Thermal Printers** - ESC/POS (80mm/58mm), Windows Print API
- **Cash Drawers** - Printer-driven (CD kick)
- **Weighing Scales** - RS232/USB serial protocols
- **Pole Displays** - Serial/USB customer display

## GST Compliance (India)

- HSN/SAC code management per product
- GST rates (0%, 5%, 12%, 18%, 28%) with CGST/SGST/IGST split
- B2B/B2C invoice classification
- GSTR-1 JSON export (B2B, B2C, HSN summary)
- GSTR-3B summary data
- E-invoice ready (IRN generation via API)
- Invoice series management (financial year wise)

## License

Private repository - All rights reserved.

## Author

**Shahid Ali** - shahidshafaqat2007@gmail.com
GitHub: [@Shahid-ALI12](https://github.com/Shahid-ALI12)