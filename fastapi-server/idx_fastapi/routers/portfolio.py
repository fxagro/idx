from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from pydantic import BaseModel, Field
import datetime
import random
import yfinance as yf
from typing import List, Optional
import redis
import json
import uuid

redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

from ..database import get_db
from .auth import get_current_user
from ..models import User

router = APIRouter(prefix="/stocks/virtual", tags=["Virtual Trading & Portfolio"])

class TradeRequest(BaseModel):
    symbol: str
    quantity: int = Field(..., gt=0)
    orderType: Optional[str] = "market"
    limitPrice: Optional[float] = None

def get_current_price(remote_db, symbol: str, current_user: User = None) -> float:
    symbol_upper = symbol.upper().strip()
    symbol_variations = [symbol_upper, f"{symbol_upper}.JK", symbol_upper.replace(".JK", "")]
    role = current_user.get("role") if isinstance(current_user, dict) else (getattr(current_user, 'role', None) if current_user else None)
    tier = role.lower() if role else "free"
    if tier in ["basic", "premium", "pro", "enterprise"]:
        cache_key = f"realtime_price:{symbol_upper}"
        try:
            cached_price = redis_client.get(cache_key)
            if cached_price:
                return float(cached_price)
        except Exception:
            pass
        try:
            ticker = yf.Ticker(f"{symbol_upper}.JK")
            fast_info = ticker.fast_info
            if 'lastPrice' in fast_info and fast_info['lastPrice']:
                price = float(fast_info['lastPrice'])
                try:
                    redis_client.setex(cache_key, 600, str(price))
                except Exception:
                    pass
                return price
        except Exception as e:
            print(f"Error yfinance {symbol_upper}: {e}")
    for search_sym in symbol_variations:
        try:
            row = remote_db.execute(text("""
                SELECT close_price FROM stock_daily
                WHERE stock_code = :symbol ORDER BY trade_date DESC LIMIT 1
            """), {"symbol": search_sym}).fetchone()
            if row and row[0] is not None:
                return float(row[0])
        except Exception as e:
            print(f"Error price {search_sym}: {e}")
    return 1000.0 + random.random() * 4000.0

class RefreshPriceRequest(BaseModel):
    symbol: str

@router.post("/refresh-price")
def refresh_realtime_price(payload: RefreshPriceRequest, current_user: User = Depends(get_current_user)):
    role = current_user.get("role") if isinstance(current_user, dict) else (getattr(current_user, 'role', None) if current_user else None)
    tier = role.lower() if role else "free"
    if tier not in ["basic", "premium", "pro", "enterprise"]:
        raise HTTPException(status_code=403, detail="Hanya user berbayar yang dapat merefresh harga secara manual.")
    symbol_upper = payload.symbol.upper().strip()
    cache_key = f"realtime_price:{symbol_upper}"
    try:
        ticker = yf.Ticker(f"{symbol_upper}.JK")
        fast_info = ticker.fast_info
        if 'lastPrice' in fast_info and fast_info['lastPrice']:
            price = float(fast_info['lastPrice'])
            try:
                redis_client.setex(cache_key, 600, str(price))
            except Exception:
                pass
            return {"success": True, "symbol": symbol_upper, "price": price, "source": "yahoo"}
        else:
            raise Exception("No lastPrice in fast_info")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal refresh harga dari server bursa: {str(e)}")

@router.get("/balance")
def get_balance(current_user: User = Depends(get_current_user)):
    return {"success": True, "balance": float(current_user.virtual_saldo) if current_user.virtual_saldo else 0.0}

