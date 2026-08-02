import random
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
import datetime
from pydantic import BaseModel

from database import get_local_db, get_remote_db
from .auth import get_current_user
from models import User

import requests
from config import settings

router = APIRouter(prefix="/stocks", tags=["Stocks & Technicals"])

class AnalyzeRequest(BaseModel):
    symbol: str
    market: str
    question: str

class WatchlistRequest(BaseModel):
    symbol: str

# Helper to classify Indonesian broker codes
def classify_broker_type(code: str) -> str:
    code_upper = code.upper().strip()
    asing = {"AK", "BK", "DB", "CS", "MS", "KZ", "CG", "RX", "ZP", "BS"}
    bumn = {"CC", "OD", "NI", "DX", "BR"}
    retail = {"YP", "PD", "XC", "KK", "YJ", "IP", "CP", "AZ", "GR", "DH", "HD", "XA", "XL"}
    
    if code_upper in asing:
        return "asing"
    elif code_upper in bumn:
        return "bumn"
    elif code_upper in retail:
        return "retail"
    else:
        return "institusi"

@router.get("/price/{symbol}")
def get_stock_price(symbol: str, market: str = "idx", days: int = 60, remote_db: Session = Depends(get_remote_db)):
    symbol_upper = symbol.upper().strip()
    try:
        # Get history
        query = text("""
            SELECT trade_date, open_price, high_price, low_price, close_price, volume
            FROM stock_daily
            WHERE stock_code = :symbol
            ORDER BY trade_date DESC
            LIMIT :days
        """)
        rows = remote_db.execute(query, {"symbol": symbol_upper, "days": days}).fetchall()
        
        history = []
        for r in reversed(rows):
            history.append({
                "date": str(r[0]),
                "open": float(r[1]) if r[1] is not None else 0.0,
                "high": float(r[2]) if r[2] is not None else 0.0,
                "low": float(r[3]) if r[3] is not None else 0.0,
                "price": float(r[4]) if r[4] is not None else 0.0,
                "close": float(r[4]) if r[4] is not None else 0.0,
                "volume": int(r[5]) if r[5] is not None else 0
            })
            
        # Get current
        current = None
        if history:
            last = history[-1]
            current = {
                "price": last["close"],
                "date": last["date"],
                "volume": last["volume"],
                "high": last["high"],
                "low": last["low"],
                "open": last["open"]
            }
        else:
            current = {
                "price": 0.0, "date": "", "volume": 0, "high": 0.0, "low": 0.0, "open": 0.0
            }
            
        return {
            "symbol": symbol_upper,
            "market": market.upper(),
            "current": current,
            "history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/idx/candlestick")
@router.get("/candlestick")
def get_candlestick(
    symbol: str, 
    timeframe: str = "1M", 
    db: Session = Depends(get_remote_db)
):
    symbol_upper = symbol.upper().strip()
    
    # 1. Get min/max date from database
    range_query = text("""
        SELECT 
            MIN(trade_date) as min_date,
            MAX(trade_date) as max_date
        FROM stock_daily
        WHERE stock_code = :symbol
    """)
    range_res = db.execute(range_query, {"symbol": symbol_upper}).fetchone()
    
    if not range_res or range_res[0] is None:
        return {
            "success": True,
            "data": [],
            "company_name": f"{symbol_upper} - No Data",
            "data_points": 0,
            "symbol": symbol_upper,
            "timeframe": timeframe
        }
        
    db_min = range_res[0]
    db_max = range_res[1]
    
    # Calculate start date based on timeframe
    now = datetime.datetime.now()
    start_date = now
    
    if timeframe == '1M':
        start_date = now - datetime.timedelta(days=30)
    elif timeframe == '3M':
        start_date = now - datetime.timedelta(days=90)
    elif timeframe == '6M':
        start_date = now - datetime.timedelta(days=180)
    elif timeframe == '1Y':
        start_date = now - datetime.timedelta(days=365)
    elif timeframe == 'YTD':
        start_date = datetime.datetime(now.year, 1, 1)
    elif timeframe == 'ALL':
        start_date = datetime.datetime(2020, 1, 1)
    else:
        start_date = now - datetime.timedelta(days=30)
        
    # Adjust within DB boundaries
    if isinstance(db_min, str):
        db_min_dt = datetime.datetime.strptime(db_min, "%Y-%m-%d")
    elif isinstance(db_min, datetime.date) and not isinstance(db_min, datetime.datetime):
        db_min_dt = datetime.datetime.combine(db_min, datetime.time.min)
    else:
        db_min_dt = db_min
        
    if isinstance(db_max, str):
        db_max_dt = datetime.datetime.strptime(db_max, "%Y-%m-%d")
    elif isinstance(db_max, datetime.date) and not isinstance(db_max, datetime.datetime):
        db_max_dt = datetime.datetime.combine(db_max, datetime.time.min)
    else:
        db_max_dt = db_max
        
    if start_date < db_min_dt:
        start_date = db_min_dt
        
    end_date = now
    if end_date > db_max_dt:
        end_date = db_max_dt
        
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    # Fetch candlestick data
    candlestick_query = text("""
        SELECT
            trade_date,
            open_price as open,
            high_price as high,
            low_price as low,
            close_price as close,
            volume,
            stock_name as company_name
        FROM stock_daily
        WHERE stock_code = :symbol
          AND trade_date >= :start
          AND trade_date <= :end
        ORDER BY trade_date ASC
    """)
    
    rows = db.execute(candlestick_query, {"symbol": symbol_upper, "start": start_str, "end": end_str}).fetchall()
    
    if not rows:
        return {
            "success": True,
            "data": [],
            "company_name": f"{symbol_upper} - No Data",
            "data_points": 0,
            "symbol": symbol_upper,
            "timeframe": timeframe
        }
        
    data = []
    for r in rows:
        trade_date_val = r[0]
        if isinstance(trade_date_val, (datetime.date, datetime.datetime)):
            trade_date_str = trade_date_val.strftime("%Y-%m-%d")
        else:
            trade_date_str = str(trade_date_val)
            
        data.append({
            "trade_date": trade_date_str,
            "open": float(r[1]) if r[1] is not None else 0.0,
            "high": float(r[2]) if r[2] is not None else 0.0,
            "low": float(r[3]) if r[3] is not None else 0.0,
            "close": float(r[4]) if r[4] is not None else 0.0,
            "volume": int(r[5]) if r[5] is not None else 0
        })
        
    company_name = rows[0][6] if rows[0][6] else symbol_upper
    
    return {
        "success": True,
        "data": data,
        "company_name": company_name,
        "data_points": len(data),
        "symbol": symbol_upper,
        "timeframe": timeframe,
        "date_range": {
            "start": start_str,
            "end": end_str
        }
    }

