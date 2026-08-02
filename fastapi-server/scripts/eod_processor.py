"""
EOD Processor — Production-Grade End of Day Settlement & Reporting
Called by cron: 0 17 * * 1-5  (every trading day 17:00 WIB)
"""
import requests
import json
import logging
import sys
import os
from datetime import datetime, timedelta

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [EOD] %(levelname)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/var/log/eod_processor.log')
    ]
)
log = logging.getLogger(__name__)

API_BASE = "http://127.0.0.1:5000/api"

def call_api(method, endpoint, payload=None):
    url = f"{API_BASE}{endpoint}"
    try:
        if method == "POST":
            r = requests.post(url, json=payload, timeout=120)
        else:
            r = requests.get(url, params=payload, timeout=120)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.error(f"API call failed: {method} {url} -> {e}")
        if payload:
            log.error(f"Payload: {json.dumps(payload)[:200]}")
        return {"status": "error", "detail": str(e)}

def step(name, fn):
    log.info("=" * 60)
    log.info(f"STEP: {name}")
    log.info("=" * 60)
    try:
        result = fn()
        log.info(f"RESULT: {json.dumps(result)[:500]}")
        return result
    except Exception as e:
        log.error(f"FAILED: {name} -> {e}")
        return {"status": "error", "detail": str(e)}

def phase0_oms_reset():
    """Phase 0: Reset OMS (Cancel all unexecuted day orders)"""
    log.info("--- Phase 0: OMS Daily Reset ---")
    return call_api("POST", "/oms/eod_reset")

def phase1_settlement_batch():
    """Phase 1: Run T+2 settlement batch (KPEI clearing simulation)"""
    log.info("--- Phase 1: Settlement Batch (KPEI Clearing) ---")
    return call_api("POST", "/clearing/run_settlement_batch")

def phase2_ksei_sync():
    """Phase 2: Sync portfolio mutations to KSEI"""
    log.info("--- Phase 2: KSEI Portfolio Sync ---")
    return call_api("POST", "/clearing/ksei_sync")

def phase3_process_journals():
    """Phase 3: Process daily journals for broker/commission income"""
    log.info("--- Phase 3: Daily Journal Processing ---")
    today = datetime.now().strftime("%Y-%m-%d")
    return call_api("POST", "/finance/ledger/process", {"trade_date": today})

def phase4_calc_mkbd():
    """Phase 4: Calculate MKBD from EOD balances"""
    log.info("--- Phase 4: MKBD Calculation ---")
    today = datetime.now().strftime("%Y-%m-%d")
    return call_api("GET", "/finance/mkbd", {"trade_date": today})

def phase5_reconciliation():
    """Phase 5: Internal vs KSEI vs KPEI reconciliation"""
    log.info("--- Phase 5: Reconciliation ---")
    import subprocess
    script_dir = os.path.dirname(os.path.abspath(__file__))
    result = subprocess.run(
        [sys.executable, os.path.join(script_dir, "reconciliation_engine.py")],
        capture_output=True, text=True, timeout=120
    )
    log.info(f"Recon stdout: {result.stdout[:500]}")
    if result.returncode != 0:
        log.error(f"Recon stderr: {result.stderr[:500]}")
        return {"status": "error", "detail": result.stderr[:500]}
    return {"status": "success", "output": result.stdout[:500]}

def phase6_eod_report():
    """Phase 6: Generate EOD summary report"""
    log.info("--- Phase 6: EOD Summary Report ---")
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Get financial statements for today
    bs = call_api("GET", "/finance/financial_statements", {"trade_date": today, "report_type": "balance_sheet"})
    pl = call_api("GET", "/finance/financial_statements", {"trade_date": today, "report_type": "income_statement"})
    
    summary = {
        "eod_date": today,
        "timestamp": datetime.now().isoformat(),
        "balance_sheet": bs.get("data", {}),
        "income_statement": pl.get("data", {}),
    }
    
    # Save EOD report to file
    report_path = f"/var/www/idx.mytriv.com/fastapi-server/reports/eod_{today}.json"
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w") as f:
        json.dump(summary, f, indent=2, default=str)
    
    log.info(f"EOD Report saved to {report_path}")
    return summary

def main():
    log.info("=" * 60)
    log.info("EOD PROCESSOR STARTED")
    log.info(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log.info("=" * 60)
    
    results = {}
    
    results["phase0_oms_reset"] = step("OMS Daily Reset", phase0_oms_reset)
    results["phase1_settlement"] = step("T+2 Settlement Batch", phase1_settlement_batch)
    results["phase2_ksei_sync"] = step("KSEI Portfolio Sync", phase2_ksei_sync)
    results["phase3_journals"] = step("Daily Journal Processing", phase3_process_journals)
    results["phase4_mkbd"] = step("MKBD Calculation", phase4_calc_mkbd)
    results["phase5_recon"] = step("Reconciliation", phase5_reconciliation)
    results["phase6_report"] = step("EOD Summary Report", phase6_eod_report)
    
    # Final summary
    errors = [k for k, v in results.items() if v.get("status") == "error"]
    log.info("=" * 60)
    if errors:
        log.warning(f"EOD COMPLETED WITH ERRORS: {errors}")
    else:
        log.info("EOD COMPLETED SUCCESSFULLY")
    log.info("=" * 60)
    
    return results

if __name__ == "__main__":
    main()