@router.get("/portfolio")
@router.get("/holdings")
def get_holdings(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    query = text("""
        SELECT symbol, side, quantity, price FROM pe_oms_orders
        WHERE user_id = :user_id AND status IN ('MATCHED', 'FILLED') AND symbol NOT LIKE '% %'
    """)
    rows = db.execute(query, {"user_id": current_user.id}).fetchall()
    positions = {}
    for r in rows:
        sym = r[0]
        side = r[1].upper()
        qty = int(r[2])
        price = float(r[3])
        if sym not in positions:
            positions[sym] = {'buy_qty': 0, 'spend': 0.0, 'sell_qty': 0}
        if side == 'BUY':
            positions[sym]['buy_qty'] += qty
            positions[sym]['spend'] += (price * qty)
        elif side == 'SELL':
            positions[sym]['sell_qty'] += qty
    holdings = []
    total_market_value = 0.0
    total_buy_value = 0.0
    for sym, pos in positions.items():
        net_qty = pos['buy_qty'] - pos['sell_qty']
        if net_qty > 0:
            avg_price = pos['spend'] / pos['buy_qty'] if pos['buy_qty'] > 0 else 0.0
            current_price = get_current_price(db.remote, sym, current_user)
            buy_val = net_qty * avg_price
            market_val = net_qty * current_price
            unrealized_pl = market_val - buy_val
            pl_pct = (unrealized_pl / buy_val * 100.0) if buy_val > 0 else 0.0
            total_buy_value += buy_val
            total_market_value += market_val
            try:
                comp_row = db.execute(text("SELECT stock_name FROM stock_daily WHERE stock_code = :symbol LIMIT 1"), {"symbol": sym.upper()}).fetchone()
                comp_name = comp_row[0] if comp_row else sym
            except Exception:
                comp_name = sym
            sector = "Finansial" if sym.upper().startswith("B") else "Teknologi" if sym.upper().startswith("G") else "Lainnya"
            item = {
                "symbol": sym, "name": comp_name, "company_name": comp_name,
                "shares": net_qty, "quantity": net_qty, "qty": net_qty,
                "avgPrice": avg_price, "avg_price": avg_price,
                "currentPrice": current_price, "current_price": current_price,
                "currentValue": market_val, "current_value": market_val, "market_value": market_val,
                "gainLoss": unrealized_pl, "gain_loss": unrealized_pl, "unrealized_pl": unrealized_pl,
                "gainLossPercent": pl_pct, "gain_loss_percent": pl_pct, "pl_percent": pl_pct,
                "total_investment": buy_val, "sector": sector
            }
            holdings.append(item)
    return {
        "success": True, "holdings": holdings, "portfolio": holdings,
        "totalValue": total_market_value, "totalGainLoss": total_market_value - total_buy_value,
        "summary": {
            "total_buy_value": total_buy_value, "total_market_value": total_market_value,
            "total_unrealized_pl": total_market_value - total_buy_value,
            "balance": float(current_user.virtual_saldo) if current_user.virtual_saldo else 0.0,
            "total_portfolio_value": total_market_value + (float(current_user.virtual_saldo) if current_user.virtual_saldo else 0.0)
        }
    }

@router.post("/buy")
def virtual_buy(payload: TradeRequest, current_user: User = Depends(get_current_user), db = Depends(get_db)):
    symbol_upper = payload.symbol.upper().strip()
    qty = payload.quantity
    if qty <= 0:
        return {"success": False, "message": "Quantity must be > 0"}
    market_price = get_current_price(db.remote, symbol_upper, current_user)
    execution_price = market_price
    if payload.orderType == "limit" and payload.limitPrice:
        if market_price > payload.limitPrice:
            return {"success": False, "message": f"Limit price ({payload.limitPrice}) is below current market price ({market_price})."}
        execution_price = payload.limitPrice
    else:
        execution_price = market_price * 1.001
        slippage_percent = 0.002 if qty > 10 else 0.001
        execution_price += execution_price * slippage_percent
        execution_price = round(execution_price)
    base_cost = qty * execution_price * 100
    quantity_shares = qty * 100
    fee = base_cost * 0.0015
    total_cost = base_cost + fee
    user_balance = float(current_user.virtual_saldo) if current_user.virtual_saldo else 0.0
    if user_balance < total_cost:
        return {"success": False, "message": f"Risk Reject: Insufficient funds. Required: {total_cost}, Available: {user_balance}"}
    if total_cost > 100_000_000:
        try:
            db.execute(text("INSERT INTO pe_risk_apu_ppt (user_id, alert_type, description, amount) VALUES (:user_id, 'STR_LARGE_BUY', :desc, :amt)"), {"user_id": current_user.id, "desc": f"Large Buy Order for {symbol_upper} (Qty: {qty} LOTS)", "amt": total_cost})
        except Exception as e:
            print("APU PPT Logging Error:", e)
    new_balance = user_balance - total_cost
    current_user.virtual_saldo = new_balance
    try:
        oms_query = text("""
            INSERT INTO pe_oms_orders (user_id, symbol, side, type, quantity, price, status, created_at)
            VALUES (:user_id, :symbol, 'BUY', :type, :quantity, :price, 'MATCHED', NOW())
        """)
        db.execute(oms_query, {"user_id": current_user.id, "symbol": symbol_upper, "type": str(payload.orderType).upper() if payload.orderType else 'MARKET', "quantity": quantity_shares, "price": execution_price})
    except Exception as e:
        print("OMS Logging Error:", e)
    try:
        existing = db.execute(text("SELECT id FROM pe_custodian_assets WHERE user_id = :uid AND symbol = :sym"), {"uid": current_user.id, "sym": symbol_upper}).fetchone()
        if existing:
            db.execute(text("UPDATE pe_custodian_assets SET balance = balance + :qty WHERE user_id = :uid AND symbol = :sym"), {"qty": quantity_shares, "uid": current_user.id, "sym": symbol_upper})
        else:
            db.execute(text("INSERT INTO pe_custodian_assets (user_id, asset_type, symbol, balance, ksei_synced) VALUES (:user_id, 'STOCK', :symbol, :qty, false)"), {"user_id": current_user.id, "symbol": symbol_upper, "qty": quantity_shares})
    except Exception as e:
        print("Custodian Logging Error:", e)
    try:
        rdn = db.execute(text("SELECT id FROM pe_rdn_balance WHERE user_id = :uid"), {"uid": current_user.id}).fetchone()
        if not rdn:
            db.execute(text("INSERT INTO pe_rdn_balance (user_id, balance, held_balance) VALUES (:uid, :bal, 0)"), {"uid": current_user.id, "bal": user_balance})
        db.execute(text("UPDATE pe_rdn_balance SET balance = :bal WHERE user_id = :uid"), {"uid": current_user.id, "bal": new_balance})
    except Exception as e:
        print("RDN Logging Error:", e)
    try:
        trade_date = datetime.datetime.now().strftime("%Y-%m-%d")
        entry_id = f"FEE-{uuid.uuid4().hex[:6].upper()}"
        db.execute(text("INSERT INTO journal_entries (entry_id, trade_date, account_id, debit, credit, description, status) VALUES (:entry_id, :trade_date, '4.1.02.00.01', 0.0, :credit, :desc, 'Posted')"), {"entry_id": entry_id, "trade_date": trade_date, "credit": fee, "desc": f"Retail Buy Fee {symbol_upper} for User {current_user.id}"})
        db.commit()
    except Exception as e:
        db.rollback()
    db.commit()
    return {"success": True, "message": f"Successfully bought {qty} lots of {symbol_upper} at {execution_price}", "new_balance": new_balance}

@router.post("/sell")
def virtual_sell(payload: TradeRequest, current_user: User = Depends(get_current_user), db = Depends(get_db)):
    symbol_upper = payload.symbol.upper().strip()
    qty = payload.quantity
    if qty <= 0:
        return {"success": False, "message": "Quantity must be > 0"}
    market_price = get_current_price(db.remote, symbol_upper, current_user)
    execution_price = market_price
    if payload.orderType == "limit" and payload.limitPrice:
        if market_price < payload.limitPrice:
            return {"success": False, "message": f"Limit price ({payload.limitPrice}) is above current market price ({market_price})."}
        execution_price = payload.limitPrice
    else:
        execution_price = market_price * 0.999
        slippage_percent = 0.002 if qty > 10 else 0.001
        execution_price -= execution_price * slippage_percent
        execution_price = round(execution_price)
    base_proceeds = qty * execution_price * 100
    quantity_shares = qty * 100
    fee = base_proceeds * 0.0025
    tax = base_proceeds * 0.001
    total_proceeds = base_proceeds - fee - tax
    asset_record = db.execute(text("SELECT balance FROM pe_custodian_assets WHERE user_id = :user_id AND symbol = :symbol"), {"user_id": current_user.id, "symbol": symbol_upper}).fetchone()
    if not asset_record or int(asset_record[0]) < quantity_shares:
        available = int(asset_record[0]) if asset_record else 0
        return {"success": False, "message": f"Risk Reject: Insufficient lots to sell. Required: {qty} (or {quantity_shares} shares), Available: {available} shares"}
    if total_proceeds > 100_000_000:
        try:
            db.execute(text("INSERT INTO pe_risk_apu_ppt (user_id, alert_type, description, amount) VALUES (:user_id, 'STR_LARGE_SELL', :desc, :amt)"), {"user_id": current_user.id, "desc": f"Large Sell Order for {symbol_upper} (Qty: {qty} LOTS)", "amt": total_proceeds})
        except Exception as e:
            print("APU PPT Logging Error:", e)
    user_balance = float(current_user.virtual_saldo) if current_user.virtual_saldo else 0.0
    new_balance = user_balance + total_proceeds
    current_user.virtual_saldo = new_balance
    try:
        db.execute(text("INSERT INTO pe_oms_orders (user_id, symbol, side, type, quantity, price, status, created_at) VALUES (:user_id, :symbol, 'SELL', :type, :quantity, :price, 'MATCHED', NOW())"), {"user_id": current_user.id, "symbol": symbol_upper, "type": str(payload.orderType).upper() if payload.orderType else 'MARKET', "quantity": quantity_shares, "price": execution_price})
    except Exception as e:
        print("OMS Logging Error:", e)
    try:
        db.execute(text("UPDATE pe_custodian_assets SET balance = balance - :qty WHERE user_id = :uid AND symbol = :sym"), {"qty": quantity_shares, "uid": current_user.id, "sym": symbol_upper})
    except Exception as e:
        print("Custodian Logging Error:", e)
    try:
        db.execute(text("UPDATE pe_rdn_balance SET balance = :bal WHERE user_id = :uid"), {"uid": current_user.id, "bal": new_balance})
    except Exception as e:
        print("RDN Logging Error:", e)
    try:
        trade_date = datetime.datetime.now().strftime("%Y-%m-%d")
        entry_id = f"FEE-{uuid.uuid4().hex[:6].upper()}"
        db.execute(text("INSERT INTO journal_entries (entry_id, trade_date, account_id, debit, credit, description, status) VALUES (:entry_id, :trade_date, '4.1.02.00.01', 0.0, :credit, :desc, 'Posted')"), {"entry_id": entry_id, "trade_date": trade_date, "credit": fee, "desc": f"Retail Sell Fee {symbol_upper} for User {current_user.id}"})
        db.execute(text("INSERT INTO journal_entries (entry_id, trade_date, account_id, debit, credit, description, status) VALUES (:entry_id, :trade_date, '2.1.10.02.06', 0.0, :credit, :desc, 'Posted')"), {"entry_id": entry_id+"-T", "trade_date": trade_date, "credit": tax, "desc": f"Retail Sell Tax PPh {symbol_upper} for User {current_user.id}"})
        db.commit()
    except Exception as e:
        db.rollback()
    db.commit()
    return {"success": True, "message": f"Successfully sold {qty} lots of {symbol_upper} at {execution_price}", "new_balance": new_balance}

@router.get("/history")
def get_history(limit: int = 100, current_user: User = Depends(get_current_user), db = Depends(get_db)):
    rows = db.execute(text("SELECT symbol, side, quantity, price, created_at FROM pe_oms_orders WHERE user_id = :user_id AND symbol NOT LIKE '% %' ORDER BY created_at DESC LIMIT :limit"), {"user_id": current_user.id, "limit": limit}).fetchall()
    history = []
    for r in rows:
        dt_val = r[4]
        if isinstance(dt_val, datetime.datetime):
            dt_val = dt_val + datetime.timedelta(hours=5)
            dt_str = dt_val.strftime("%Y-%m-%dT%H:%M:%S+07:00")
        elif isinstance(dt_val, datetime.date):
            dt_str = dt_val.strftime("%Y-%m-%d")
        else:
            dt_str = str(dt_val)
        qty = int(r[2])
        price = float(r[3])
        history.append({"symbol": r[0], "type": r[1].upper(), "qty": qty, "quantity": qty, "price": price, "total_amount": price * qty, "date": dt_str, "transaction_date": dt_str})
    return {"success": True, "history": history, "transactions": history}

@router.get("/leaderboard")
def get_leaderboard(db = Depends(get_db)):
    rows = db.local.execute(text("SELECT id, email, virtual_saldo, avatar FROM users WHERE virtual_saldo IS NOT NULL ORDER BY virtual_saldo DESC LIMIT 10")).fetchall()
    leaderboard = []
    for rank, r in enumerate(rows, 1):
        leaderboard.append({"rank": rank, "id": r[0], "email": r[1].split("@")[0] + "@***", "virtual_saldo": float(r[2]) if r[2] is not None else 0.0, "avatar": r[3]})
    return {"success": True, "leaderboard": leaderboard}

@router.post("/reset-balance")
def reset_virtual_balance(current_user: User = Depends(get_current_user), db = Depends(get_db)):
    try:
        tier = current_user.tier.lower() if current_user.tier else "free"
        if tier == "free":
            new_balance = 100_000_000
        elif tier == "basic":
            new_balance = 1_000_000_000
        elif tier in ["premium", "pro"]:
            new_balance = 5_000_000_000
        elif tier == "enterprise":
            new_balance = 1_000_000_000_000
        else:
            new_balance = 100_000_000
        db.local.execute(text("UPDATE users SET virtual_saldo = :balance WHERE id = :user_id"), {"balance": new_balance, "user_id": current_user.id})
        db.execute(text("DELETE FROM pe_custodian_assets WHERE user_id = :user_id"), {"user_id": current_user.id})
        db.execute(text("DELETE FROM pe_oms_orders WHERE user_id = :user_id"), {"user_id": current_user.id})
        db.commit()
        current_user.virtual_saldo = new_balance
        return {"success": True, "message": f"Virtual account reset! New balance: Rp {new_balance:,.0f}", "balance": float(new_balance)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reset balance: {str(e)}")