@router.get("/bandar")
def get_bandar(
    symbol: str, 
    days: int = 30, 
    remote_db: Session = Depends(get_remote_db)
):
    symbol_upper = symbol.upper().strip()
    
    # 1. Fetch price history from remote stock_daily
    local_query = text("""
        SELECT
            trade_date as date,
            close_price as close,
            high_price as high,
            low_price as low,
            open_price as open,
            volume,
            frequency
        FROM stock_daily
        WHERE stock_code = :symbol
        ORDER BY trade_date DESC
        LIMIT :days
    """)
    rows = remote_db.execute(local_query, {"symbol": symbol_upper, "days": days}).fetchall()
    
    if not rows:
        return {
            "success": True,
            "data": {
                "symbol": symbol_upper,
                "message": "No price data found for this symbol",
                "history": [],
                "brokers": [],
                "premium_bandar": {"premium_available": False, "message": "No remote analysis records found."}
            }
        }
        
    # Standard metrics
    history = []
    for r in reversed(rows):
        dt_val = r[0]
        dt_str = dt_val.strftime("%Y-%m-%d") if isinstance(dt_val, (datetime.date, datetime.datetime)) else str(dt_val)
        history.append({
            "date": dt_str,
            "close": float(r[1]) if r[1] is not None else 0.0,
            "high": float(r[2]) if r[2] is not None else 0.0,
            "low": float(r[3]) if r[3] is not None else 0.0,
            "open": float(r[4]) if r[4] is not None else 0.0,
            "volume": int(r[5]) if r[5] is not None else 0,
            "frequency": int(r[6]) if r[6] is not None else 0
        })
        
    buy_volume = sum(h["volume"] for h in history if h["close"] > h["open"])
    sell_volume = sum(h["volume"] for h in history if h["close"] < h["open"])
    total_volume = sum(h["volume"] for h in history)
    avg_volume = total_volume / len(history) if history else 0
    
    # 2. Fetch remote premium bandarmology analysis from VPS 3 database broker_db
    premium_data = {}
    try:
        remote_query = text("""
            SELECT
                accum_net_vol, accum_net_val, accum_buy_vol, accum_sell_vol,
                status, strength, accum_ratio, foreign_net_val,
                top_3_buy_val, top_3_sell_val, conviction_score
            FROM bandarmology_analysis
            WHERE stock_code = :symbol
            ORDER BY analysis_date DESC
            LIMIT 1
        """)
        premium_row = remote_db.execute(remote_query, {"symbol": symbol_upper}).fetchone()
        
        if premium_row:
            premium_data = {
                "premium_available": True,
                "accum_net_vol": premium_row[0],
                "accum_net_val": float(premium_row[1]) if premium_row[1] is not None else 0.0,
                "accum_buy_vol": premium_row[2],
                "accum_sell_vol": premium_row[3],
                "status": premium_row[4],
                "strength": float(premium_row[5]) if premium_row[5] is not None else 0.0,
                "accum_ratio": float(premium_row[6]) if premium_row[6] is not None else 0.0,
                "foreign_net_val": float(premium_row[7]) if premium_row[7] is not None else 0.0,
                "top_3_buy_val": float(premium_row[8]) if premium_row[8] is not None else 0.0,
                "top_3_sell_val": float(premium_row[9]) if premium_row[9] is not None else 0.0,
                "conviction_score": float(premium_row[10]) if premium_row[10] is not None else 0.0,
            }
        else:
            premium_data = {"premium_available": False, "message": "No remote analysis records found for this symbol."}
    except Exception as e:
        premium_data = {"premium_available": False, "error": f"Failed to pull remote premium metrics: {str(e)}"}

    # 3. Fetch remote broker transaction logs and aggregate
    brokers_data = []
    try:
        # Find the N last trading dates in remote transactions database for this stock
        dates_query = text("""
            SELECT DISTINCT trade_date 
            FROM transactions 
            WHERE stock_code = :symbol 
            ORDER BY trade_date DESC 
            LIMIT :days
        """)
        trading_dates = remote_db.execute(dates_query, {"symbol": symbol_upper, "days": days}).fetchall()
        
        if trading_dates:
            min_date = trading_dates[-1][0]
            
            # Aggregate broker transactions from min_date to latest
            broker_query = text("""
                SELECT 
                    t.broker_code,
                    COALESCE(b.broker_name, t.broker_code) as broker_name,
                    SUM(t.buy_freq) as buy_freq,
                    SUM(t.buy_vol) as buy_vol,
                    SUM(t.buy_val) as buy_val,
                    SUM(t.sell_freq) as sell_freq,
                    SUM(t.sell_vol) as sell_vol,
                    SUM(t.sell_val) as sell_val,
                    SUM(t.net_vol) as net_vol,
                    SUM(t.net_val) as net_val
                FROM transactions t
                LEFT JOIN brokers b ON t.broker_code = b.broker_code
                WHERE t.stock_code = :symbol
                  AND t.trade_date >= :min_date
                GROUP BY t.broker_code, b.broker_name
            """)
            broker_rows = remote_db.execute(broker_query, {"symbol": symbol_upper, "min_date": min_date}).fetchall()
            
            for br in broker_rows:
                br_code = br[0]
                br_name = br[1]
                b_freq = int(br[2]) if br[2] is not None else 0
                b_vol = int(br[3]) if br[3] is not None else 0
                b_val = float(br[4]) if br[4] is not None else 0.0
                s_freq = int(br[5]) if br[5] is not None else 0
                s_vol = int(br[6]) if br[6] is not None else 0
                s_val = float(br[7]) if br[7] is not None else 0.0
                net_vol = int(br[8]) if br[8] is not None else 0
                net_val = float(br[9]) if br[9] is not None else 0.0
                
                # Calculate average buy/sell prices
                b_avg = b_val / b_vol if b_vol > 0 else 0.0
                s_avg = s_val / s_vol if s_vol > 0 else 0.0
                
                # Calculate percentage
                total_tr_vol = b_vol + s_vol
                buy_percent = (b_vol / total_tr_vol * 100) if total_tr_vol > 0 else 50.0
                sell_percent = (s_vol / total_tr_vol * 100) if total_tr_vol > 0 else 50.0
                
                brokers_data.append({
                    "kode_broker": br_code.upper(),
                    "nama_broker": br_name,
                    "jenis_broker": classify_broker_type(br_code),
                    "buy_freq": b_freq,
                    "buy_vol": b_vol,
                    "buy_avg": b_avg,
                    "buy_percent": buy_percent,
                    "sell_freq": s_freq,
                    "sell_vol": s_vol,
                    "sell_avg": s_avg,
                    "sell_percent": sell_percent,
                    "net_vol": net_vol,
                    "net_val": net_val
                })
    except Exception as e:
        print(f"Failed to fetch remote broker transactions: {str(e)}")
        
    return {
        "success": True,
        "data": {
            "symbol": symbol_upper,
            "period": f"{days} days",
            "metrics": {
                "totalVolume": total_volume,
                "avgVolume": round(avg_volume),
                "buyVolume": buy_volume,
                "sellVolume": sell_volume
            },
            "history": history,
            "premium_bandar": premium_data
        },
        "brokers": brokers_data
    }

