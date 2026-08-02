# Sinyal IDX Platform

Comprehensive trading platform with multi-source order flow (Web, Android, Desktop, Streamlit Bots) unified under a single FastAPI backend with dual-database architecture.

---

## Architecture Overview

```
                     ┌─────────────────────────────┐
                     │     Nginx Reverse Proxy      │
                     │  VPS2 (194.163.138.207:48622)│
                     └──────────┬──────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
  ┌───────────────┐   ┌───────────────┐   ┌───────────────────┐
  │ Web (React)   │   │ Android (APK) │   │ Desktop (Tauri)   │
  │ /client       │   │               │   │                   │
  └───────┬───────┘   └───────┬───────┘   └────────┬──────────┘
          │                   │                     │
          └───────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌──────────────────────────┐
                    │   FastAPI Backend          │
                    │   VPS2 :5000 (127.0.0.1)   │
                    │   PM2: idx-fastapi         │
                    └──────────┬───────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
          ┌─────────────────┐   ┌──────────────────────┐
          │  local_db       │   │   remote_db           │
          │  VPS2:5432      │   │   VPS3:5434           │
          │  stock DB       │   │   broker_db           │
          │                 │   │                       │
          │ - users         │   │ - pe_oms_orders       │
          │ - user_balances │   │ - pe_custodian_assets │
          │ - portfolio     │   │ - pe_rdn_balance      │
          │                 │   │ - pe_risk_kyc         │
          │                 │   │ - pe_risk_apu_ppt     │
          │                 │   │ - pe_settlement       │
          │                 │   │ - chart_of_accounts   │
          │                 │   │ - journal_entries     │
          └─────────────────┘   └──────────────────────┘
                                          ▲
                                          │
                               ┌──────────┴─────────────┐
                               │  VPS3 Services           │
                               │  (62.171.183.236:48622)  │
                               │                          │
                               │  - Streamlit (8503)       │
                               │  - Node.js (3001)         │
                               │  - Alpaca Bot             │
                               │  - Telegram Bot (@idxgpt) │
                               │  - Signal Broadcaster     │
                               └──────────────────────────┘
```

### Data Flow

- **Web/APK/Desktop** → Nginx (VPS2) → FastAPI (VPS2:5000)
- **Streamlit bots** → Node.js (VPS3:3001) → FastAPI (VPS2:5000)
- **OMS reads** `pe_oms_orders` from **remote_db** (VPS3:5434)
- **Virtual trading** writes `pe_*` tables to **remote_db** (auto-routed by DBRouter)
- **User accounts/auth** stay on **local_db** (VPS2:5432)

---

## OMS Market Filtering

**File:** `routers/oms.py`

The OMS `GET /oms/orders` endpoint filters by market by default:

| Parameter | Default | Description |
|---|---|---|
| `market` | `idx` | `idx` = IDX stocks only (excludes US Quant engines), `all` = all orders |

US stock orders from Alpaca/Quant engines (users 1, 8000, 8005) are hidden by default. Set `US_ENGINE_USERS = {1, 8000, 8005}` in `oms.py`.

Alpaca service (`alpaca_service.py:236-245`) and core DB (`core/database.py:230,299`) OMS API calls are commented out — US Quant engines no longer write to `pe_oms_orders`.

---

## Database Routing (DBRouter)

**File:** `idx_fastapi/database.py`

The `DBRouter` class auto-routes SQL queries:

| Table Pattern | Destination |
|---|---|
| `pe_*` (e.g. `pe_oms_orders`, `pe_custodian_assets`) | **remote_db** (VPS3:5434) |
| `REMOTE_TABLES` explicit list | **remote_db** (VPS3:5434) |
| Everything else (users, portfolio, etc.) | **local_db** (VPS2:5432) |

### Usage in Routers

```python
from database import get_db

@router.post("/endpoint")
async def my_endpoint(db: DBRouter = Depends(get_db)):
    # Auto-routed to remote_db (pe_* tables)
    db.execute(text("SELECT * FROM pe_oms_orders WHERE user_id=:uid"), {"uid": uid})

    # Explicit local_db for user data
    db.local.execute(text("SELECT * FROM users WHERE id=:uid"), {"uid": uid})

    # Explicit remote_db for broker data
    db.remote.execute(text("SELECT * FROM chart_of_accounts"))
```

---

## Servers

### VPS2 — Nginx + FastAPI (194.163.138.207)

| Service | Port | Access |
|---|---|---|
| Nginx (HTTPS) | 443 | Public (idx.mytriv.com) |
| FastAPI | 5000 | **127.0.0.1 only** (secured Jul 2026) |
| PostgreSQL (stock) | 5432 | localhost |
| SSH | 48622 | Key-only, fail2ban |

