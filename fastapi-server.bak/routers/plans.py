from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
import datetime
from typing import List, Optional

from database import get_local_db
from .auth import get_current_user
from models import User

router = APIRouter(prefix="/plans", tags=["Subscription Plans & Payments"])

class OrderRequest(BaseModel):
    planId: str
    amount: float = Field(..., gt=0.0)

PLANS = [
    {
        "id": "basic",
        "name": "Basic",
        "price": 50000.0,
        "quota": 10,
        "benefits": ["Kuota AI 10x/bulan", "Analisis Dasar", "Virtual Trading Saldo Rp 1 Miliar", "Real-Time Price Data"]
    },
    {
        "id": "premium",
        "name": "Premium",
        "price": 100000.0,
        "quota": 50,
        "benefits": ["Kuota AI 50x/bulan", "Analisis Premium", "Data Real-time", "Virtual Trading Saldo Rp 5 Miliar", "Real-Time Price Data", "Reset Tanpa Batas"]
    },
    {
        "id": "pro",
        "name": "Pro",
        "price": 200000.0,
        "quota": 100,
        "benefits": ["Kuota AI 100x/bulan", "Akses Broker Data", "Analisis Lanjutan", "Support Prioritas", "Virtual Trading Saldo Rp 5 Miliar", "Real-Time Price Data", "Reset Tanpa Batas"]
    },
    {
        "id": "enterprise",
        "name": "Enterprise",
        "price": 250000.0,
        "quota": 1000,
        "benefits": ["Kuota AI 1000x/bulan", "Akses Broker Data", "Analisis Lanjutan", "Support Prioritas", "API Access", "Custom Integration", "Virtual Trading Saldo Unlimited (Rp 1 Triliun)", "Real-Time Price Data", "Reset Tanpa Batas"]
    }
]

@router.get("")
def get_plans():
    return {
        "success": True,
        "plans": PLANS,
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }

@router.post("/order")
def create_order(
    payload: OrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_local_db)
):
    plan = next((p for p in PLANS if p["id"] == payload.planId), None)
    if not plan:
        raise HTTPException(status_code=400, detail="Plan not found")
        
    try:
        insert_query = text("""
            INSERT INTO subscriptions (user_id, plan_id, amount, status, created_at, updated_at)
            VALUES (:user_id, :plan_id, :amount, 'pending', NOW(), NOW())
            RETURNING id, user_id, plan_id, amount, status, created_at
        """)
        row = db.execute(insert_query, {
            "user_id": current_user.id,
            "plan_id": payload.planId,
            "amount": payload.amount
        }).fetchone()
        
        db.commit()
        
        order_data = {
            "id": row[0],
            "user_id": row[1],
            "plan_id": row[2],
            "amount": float(row[3]) if row[3] is not None else 0.0,
            "status": row[4],
            "created_at": row[5].isoformat() if isinstance(row[5], (datetime.datetime, datetime.date)) else str(row[5])
        }
        
        return {
            "success": True,
            "message": "Subscription order created successfully",
            "order": order_data,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")

@router.get("/instructions")
def get_instructions():
    return {
        "success": True,
        "instructions": {
            "bank_name": "BCA",
            "account_number": "00132000048716",
            "account_holder": "Agus Rochman",
            "instructions": [
                "Transfer sesuai dengan paket yang dipilih",
                "Upload bukti transfer setelah pembayaran",
                "Bukti transfer akan diverifikasi dalam 1-2 hari kerja",
                "Setelah verifikasi, paket akan diaktivasi",
                "Kirim bukti transfer ke support@ai-saham.com jika diperlukan"
            ]
        },
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }

@router.get("/orders")
def get_user_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_local_db)
):
    try:
        query = text("""
            SELECT id, plan_id, amount, status, proof_path, created_at
            FROM subscriptions
            WHERE user_id = :user_id
            ORDER BY created_at DESC
        """)
        rows = db.execute(query, {"user_id": current_user.id}).fetchall()
        
        orders = []
        for r in rows:
            orders.append({
                "id": r[0],
                "plan_id": r[1],
                "amount": float(r[2]) if r[2] is not None else 0.0,
                "status": r[3],
                "proof_path": r[4],
                "created_at": r[5].isoformat() if isinstance(r[5], (datetime.datetime, datetime.date)) else str(r[5])
            })
            
        return {
            "success": True,
            "orders": orders,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user orders: {str(e)}")