@router.get("/symbols")
@router.get("/idx/symbols")
def get_symbols(db: Session = Depends(get_remote_db)):
    query = text("""
        SELECT stock_code, MAX(stock_name) as stock_name
        FROM stock_daily 
        GROUP BY stock_code
        ORDER BY stock_code ASC
        LIMIT 1000
    """)
    rows = db.execute(query).fetchall()
    symbols = [{"symbol": r[0], "name": r[1] if r[1] else r[0]} for r in rows if r[0]]
    return {"success": True, "symbols": symbols}

@router.get("/signals")
def get_signals(limit: int = 50, remote_db: Session = Depends(get_remote_db)):
    try:
        query = text("""
            SELECT 
                id, trade_date, signal_time, signal_type, stock_code, 
                last_price, change_price, change_percent, volume
            FROM stock_signals
            ORDER BY trade_date DESC, signal_time DESC
            LIMIT :limit
        """)
        rows = remote_db.execute(query, {"limit": limit}).fetchall()
        signals = []
        for r in rows:
            signals.append({
                "id": r[0],
                "trade_date": r[1],
                "signal_time": r[2],
                "signal_type": r[3],
                "stock_code": r[4],
                "last_price": float(r[5]) if r[5] is not None else 0.0,
                "change_price": float(r[6]) if r[6] is not None else 0.0,
                "change_percent": float(r[7]) if r[7] is not None else 0.0,
                "volume": r[8]
            })
        return {"success": True, "data": signals}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query remote signals: {str(e)}")

@router.get("/market/news")
def get_market_news(limit: int = 20, remote_db: Session = Depends(get_remote_db)):
    try:
        query = text("""
            SELECT id, title, content, source, category, news_date, created_at
            FROM market_news
            ORDER BY news_date DESC, created_at DESC
            LIMIT :limit
        """)
        rows = remote_db.execute(query, {"limit": limit}).fetchall()
        news = []
        for r in rows:
            news.append({
                "id": r[0],
                "title": r[1],
                "content": r[2],
                "source": r[3],
                "category": r[4],
                "news_date": str(r[5]) if r[5] else None,
                "created_at": str(r[6]) if r[6] else None
            })
        return {"success": True, "data": news}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query market news: {str(e)}")

@router.get("/market/signals")
def get_market_signals(limit: int = 50, remote_db: Session = Depends(get_remote_db)):
    try:
        query = text("""
            SELECT 
                id, trade_date, signal_time, division, signal_type, stock_code, 
                last_price, change_price, change_percent, volume
            FROM stock_signals
            ORDER BY trade_date DESC, signal_time DESC
            LIMIT :limit
        """)
        rows = remote_db.execute(query, {"limit": limit}).fetchall()
        signals = []
        for r in rows:
            signals.append({
                "id": r[0],
                "trade_date": r[1],
                "signal_time": r[2],
                "division": r[3],
                "signal_type": r[4],
                "stock_code": r[5],
                "last_price": float(r[6]) if r[6] is not None else 0.0,
                "change_price": float(r[7]) if r[7] is not None else 0.0,
                "change_percent": float(r[8]) if r[8] is not None else 0.0,
                "volume": r[9]
            })
        return {"success": True, "data": signals}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query market signals: {str(e)}")

