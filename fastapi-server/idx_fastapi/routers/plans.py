from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
import datetime
from typing import List, Optional

from ..database import get_local_db
from .auth import get_current_user
from ..models import User

router = APIRouter(prefix="/plans", tags=["Subscription Plans & Payments"])

class OrderRequest(BaseModel):
    planId: str
    amount: float = Field(..., ge=0.0)

PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price": 0.0,
        "quota": 0,
        "period": "Free",
        "benefits": [
            "Akses Telegram",
            "Harga delay data EOD (H-1)",
            "Akses web terbatas"
        ]
    },
    {
        "id": "basic",
        "name": "Basic",
        "price": 60000.0,
        "priceOption3Months": 149000.0,
        "period": "/bulan atau Rp 149.000 / 3 bulan",
        "popular": True,
        "quota": 100,
        "benefits": [
            "Akses Telegram",
            "BSJP Scanner",
            "Sinyal Trading Harian",
            "Berita IDX",
            "Kalender Event IDX",
            "Notifikasi & Alert",
            "Watchlist",
            "Analisa Mendalam",
            "Early Buy Radar",
            "Export CSV/PDF",
            "Screener Custom",
            "Bandarmology",
            "Peta Jaringan Insider",
            "Orderbook Live",
            "Virtual Trading saldo s/d 1 Miliar"
        ]
    },
    {
        "id": "lifetime",
        "name": "Lifetime",
        "price": 500000.0,
        "period": "Sekali Bayar (Lifetime)",
        "quota": 999999,
        "benefits": [
            "Akses Telegram",
            "Harga Realtime",
            "Akses Web Penuh",
            "Virtual Trading",
            "Semua Fitur Basic + Akses Seumur Hidup"
        ]
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
            "bank_name": "Bank BCA",
            "account_number": "1234567890",
            "account_holder": "SinyalIDX / MyTriv",
            "notes": [
                "Transfer nominal sesuai paket yang dipilih",
                "Sertakan Order ID pada berita transfer",
                "Unggah bukti transfer di menu Pembayaran / Dashboard"
            ]
        },
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }
