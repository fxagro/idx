from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
import datetime
from pydantic import BaseModel

from database import get_remote_db, get_local_db

router = APIRouter(tags=["Android Compat"])

class OrderRequest(BaseModel):
    userId: str
    assetCode: str
    quantity: float
    type: str
    assetType: str

@router.get("/market/assets")
@router.get("/market/stocks")
def get_assets(type: Optional[str] = None, market: Optional[str] = "IDX", db: Session = Depends(get_remote_db)):
    try:
        query = text("""
            SELECT s.stock_code, s.stock_name, s.close_price, s.prev_price, s.change_price, s.volume
            FROM stock_daily s
            INNER JOIN (
                SELECT stock_code, MAX(trade_date) as max_date 
                FROM stock_daily GROUP BY stock_code
            ) m ON s.stock_code = m.stock_code AND s.trade_date = m.max_date
            WHERE s.close_price > 0
            LIMIT 500
        """)
        rows = db.execute(query).fetchall()
        result = []
        for r in rows:
            prev = float(r[3]) if r[3] else 0.0
            chg = float(r[4]) if r[4] else 0.0
            chg_pct = (chg / prev * 100) if prev > 0 else 0.0
            result.append({
                "code": r[0],
                "stock_code": r[0],
                "name": r[1] or r[0],
                "stock_name": r[1] or r[0],
                "price": float(r[2] or 0),
                "change": chg,
                "change_pct": chg_pct,
                "type": "SAHAM",
                "volume": int(r[5] or 0),
                "foreign_net": 0.0
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/market/search")
def search_assets(q: str, db: Session = Depends(get_remote_db)):
    q_str = f"%{q.upper()}%"
    try:
        query = text("""
            SELECT s.stock_code, s.stock_name, s.close_price, s.prev_price, s.change_price, s.volume
            FROM stock_daily s
            INNER JOIN (
                SELECT stock_code, MAX(trade_date) as max_date 
                FROM stock_daily GROUP BY stock_code
            ) m ON s.stock_code = m.stock_code AND s.trade_date = m.max_date
            WHERE s.stock_code LIKE :q OR s.stock_name ILIKE :q
            LIMIT 50
        """)
        rows = db.execute(query, {"q": q_str}).fetchall()
        result = []
        for r in rows:
            prev = float(r[3]) if r[3] else 0.0
            chg = float(r[4]) if r[4] else 0.0
            chg_pct = (chg / prev * 100) if prev > 0 else 0.0
            result.append({
                "code": r[0],
                "name": r[1] or r[0],
                "price": float(r[2] or 0),
                "change": chg,
                "change_pct": chg_pct,
                "type": "SAHAM",
                "volume": int(r[5] or 0)
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/market/asset/{code}")
def get_asset_detail(code: str, type: Optional[str] = "SAHAM", market: Optional[str] = "IDX", db: Session = Depends(get_remote_db)):
    code_upper = code.upper()
    try:
        query = text("""
            SELECT trade_date, open_price, high_price, low_price, close_price, volume, prev_price
            FROM stock_daily
            WHERE stock_code = :code
            ORDER BY trade_date DESC
            LIMIT 30
        """)
        rows = db.execute(query, {"code": code_upper}).fetchall()
        if not rows:
            raise HTTPException(status_code=404, detail="Asset not found")
            
        history = []
        for r in reversed(rows):
            history.append({
                "trade_date": str(r[0]),
                "open_price": float(r[1] or 0),
                "high_price": float(r[2] or 0),
                "low_price": float(r[3] or 0),
                "close_price": float(r[4] or 0),
                "volume": int(r[5] or 0)
            })
            
        latest = rows[0]
        return {
            "code": code_upper,
            "name": code_upper,
            "price": float(latest[4] or 0),
            "prev_price": float(latest[6] or 0),
            "history": history,
            "type": "SAHAM"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/virtual/portfolio")
def get_portfolio(userId: str, db: Session = Depends(get_local_db)):
    try:
        u_query = text("SELECT id, balance FROM users WHERE id::text = :id OR email = :id")
        user = db.execute(u_query, {"id": userId}).fetchone()
        if not user:
            return {"userId": userId, "balance": 10000000.0, "totalValue": 10000000.0, "positions": []}
            
        uid = user[0]
        bal = float(user[1] or 0)
        
        p_query = text("""
            SELECT stock_code, shares, average_price 
            FROM portfolio 
            WHERE user_id = :uid AND shares > 0
        """)
        pos_rows = db.execute(p_query, {"uid": uid}).fetchall()
        positions = []
        total_val = bal
        
        for p in pos_rows:
            positions.append({
                "asset_code": p[0],
                "units": int(p[1]) / 100.0,
                "avg_price": float(p[2] or 0),
                "current_price": float(p[2] or 0),
                "unrealized_pnl": 0.0,
                "pnl_pct": 0.0,
                "type": "SAHAM"
            })
            total_val += (int(p[1]) * float(p[2] or 0))
            
        return {
            "userId": str(uid),
            "balance": bal,
            "totalValue": total_val,
            "positions": positions
        }
    except Exception as e:
        print(f"Error portfolio: {e}")
        return {"userId": userId, "balance": 0.0, "totalValue": 0.0, "positions": []}

@router.post("/virtual/order")
def execute_order(request: OrderRequest, db: Session = Depends(get_local_db)):
    return {"success": True, "message": "Order executed successfully"}

@router.get("/market/ihsg")
def get_ihsg(db: Session = Depends(get_remote_db)):
    try:
        query = text("""
            SELECT a.trade_date, a.close_index,
                   COALESCE(b.close_index, a.close_index) as prev_close
            FROM index_daily a
            LEFT JOIN index_daily b
              ON b.index_code = a.index_code
             AND b.trade_date = (
                 SELECT MAX(trade_date) FROM index_daily
                 WHERE index_code = a.index_code AND trade_date < a.trade_date
             )
            WHERE a.index_code = 'COMPOSITE'
            ORDER BY a.trade_date DESC
            LIMIT 1
        """)
        row = db.execute(query).fetchone()
        if not row:
            return {
                "code": "IHSG",
                "price": 0.0,
                "change": 0.0,
                "change_pct": 0.0
            }

        close_idx = float(row[1] or 0)
        prev = float(row[2] or 0)
        chg_idx = close_idx - prev
        chg_pct = (chg_idx / prev * 100) if prev > 0 else 0.0

        return {
            "code": "IHSG",
            "price": close_idx,
            "change": chg_idx,
            "change_pct": chg_pct
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/market/sectors")
def get_sectors(db: Session = Depends(get_remote_db)):
    try:
        query = text("""
            SELECT a.index_code, a.close_index,
                   COALESCE(b.close_index, a.close_index) as prev_close
            FROM index_daily a
            LEFT JOIN index_daily b
              ON b.index_code = a.index_code
             AND b.trade_date = (
                 SELECT MAX(trade_date) FROM index_daily
                 WHERE index_code = a.index_code AND trade_date < a.trade_date
             )
            INNER JOIN (
                SELECT MAX(a2.trade_date) as max_date
                FROM index_daily a2
                WHERE a2.index_code LIKE 'IDX%%'
            ) m ON a.trade_date = m.max_date
            WHERE a.index_code LIKE 'IDX%%'
            ORDER BY a.index_code
            LIMIT 50
        """)
        rows = db.execute(query).fetchall()
        result = []
        for r in rows:
            code = r[0]
            if code in ["IDX30", "IDX80", "IDXHIDIV20"]:
                continue
            close_idx = float(r[1] or 0)
            prev = float(r[2] or 0)
            chg_idx = close_idx - prev
            chg_pct = (chg_idx / prev * 100) if prev > 0 else 0.0

            result.append({
                "code": code,
                "name": code.replace("IDX", "Sektor "),
                "price": close_idx,
                "change": chg_idx,
                "change_pct": chg_pct
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

