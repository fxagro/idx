from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List
import datetime

from ..database import get_local_db
from ..models import User
from .auth import get_current_user

router = APIRouter()

# Hardcoded Mutual Fund Products for Presentation
PRODUCTS = [
    {"id": 1, "manager": "KIM", "type": "Fixed Income", "name": "REKSA DANA KIM FIXED INCOME FUND", "nav": 1205.84, "minSub": 100000.0, "minRed": 100000.0, "isSyariah": False},
    {"id": 2, "manager": "MNC Asset", "type": "Fixed Income", "name": "REKSA DANA MNC DANA LIKUID", "nav": 3602.47, "minSub": 250000.0, "minRed": 250000.0, "isSyariah": False},
    {"id": 3, "manager": "MNC Asset", "type": "Fixed Income", "name": "REKSA DANA MNC DANA SYARIAH", "nav": 3923.84, "minSub": 250000.0, "minRed": 250000.0, "isSyariah": True},
    {"id": 4, "manager": "BNI-AM", "type": "Fixed Income", "name": "REKSA DANA PENDAPATAN TETAP BNI-AM", "nav": 1644.18, "minSub": 10000.0, "minRed": 10000.0, "isSyariah": False},
    {"id": 5, "manager": "Mandiri", "type": "Money Market", "name": "REKSA DANA MANDIRI INVESTA PASAR UANG", "nav": 1829.55, "minSub": 10000.0, "minRed": 10000.0, "isSyariah": False},
    {"id": 6, "manager": "MNC Asset", "type": "Money Market", "name": "REKSA DANA MNC DANA SYARIAH PASAR UANG", "nav": 1608.04, "minSub": 250000.0, "minRed": 250000.0, "isSyariah": True},
    {"id": 7, "manager": "MNC Asset", "type": "Money Market", "name": "REKSA DANA MNC DANA LANCAR", "nav": 2041.38, "minSub": 250000.0, "minRed": 250000.0, "isSyariah": False},
    {"id": 8, "manager": "Mandiri", "type": "Money Market", "name": "REKSA DANA MANDIRI PASAR UANG SYARIAH", "nav": 1421.00, "minSub": 10000.0, "minRed": 10000.0, "isSyariah": True},
    {"id": 9, "manager": "Syailendra", "type": "Money Market", "name": "REKSA DANA SYAILENDRA DANA KAS", "nav": 1800.32, "minSub": 100000.0, "minRed": 100000.0, "isSyariah": False},
    {"id": 10, "manager": "KIM", "type": "Money Market", "name": "REKSA DANA SYARIAH KIM PASAR UANG", "nav": 1038.75, "minSub": 100000.0, "minRed": 100000.0, "isSyariah": True},
    {"id": 11, "manager": "KIM", "type": "Money Market", "name": "REKSA DANA KIM MONEY MARKET FUND", "nav": 1380.59, "minSub": 100000.0, "minRed": 100000.0, "isSyariah": False},
    {"id": 12, "manager": "Bahana", "type": "Money Market", "name": "REKSA DANA BAHANA LIKUID", "nav": 1530.46, "minSub": 10000.0, "minRed": 10000.0, "isSyariah": False},
    {"id": 13, "manager": "BNI-AM", "type": "Money Market", "name": "REKSA DANA BNI AM DANA LIKUID", "nav": 2024.61, "minSub": 10000.0, "minRed": 10000.0, "isSyariah": False},
]

def get_product_by_id(fund_id: int):
    for p in PRODUCTS:
        if p["id"] == fund_id:
            return p
    return None

class ReksadanaTransactionReq(BaseModel):
    fund_id: int
    amount: float # Rupiah value to invest or redeem

@router.get("/products")
def get_products():
    return PRODUCTS

@router.get("/portfolio")
def get_portfolio(current_user: User = Depends(get_current_user), db: Session = Depends(get_local_db)):
    query = text("""
        SELECT fund_id, qty, avg_price
        FROM reksadana_portfolio
        WHERE user_id = :user_id AND qty > 0
    """)
    rows = db.execute(query, {"user_id": current_user.id}).fetchall()
    
    portfolio = []
    total_market_value = 0.0
    total_buy_value = 0.0
    
    for r in rows:
        fund_id = r[0]
        qty = float(r[1])
        avg_price = float(r[2])
        
        product = get_product_by_id(fund_id)
        if not product:
            continue
            
        current_nav = product["nav"]
        buy_val = qty * avg_price
        market_val = qty * current_nav
        unrealized_pl = market_val - buy_val
        pl_pct = (unrealized_pl / buy_val * 100.0) if buy_val > 0 else 0.0
        
        total_buy_value += buy_val
        total_market_value += market_val
        
        portfolio.append({
            "fund_id": fund_id,
            "product": product,
            "qty": qty,
            "avg_price": avg_price,
            "current_nav": current_nav,
            "buy_value": buy_val,
            "market_value": market_val,
            "unrealized_pl": unrealized_pl,
            "unrealized_pl_pct": pl_pct
        })
        
    user_row = db.execute(text("SELECT virtual_saldo FROM users WHERE id = :uid"), {"uid": current_user.id}).fetchone()
    balance = user_row[0] if user_row else 0.0
    
    return {
        "balance": balance,
        "total_market_value": total_market_value,
        "total_buy_value": total_buy_value,
        "total_unrealized_pl": total_market_value - total_buy_value,
        "portfolio": portfolio
    }

