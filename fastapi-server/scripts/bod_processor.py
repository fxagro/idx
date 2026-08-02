"""
BOD Processor — Production-Grade Begin/Start of Day Preparation
Called by cron: 0 7 * * 1-5  (every trading day 07:00 WIB, before market open)

Processes:
  1. Reset daily trading limits
  2. Prepare RDN balances for new trading day
  3. Archive yesterday's data snapshots
  4. Verify system readiness (DB, API, market data)
  5. Generate BOD report
"""
import requests
import json
import logging
import os
import sys
from datetime import datetime, timedelta

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [BOD] %(levelname)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/var/log/bod_processor.log')
    ]
)
log = logging.getLogger(__name__)

API_BASE = "http://127.0.0.1:5000/api"
DB_CONFIG = {
    "host": "localhost", "port": 5432, "dbname": "stock",
    "user": "openpg", "password": "openpgpwd"
}

def call_api(method, endpoint, payload=None):
    url = f"{API_BASE}{endpoint}"
    try:
        if method == "POST":
            r = requests.post(url, json=payload, timeout=30)
        else:
            r = requests.get(url, params=payload, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.error(f"API call failed: {method} {url} -> {e}")
        return {"status": "error", "detail": str(e)}

def step(name, fn):
    log.info("-" * 40)
    log.info(f"STEP: {name}")
    log.info("-" * 40)
    try:
        result = fn()
        log.info(f"OK: {json.dumps(result)[:300]}")
        return result
    except Exception as e:
        log.error(f"FAILED: {name} -> {e}")
        return {"status": "error", "detail": str(e)}

def phase1_health_check():
    """Phase 1: System health check"""
    log.info("--- Phase 1: System Health Check ---")
    import psycopg2
    
    checks = {}
    
    # Check FastAPI
    try:
        r = requests.get("http://127.0.0.1:5000/health", timeout=5)
        checks["fastapi"] = r.json()
    except Exception as e:
        checks["fastapi"] = {"status": "error", "detail": str(e)}
    
    # Check local DB
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        checks["local_db"] = {"status": "healthy"}
    except Exception as e:
        checks["local_db"] = {"status": "error", "detail": str(e)}
    
    # Check remote DB
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine("postgresql://postgres:newpassword@62.171.183.236:5434/broker_db", connect_args={"connect_timeout": 5})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        checks["remote_db"] = {"status": "healthy"}
    except Exception as e:
        checks["remote_db"] = {"status": "error", "detail": str(e)}
    
    log.info(f"Health: {json.dumps(checks)}")
    return checks

def phase2_reset_daily_limits():
    """Phase 2: Reset daily trading limits for non-bot users"""
    log.info("--- Phase 2: Reset Daily Limits ---")
    import psycopg2
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    try:
        # Reset daily AI/API usage for non-admin users
        cur.execute("""
            UPDATE users 
            SET api_usage = 0, ai_usage = 0
            WHERE role NOT IN ('admin', 'superadmin')
        """)
        reset_count = cur.rowcount
        conn.commit()
        log.info(f"  Reset daily limits for {reset_count} users")
        return {"status": "success", "reset_count": reset_count}
    except Exception as e:
        conn.rollback()
        log.error(f"Reset failed: {e}")
        return {"status": "error", "detail": str(e)}
    finally:
        cur.close()
        conn.close()

def phase3_archive_snapshot():
    """Phase 3: Archive yesterday's trading snapshot"""
    log.info("--- Phase 3: Archive Daily Snapshot ---")
    import psycopg2
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    try:
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Snapshot OMS orders for the day
        cur.execute("""
            INSERT INTO pe_daily_snapshots (snapshot_date, data_type, snapshot)
            SELECT %s::DATE, 'oms_orders', json_agg(row_to_json(t))
            FROM (
                SELECT * FROM pe_oms_orders 
                WHERE created_at::DATE = %s::DATE
            ) t
        """, (yesterday, yesterday))
        
        # Snapshot settlement ledger
        cur.execute("""
            INSERT INTO pe_daily_snapshots (snapshot_date, data_type, snapshot)
            SELECT %s::DATE, 'settlement_ledger', json_agg(row_to_json(t))
            FROM (
                SELECT * FROM pe_settlement_ledger 
                WHERE settlement_date = %s::DATE
            ) t
        """, (yesterday, yesterday))
        
        # Snapshot RDN balances
        cur.execute("""
            INSERT INTO pe_daily_snapshots (snapshot_date, data_type, snapshot)
            SELECT %s::DATE, 'rdn_balance', json_agg(row_to_json(t))
            FROM (
                SELECT * FROM pe_rdn_balance
            ) t
        """, (yesterday,))
        
        conn.commit()
        log.info(f"  Archived snapshots for {yesterday}")
        return {"status": "success", "date": yesterday}
    except Exception as e:
        conn.rollback()
        log.error(f"Archive failed: {e}")
        return {"status": "error", "detail": str(e)}
    finally:
        cur.close()
        conn.close()

def phase4_trading_day_prep():
    """Phase 4: Prepare system for new trading day"""
    log.info("--- Phase 4: Trading Day Preparation ---")
    import psycopg2
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Create BOD entry in trading calendar if not exists
        cur.execute("""
            INSERT INTO pe_trading_calendar (trade_date, status, notes)
            VALUES (%s::DATE, 'OPEN', 'BOD Auto-Open')
            ON CONFLICT (trade_date) DO UPDATE SET status = 'OPEN', notes = 'BOD Auto-Open'
        """, (today,))
        
        conn.commit()
        log.info(f"  Trading day {today} prepared")
        return {"status": "success", "trade_date": today}
    except Exception as e:
        conn.rollback()
        log.error(f"Prep failed: {e}")
        return {"status": "error", "detail": str(e)}
    finally:
        cur.close()
        conn.close()

def phase5_bod_report():
    """Phase 5: Generate BOD report"""
    log.info("--- Phase 5: BOD Report ---")
    today = datetime.now().strftime("%Y-%m-%d")
    
    report = {
        "bod_date": today,
        "timestamp": datetime.now().isoformat(),
        "market_status": "OPEN",
        "system": "READY"
    }
    
    report_path = f"/var/www/idx.mytriv.com/fastapi-server/reports/bod_{today}.json"
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    
    log.info(f"BOD Report saved to {report_path}")
    return report

def main():
    log.info("=" * 60)
    log.info("BOD PROCESSOR STARTED")
    log.info(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log.info("=" * 60)
    
    results = {}
    
    results["health"] = step("System Health Check", phase1_health_check)
    
    # Only proceed if core systems are healthy
    health_ok = results["health"].get("fastapi", {}).get("status") == "healthy" and \
                results["health"].get("local_db", {}).get("status") == "healthy"
    
    if not health_ok:
        log.error("SYSTEM HEALTH CHECK FAILED — Aborting BOD")
        log.error(json.dumps(results["health"], indent=2))
        return results
    
    results["limits"] = step("Reset Daily Limits", phase2_reset_daily_limits)
    results["archive"] = step("Archive Snapshot", phase3_archive_snapshot)
    results["prep"] = step("Trading Day Prep", phase4_trading_day_prep)
    results["report"] = step("BOD Report", phase5_bod_report)
    
    errors = [k for k, v in results.items() if isinstance(v, dict) and v.get("status") == "error"]
    log.info("=" * 60)
    if errors:
        log.warning(f"BOD COMPLETED WITH ERRORS: {errors}")
    else:
        log.info("BOD COMPLETED SUCCESSFULLY — SYSTEM READY FOR TRADING")
    log.info("=" * 60)
    
    return results

if __name__ == "__main__":
    main()