### VPS3 — Bandarmologi Stack (62.171.183.236)

| Service | Port | Notes |
|---|---|---|
| PostgreSQL (broker_db) | 5434 | Docker, internal |
| Redis | 6379 | localhost only |
| Node.js Backend | 3001 | bandarmologi-backend (PM2) |
| Streamlit Terminal | 8503 | 127.0.0.1, via Nginx `/dashboard` |
| Alpaca Bot | — | `workers/alpaca_worker.py` (PM2) |
| Telegram Bot (@idxgpt_bot) | — | `scripts/telegram_bot_server.py` (PM2) |
| Signal Broadcaster | — | `workers/idx_signal_broadcaster.py` (PM2) |

**PM2 VPS3 (13 apps):** alpaca-bot, bandarmologi-backend, idx-interactive-bot, idx-broadcaster, ai-saham-nextjs, banking-api, erp-ai-proxy, erp-fastapi-middleware, erp-landing-api, mytriv-domain, mytriv-track, pos-api, pos-api-v2.

### Security Hardening (July 2026)

| Action | Status |
|---|---|
| FastAPI bind `0.0.0.0` → `127.0.0.1` (VPS2) | ✅ Done |
| UFW block on Docker DB ports 6432, 6380, 6381 (VPS3) | ✅ iptables DOCKER-USER chain |
| SSH key-only auth, fail2ban | ✅ Both VPSes |
| Nginx duplicate mime types cleanup | ✅ Done |

---

## Telegram Bot

