from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
from .auth import get_current_user, RequireRole
from ..database import get_local_db
from ..models import User

router = APIRouter(prefix="/deposit", tags=["Deposit"])

class DepositRequestIn(BaseModel):
    amount: int = Field(..., gt=0)
    note: Optional[str] = ""

@router.post("/request")
def request_deposit(
    payload: DepositRequestIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_local_db)
):
    result = db.execute(
        text("INSERT INTO deposit_requests (user_id, email, amount, note, status, created_at) VALUES (:uid, :email, :amount, :note, 'pending', :now) RETURNING id"),
        {"uid": current_user.id, "email": current_user.email, "amount": payload.amount, "note": payload.note or "", "now": datetime.utcnow()}
    )
    db.commit()
    rid = result.fetchone()[0]
    return {"success": True, "message": "Deposit request submitted", "data": {"id": rid, "amount": payload.amount, "status": "pending"}}

@router.get("/requests")
def list_deposit_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_local_db)
):
    is_admin = current_user.role in ("admin", "superadmin")
    if is_admin:
        rows = db.execute(text("SELECT * FROM deposit_requests ORDER BY created_at DESC")).mappings().fetchall()
    else:
        rows = db.execute(text("SELECT * FROM deposit_requests WHERE user_id = :uid ORDER BY created_at DESC"), {"uid": current_user.id}).mappings().fetchall()
    data = []
    for r in rows:
        data.append({
            "id": r["id"], "user_id": r["user_id"], "email": r["email"],
            "amount": r["amount"], "note": r.get("note", ""), "status": r["status"],
            "created_at": str(r["created_at"]), "approved_at": str(r["approved_at"]) if r.get("approved_at") else None
        })
    return {"success": True, "data": data}

@router.post("/approve/{request_id}")
def approve_deposit(
    request_id: int,
    current_user: User = Depends(RequireRole(["admin", "superadmin"])),
    db: Session = Depends(get_local_db)
):
    req = db.execute(text("SELECT * FROM deposit_requests WHERE id = :id AND status = 'pending'"), {"id": request_id}).mappings().fetchone()
    if not req:
        raise HTTPException(status_code=404, detail="Deposit request not found or already processed")
    now = datetime.utcnow()
    db.execute(text("UPDATE deposit_requests SET status = 'approved', approved_at = :now WHERE id = :id"), {"now": now, "id": request_id})
    db.execute(text("UPDATE users SET virtual_saldo = virtual_saldo + :amount WHERE id = :uid"), {"amount": req["amount"], "uid": req["user_id"]})
    db.execute(text("INSERT INTO pe_rdn_balance (user_id, balance, held_balance) VALUES (:uid, :amount, 0) ON CONFLICT (user_id) DO UPDATE SET balance = pe_rdn_balance.balance + :amount2"), {"uid": req["user_id"], "amount": req["amount"], "amount2": req["amount"]})
    db.commit()
    return {"success": True, "message": "Deposit approved", "data": {"id": request_id, "status": "approved"}}

@router.post("/reject/{request_id}")
def reject_deposit(
    request_id: int,
    current_user: User = Depends(RequireRole(["admin", "superadmin"])),
    db: Session = Depends(get_local_db)
):
    req = db.execute(text("SELECT * FROM deposit_requests WHERE id = :id AND status = 'pending'"), {"id": request_id}).mappings().fetchone()
    if not req:
        raise HTTPException(status_code=404, detail="Deposit request not found or already processed")
    db.execute(text("UPDATE deposit_requests SET status = 'rejected', approved_at = :now WHERE id = :id"), {"now": datetime.utcnow(), "id": request_id})
    db.commit()
    return {"success": True, "message": "Deposit rejected", "data": {"id": request_id, "status": "rejected"}}
