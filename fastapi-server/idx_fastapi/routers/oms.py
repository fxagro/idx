from ..socket_manager import sio
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy import text
from ..database import get_db
import traceback

router = APIRouter(prefix="/oms", tags=["oms"])

from fastapi import Request

US_ENGINE_USERS = {1, 8000, 8005}

@router.get("/orders")
def get_orders(request: Request, date: str = None, market: str = Query("idx", regex="^(idx|all)$"), db = Depends(get_db)):
    try:
        if date:
            result = db.execute(text("SELECT * FROM pe_oms_orders WHERE DATE(created_at) = :date ORDER BY created_at DESC"), {"date": date}).fetchall()
        else:
            result = db.execute(text("SELECT * FROM pe_oms_orders WHERE DATE(created_at) = CURRENT_DATE ORDER BY created_at DESC")).fetchall()
        orders = [dict(row._mapping) for row in result]

        if market == "idx":
            orders = [o for o in orders if o.get("user_id") not in US_ENGINE_USERS]

        user_agent = request.headers.get("user-agent", "").lower()
        referer = request.headers.get("referer", "").lower()

        is_android = "android" in user_agent or "dalvik" in user_agent or "okhttp" in user_agent
        is_backend = "python" in user_agent or "node" in user_agent or "axios" in user_agent
        is_dashboard = "dashboard" in referer or "oms" in referer or "admin" in referer

        if not is_android and not is_backend and not is_dashboard:
            for order in orders:
                if 'quantity' in order and order['quantity'] is not None:
                    order['quantity'] = order['quantity'] // 100

        engine_map_rev = {
            8001: "KOMPAS VELOCITY (INTRADAY)",
            8002: "MBX VELOCITY (INTRADAY)",
            8003: "KOMPAS NO VELOCITY (FORWARD)",
            8004: "MBX NO VELOCITY (FORWARD)",
            8005: "WALL STREET QUANT (US MARKET)",
            8006: "TOP GAINER DCA",
            8000: "UNKNOWN ENGINE"
        }
        for order in orders:
            order["user_name"] = engine_map_rev.get(order["user_id"], f"User {order['user_id']}")

        return {"status": "success", "data": orders}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

from .risk import validate_order