@router.post("/buy")
def buy_reksadana(req: ReksadanaTransactionReq, current_user: User = Depends(get_current_user), db: Session = Depends(get_local_db)):
    product = get_product_by_id(req.fund_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produk Reksa Dana tidak ditemukan")
        
    if req.amount < product["minSub"]:
        raise HTTPException(status_code=400, detail=f"Minimal pembelian adalah Rp {product['minSub']:,.0f}")
        
    user_row = db.execute(text("SELECT virtual_saldo FROM users WHERE id = :uid"), {"uid": current_user.id}).fetchone()
    if not user_row or user_row[0] < req.amount:
        raise HTTPException(status_code=400, detail="Saldo tidak mencukupi")
        
    # Calculate units
    nav = product["nav"]
    units = req.amount / nav
    
    # Deduct balance
    db.execute(text("UPDATE users SET virtual_saldo = virtual_saldo - :amt WHERE id = :uid"), {"amt": req.amount, "uid": current_user.id})
    
    # Update portfolio
    port_row = db.execute(text("SELECT qty, avg_price FROM reksadana_portfolio WHERE user_id = :uid AND fund_id = :fid"), 
                          {"uid": current_user.id, "fid": req.fund_id}).fetchone()
                          
    if port_row:
        old_qty = float(port_row[0])
        old_avg = float(port_row[1])
        total_cost = (old_qty * old_avg) + req.amount
        new_qty = old_qty + units
        new_avg = total_cost / new_qty
        
        db.execute(text("UPDATE reksadana_portfolio SET qty = :qty, avg_price = :avg WHERE user_id = :uid AND fund_id = :fid"),
                   {"qty": new_qty, "avg": new_avg, "uid": current_user.id, "fid": req.fund_id})
    else:
        db.execute(text("INSERT INTO reksadana_portfolio (user_id, fund_id, qty, avg_price) VALUES (:uid, :fid, :qty, :avg)"),
                   {"uid": current_user.id, "fid": req.fund_id, "qty": units, "avg": nav})
                   
    # Record transaction
    db.execute(text("""
        INSERT INTO reksadana_transactions (user_id, fund_id, type, qty, price, total_value, timestamp) 
        VALUES (:uid, :fid, 'BUY', :qty, :price, :val, :ts)
    """), {
        "uid": current_user.id, "fid": req.fund_id, "qty": units, "price": nav, 
        "val": req.amount, "ts": datetime.datetime.now()
    })
    
    db.commit()
    return {"message": "Pembelian Reksa Dana berhasil", "units": units, "amount": req.amount}

@router.post("/sell")
def sell_reksadana(req: ReksadanaTransactionReq, current_user: User = Depends(get_current_user), db: Session = Depends(get_local_db)):
    product = get_product_by_id(req.fund_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produk Reksa Dana tidak ditemukan")
        
    port_row = db.execute(text("SELECT qty, avg_price FROM reksadana_portfolio WHERE user_id = :uid AND fund_id = :fid"), 
                          {"uid": current_user.id, "fid": req.fund_id}).fetchone()
                          
    if not port_row or float(port_row[0]) <= 0:
        raise HTTPException(status_code=400, detail="Anda tidak memiliki portofolio Reksa Dana ini")
        
    current_qty = float(port_row[0])
    nav = product["nav"]
    units_to_sell = req.amount / nav
    
    if req.amount < product["minRed"] and (current_qty * nav) >= product["minRed"]:
        # Allow selling everything if remaining is less than minRed, but strictly checking requested amount
        raise HTTPException(status_code=400, detail=f"Minimal penjualan adalah Rp {product['minRed']:,.0f}")
        
    if units_to_sell > current_qty + 0.0001: # Add epsilon for floating point issues
        units_to_sell = current_qty
        req.amount = units_to_sell * nav
        
    # Add balance
    db.execute(text("UPDATE users SET virtual_saldo = virtual_saldo + :amt WHERE id = :uid"), {"amt": req.amount, "uid": current_user.id})
    
    # Update portfolio
    new_qty = current_qty - units_to_sell
    if new_qty < 0.0001:
        db.execute(text("DELETE FROM reksadana_portfolio WHERE user_id = :uid AND fund_id = :fid"),
                   {"uid": current_user.id, "fid": req.fund_id})
    else:
        db.execute(text("UPDATE reksadana_portfolio SET qty = :qty WHERE user_id = :uid AND fund_id = :fid"),
                   {"qty": new_qty, "uid": current_user.id, "fid": req.fund_id})
                   
    # Record transaction
    db.execute(text("""
        INSERT INTO reksadana_transactions (user_id, fund_id, type, qty, price, total_value, timestamp) 
        VALUES (:uid, :fid, 'SELL', :qty, :price, :val, :ts)
    """), {
        "uid": current_user.id, "fid": req.fund_id, "qty": units_to_sell, "price": nav, 
        "val": req.amount, "ts": datetime.datetime.now()
    })
    
    db.commit()
    return {"message": "Penjualan Reksa Dana berhasil", "units": units_to_sell, "amount": req.amount}

@router.get("/history")
def get_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_local_db)):
    query = text("""
        SELECT fund_id, type, qty, price, total_value, timestamp
        FROM reksadana_transactions
        WHERE user_id = :user_id
        ORDER BY timestamp DESC
    """)
    rows = db.execute(query, {"user_id": current_user.id}).fetchall()
    
    history = []
    for r in rows:
        product = get_product_by_id(r[0])
        history.append({
            "fund_id": r[0],
            "product_name": product["name"] if product else "Unknown Fund",
            "type": r[1],
            "qty": r[2],
            "price": r[3],
            "total_value": r[4],
            "timestamp": r[5]
        })
        
    return history
