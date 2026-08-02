from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_local_db as get_db
import traceback
import os

router = APIRouter(prefix="/compliance", tags=["compliance"])

@router.post("/kyc")
def register_kyc(
    user_id: int = Body(...),
    full_name: str = Body(...),
    id_card_number: str = Body(...),
    db: Session = Depends(get_db)
):
    """
    Simulasi Customer Due Diligence (CDD) saat nasabah pertama kali registrasi.
    """
    try:
        # Simple risk scoring logic based on id_card length
        risk_score = 10 if len(id_card_number) < 16 else 0
        status = 'PENDING_REVIEW' if risk_score > 0 else 'APPROVED'
        
        db.execute(
            text("INSERT INTO pe_risk_kyc (user_id, full_name, id_card_number, risk_score, status) VALUES (:user_id, :full_name, :id_card, :risk_score, :status)"),
            {"user_id": user_id, "full_name": full_name, "id_card": id_card_number, "risk_score": risk_score, "status": status}
        )
        db.commit()
        return {"status": "success", "message": "KYC Data submitted", "kyc_status": status, "risk_score": risk_score}
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/str")
def report_str(
    user_id: int = Body(...),
    alert_type: str = Body(...),
    description: str = Body(...),
    amount: float = Body(...),
    db: Session = Depends(get_db)
):
    """
    Suspicious Transaction Report (STR) untuk mencatat transaksi aneh.
    """
    try:
        # Check if amount is unusually large
        status = 'FLAGGED_HIGH_PRIORITY' if amount > 1000000000 else 'OPEN'
            
        db.execute(
            text("INSERT INTO pe_risk_apu_ppt (user_id, alert_type, description, amount, status) VALUES (:user_id, :alert_type, :description, :amount, :status)"),
            {"user_id": user_id, "alert_type": alert_type, "description": description, "amount": amount, "status": status}
        )
        db.commit()
        return {"status": "success", "message": "Suspicious Transaction Reported", "str_status": status}
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
