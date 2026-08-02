# Sinyal IDX FastAPI Backend

This repository contains the FastAPI backend for the Sinyal IDX applications (Android, Desktop Tauri, and Web).

## Recent Fixes & Patches (June 11, 2026)

### 1. Fix "RDN Account not found" Error
**File:** `idx_fastapi/routers/oms.py`
**Issue:** When attempting to place a BUY order, the backend threw a `psycopg2.errors.UndefinedColumn: column "virtual_saldo" does not exist` error.
**Resolution:**
- The logic in `buy_stock` and `sell_stock` was referencing a non-existent `virtual_saldo` column in the `users` table.
- Modified the code to fetch the `saldo` from the `user_balances` table instead.
- **Implementation:**
  ```python
  balance_query = text("SELECT saldo FROM user_balances WHERE user_id = :uid LIMIT 1")
  ```

### 2. Fix "unexpected keyword argument 'local_db'" Error
**File:** `idx_fastapi/routers/oms.py`
**Issue:** `validate_order()` was crashing because it was called with a `local_db` argument, but the function signature did not accept it.
**Resolution:**
- Modified the signature of `validate_order` to accept `local_db: Session` as an argument.

### 3. Sync Portfolio Quantity Logic across Android, Web, and Desktop
**File:** `idx_fastapi/routers/portfolio.py` and `idx_fastapi/routers/oms.py`
**Issue:** The quantity calculation was inconsistent across different platforms. Android expected the value in *Shares* (Lembar), while the Web and Tauri Desktop clients expected the value in *Lots*.
**Resolution:**
1. **Web App (via `/portfolio` & `/history`):**
   - Modified `idx_fastapi/routers/portfolio.py` to ensure that `shares`, `quantity`, and `qty` are returned in **Lots** (`net_qty // 100`).
   - The Desktop App (which recalculates total market values via `quantity * 100 * price` behind the scenes) was also partially affected by this.
2.   - **Desktop Tauri App (via `/oms/orders`):**
   - The Desktop App fetches its data from the `pe_oms_orders` table (via `/orders` endpoint in `oms.py`) and recalculates the total portfolio value using its own logic (`shares * 100 * price`).
   - Android also uses the `/orders` endpoint but expects the raw *Shares*.
   - The OMS Streamlit Dashboard (admin panel) uses the `/orders` endpoint but divides the shares by 100 on its own frontend UI.
   - **User-Agent & Referer Sniffing:** To fix the Desktop App without breaking the Android App or the OMS Dashboard, a detector was injected into `get_orders` (`oms.py`).
   - If the request originates from **Android** (`android`, `dalvik`, or `okhttp` in the User-Agent), it returns the raw `quantity` (Shares).
   - If the request originates from **OMS Dashboard** (`dashboard` or `oms` in the Referer), it returns the raw `quantity` (Shares).
   - If the request is purely from the **Desktop Tauri client or SinyalIDX Web App**, it divides the `quantity` by 100 before returning it.

**Important Note for Future Development:**
When adding new features or modifying quantity calculations, always remember that:
- **Android App** inherently computes using *Shares* and performs its own `/ 100` division on the UI.
- **Web & Desktop Apps** rely on the backend dividing the values by 100 to yield *Lots*. 
- The `get_orders` endpoint dynamically alters the `quantity` field based on the client's `User-Agent`. Do not remove this logic unless the Desktop App is updated to perform the division internally.
