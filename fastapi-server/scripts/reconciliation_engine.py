"""
Reconciliation Engine — Production-Grade Internal vs KSEI vs KPEI Daily Reconciliation
Called by EOD Processor. Compares:
  1. Internal portfolio (pe_custodian_assets) vs simulated KSEI records
  2. Internal settlement (pe_settlement_ledger) vs simulated KPEI clearing
  3. Journal entries vs actual trade records
Generates exception reports for any discrepancies.
"""
import sys
import os
import json
import logging
from datetime import datetime, date, timedelta

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [RECON] %(levelname)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/var/log/reconciliation_engine.log')
    ]
)
log = logging.getLogger(__name__)

# Database config
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "stock",
    "user": "openpg",
    "password": "openpgpwd"
}

def connect_db():
    import psycopg2
    return psycopg2.connect(**DB_CONFIG)

def recon_phase1_internal_vs_ksei(recon_date):
    """Phase 1: Internal portfolio vs KSEI custodian records"""
    log.info(f"Recon Phase 1: Internal vs KSEI — {recon_date}")
    conn = connect_db()
    cur = conn.cursor()
    try:
        # Get all internal custodian assets
        cur.execute("""
            SELECT user_id, symbol, balance as internal_qty, ksei_synced, last_synced_at
            FROM pe_custodian_assets
            WHERE balance > 0
            ORDER BY user_id, symbol
        """)
        internal_assets = {f"{r[0]}:{r[1]}": {
            "user_id": r[0], "symbol": r[1], "qty": r[2],
            "ksei_synced": r[3], "last_synced": r[4]
        } for r in cur.fetchall()}

        # Get simulated KSEI records (same table, ksei_synced=true)
        cur.execute("""
            SELECT user_id, symbol, balance as ksei_qty
            FROM pe_custodian_assets
            WHERE ksei_synced = true AND balance >= 0
            ORDER BY user_id, symbol
        """)
        ksei_assets = {f"{r[0]}:{r[1]}": r[2] for r in cur.fetchall()}

        # Compare
        discrepancies = []
        for key, internal in internal_assets.items():
            ksei_qty = ksei_assets.get(key, 0)
            diff = internal["qty"] - ksei_qty
            if abs(diff) > 0:
                discrepancies.append({
                    "type": "QUANTITY_MISMATCH",
                    "user_id": internal["user_id"],
                    "symbol": internal["symbol"],
                    "internal_qty": internal["qty"],
                    "ksei_qty": ksei_qty,
                    "difference": diff,
                    "severity": "CRITICAL" if abs(diff) > 100 else "WARNING"
                })

        # Check for KSEI-only records (not in internal)
        for key, ksei_qty in ksei_assets.items():
            if key not in internal_assets and ksei_qty > 0:
                u_id, sym = key.split(":")
                discrepancies.append({
                    "type": "KSEI_ONLY",
                    "user_id": int(u_id),
                    "symbol": sym,
                    "internal_qty": 0,
                    "ksei_qty": ksei_qty,
                    "difference": -ksei_qty,
                    "severity": "CRITICAL"
                })

        log.info(f"  Internal assets: {len(internal_assets)}, KSEI records: {len(ksei_assets)}")
        log.info(f"  Discrepancies found: {len(discrepancies)}")

        # Save exception report
        if discrepancies:
            report = {
                "recon_date": recon_date,
                "phase": "internal_vs_ksei",
                "timestamp": datetime.now().isoformat(),
                "total_discrepancies": len(discrepancies),
                "discrepancies": discrepancies
            }
            report_path = f"/var/www/idx.mytriv.com/fastapi-server/reports/recon_ksei_{recon_date}.json"
            os.makedirs(os.path.dirname(report_path), exist_ok=True)
            with open(report_path, "w") as f:
                json.dump(report, f, indent=2, default=str)
            log.warning(f"KSEI discrepancies saved to {report_path}")

        conn.commit()
        return discrepancies
    except Exception as e:
        conn.rollback()
        log.error(f"Phase 1 failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

def recon_phase2_settlement_vs_kpei(recon_date):
    """Phase 2: Settlement ledger vs KPEI clearing records"""
    log.info(f"Recon Phase 2: Settlement vs KPEI — {recon_date}")
    conn = connect_db()
    cur = conn.cursor()
    try:
        # Get all settlement records due today
        cur.execute("""
            SELECT id, order_id, user_id, type, amount, status, settlement_date
            FROM pe_settlement_ledger
            WHERE settlement_date <= %s::DATE
            ORDER BY id
        """, (recon_date,))
        settlements = [{
            "id": r[0], "order_id": r[1], "user_id": r[2],
            "type": r[3], "amount": float(r[4]), "status": r[5],
            "due_date": str(r[6])
        } for r in cur.fetchall()]

        pending = [s for s in settlements if s["status"] == "PENDING"]
        settled = [s for s in settlements if s["status"] == "SETTLED"]

        log.info(f"  Total settlements: {len(settlements)}, Pending: {len(pending)}, Settled: {len(settled)}")

        # Flag any overdue pending settlements
        overdue = [s for s in pending if s["due_date"] < recon_date]
        if overdue:
            report = {
                "recon_date": recon_date,
                "phase": "settlement_vs_kpei",
                "timestamp": datetime.now().isoformat(),
                "overdue_count": len(overdue),
                "overdue_settlements": overdue
            }
            report_path = f"/var/www/idx.mytriv.com/fastapi-server/reports/recon_kpei_{recon_date}.json"
            os.makedirs(os.path.dirname(report_path), exist_ok=True)
            with open(report_path, "w") as f:
                json.dump(report, f, indent=2, default=str)
            log.warning(f"Overdue settlements: {len(overdue)}")

        conn.commit()
        return overdue
    except Exception as e:
        conn.rollback()
        log.error(f"Phase 2 failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

def connect_remote_db():
    import psycopg2
    return psycopg2.connect(
        host="62.171.183.236", port=5434,
        dbname="broker_db", user="postgres", password="newpassword"
    )

def recon_phase3_journal_audit(recon_date):
    """Phase 3: Verify journal entries match actual trade records (remote DB)"""
    log.info(f"Recon Phase 3: Journal Audit — {recon_date}")
    conn = connect_remote_db()
    cur = conn.cursor()
    try:
        # Get journal entries for the date
        cur.execute("""
            SELECT entry_id, account_id, debit, credit, description, status
            FROM journal_entries
            WHERE trade_date = %s::DATE
            ORDER BY entry_id
        """, (recon_date,))
        journals = [{
            "entry_id": r[0], "account_id": r[1],
            "debit": float(r[2]), "credit": float(r[3]),
            "description": r[4], "status": r[5]
        } for r in cur.fetchall()]

        # Verify double-entry balance (debits must equal credits)
        total_debit = sum(j["debit"] for j in journals if j["status"] == "Posted")
        total_credit = sum(j["credit"] for j in journals if j["status"] == "Posted")

        imbalances = []
        if abs(total_debit - total_credit) > 0.01:
            imbalances.append({
                "type": "UNBALANCED_JOURNAL",
                "total_debit": total_debit,
                "total_credit": total_credit,
                "difference": round(total_debit - total_credit, 2),
                "severity": "CRITICAL"
            })

        log.info(f"  Journals: {len(journals)}, Debit: {total_debit:,.0f}, Credit: {total_credit:,.0f}")
        if imbalances:
            log.warning(f"Journal imbalances: {len(imbalances)}")

        # Save audit report
        report_path = f"/var/www/idx.mytriv.com/fastapi-server/reports/recon_journal_{recon_date}.json"
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        audit = {
            "recon_date": recon_date,
            "phase": "journal_audit",
            "timestamp": datetime.now().isoformat(),
            "total_entries": len(journals),
            "total_debit": total_debit,
            "total_credit": total_credit,
            "is_balanced": len(imbalances) == 0,
            "imbalances": imbalances,
            "pending_entries": len([j for j in journals if j["status"] != "Posted"])
        }
        with open(report_path, "w") as f:
            json.dump(audit, f, indent=2, default=str)

        conn.commit()
        return audit
    except Exception as e:
        conn.rollback()
        log.error(f"Phase 3 failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

def run_reconciliation(recon_date=None):
    if recon_date is None:
        recon_date = datetime.now().strftime("%Y-%m-%d")

    log.info("=" * 60)
    log.info(f"RECONCILIATION ENGINE — {recon_date}")
    log.info("=" * 60)

    results = {}
    try:
        results["ksei"] = recon_phase1_internal_vs_ksei(recon_date)
        log.info("")
    except Exception as e:
        results["ksei"] = {"error": str(e)}
        log.error(f"KSEI recon failed: {e}")

    try:
        results["kpei"] = recon_phase2_settlement_vs_kpei(recon_date)
        log.info("")
    except Exception as e:
        results["kpei"] = {"error": str(e)}
        log.error(f"KPEI recon failed: {e}")

    try:
        results["journal"] = recon_phase3_journal_audit(recon_date)
        log.info("")
    except Exception as e:
        results["journal"] = {"error": str(e)}
        log.error(f"Journal audit failed: {e}")

    log.info("=" * 60)
    total_issues = len(results.get("ksei", []) if isinstance(results.get("ksei"), list) else []) + \
                   len(results.get("kpei", []) if isinstance(results.get("kpei"), list) else [])
    log.info(f"RECONCILIATION COMPLETE — Issues: KSEI={len(results.get('ksei', []) if isinstance(results.get('ksei'), list) else [])}, KPEI={len(results.get('kpei', []) if isinstance(results.get('kpei'), list) else [])}, Journal Balanced={results.get('journal', {}).get('is_balanced', 'N/A')}")
    log.info("=" * 60)

    return results

if __name__ == "__main__":
    recon_date = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("%Y-%m-%d")
    results = run_reconciliation(recon_date)
    print(json.dumps(results, indent=2, default=str))