@router.get("/market/recommendations")
def get_recommendations(limit: int = 20, remote_db: Session = Depends(get_remote_db)):
    try:
        query = text("""
            SELECT 
                id, trade_date, stock_code, stock_name, entry_price,
                tp1, tp2, sl1, sl2, tier_required, result_status,
                last_price, live_gain, strategy_type, reason,
                recommendation_score, bandar_status, bandar_strength,
                foreign_net, consistency_days
            FROM daily_recommendations
            ORDER BY trade_date DESC, id DESC
            LIMIT :limit
        """)
        rows = remote_db.execute(query, {"limit": limit}).fetchall()
        recs = []
        for r in rows:
            recs.append({
                "id": r[0],
                "trade_date": r[1],
                "stock_code": r[2],
                "stock_name": r[3],
                "entry_price": float(r[4]) if r[4] is not None else None,
                "tp1": float(r[5]) if r[5] is not None else None,
                "tp2": float(r[6]) if r[6] is not None else None,
                "sl1": float(r[7]) if r[7] is not None else None,
                "sl2": float(r[8]) if r[8] is not None else None,
                "tier_required": r[9],
                "result_status": r[10],
                "last_price": float(r[11]) if r[11] is not None else None,
                "live_gain": float(r[12]) if r[12] is not None else None,
                "strategy_type": r[13],
                "reason": r[14],
                "recommendation_score": float(r[15]) if r[15] is not None else None,
                "bandar_status": r[16],
                "bandar_strength": float(r[17]) if r[17] is not None else None,
                "foreign_net": r[18],
                "consistency_days": r[19]
            })
        return {"success": True, "data": recs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query recommendations: {str(e)}")


@router.get("/market/ihsg-chart")
def get_ihsg_chart(days: int = 30, remote_db: Session = Depends(get_remote_db)):
    try:
        query = text("""
            SELECT trade_date, close_index
            FROM index_daily
            WHERE index_code IN ('IHSG', 'COMPOSITE')
            ORDER BY trade_date DESC
            LIMIT :days
        """)
        rows = remote_db.execute(query, {"days": days}).fetchall()
        data = []
        for r in reversed(rows):
            dt_val = r[0]
            dt_str = dt_val.strftime("%Y-%m-%d") if isinstance(dt_val, (datetime.date, datetime.datetime)) else str(dt_val)
            data.append({
                "date": dt_str,
                "value": float(r[1]) if r[1] is not None else 0.0
            })
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query IHSG chart: {str(e)}")


@router.get("/watchlist")

def get_watchlist(current_user: User = Depends(get_current_user), local_db: Session = Depends(get_local_db), remote_db: Session = Depends(get_remote_db)):
    query = text("""
        SELECT symbol, added_at 
        FROM user_watchlist 
        WHERE user_id = :user_id
        ORDER BY added_at DESC
    """)
    rows = local_db.execute(query, {"user_id": current_user.id}).fetchall()
    if not rows:
        return {"success": True, "data": []}

    items = []
    for r in rows:
        symbol = r[0]
        added_at = str(r[1]) if r[1] else None
        try:
            price_query = text("""
                SELECT close_price, change_price, prev_price, volume
                FROM stock_daily
                WHERE stock_code = :symbol
                ORDER BY trade_date DESC
                LIMIT 1
            """)
            price_row = remote_db.execute(price_query, {"symbol": symbol}).fetchone()
            if price_row:
                close_price = float(price_row[0]) if price_row[0] is not None else 0.0
                change = float(price_row[1]) if price_row[1] is not None else 0.0
                prev = float(price_row[2]) if price_row[2] is not None else 0.0
                change_pct = (change / prev * 100) if prev > 0 else 0.0
                volume = int(price_row[3]) if price_row[3] is not None else 0
            else:
                close_price = 0.0
                change = 0.0
                change_pct = 0.0
                volume = 0

            bandar_query = text("""
                SELECT status, strength
                FROM bandarmology_analysis
                WHERE stock_code = :symbol
                ORDER BY analysis_date DESC
                LIMIT 1
            """)
            bandar_row = remote_db.execute(bandar_query, {"symbol": symbol}).fetchone()
            bandar_status = bandar_row[0] if bandar_row else None
            bandar_strength = float(bandar_row[1]) if bandar_row and bandar_row[1] is not None else None
        except Exception:
            close_price = 0.0
            change = 0.0
            change_pct = 0.0
            volume = 0
            bandar_status = None
            bandar_strength = None

        items.append({
            "id": 0,
            "symbol": symbol,
            "price": close_price,
            "change": change,
            "change_pct": round(change_pct, 2),
            "volume": volume,
            "bandar_status": bandar_status,
            "bandar_strength": bandar_strength,
            "created_at": added_at
        })
    return {"success": True, "data": items}
@router.post("/watchlist")
def add_watchlist(payload: WatchlistRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_local_db)):
    symbol_upper = payload.symbol.upper().strip()
    
    check_query = text("""
        SELECT id FROM user_watchlist 
        WHERE user_id = :user_id AND symbol = :symbol
    """)
    exists = db.execute(check_query, {"user_id": current_user.id, "symbol": symbol_upper}).fetchone()
    if exists:
        return {"success": True, "message": "Symbol already in watchlist"}
        
    insert_query = text("""
        INSERT INTO user_watchlist (user_id, symbol, added_at) 
        VALUES (:user_id, :symbol, NOW())
    """)
    db.execute(insert_query, {"user_id": current_user.id, "symbol": symbol_upper})
    db.commit()
    return {"success": True, "message": "Added to watchlist successfully"}

@router.delete("/watchlist/{symbol}")
def delete_watchlist(symbol: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_local_db)):
    symbol_upper = symbol.upper().strip()
    delete_query = text("""
        DELETE FROM user_watchlist 
        WHERE user_id = :user_id AND symbol = :symbol
    """)
    db.execute(delete_query, {"user_id": current_user.id, "symbol": symbol_upper})
    db.commit()
    return {"success": True, "message": "Removed from watchlist successfully"}

@router.get("/watchlist/check/{symbol}")
def check_watchlist(symbol: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_local_db)):
    symbol_upper = symbol.upper().strip()
    query = text("""
        SELECT id FROM user_watchlist 
        WHERE user_id = :user_id AND symbol = :symbol
    """)
    exists = db.execute(query, {"user_id": current_user.id, "symbol": symbol_upper}).fetchone()
    return {"success": True, "exists": exists is not None}

@router.get("/brokers/holdings")
def get_broker_holdings(
    broker: str,
    days: int = 30,
    remote_db: Session = Depends(get_remote_db)
):
    broker_upper = broker.upper().strip()
    
    try:
        dates_query = text("SELECT DISTINCT trade_date FROM transactions ORDER BY trade_date DESC LIMIT :days")
        trading_dates = remote_db.execute(dates_query, {"days": days}).fetchall()
        
        if not trading_dates:
            return {"success": True, "holdings": []}
            
        min_date = trading_dates[-1][0]
        
        holdings_query = text("""
            SELECT 
                stock_code,
                SUM(buy_vol) as total_buy_vol,
                SUM(sell_vol) as total_sell_vol,
                SUM(net_vol) as net_vol,
                SUM(net_val) as net_val
            FROM transactions
            WHERE broker_code = :broker
              AND trade_date >= :min_date
            GROUP BY stock_code
            HAVING SUM(net_vol) != 0 OR SUM(net_val) != 0
        """)
        rows = remote_db.execute(holdings_query, {"broker": broker_upper, "min_date": min_date}).fetchall()
        
        holdings = []
        for r in rows:
            holdings.append({
                "saham": r[0].upper(),
                "total_buy_vol": int(r[1]) if r[1] is not None else 0,
                "total_sell_vol": int(r[2]) if r[2] is not None else 0,
                "net_vol": int(r[3]) if r[3] is not None else 0,
                "net_val": float(r[4]) if r[4] is not None else 0.0
            })
            
        return {"success": True, "holdings": holdings}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query broker holdings: {str(e)}")

