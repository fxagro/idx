#!/usr/bin/env python3
"""
Setup crontab for EOD/BOD processors on VPS 2
Usage:
  python3 setup_cron.py           — Install/enable cron jobs
  python3 setup_cron.py --enable   — Same as above
  python3 setup_cron.py --disable  — Remove all production cron jobs
  python3 setup_cron.py --status   — Show current cron status
"""
import os
import subprocess
import sys

SCRIPTS_DIR = "/var/www/idx.mytriv.com/fastapi-server/scripts"
REPORTS_DIR = "/var/www/idx.mytriv.com/fastapi-server/reports"
CRON_MARKER = ".eod_bod_cron_entries"

PRODUCTION_JOBS = """
# ===== OMS/ACCOUNTING PRODUCTION SCHEDULER =====
# BOD: 07:00 WIB (00:00 UTC) — Prepare trading day
0 0 * * 1-5 cd {scripts} && python3 bod_processor.py >> /var/log/bod_cron.log 2>&1

# EOD Phase 1: 16:30 WIB (09:30 UTC) — Settlement + KSEI + Journals
30 9 * * 1-5 cd {scripts} && python3 eod_processor.py >> /var/log/eod_cron.log 2>&1

# EOD Phase 2: 17:00 WIB (10:00 UTC) — MKBD + Reconciliation report
0 10 * * 1-5 cd {scripts} && python3 eod_processor.py >> /var/log/eod_cron.log 2>&1

# Weekly: Saturday 06:00 WIB — Full system audit
0 0 * * 6 cd {scripts} && python3 reconciliation_engine.py >> /var/log/weekly_recon.log 2>&1
# ===== END PRODUCTION SCHEDULER =====
""".format(scripts=SCRIPTS_DIR)

# Unique markers used to identify our entries
FILTER_KEYWORDS = ["EOD", "BOD", "eod_processor", "bod_processor", "reconciliation_engine"]

def is_ours(line):
    return any(kw in line for kw in FILTER_KEYWORDS)

def get_current_crontab():
    result = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
    if result.returncode == 0:
        return result.stdout
    return ""

def set_crontab(content):
    proc = subprocess.run(["crontab"], input=content, text=True, capture_output=True)
    if proc.returncode == 0:
        return True, content
    return False, proc.stderr

def enable():
    os.makedirs(SCRIPTS_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)

    current = get_current_crontab()
    lines = current.split("\n")

    # Remove existing production entries
    filtered = [l for l in lines if not is_ours(l)]

    final_cron = "\n".join(filtered).strip()
    if final_cron and not final_cron.endswith("\n"):
        final_cron += "\n"
    final_cron += PRODUCTION_JOBS

    success, error = set_crontab(final_cron)
    if success:
        print("Cron jobs ENABLED successfully!")
        print("Jobs added:")
        print(PRODUCTION_JOBS)
    else:
        print(f"Failed: {error}")
        sys.exit(1)

    # Verify
    print("\nCurrent crontab:")
    print(get_current_crontab())

def disable():
    current = get_current_crontab()
    lines = current.split("\n")

    new_lines = [l for l in lines if not is_ours(l)]
    if new_lines == lines:
        print("No production cron jobs found — nothing to disable.")
    else:
        final_cron = "\n".join(new_lines).strip() + "\n"
        success, error = set_crontab(final_cron)
        if success:
            removed_count = len(lines) - len(new_lines)
            print(f"Cron jobs DISABLED successfully! ({removed_count} lines removed)")
        else:
            print(f"Failed: {error}")
            sys.exit(1)

    print("\nRemaining crontab:")
    print(get_current_crontab())

def status():
    current = get_current_crontab()
    lines = current.split("\n")
    ours = [l.strip() for l in lines if is_ours(l)]
    print(f"Production cron entries: {len(ours)}")
    for entry in ours:
        print(f"  {entry}")
    if not ours:
        print("  (none — cron is disabled)")
    print(f"\nFull crontab ({len(lines)} lines):")
    print(current)

if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else ""

    if arg == "--disable":
        disable()
    elif arg == "--status":
        status()
    else:
        # --enable or default: install/re-enable
        enable()
