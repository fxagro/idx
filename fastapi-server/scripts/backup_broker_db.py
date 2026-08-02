#!/usr/bin/env python3
"""Periodic backup: broker_db (VPS3) pe_* tables -> stock_db (VPS2)"""
import subprocess, sys, os, time, gzip
from datetime import datetime

REMOTE_HOST = "62.171.183.236"
REMOTE_PORT = "5434"
REMOTE_DB = "broker_db"
REMOTE_USER = "postgres"
REMOTE_PASS = "newpassword"

LOCAL_HOST = "127.0.0.1"
LOCAL_PORT = "5432"
LOCAL_DB = "stock"
LOCAL_USER = "openpg"
LOCAL_PASS = "openpgpwd"

BACKUP_DIR = "/var/backups/broker_db"
os.makedirs(BACKUP_DIR, exist_ok=True)

ts = datetime.now().strftime("%Y%m%d_%H%M%S")
sql_file = os.path.join(BACKUP_DIR, f"broker_db_pe_tables_{ts}.sql")
gz_file = sql_file + ".gz"
restore_log = os.path.join(BACKUP_DIR, f"restore_{ts}.log")

tables = [
    "pe_oms_orders", "pe_rdn_balance", "pe_custodian_assets",
    "pe_risk_kyc", "pe_risk_apu_ppt", "pe_settlement_ledger",
    "journal_entries", "chart_of_accounts", "subsidiary_ledger",
]

os.environ["PGPASSWORD"] = REMOTE_PASS
dump_cmd = ["pg_dump", "-h", REMOTE_HOST, "-p", REMOTE_PORT,
    "-U", REMOTE_USER, "-d", REMOTE_DB,
    "-F", "p", "-f", sql_file,
    "--no-owner", "--no-acl"]
for t in tables:
    dump_cmd.extend(["-t", t])

ts_now = ts
print(f"[{ts_now}] Dumping {len(tables)} tables from broker_db...")
res = subprocess.run(dump_cmd, capture_output=True, text=True)
if res.returncode != 0:
    print(f"DUMP FAILED: {res.stderr}")
    sys.exit(1)
size_str = f"{os.path.getsize(sql_file):,}"
print(f"  Dumped {size_str} bytes")

os.environ["PGPASSWORD"] = LOCAL_PASS
restore_cmd = ["psql", "-h", LOCAL_HOST, "-p", LOCAL_PORT,
    "-U", LOCAL_USER, "-d", LOCAL_DB, "-f", sql_file, "--quiet"]
ts2 = datetime.now().strftime("%Y%m%d_%H%M%S")
print(f"[{ts2}] Restoring to stock_db...")
with open(restore_log, "w") as logf:
    res = subprocess.run(restore_cmd, stdout=logf, stderr=logf, text=True)
if res.returncode == 0:
    print("  RESTORE OK")
else:
    print(f"  RESTORE had errors - check {restore_log}")

with open(sql_file, "rb") as f_in:
    with gzip.open(gz_file, "wb") as f_out:
        f_out.writelines(f_in)
os.remove(sql_file)
print(f"  Compressed -> {gz_file}")

cutoff = time.time() - 7 * 86400
for f in os.listdir(BACKUP_DIR):
    fpath = os.path.join(BACKUP_DIR, f)
    if os.path.isfile(fpath) and os.path.getmtime(fpath) < cutoff:
        os.remove(fpath)
        print(f"  Cleaned old: {f}")
ts_end = datetime.now().strftime("%Y%m%d_%H%M%S")
print(f"[{ts_end}] Done.")