from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
import requests
import base64
import hashlib
from datetime import datetime, timedelta
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_local_db
from ..config import settings
from .auth import get_current_user
from ..models import User

router = APIRouter(prefix="/payment", tags=["Payment"])

MIDTRANS_SERVER_KEY = settings.MIDTRANS_SERVER_KEY
MIDTRANS_CLIENT_KEY = settings.MIDTRANS_CLIENT_KEY
MIDTRANS_IS_PRODUCTION = settings.MIDTRANS_IS_PRODUCTION
MIDTRANS_BASE_URL = "https://app.sandbox.midtrans.com/snap/v1" if not MIDTRANS_IS_PRODUCTION else "https://app.midtrans.com/snap/v1"
FRONTEND_URL = settings.FRONTEND_URL

PLANS = {
    "free": {"price": 0, "quota": 0, "name": "Free"},
    "basic": {"price": 60000, "quota": 100, "name": "Basic"},
    "lifetime": {"price": 500000, "quota": 999999, "name": "Lifetime"},
}

class SnapTokenRequest(BaseModel):
    plan_id: str
    order_id: int

@router.post("/create-snap-token")
def create_snap_token(
    req: SnapTokenRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_local_db)
):
    plan = PLANS.get(req.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")

    order = db.execute(
        text("SELECT * FROM subscriptions WHERE id=:id AND user_id=:uid AND status='pending'"),
        {"id": req.order_id, "uid": current_user.id}
    ).fetchone()
    if not order:
        raise HTTPException(status_code=400, detail="Order not found or already processed")

    if not MIDTRANS_SERVER_KEY or MIDTRANS_SERVER_KEY == "":
        return {"success": True, "is_mock": True, "message": "Midtrans not configured"}

    auth = base64.b64encode(f"{MIDTRANS_SERVER_KEY}:".encode()).decode()
    order_id_snap = f"IDX-{req.order_id}-{int(datetime.utcnow().timestamp())}"

    payload = {
        "transaction_details": {
            "order_id": order_id_snap,
            "gross_amount": int(plan["price"])
        },
        "item_details": [{
            "id": req.plan_id,
            "price": int(plan["price"]),
            "quantity": 1,
            "name": f"SinyalIDX {plan['name']} Plan"
        }],
        "customer_details": {
            "email": current_user.email,
            "first_name": current_user.full_name or "User"
        }
    }

    try:
        resp = requests.post(
            f"{MIDTRANS_BASE_URL}/transactions",
            json=payload,
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            timeout=10
        )
        if resp.status_code == 201:
            data = resp.json()
            return {"success": True, "token": data.get("token"), "redirect_url": data.get("redirect_url")}
        else:
            return {"success": False, "error": resp.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