@router.post("/order")
def create_order(
    user_id: int = Body(...),
    symbol: str = Body(...),
    side: str = Body(...),
    order_type: str = Body(...),
    quantity: int = Body(...),
    price: float = Body(None),
    db = Depends(get_db)
):
    try:
        validate_order(
            user_id=user_id, symbol=symbol, side=side,
            quantity=quantity, price=price or 0.0,
            db=db.remote, local_db=db.local
        )

        initial_status = "MATCHED"
        quantity_shares = quantity * 100
        gross_value = (price or 0) * quantity_shares

        result = db.execute(
            text("INSERT INTO pe_oms_orders (user_id, symbol, side, type, quantity, price, status) VALUES (:user_id, :symbol, :side, :type, :quantity, :price, :status) RETURNING id"),
            {"user_id": user_id, "symbol": symbol, "side": side, "type": order_type, "quantity": quantity_shares, "price": price, "status": initial_status}
        )
        order_id = result.fetchone()[0]

        if side.upper() == "BUY":
            broker_fee = gross_value * 0.0015
            net_value = gross_value + broker_fee
            db.execute(text("UPDATE pe_rdn_balance SET held_balance = held_balance + :amount WHERE user_id = :uid"), {"amount": net_value, "uid": user_id})
            if user_id < 8000:
                db.local.execute(text("UPDATE users SET virtual_saldo = virtual_saldo - :amount WHERE id = :uid"), {"amount": gross_value, "uid": user_id})
                db.local.commit()
            existing = db.execute(text("SELECT id FROM pe_custodian_assets WHERE user_id = :uid AND symbol = :sym"), {"uid": user_id, "sym": symbol}).fetchone()
            if existing:
                db.execute(text("UPDATE pe_custodian_assets SET balance = balance + :qty WHERE user_id = :uid AND symbol = :sym"), {"qty": quantity_shares, "uid": user_id, "sym": symbol})
            else:
                db.execute(text("INSERT INTO pe_custodian_assets (user_id, asset_type, symbol, balance) VALUES (:uid, 'STOCK', :sym, :qty)"), {"uid": user_id, "sym": symbol, "qty": quantity_shares})
        else:
            broker_fee = gross_value * 0.0025
            net_value = gross_value - broker_fee
            db.execute(text("INSERT INTO pe_settlement_ledger (order_id, user_id, settlement_date, type, amount, status) VALUES (:oid, :uid, CURRENT_DATE, 'SELL_SETTLEMENT', :amount, 'PENDING')"), {"oid": order_id, "uid": user_id, "amount": net_value})
            if user_id < 8000:
                db.local.execute(text("UPDATE users SET virtual_saldo = virtual_saldo + :amount WHERE id = :uid"), {"amount": net_value, "uid": user_id})
                db.local.commit()
            db.execute(text("UPDATE pe_custodian_assets SET balance = balance - :qty WHERE user_id = :uid AND symbol = :sym"), {"qty": quantity_shares, "uid": user_id, "sym": symbol})

        if user_id < 8000 and gross_value > 1000000000:
            db.execute(
                text("INSERT INTO pe_risk_apu_ppt (user_id, alert_type, description, amount, status, detected_at) VALUES (:uid, :type, :desc, :amt, :status, NOW())"),
                {"uid": user_id, "type": "STR_LARGE_ORDER", "desc": f"LARGE ORDER: {side} {symbol} {quantity} LOTS @ Rp {price:,.0f} | Total Rp {gross_value:,.0f}", "amt": gross_value, "status": "FLAGGED_HIGH_PRIORITY"}
            )

        db.commit()
        return {"status": "success", "message": "Order created successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

from datetime import datetime, timedelta

@router.put("/orders/{order_id}/status")
def update_order_status(order_id: int, status: str = Body(...), db = Depends(get_db)):
    try:
        db.execute(text("UPDATE pe_oms_orders SET status = :status WHERE id = :id"), {"status": status, "id": order_id})

        if status == 'MATCHED':
            order = db.execute(text("SELECT * FROM pe_oms_orders WHERE id = :id"), {"id": order_id}).fetchone()
            if order:
                gross_value = order.price * order.quantity * 100
                t_plus_2_date = datetime.now() + timedelta(days=2)

                if order.side.upper() == "BUY":
                    broker_fee = gross_value * 0.0015
                    net_value = gross_value + broker_fee
                    db.execute(text("INSERT INTO pe_settlement_ledger (order_id, user_id, settlement_date, type, amount, status) VALUES (:order_id, :user_id, :date, 'BUY_SETTLEMENT', :amount, 'PENDING')"), {"order_id": order_id, "user_id": order.user_id, "date": t_plus_2_date.date(), "amount": net_value})
                    db.execute(text("UPDATE pe_rdn_balance SET held_balance = held_balance + :amount WHERE user_id = :user_id"), {"amount": net_value, "user_id": order.user_id})
                else:
                    broker_fee = gross_value * 0.0025
                    net_value = gross_value - broker_fee
                    db.execute(text("INSERT INTO pe_settlement_ledger (order_id, user_id, settlement_date, type, amount, status) VALUES (:order_id, :user_id, :date, 'SELL_SETTLEMENT', :amount, 'PENDING')"), {"order_id": order_id, "user_id": order.user_id, "date": t_plus_2_date.date(), "amount": net_value})

        db.commit()
        return {"status": "success", "message": "Order status updated and settlement processed if MATCHED"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/eod_reset")
def eod_reset_orders(db = Depends(get_db)):
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        result = db.execute(text("UPDATE pe_oms_orders SET status = 'CANCELLED' WHERE status = 'PENDING' AND created_at::DATE <= :today"), {"today": today})
        cancelled_count = result.rowcount
        db.commit()
        return {"status": "success", "message": f"OMS EOD Reset completed. Cancelled {cancelled_count} open orders.", "reset_date": today}
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