@router.get("/idx/dates")
def get_idx_dates(remote_db: Session = Depends(get_remote_db)):
    try:
        query = text("""
            SELECT DISTINCT trade_date 
            FROM transactions 
            ORDER BY trade_date DESC 
            LIMIT 30
        """)
        rows = remote_db.execute(query).fetchall()
        dates = [r[0].strftime("%Y-%m-%d") if isinstance(r[0], (datetime.date, datetime.datetime)) else str(r[0]) for r in rows]
        return {"success": True, "dates": dates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query trading dates: {str(e)}")

@router.get("/broker-data/{broker_code}")
def get_broker_data(
    broker_code: str,
    symbol: Optional[str] = None,
    limit: int = 50,
    remote_db: Session = Depends(get_remote_db)
):
    broker_upper = broker_code.upper().strip()
    
    try:
        if symbol:
            symbol_upper = symbol.upper().strip()
            query = text("""
                SELECT 
                    trade_date,
                    stock_code,
                    buy_vol,
                    sell_vol,
                    net_val
                FROM transactions
                WHERE broker_code = :broker
                  AND stock_code = :symbol
                ORDER BY trade_date DESC
                LIMIT :limit
            """)
            rows = remote_db.execute(query, {"broker": broker_upper, "symbol": symbol_upper, "limit": limit}).fetchall()
        else:
            query = text("""
                SELECT 
                    trade_date,
                    stock_code,
                    buy_vol,
                    sell_vol,
                    net_val
                FROM transactions
                WHERE broker_code = :broker
                ORDER BY trade_date DESC
                LIMIT :limit
            """)
            rows = remote_db.execute(query, {"broker": broker_upper, "limit": limit}).fetchall()
            
        data = []
        for r in rows:
            dt_str = r[0].strftime("%Y-%m-%d") if isinstance(r[0], (datetime.date, datetime.datetime)) else str(r[0])
            data.append({
                "date": dt_str,
                "symbol": r[1].upper(),
                "buyVol": int(r[2]) if r[2] is not None else 0,
                "sellVol": int(r[3]) if r[3] is not None else 0,
                "netValue": float(r[4]) if r[4] is not None else 0.0
            })
            
        ihsg_query = text("""
            SELECT trade_date, close_index 
            FROM index_daily 
            WHERE index_code IN ('IHSG', 'COMPOSITE') AND trade_date >= :min_date
            ORDER BY trade_date ASC
        """)
        ihsg_rows = db.execute(ihsg_query, {"min_date": min_date}).fetchall()
        ihsg_history = []
        for r in ihsg_rows:
            ihsg_history.append({
                "tanggal_perdagangan_terakhir": str(r[0]),
                "penutupan": float(r[1] or 0)
            })
            
        return {"success": True, "data": data, "ihsg_history": ihsg_history}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query broker data: {str(e)}")

@router.get("/idx/top-gainers")
def get_idx_top_gainers(limit: int = 15, db: Session = Depends(get_remote_db)):
    try:
        date_query = text("SELECT MAX(trade_date) FROM stock_daily")
        target_date = db.execute(date_query).scalar()
        
        if not target_date:
            return {"success": True, "gainers": []}
            
        query = text("""
            SELECT 
                stock_code as symbol,
                stock_name as company_name,
                trade_date as trade_date,
                open_price,
                close_price as current_price,
                high_price,
                low_price,
                volume,
                prev_price as previous_close,
                change_price as change,
                CASE 
                    WHEN prev_price IS NULL OR prev_price = 0 THEN 0
                    ELSE (change_price / prev_price) * 100 
                END as change_percent
            FROM stock_daily
            WHERE trade_date = :target_date
              AND close_price > 0
              AND prev_price > 0
            ORDER BY change_percent DESC
            LIMIT :limit
        """)
        
        rows = db.execute(query, {"target_date": target_date, "limit": limit}).fetchall()
        gainers = []
        for r in rows:
            gainers.append({
                "symbol": r[0],
                "company_name": r[1],
                "currentPrice": float(r[4]) if r[4] is not None else 0.0,
                "openPrice": float(r[3]) if r[3] is not None else 0.0,
                "highPrice": float(r[5]) if r[5] is not None else 0.0,
                "lowPrice": float(r[6]) if r[6] is not None else 0.0,
                "previousClose": float(r[8]) if r[8] is not None else 0.0,
                "change": float(r[9]) if r[9] is not None else 0.0,
                "changePercent": float(r[10]) if r[10] is not None else 0.0,
                "volume": int(r[7]) if r[7] is not None else 0,
                "tradeDate": r[2]
            })
            
        return {
            "success": True,
            "source": "PostgreSQL Database (VPS3)",
            "date": target_date,
            "total": len(gainers),
            "gainers": gainers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query top gainers: {str(e)}")

@router.get("/idx/top-losers")
def get_idx_top_losers(limit: int = 15, db: Session = Depends(get_remote_db)):
    try:
        date_query = text("SELECT MAX(trade_date) FROM stock_daily")
        target_date = db.execute(date_query).scalar()
        
        if not target_date:
            return {"success": True, "losers": []}
            
        query = text("""
            SELECT 
                stock_code as symbol,
                stock_name as company_name,
                trade_date as trade_date,
                open_price,
                close_price as current_price,
                high_price,
                low_price,
                volume,
                prev_price as previous_close,
                change_price as change,
                CASE 
                    WHEN prev_price IS NULL OR prev_price = 0 THEN 0
                    ELSE (change_price / prev_price) * 100 
                END as change_percent
            FROM stock_daily
            WHERE trade_date = :target_date
              AND close_price > 0
              AND prev_price > 0
            ORDER BY change_percent ASC
            LIMIT :limit
        """)
        
        rows = db.execute(query, {"target_date": target_date, "limit": limit}).fetchall()
        losers = []
        for r in rows:
            losers.append({
                "symbol": r[0],
                "company_name": r[1],
                "currentPrice": float(r[4]) if r[4] is not None else 0.0,
                "openPrice": float(r[3]) if r[3] is not None else 0.0,
                "highPrice": float(r[5]) if r[5] is not None else 0.0,
                "lowPrice": float(r[6]) if r[6] is not None else 0.0,
                "previousClose": float(r[8]) if r[8] is not None else 0.0,
                "change": float(r[9]) if r[9] is not None else 0.0,
                "changePercent": float(r[10]) if r[10] is not None else 0.0,
                "volume": int(r[7]) if r[7] is not None else 0,
                "tradeDate": r[2]
            })
            
        return {
            "success": True,
            "source": "PostgreSQL Database (VPS3)",
            "date": target_date,
            "total": len(losers),
            "losers": losers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query top losers: {str(e)}")

@router.get("/fundamental/{symbol}/{market}")
@router.get("/fundamental/{symbol}")
def get_fundamental(symbol: str, market: str = "idx", remote_db: Session = Depends(get_remote_db)):
    symbol_upper = symbol.upper().strip()
    try:
        query = text("""
            SELECT 
                pe_ratio, eps, dividend_yield, return_on_equity, price_to_book_ratio
            FROM stock_fundamental
            WHERE stock_code = :symbol
        """)
        row = remote_db.execute(query, {"symbol": symbol_upper}).fetchone()
        
        if row:
            per = float(row[0]) if row[0] is not None else 0.0
            eps = float(row[1]) if row[1] is not None else 0.0
            div_yield = float(row[2]) if row[2] is not None else 0.0
            roe = float(row[3]) if row[3] is not None else 0.0
            pbv = float(row[4]) if row[4] is not None else 0.0
        else:
            per, eps, div_yield, roe, pbv = 0.0, 0.0, 0.0, 0.0, 0.0

        return {
            "success": True,
            "data": {
                "symbol": symbol_upper,
                "eps": eps,
                "per": per,
                "pbv": pbv,
                "roe": roe,
                "dividendYield": div_yield,
                "market": market,
                "reportDate": datetime.datetime.now().strftime("%Y-%m-%d")
            }
        }
    except Exception as e:
        print(f"Failed to fetch fundamental data: {str(e)}")
        return {
            "success": False,
            "data": None,
            "error": str(e)
        }

@router.get("/trend/{symbol}/{market}")
@router.get("/trend/{symbol}")
def get_trend(symbol: str, market: str = "idx"):
    # Dummy trend data to prevent frontend errors
    symbol_upper = symbol.upper().strip()
    return {
        "success": True,
        "symbol": symbol_upper,
        "trend_data": {
            "labels": ["2023-Q1", "2023-Q2", "2023-Q3", "2023-Q4", "2024-Q1"],
            "datasets": [
                {
                    "label": "EPS",
                    "data": [100, 110, 105, 120, 125],
                    "borderColor": "rgba(59, 130, 246, 1)",
                    "backgroundColor": "rgba(59, 130, 246, 0.5)",
                    "yAxisID": "y"
                },
                {
                    "label": "ROE (%)",
                    "data": [12, 12.5, 13, 14, 14.5],
                    "borderColor": "rgba(16, 185, 129, 1)",
                    "backgroundColor": "rgba(16, 185, 129, 0.5)",
                    "yAxisID": "y1"
                }
            ]
        }
    }

@router.get("/market-overview")
def get_market_overview(db: Session = Depends(get_remote_db)):
    """
    Returns market overview data for DashboardPage with correct field names.
    """
    indices = []
    ihsg_chart = []
    brokers = []

    # 1. Get latest IHSG (COMPOSITE) and LQ45 with change vs previous day
    try:
        max_date_row = db.execute(text("SELECT MAX(trade_date) FROM index_daily")).scalar()
        if max_date_row:
            idx_query = text("""
                SELECT a.index_code, a.close_index, b.close_index as prev_close
                FROM index_daily a
                LEFT JOIN index_daily b
                  ON b.index_code = a.index_code
                 AND b.trade_date = (
                     SELECT MAX(trade_date) FROM index_daily
                     WHERE index_code = a.index_code AND trade_date < a.trade_date
                 )
                WHERE a.trade_date = :max_date
                  AND a.index_code IN ('COMPOSITE', 'LQ45')
            """)
            idx_rows = db.execute(idx_query, {"max_date": max_date_row}).fetchall()
            for row in idx_rows:
                code = row[0]
                close = float(row[1]) if row[1] is not None else 0.0
                prev = float(row[2]) if row[2] is not None else close
                chg = close - prev
                chg_pct = (chg / prev * 100.0) if prev > 0 else 0.0
                display_name = "IHSG" if code == "COMPOSITE" else code
                indices.append({
                    "name": display_name,
                    "value": round(close, 2),
                    "change": round(chg, 2),
                    "changePercent": round(chg_pct, 2)
                })
    except Exception as e:
        print(f"[market-overview] Index query failed: {e}")

    if not indices:
        indices = [
            {"name": "IHSG", "value": 7200.0, "change": 25.0, "changePercent": 0.35},
            {"name": "LQ45", "value": 980.0, "change": 5.0, "changePercent": 0.51}
        ]

    # 2. Get IHSG 30-day chart
    try:
        chart_query = text("""
            SELECT trade_date, close_index
            FROM index_daily
            WHERE index_code = 'COMPOSITE'
            ORDER BY trade_date DESC
            LIMIT 30
        """)
        chart_rows = db.execute(chart_query).fetchall()
        for cr in reversed(chart_rows):
            dt_val = cr[0]
            dt_str = dt_val.strftime("%Y-%m-%d") if isinstance(dt_val, (datetime.date, datetime.datetime)) else str(dt_val)
            ihsg_chart.append({
                "date": dt_str,
                "value": float(cr[1]) if cr[1] is not None else 0.0
            })
    except Exception as e:
        print(f"[market-overview] Chart query failed: {e}")

    # 3. Get top 10 brokers by total buy volume on latest trading day
    try:
        max_tx_date = db.execute(text("SELECT MAX(trade_date) FROM transactions")).scalar()
        if max_tx_date:
            broker_query = text("""
                SELECT
                    t.broker_code,
                    COALESCE(b.broker_name, t.broker_code) as broker_name,
                    SUM(t.buy_vol) as total_buy_vol,
                    SUM(t.sell_vol) as total_sell_vol,
                    SUM(t.net_vol) as net_vol,
                    SUM(t.net_val) as net_val
                FROM transactions t
                LEFT JOIN brokers b ON UPPER(t.broker_code) = UPPER(b.broker_code)
                WHERE t.trade_date = :max_date
                GROUP BY t.broker_code, b.broker_name
                ORDER BY SUM(t.buy_vol) DESC
                LIMIT 10
            """)
            broker_rows = db.execute(broker_query, {"max_date": max_tx_date}).fetchall()
            total_vol = sum((int(r[2] or 0) + int(r[3] or 0)) for r in broker_rows) or 1
            for br in broker_rows:
                buy_vol = int(br[2]) if br[2] is not None else 0
                sell_vol = int(br[3]) if br[3] is not None else 0
                vol = buy_vol + sell_vol
                share = round(vol / total_vol * 100, 2)
                brokers.append({
                    "name": br[1] if br[1] else br[0],
                    "code": br[0],
                    "volume": vol,
                    "netVol": int(br[4]) if br[4] is not None else 0,
                    "netVal": float(br[5]) if br[5] is not None else 0.0,
                    "marketShare": share
                })
    except Exception as e:
        print(f"[market-overview] Broker query failed: {e}")

    return {
        "success": True,
        "data": {
            "indices": indices,
            "ihsgChart": ihsg_chart,
            "brokers": brokers,
            "total_stocks": 850,
            "total_volume": sum(b["volume"] for b in brokers) if brokers else 15000000,
        }
    }

@router.post("/ai/analyze")
def ai_analyze(payload: AnalyzeRequest, current_user: User = Depends(get_current_user), remote_db: Session = Depends(get_remote_db)):
    if current_user.ai_quota <= 0:
        return {"success": False, "error": "AI quota exceeded. Please upgrade your plan."}
        
    symbol_upper = payload.symbol.upper().strip()
    
    # 1. Gather basic stock data to feed the AI
    stock_info = ""
    try:
        query = text("""
            SELECT trade_date, close_price, volume
            FROM stock_daily
            WHERE stock_code = :symbol
            ORDER BY trade_date DESC LIMIT 5
        """)
        rows = remote_db.execute(query, {"symbol": symbol_upper}).fetchall()
        if rows:
            stock_info = f"Recent 5 days data for {symbol_upper}:\n"
            for r in rows:
                stock_info += f"- Date: {r[0]}, Close: {r[1]}, Vol: {r[2]}\n"
        else:
            stock_info = f"No recent market data found for {symbol_upper}.\n"
    except Exception as e:
        stock_info = f"Error fetching market data for {symbol_upper}.\n"

    system_prompt = f"""You are an expert AI Stock Analyst for the Indonesian Stock Exchange (IDX).
The user is asking about the stock {symbol_upper}.
Market Data Context:
{stock_info}

Analyze the stock based on the user's question. Provide a comprehensive analysis.
You MUST output your response in valid JSON format ONLY, exactly matching this structure:
{{
  "success": true,
  "analysis": {{
    "investment_thesis": "Your detailed response to the user's question, using Markdown for formatting if needed.",
    "sentiment": "Overall market sentiment (e.g., Bullish, Bearish, Neutral)",
    "recommendation": "Buy / Hold / Sell",
    "risk_level": "low" | "medium" | "high",
    "key_factors": ["Point 1", "Point 2", "Point 3"],
    "price_prediction": "Short prediction of future movement"
  }},
  "data_summary": {{
    "technical_points": 5,
    "fundamental_points": 5,
    "news_articles": 0,
    "overall_sentiment": "Neutral"
  }}
}}
Do not include markdown code blocks like ```json around the response, output only the raw JSON object.
"""

    if not settings.OPENROUTER_API_KEY:
        return {"success": False, "error": "OpenRouter API Key not configured on the server."}
        
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://idx.mytriv.com",
        "X-Title": "SinyalIDX",
        "Content-Type": "application/json"
    }
    
    api_payload = {
        "model": settings.AI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": payload.question}
        ],
        "response_format": {"type": "json_object"}
    }
    
    try:
        response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=api_payload, timeout=30)
        response.raise_for_status()
        result_content = response.json()["choices"][0]["message"]["content"]
        
        # Parse the JSON response from AI
        import json
        ai_response = json.loads(result_content)
        
        # Deduct quota (optional logic here)
        # current_user.ai_quota -= 1
        # db.commit()
        
        return ai_response
    except Exception as e:
        print(f"OpenRouter Error: {str(e)}")
        return {"success": False, "error": f"AI Service Error: {str(e)}"}





