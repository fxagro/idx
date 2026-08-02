# Changelog — Sinyal IDX FastAPI Backend

All notable changes to the FastAPI backend infrastructure.

---

## [2026-06-22] — OMS US Stock Filtering & Alpaca Cleanup

### Added
- **Market filter** (`GET /oms/orders?market=idx|all`): Default `idx` hides US Quant engine orders (users 1, 8000, 8005)
- **`US_ENGINE_USERS` set** in `routers/oms.py`: Centralized list of user IDs for non-IDX trading engines

### Changed
- **`routers/oms.py`**: `get_orders()` now accepts `market` query param; default `idx` filters out US engine users
- **`alpaca_service.py`** (VPS3): OMS API call commented out — US stock trades no longer written to `pe_oms_orders`
- **`core/database.py`** (VPS3): OMS API call commented out — WALL STREET QUANT engine no longer writes to `pe_oms_orders`

### Fixed
- **OMS dashboard clutter**: US stock orders (AIG, AAPL, GOOGL, etc.) no longer pollute the IDX OMS view
- **Data source isolation**: IDX OMS now only shows user 6+ regular trades; US quant trades isolated via `market=all`

---

## [2026-06-19] — Database Routing & Infrastructure Overhaul

### Added
- **DBRouter class** (`idx_fastapi/database.py`): Auto-routes SQL queries to local_db (VPS2:5432) or remote_db (VPS3:5434) based on table name pattern (`pe_*` → remote)
- **`get_db()` dependency**: Centralized DB session injection replacing ad-hoc dual-session pattern
- **Health endpoints** (`GET /health`, `GET /api/health`): Tests both DB connections, returns 200/503
- **PM2 ecosystem config** (`ecosystem.config.js`): Memory limit (500M), watch mode, exponential backoff restart
- **Health check script** (`/usr/local/bin/health_check.sh`): Cron-based auto-recovery every 5 minutes
- **Backup script** (`scripts/backup_broker_db.py`): Daily `pe_*` tables backup from remote to local DB, compressed, 7-day retention
- **Backup status endpoint** (`GET /api/system/backup/status`): Backup metadata + restore log

### Changed
- **`routers/oms.py`**: Migrated to `get_db()`; passes `db.remote` / `db.local` to downstream calls
- **`routers/portfolio.py`**: Migrated to `get_db()`; all `pe_*` table operations changed from `db.local.execute()` → `db.execute()` (auto-routes to remote DB)
- **`routers/risk.py`**: Migrated to `get_db()`; `validate_order()` accepts `db` (DBRouter or Session) + `local_db` for backward compat
- **Remote DB connection string**: Updated to use explicit credentials for VPS3 broker_db

### Fixed
- **Order visibility**: Virtual trading orders now write to remote DB → visible in OMS dashboard
- **validate_order compatibility**: Backward-compatible signature accepts both old and new callers

### Security
- **Risk validation bypassed** for demo: `validate_order()` returns success immediately, skipping KYC/RDN/balance checks

---

## [2026-06-11] — Quantity Consistency & Bug Fixes

### Fixed
- **"RDN Account not found" error** (`routers/oms.py`): Replaced `users.virtual_saldo` with `user_balances.saldo`
- **"unexpected keyword argument 'local_db'" error** (`routers/risk.py`): Added `local_db` parameter to `validate_order()` signature
- **Quantity inconsistency**: Added User-Agent sniffing in `get_orders()` to return Shares (Android/OMS) or Lots (Web/Desktop)

---

## [2026-06-09] — Initial FastAPI Backend Bridge

### Added
- FastAPI backend bridge deployment (`idx_fastapi/`)
- PM2 process management
- PostgreSQL connection to both local stock_db and remote broker_db
- Basic OMS order endpoints
- Virtual trading portfolio endpoints
- Risk validation skeleton