**Bot:** [@idxgpt_bot](https://t.me/idxgpt_bot) (Sinyal IDX Intelligence)
**Channel:** [@sinyalIDX](https://t.me/+MoJ29f5AYBtiODll) (permanent invite link)
**PM2:** `idx-interactive-bot` (scripts/telegram_bot_server.py)

| Command | Description |
|---|---|
| `/start` | Main menu & dashboard |
| `/link [TOKEN]` | Link Telegram to web account |
| `/harga BBRI` | Stock price check |
| `/sinyal BBCA` | Signal log query |
| `/chart BBCA` | Chart image |
| `/top` | Top gainers |
| `/market` | IDX market pulse |
| `/global` | US/world markets |
| `/news` | Market sentiment |
| `/alert BBCA 5000` | Price alert |
| `/referral` | Referral link |

20 users invited to @sinyalIDX channel (Jul 2026), 15 success, 5 blocked.

---

## VPS3 — Bandarmologi App Stack

**Directory:** `/home/deploy/bandarmologi/`

### Streamlit Terminal
- **Port:** 8503 (127.0.0.1), proxied via Nginx
- **Config:** `.streamlit/config.toml`
- **Pages:** 78 Python modules in `pages/`
- **Caching:** `@st.cache_data(ttl=3600)`, global `CACHE_TTL=300`

### Database Performance (Jul 2026 Fix)
Added 23 indexes to eliminate sequential scans:

| Table | Indexes |
|---|---|
| `alpaca_dca_portfolio` | `symbol`, `account_layer`, `last_update`, `buy_time` |
| `pe_custodian_assets` | `user_id`, `symbol`, `last_synced_at` |
| `dca_forward_trades` | `stock_code`, `trade_time`, `buy_time`, `account_layer` |
| `dca_scalp_trades` | `stock_code`, `trade_time`, `buy_time`, `account_layer` |
| `dca_mbx_forward_trades` | `stock_code`, `trade_time`, `buy_time`, `account_layer` |
| `dca_mbx_scalp_trades` | `stock_code`, `trade_time`, `buy_time`, `account_layer` |

### Telegram Bot Bugfix
Fixed `AttributeError: 'CallbackQuery' object has no attribute 'reply_text'` in `_send_fomo_lock()` — added `hasattr(source, "data")` check to handle both Message and CallbackQuery objects.

---

## Recent Infrastructure Changes

### 1. Router Migration to `get_db()` (June 19, 2026)

| Router | File | Status |
|---|---|---|
| OMS | `routers/oms.py` | `get_db()` with backward compat |
| Portfolio | `routers/portfolio.py` | `get_db()` + pe_* routing fix |
| Risk | `routers/risk.py` | `get_db()` + validate_order bypass |
| System Ops | `routers/system_ops.py` | `get_db()` + backup status endpoint |

**Portfolio Routing Fix:**
- `db.local.execute()` → `db.execute()` for `pe_*` tables (auto-routes to remote)
- `users` table stays on local via `db.local.execute()`

**Risk Bypass (Demo Mode):**
- `validate_order()` returns `{"status": "success"}` — skips KYC, RDN, portfolio checks

### 2. Health Monitoring

**Endpoint:** `GET /api/health` and `GET /health`

```json
{
  "status": "healthy",
  "database": {
    "local": "ok",
    "remote": "ok"
  }
}
```

### 3. PM2 Ecosystem (VPS2)

**File:** `ecosystem.config.js`

| Setting | Value |
|---|---|
| Process name | `idx-fastapi-backend` |
| Max memory | 500 MB (auto-restart) |
| Watch dir | `idx_fastapi/` |
| Restart delay | 100ms (exponential backoff) |

### 4. Health Check Automation

**File:** `/usr/local/bin/health_check.sh`
- Curls `/api/health` every 5 minutes via cron
- Auto-restarts PM2 if non-200
- Logs to `/var/log/health_check.log`

### 5. Database Backup

**Script:** `scripts/backup_broker_db.py`

| Setting | Value |
|---|---|
| Source | broker_db (VPS3:5434) |
| Destination | stock (VPS2:5432) |
| Tables | pe_* + accounting |
| Schedule | Daily 02:00 AM |
| Retention | 7 days |
| Storage | `/var/backups/broker_db/` |

**Status:** `GET /api/system/backup/status`

### 6. Streamlit System Operations Dashboard

**File:** `/home/deploy/bandarmologi/pages/27B_System_Operations.py`
- Backend health status (realtime)
- DB connectivity (local + remote)
- Backup count and details

---

## CSV Export

**File:** `routers/system_ops.py`

CSV export uses UTF-8 BOM for Excel compatibility. Web view uses inline CSS styling. File path resolves from `GET /api/system/csv-export/{filename}`.

---

## Documentation

| File | Content |
|---|---|
| `readme_sinyalidx.md` | Architecture, routing, security, services (this file) |
| `CHANGELOG.md` | Version history (June 11, 19, 22, Jul 2026) |
| `readme_sinyalidx.md` (bandarmologi) | Streamlit bot architecture |

---

## Credentials & Access

### Database

| DB | Host | Port | DB Name | User | Password |
|---|---|---|---|---|---|
| Local | localhost | 5432 | stock | openpg | openpgpwd |
| Remote | 62.171.183.236 | 5434 | broker_db | postgres | newpassword |

### SSH

| Server | Host | Port | Auth |
|---|---|---|---|
| VPS2 | 194.163.138.207 | 48622 | Key-only |
| VPS3 | 62.171.183.236 | 48622 | Key-only |

### PM2

```bash
pm2 status                    # List all processes
pm2 logs idx-fastapi-backend  # Tail logs
pm2 restart idx-fastapi-backend  # Restart
pm2 save                      # Save process list
```

---

## Development Guide

### Adding a New Router

```python
from fastapi import APIRouter, Depends
from database import get_db, DBRouter

router = APIRouter()

@router.get("/example")
async def example(db: DBRouter = Depends(get_db)):
    result = db.execute(text("SELECT * FROM pe_oms_orders"))
    users = db.local.execute(text("SELECT * FROM users"))
    return {"orders": result.fetchall(), "users": users.fetchall()}
```

### Important Conventions

1. **`pe_*` tables** → always write to remote_db (`db.execute()` or `db.remote.execute()`)
2. **`users`, `user_balances`** → always local (`db.local.execute()`)
3. **Quantity units:**
   - Android expects raw **Shares**
   - Web/Desktop expects **Lots** (quantity / 100)
   - OMS Dashboard expects raw **Shares**
   - Backend sniffs User-Agent to determine which to return
4. **Risk validation** is bypassed in demo mode

### Deployment

```bash
# VPS2 - FastAPI
cd /var/www/idx.mytriv.com/fastapi-server
git pull
pm2 restart idx-fastapi-backend
curl http://127.0.0.1:5000/health

# VPS3 - Streamlit
ssh -p48622 root@62.171.183.236
cd /home/deploy/bandarmologi
kill $(pgrep -f "streamlit run")
nohup venv/bin/streamlit run app.py --server.port=8503 --server.address=127.0.0.1 --server.headless=true >> streamlit_8503.log 2>&1 &
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Order not appearing in OMS | Portfolio wrote to local DB | Use `db.execute()` (not `db.local.execute()`) for `pe_*` |
| "RDN Account not found" | Wrong column name | Check `user_balances.saldo` vs `users.virtual_saldo` |
| validate_order crash | Missing `local_db` arg | Ensure function accepts `db` (DBRouter or Session) |
| Health returns 503 | DB connection issue | Check `database.py` credentials, network to VPS3 |
| OMS showing US stocks | Alpaca/Quant engines | Use `?market=idx` or check alpaca_service.py OMS call |
| Telegram Conflict error | Two bot instances / CallbackQuery bug | Check `_send_fomo_lock()` hasattr fix |
| Streamlit slow | Missing DB indexes | Run `CREATE INDEX` on `alpaca_dca_portfolio` etc. |