@router.get("/search/{query}")
def search_stocks(query: str, db: Session = Depends(get_remote_db)):
    query = query.strip().upper()
    if not query:
        return {"success": True, "results": []}
        
    try:
        sql = text("""
            SELECT stock_code, MAX(stock_name) as name, 'General' as sector 
            FROM stock_daily 
            WHERE stock_code ILIKE :q OR stock_name ILIKE :q
            GROUP BY stock_code
            ORDER BY stock_code ASC
            LIMIT 10
        """)
        rows = db.execute(sql, {"q": f"%{query}%"}).fetchall()
        
        results = []
        for r in rows:
            results.append({
                "symbol": r[0],
                "name": r[1] if r[1] else "",
                "sector": r[2] if r[2] else "General"
            })
            
        if not results:
            fallback = [
                {"symbol": "BBCA", "name": "Bank Central Asia Tbk.", "sector": "Finance"},
                {"symbol": "BBRI", "name": "Bank Rakyat Indonesia (Persero) Tbk.", "sector": "Finance"},
                {"symbol": "BMRI", "name": "Bank Mandiri (Persero) Tbk.", "sector": "Finance"},
                {"symbol": "BBNI", "name": "Bank Negara Indonesia (Persero) Tbk.", "sector": "Finance"},
                {"symbol": "TLKM", "name": "Telkom Indonesia (Persero) Tbk.", "sector": "Infrastructures"},
                {"symbol": "ASII", "name": "Astra International Tbk.", "sector": "Industrials"},
                {"symbol": "GOTO", "name": "GoTo Gojek Tokopedia Tbk.", "sector": "Technology"}
            ]
            results = [s for s in fallback if query in s["symbol"] or query in s["name"].upper()]
            
        return {"success": True, "results": results}
    except Exception as e:
        print(f"Search error: {str(e)}")
        return {"success": False, "error": str(e), "results": []}

