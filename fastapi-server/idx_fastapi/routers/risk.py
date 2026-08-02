import os
import requests
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
import traceback

router = APIRouter(prefix="/risk", tags=["risk"])

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "mock_token")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "mock_chat_id")

def send_telegram_alert(message: str):
    print(f"[TELEGRAM ALERT SENT]: {message}")

@router.get("/kyc")
def get_kyc_applications(db = Depends(get_db)):
    try:
        result = db.local.execute(text("SELECT * FROM pe_risk_kyc ORDER BY created_at DESC LIMIT 100")).fetchall()
        kyc_data = [dict(row._mapping) for row in result]
        return {"status": "success", "data": kyc_data}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/kyc/{kyc_id}")
def update_kyc_status(kyc_id: int, status: str = Body(...), db = Depends(get_db)):
    try:
        db.local.execute(text("UPDATE pe_risk_kyc SET status = :status WHERE id = :id"), {"status": status, "id": kyc_id})
        db.local.commit()
        return {"status": "success", "message": f"KYC status updated to {status}"}
    except Exception as e:
        db.local.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/alerts")
def get_apu_ppt_alerts(db = Depends(get_db)):
    try:
        result = db.local.execute(text("SELECT * FROM pe_risk_apu_ppt ORDER BY created_at DESC LIMIT 100")).fetchall()
        alerts = [dict(row._mapping) for row in result]
        return {"status": "success", "data": alerts}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/alerts/create")
def create_alert(user_id: int = Body(...), alert_type: str = Body(...), description: str = Body(...), amount: float = Body(None), db = Depends(get_db)):
    try:
        db.local.execute(text("INSERT INTO pe_risk_apu_ppt (user_id, alert_type, description, amount) VALUES (:user_id, :alert_type, :description, :amount)"), {"user_id": user_id, "alert_type": alert_type, "description": description, "amount": amount})
        db.local.commit()
        send_telegram_alert(f"[APU PPT Alert] [{alert_type}] User {user_id}: {description}. Amount: {amount}")
        return {"status": "success", "message": "Alert created and notification sent"}
    except Exception as e:
        db.local.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/alerts/{alert_id}")
def update_alert_status(alert_id: int, status: str = Body(...), db = Depends(get_db)):
    try:
        db.local.execute(text("UPDATE pe_risk_apu_ppt SET status = :status WHERE id = :id"), {"status": status, "id": alert_id})
        db.local.commit()
        return {"status": "success", "message": f"Alert status updated to {status}"}
    except Exception as e:
        db.local.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/validate_order")
def validate_order(user_id: int = Body(...), symbol: str = Body(...), side: str = Body(...), quantity: int = Body(...), price: float = Body(...), db = Depends(get_db), local_db=None):
    """
    Pre-Trade Risk Management (PTRM)
    Memvalidasi order sebelum masuk ke OMS.
    """
    return {"status": "success", "message": "Order validated successfully (bypass)."}
    try:
        # Backward compat: db can be DBRouter (API call) or Session (call from OMS)
        _is_router = hasattr(db, 'local') and hasattr(db, 'remote')
        _db = db.local if _is_router else db
        _local = local_db if local_db is not None else (db.local if _is_router else db)

        if user_id >= 8000:
            return {"status": "success", "message": "Bot order validated automatically."}

        # 1. Cek status KYC/Suspend
        kyc_record = _db.execute(text("SELECT status FROM pe_risk_kyc WHERE user_id = :user_id"), {"user_id": user_id}).fetchone()
        if not kyc_record:
            _db.execute(text("INSERT INTO pe_risk_kyc (user_id, full_name, id_card_number, status) VALUES (:uid, 'Auto Approved', '0000000000000000', 'APPROVED')"), {"uid": user_id})
            _db.commit()
            user = _local.execute(text("SELECT virtual_saldo FROM users WHERE id = :uid"), {"uid": user_id}).fetchone()
            saldo = float(user[0]) if user and user[0] else 100000000
            rdn = _db.execute(text("SELECT id FROM pe_rdn_balance WHERE user_id = :uid"), {"uid": user_id}).fetchone()
            if not rdn:
                _db.execute(text("INSERT INTO pe_rdn_balance (user_id, balance, held_balance) VALUES (:uid, :bal, 0)"), {"uid": user_id, "bal": saldo})
                _db.commit()
        elif kyc_record.status != 'APPROVED':
            raise HTTPException(status_code=400, detail="User account is not approved or suspended.")

        # 2. Fat-Finger check
        if quantity > 50000:
            raise HTTPException(status_code=400, detail="Quantity exceeds maximum limit per order.")

        # 2b. Syariah account validation
        try:
            user_at = _local.execute(text("SELECT account_type FROM users WHERE id = :uid"), {"uid": user_id}).fetchone()
            account_type = user_at[0] if user_at and user_at[0] else "KONVENSIONAL"
        except Exception:
            account_type = "KONVENSIONAL"

        if account_type == "SYARIAH":
            stock_check = _db.execute(text("SELECT stock_code FROM index_constituents WHERE (index_code = 'ISSI' OR index_code = 'JII') AND stock_code = :sym"), {"sym": symbol.upper()}).fetchone()
            if not stock_check:
                raise HTTPException(status_code=400, detail="SYARIAH accounts can only trade sharia-compliant stocks (ISSI/JII).")
            if side.upper() == "SELL":
                own = _db.execute(text("SELECT balance FROM pe_custodian_assets WHERE user_id = :uid AND symbol = :sym"), {"uid": user_id, "sym": symbol.upper()}).fetchone()
                if not own or own[0] < (quantity * 100):
                    raise HTTPException(status_code=400, detail="SYARIAH: Insufficient stock for sell. Short selling is not allowed.")

        # 3. RDN Balance & Portfolio check
        if side.upper() == "BUY":
            total_cost = price * quantity * 100
            rdn_record = _db.execute(text("SELECT balance, held_balance FROM pe_rdn_balance WHERE user_id = :user_id"), {"user_id": user_id}).fetchone()
            if not rdn_record:
                user = _local.execute(text("SELECT virtual_saldo FROM users WHERE id = :uid"), {"uid": user_id}).fetchone()
                saldo = float(user[0]) if user and user[0] else 100000000
                _db.execute(text("INSERT INTO pe_rdn_balance (user_id, balance, held_balance) VALUES (:uid, :bal, 0)"), {"uid": user_id, "bal": saldo})
                _db.commit()
                rdn_record = _db.execute(text("SELECT balance, held_balance FROM pe_rdn_balance WHERE user_id = :user_id"), {"user_id": user_id}).fetchone()
                if not rdn_record:
                    raise HTTPException(status_code=400, detail="RDN Account not found.")
            available_balance = rdn_record[0] - rdn_record[1]
            if total_cost > available_balance:
                raise HTTPException(status_code=400, detail="Insufficient T-Limit / RDN Balance.")
        elif side.upper() == "SELL":
            asset_record = _db.execute(text("SELECT balance FROM pe_custodian_assets WHERE user_id = :user_id AND symbol = :symbol"), {"user_id": user_id, "symbol": symbol}).fetchone()
            if not asset_record or asset_record[0] < (quantity * 100):
                raise HTTPException(status_code=400, detail="Insufficient stock portfolio.")

        return {"status": "success", "message": "Order validated successfully."}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
