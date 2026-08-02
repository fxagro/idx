"""
System Operations Router — Manual Trigger endpoints for BOD/EOD/Recon
Also supports cron enable/disable for demo mode.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import subprocess
import sys
import os
import json
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["system_operations"])

SCRIPTS_DIR = "/var/www/idx.mytriv.com/fastapi-server/scripts"
REPORTS_DIR = "/var/www/idx.mytriv.com/fastapi-server/reports"
CRON_MARKER_FILE = "/tmp/system_ops_cron_disabled"
BACKUPS_DIR = "/var/backups/broker_db"

class ProcessResponse(BaseModel):
    status: str
    message: str
    output: Optional[str] = None
    started_at: str
    duration_sec: Optional[float] = None

def run_script(script_name: str, args: list = None) -> dict:
    script_path = os.path.join(SCRIPTS_DIR, script_name)
    if not os.path.exists(script_path):
        raise HTTPException(404, f"Script not found: {script_path}")

    cmd = [sys.executable, script_path]
    if args:
        cmd.extend(args)

    started = datetime.now()
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        duration = (datetime.now() - started).total_seconds()
        return {
            "status": "success" if result.returncode == 0 else "error",
            "message": f"Script {'completed' if result.returncode == 0 else 'failed'}",
            "output": (result.stdout + "\n" + result.stderr)[:2000],
            "started_at": started.isoformat(),
            "duration_sec": round(duration, 2),
            "returncode": result.returncode
        }
    except subprocess.TimeoutExpired:
        duration = (datetime.now() - started).total_seconds()
        return {
            "status": "error",
            "message": "Script timed out after 300s",
            "output": None,
            "started_at": started.isoformat(),
            "duration_sec": round(duration, 2),
            "returncode": -1
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "output": None,
            "started_at": started.isoformat(),
            "duration_sec": None,
            "returncode": -1
        }

@router.post("/bod", response_model=ProcessResponse)
def trigger_bod():
    """Run BOD (Begin of Day) processor manually"""
    log.info("Manual BOD trigger received")
    result = run_script("bod_processor.py")
    return ProcessResponse(**result)

@router.post("/eod", response_model=ProcessResponse)
def trigger_eod():
    """Run full EOD (End of Day) processor (phases 1-6)"""
    log.info("Manual EOD trigger received")
    result = run_script("eod_processor.py")
    return ProcessResponse(**result)

@router.post("/eod/phase1", response_model=ProcessResponse)
def trigger_eod_phase1():
    """Run EOD Phase 1 only: Settlement + KSEI + Journals"""
    log.info("Manual EOD Phase 1 trigger received")
    import importlib.util
    spec = importlib.util.spec_from_file_location("eod_processor",
        os.path.join(SCRIPTS_DIR, "eod_processor.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    results = {}
    results["phase1_settlement"] = mod.step("T+2 Settlement Batch", mod.phase1_settlement_batch)
    results["phase2_ksei_sync"] = mod.step("KSEI Portfolio Sync", mod.phase2_ksei_sync)
    results["phase3_journals"] = mod.step("Daily Journal Processing", mod.phase3_process_journals)

    return ProcessResponse(
        status="success",
        message="EOD Phase 1 completed",
        output=json.dumps(results, indent=2)[:2000],
        started_at=datetime.now().isoformat()
    )

@router.post("/eod/phase2", response_model=ProcessResponse)
def trigger_eod_phase2():
    """Run EOD Phase 2 only: MKBD + Reconciliation + Report"""
    log.info("Manual EOD Phase 2 trigger received")
    import importlib.util
    spec = importlib.util.spec_from_file_location("eod_processor",
        os.path.join(SCRIPTS_DIR, "eod_processor.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    results = {}
    results["phase4_mkbd"] = mod.step("MKBD Calculation", mod.phase4_calc_mkbd)
    results["phase5_recon"] = mod.step("Reconciliation", mod.phase5_reconciliation)
    results["phase6_report"] = mod.step("EOD Summary Report", mod.phase6_eod_report)

    return ProcessResponse(
        status="success",
        message="EOD Phase 2 completed",
        output=json.dumps(results, indent=2)[:2000],
        started_at=datetime.now().isoformat()
    )

@router.post("/recon", response_model=ProcessResponse)
def trigger_recon():
    """Run full reconciliation engine (KSEI + KPEI + Journal audit)"""
    log.info("Manual Reconciliation trigger received")
    result = run_script("reconciliation_engine.py")
    return ProcessResponse(**result)

@router.post("/recon/phase/{phase}", response_model=ProcessResponse)
def trigger_recon_phase(phase: int):
    """Run single reconciliation phase (1=KSEI, 2=KPEI, 3=Journal)"""
    log.info(f"Manual Recon Phase {phase} trigger received")
    today = datetime.now().strftime("%Y-%m-%d")
    import importlib.util
    spec = importlib.util.spec_from_file_location("recon",
        os.path.join(SCRIPTS_DIR, "reconciliation_engine.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    phase_map = {1: "ksei", 2: "kpei", 3: "journal"}
    phase_fn = {1: mod.recon_phase1_internal_vs_ksei,
                2: mod.recon_phase2_settlement_vs_kpei,
                3: mod.recon_phase3_journal_audit}

    if phase not in phase_map:
        raise HTTPException(400, f"Invalid phase: {phase}. Use 1, 2, or 3.")

    result = phase_fn[phase](today)
    return ProcessResponse(
        status="success",
        message=f"Recon Phase {phase} ({phase_map[phase]}) completed",
        output=json.dumps(result, indent=2, default=str)[:2000],
        started_at=datetime.now().isoformat()
    )

class CronToggleRequest(BaseModel):
    enable: bool

@router.post("/cron/toggle")
def toggle_cron(req: CronToggleRequest):
    """Enable or disable all production cron jobs"""
    try:
        if req.enable:
            if os.path.exists(CRON_MARKER_FILE):
                os.remove(CRON_MARKER_FILE)
            result = subprocess.run([sys.executable,
                os.path.join(SCRIPTS_DIR, "setup_cron.py"), "--enable"],
                capture_output=True, text=True, timeout=30)
            status = "enabled"
        else:
            with open(CRON_MARKER_FILE, "w") as f:
                f.write(f"CRON_DISABLED_AT={datetime.now().isoformat()}")
            result = subprocess.run([sys.executable,
                os.path.join(SCRIPTS_DIR, "setup_cron.py"), "--disable"],
                capture_output=True, text=True, timeout=30)
            status = "disabled"

        return {
            "status": status,
            "message": f"Cron jobs {status}",
            "output": (result.stdout + result.stderr)[:1000]
        }
    except Exception as e:
        raise HTTPException(500, detail=str(e))

@router.get("/cron/status")
def cron_status():
    """Check if production cron is currently enabled"""
    disabled = os.path.exists(CRON_MARKER_FILE)
    result = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
    has_jobs = "eod_processor" in result.stdout or "bod_processor" in result.stdout
    cron_content = result.stdout if result.returncode == 0 else ""

    return {
        "enabled": not disabled and has_jobs,
        "cron_disabled_marker": disabled,
        "has_cron_jobs": has_jobs,
        "cron_content": cron_content[:2000],
        "mode": "manual" if disabled else ("automatic" if has_jobs else "not_configured")
    }

@router.get("/status")
def system_status():
    """Get current system status"""
    # Check if any processes are running
    result = subprocess.run(
        ["pgrep", "-af", "eod_processor|bod_processor|reconciliation_engine"],
        capture_output=True, text=True, timeout=10
    )
    running_processes = result.stdout.strip().split("\n") if result.stdout.strip() else []

    # Get latest report dates
    reports = {}
    for prefix in ["bod_", "eod_", "recon_ksei_", "recon_kpei_", "recon_journal_"]:
        try:
            report_files = [f for f in os.listdir(REPORTS_DIR) if f.startswith(prefix) and f.endswith(".json")]
            if report_files:
                reports[prefix.rstrip("_")] = sorted(report_files)[-1]
        except FileNotFoundError:
            pass

    return {
        "timestamp": datetime.now().isoformat(),
        "mode": "manual" if os.path.exists(CRON_MARKER_FILE) else "automatic",
        "running_processes": running_processes or [],
        "latest_reports": reports,
        "uptime": subprocess.run(["uptime", "-p"], capture_output=True, text=True).stdout.strip()
    }

@router.get("/backup/status")
def backup_status():
    """Get status of broker_db backups"""
    try:
        if not os.path.exists(BACKUPS_DIR):
            return {"status": "error", "message": "Backup directory not found", "path": BACKUPS_DIR}

        files = sorted([f for f in os.listdir(BACKUPS_DIR) if f.endswith('.sql.gz')], reverse=True)

        backup_entries = []
        for fname in files:
            fpath = os.path.join(BACKUPS_DIR, fname)
            mtime = os.path.getmtime(fpath)
            size_bytes = os.path.getsize(fpath)
            backup_entries.append({
                "filename": fname,
                "size_bytes": size_bytes,
                "size_mb": round(size_bytes / 1024 / 1024, 2),
                "modified": datetime.fromtimestamp(mtime).isoformat()
            })

        latest = backup_entries[0] if backup_entries else None
        restore_logs = sorted([f for f in os.listdir(BACKUPS_DIR) if f.startswith('restore_') and f.endswith('.log')], reverse=True)

        return {
            "status": "success",
            "backup_count": len(backup_entries),
            "latest_backup": latest,
            "backup_files": backup_entries[:10],
            "latest_restore_log": restore_logs[0] if restore_logs else None
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/logs/{log_type}")
def get_logs(log_type: str, lines: int = Query(50, ge=10, le=500)):
    """Get recent log output from EOD/BOD/Recon processors"""
    log_map = {
        "eod": "/var/log/eod_processor.log",
        "bod": "/var/log/bod_processor.log",
        "recon": "/var/log/reconciliation_engine.log",
        "eod_cron": "/var/log/eod_cron.log",
        "bod_cron": "/var/log/bod_cron.log",
        "weekly": "/var/log/weekly_recon.log"
    }

    if log_type not in log_map:
        raise HTTPException(400, f"Invalid log type: {log_type}. Options: {list(log_map.keys())}")

    log_path = log_map[log_type]
    if not os.path.exists(log_path):
        return {"log_type": log_type, "content": "", "lines": 0}

    result = subprocess.run(
        ["tail", f"-{lines}", log_path],
        capture_output=True, text=True, timeout=10
    )
    return {
        "log_type": log_type,
        "content": result.stdout,
        "lines": len(result.stdout.strip().split("\n")) if result.stdout.strip() else 0
    }