@router.get("/index")
def get_index_data(period: str = "1week", db: Session = Depends(get_remote_db)):
    try:
        from datetime import datetime, timedelta
        days = 1 if period == "1day" else 7 if period == "1week" else 30 if period == "1month" else 90
        min_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        query = text("""
            WITH latest_dates AS (
                SELECT index_code, MAX(trade_date) as max_date
                FROM index_daily
                GROUP BY index_code
            )
            SELECT 
                a.index_code, 
                a.close_index, 
                COALESCE(b.close_index, a.close_index) as prev_close,
                a.volume, 
                a.value, 
                a.frequency,
                a.trade_date,
                a.market_cap
            FROM index_daily a
            JOIN latest_dates ld ON a.index_code = ld.index_code AND a.trade_date = ld.max_date
            LEFT JOIN index_daily b
              ON b.index_code = a.index_code
             AND b.trade_date = (
                 SELECT MAX(trade_date) FROM index_daily
                 WHERE index_code = a.index_code AND trade_date < a.trade_date
             )
            ORDER BY a.volume DESC NULLS LAST
            LIMIT 50
        """)
        rows = db.execute(query).fetchall()
        data = []
        for r in rows:
            close_idx = float(r[1] or 0)
            prev_close = float(r[2] or 0)
            data.append({
                "kode_indeks": r[0],
                "penutupan": close_idx,
                "selisih": close_idx - prev_close,
                "volume": float(r[3] or 0),
                "nilai": float(r[4] or 0),
                "frekuensi": float(r[5] or 0),
                "tanggal_perdagangan_terakhir": str(r[6]) if r[6] else datetime.now().isoformat(),
                "kapitalisasi_pasar": float(r[7] or 0)
            })
        ihsg_query = text("""
            SELECT trade_date, close_index 
            FROM index_daily 
            WHERE index_code IN ('IHSG', 'COMPOSITE') AND trade_date >= :min_date
            ORDER BY trade_date ASC
        """)
        ihsg_rows = db.execute(ihsg_query, {"min_date": min_date}).fetchall()
        ihsg_history = []
        for r in ihsg_rows:
            ihsg_history.append({
                "tanggal_perdagangan_terakhir": str(r[0]),
                "penutupan": float(r[1] or 0)
            })
            
        return {"success": True, "data": data, "ihsg_history": ihsg_history}
    except Exception as e:
        print(f"Error /index: {e}")
        return {"success": False, "data": []}

