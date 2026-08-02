import os
import requests
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_local_db as get_db
import traceback

router = APIRouter(prefix="/risk", tags=["risk"])

# Mock telegram integration setup
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "mock_token")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "mock_chat_id")

def send_telegram_alert(message: str):
    # In a real setup, you would hit the Telegram Bot API here
    # requests.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage", json={"chat_id": TELEGRAM_CHAT_ID, "text": message})
    print(f"[TELEGRAM ALERT SENT]: {message}")

@router.get("/kyc")
def get_kyc_applications(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT * FROM pe_risk_kyc ORDER BY created_at DESC LIMIT 100")).fetchall()
        kyc_data = [dict(row._mapping) for row in result]
        return {"status": "success", "data": kyc_data}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/kyc/{kyc_id}")
def update_kyc_status(kyc_id: int, status: str = Body(...), db: Session = Depends(get_db)):
    try:
        db.execute(text("UPDATE pe_risk_kyc SET status = :status WHERE id = :id"), {"status": status, "id": kyc_id})
        db.commit()
        return {"status": "success", "message": f"KYC status updated to {status}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/alerts")
def get_apu_ppt_alerts(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT * FROM pe_risk_apu_ppt ORDER BY created_at DESC LIMIT 100")).fetchall()
        alerts = [dict(row._mapping) for row in result]
        return {"status": "success", "data": alerts}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/alerts/create")
def create_alert(
    user_id: int = Body(...),
    alert_type: str = Body(...),
    description: str = Body(...),
    amount: float = Body(None),
    db: Session = Depends(get_db)
):
    try:
        db.execute(
            text("INSERT INTO pe_risk_apu_ppt (user_id, alert_type, description, amount) VALUES (:user_id, :alert_type, :description, :amount)"),
            {"user_id": user_id, "alert_type": alert_type, "description": description, "amount": amount}
        )
        db.commit()
        
        # Trigger telegram alert
        send_telegram_alert(f"🚨 APU PPT Alert [{alert_type}] User {user_id}: {description}. Amount: {amount}")
        
        return {"status": "success", "message": "Alert created and notification sent"}
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/alerts/{alert_id}")
def update_alert_status(alert_id: int, status: str = Body(...), db: Session = Depends(get_db)):
    try:
        db.execute(text("UPDATE pe_risk_apu_ppt SET status = :status WHERE id = :id"), {"status": status, "id": alert_id})
        db.commit()
        return {"status": "success", "message": f"Alert status updated to {status}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

class OrderRequest:
    # A simple mock class since we use Body directly
    pass

@router.post("/validate_order")
def validate_order(
    user_id: int = Body(...),
    symbol: str = Body(...),
    side: str = Body(...), # BUY or SELL
    quantity: int = Body(...),
    price: float = Body(...),
    db: Session = Depends(get_db)
):
    """
    Pre-Trade Risk Management (PTRM)
    Memvalidasi order sebelum masuk ke OMS.
    """
    try:
        # Bypass for bot users
        if user_id >= 8000:
            return {"status": "success", "message": "Bot order validated automatically."}
            
        # 1. Cek status KYC/Suspend - auto-approve for virtual users
        kyc_record = db.execute(text("SELECT status FROM pe_risk_kyc WHERE user_id = :user_id"), {"user_id": user_id}).fetchone()
        if not kyc_record:
            db.execute(text("INSERT INTO pe_risk_kyc (user_id, full_name, id_card_number, status) VALUES (:uid, 'Auto Approved', '0000000000000000', 'APPROVED')"), {"uid": user_id})
            db.commit()
            # Auto-create RDN balance with virtual saldo from users table
            user = db.execute(text("SELECT virtual_saldo FROM users WHERE id = :uid"), {"uid": user_id}).fetchone()
            saldo = float(user[0]) if user and user[0] else 100000000
            rdn = db.execute(text("SELECT id FROM pe_rdn_balance WHERE user_id = :uid"), {"uid": user_id}).fetchone()
            if not rdn:
                db.execute(text("INSERT INTO pe_rdn_balance (user_id, balance, held_balance) VALUES (:uid, :bal, 0)"), {"uid": user_id, "bal": saldo})
                db.commit()
        elif kyc_record.status != 'APPROVED':
            raise HTTPException(status_code=400, detail="User account is not approved or suspended.")

        # 2. Pengecekan Fat-Finger (quantity limit only - virtual trading)
        if quantity > 50000:
            raise HTTPException(status_code=400, detail="Quantity exceeds maximum limit per order.")

        # 3. Pengecekan Saldo RDN & Portfolio
        if side.upper() == "BUY":
            total_cost = price * quantity * 100 # Assuming 1 lot = 100 shares
            rdn_record = db.execute(text("SELECT balance, held_balance FROM pe_rdn_balance WHERE user_id = :user_id"), {"user_id": user_id}).fetchone()
            if not rdn_record:
                raise HTTPException(status_code=400, detail="RDN Account not found.")
            available_balance = rdn_record.balance - rdn_record.held_balance
            if total_cost > available_balance:
                raise HTTPException(status_code=400, detail="Insufficient T-Limit / RDN Balance.")
        elif side.upper() == "SELL":
            asset_record = db.execute(
                text("SELECT balance FROM pe_custodian_assets WHERE user_id = :user_id AND symbol = :symbol"),
                {"user_id": user_id, "symbol": symbol}
            ).fetchone()
            if not asset_record or asset_record.balance < quantity:
                raise HTTPException(status_code=400, detail="Insufficient stock portfolio.")

        return {"status": "success", "message": "Order validated successfully."}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