@router.get("/broker")
def get_broker_data(period: str = "1week", db: Session = Depends(get_remote_db)):
    try:
        from datetime import datetime, timedelta
        days = 1 if period == "1day" else 7 if period == "1week" else 30 if period == "1month" else 90
        min_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        query = text("""
            SELECT 
                t.broker_code, 
                MAX(b.broker_name) as broker_name,
                SUM(t.buy_vol + t.sell_vol) as volume,
                SUM(t.buy_val + t.sell_val) as nilai,
                SUM(t.buy_freq + t.sell_freq) as frekuensi,
                MAX(t.trade_date) as tanggal
            FROM transactions t
            LEFT JOIN brokers b ON UPPER(t.broker_code) = UPPER(b.broker_code)
            WHERE t.trade_date >= :min_date
            GROUP BY t.broker_code
            ORDER BY volume DESC
            LIMIT 50
        """)
        rows = db.execute(query, {"min_date": min_date}).fetchall()
        data = []
        for r in rows:
            data.append({
                "kode_broker": r[0],
                "nama_perusahaan": r[1] or r[0],
                "volume": float(r[2] or 0),
                "nilai": float(r[3] or 0),
                "frekuensi": float(r[4] or 0),
                "tanggal": str(r[5]) if r[5] else datetime.now().isoformat()
            })
        ihsg_query = text("""
            SELECT trade_date, close_index 
            FROM index_daily 
            WHERE index_code IN ('IHSG', 'COMPOSITE') AND trade_date >= :min_date
            ORDER BY trade_date ASC
        """)
        ihsg_rows = db.execute(ihsg_query, {"min_date": min_date}).fetchall()
        ihsg_history = []
        for r in ihsg_rows:
            ihsg_history.append({
                "tanggal_perdagangan_terakhir": str(r[0]),
                "penutupan": float(r[1] or 0)
            })
            
        return {"success": True, "data": data, "ihsg_history": ihsg_history}
    except Exception as e:
        print(f"Error /broker: {e}")
        return {"success": False, "data": []}

@router.get("/top-brokers")
def get_top_brokers(days: int = 30, limit: int = 15, db: Session = Depends(get_remote_db)):
    try:
        from datetime import datetime, timedelta
        min_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        query = text("""
            SELECT 
                t.broker_code, 
                MAX(b.broker_name) as broker_name,
                SUM(t.buy_vol) as total_buy, 
                SUM(t.sell_vol) as total_sell, 
                SUM(t.net_vol) as net_volume,
                SUM(t.buy_vol) + SUM(t.sell_vol) as total_volume
            FROM transactions t
            LEFT JOIN brokers b ON UPPER(t.broker_code) = UPPER(b.broker_code)
            WHERE t.trade_date >= :min_date
            GROUP BY t.broker_code
            ORDER BY net_volume DESC
            LIMIT :limit
        """)
        
        rows = db.execute(query, {"min_date": min_date, "limit": limit}).fetchall()
        
        brokers = []
        for idx, row in enumerate(rows):
            brokers.append({
                "rank": idx + 1,
                "brokerCode": row[0],
                "brokerName": row[1] or row[0],
                "totalBuy": float(row[2] or 0),
                "totalSell": float(row[3] or 0),
                "netVolume": float(row[4] or 0),
                "totalVolume": float(row[5] or 0),
                "netPercent": (float(row[4] or 0) / float(row[2] or 1) * 100) if float(row[2] or 0) > 0 else 0
            })
            
        return {"success": True, "period": f"{days} days", "brokers": brokers}
    except Exception as e:
        print(f"[top-brokers] Error: {e}")
        return {"success": False, "error": str(e), "brokers": []}

@router.get("/{symbol}/orderbook")
def get_orderbook(symbol: str, remote_db: Session = Depends(get_remote_db)):
    """Simulated Order Book Generator"""
    symbol = symbol.upper()
    # Get base price from DB or default to 1000
    try:
        row = remote_db.execute(
            text("SELECT close_price FROM stock_daily WHERE stock_code = :sym ORDER BY trade_date DESC LIMIT 1"),
            {"sym": symbol}
        ).fetchone()
        base_price = int(row[0]) if row and row[0] is not None else 1000
    except Exception as db_err:
        print(f"Error querying base price: {db_err}")
        base_price = 1000

    # Fraction logic based on IDX
    if base_price < 200:
        tick = 1
    elif base_price < 500:
        tick = 2
    elif base_price < 2000:
        tick = 5
    elif base_price < 5000:
        tick = 10
    else:
        tick = 25

    orderbook = []
    # Generate 10 levels
    for i in range(10):
        bid_price = base_price - (tick * i)
        offer_price = base_price + (tick * (i + 1))
        
        row = {
            "bid": bid_price,
            "bLot": random.randint(100, 50000),
            "bFreq": random.randint(5, 500),
            "offer": offer_price,
            "oLot": random.randint(100, 50000),
            "oFreq": random.randint(5, 500)
        }
        orderbook.append(row)
        
    return {"status": "success", "data": orderbook}
