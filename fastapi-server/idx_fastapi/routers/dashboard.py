from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
import datetime
from typing import List, Dict, Any

from ..database import get_local_db, get_remote_db
from .auth import get_current_user
from ..models import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard Summary"])

@router.get("/summary")
def get_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_local_db),
    remote_db: Session = Depends(get_remote_db)
):
    try:
        user_id = current_user.id
        email = current_user.email
        username = email.split("@")[0] if email else "user"
        
        # 1. Get local portfolio holdings
        portfolio_query = text("""
            SELECT symbol, qty, avg_price 
            FROM virtual_portfolio 
            WHERE user_id = :user_id AND qty > 0
        """)
        portfolio_rows = db.execute(portfolio_query, {"user_id": user_id}).fetchall()
        
        portfolio = []
        total_value = 0.0
        total_investment = 0.0
        top_performers = []
        
        for r in portfolio_rows:
            symbol = r[0]
            qty = r[1]
            avg_price = float(r[2]) if r[2] is not None else 0.0
            
            # Get latest price from remote stock_daily
            price_query = text("""
                SELECT close_price 
                FROM stock_daily 
                WHERE stock_code = :symbol
                ORDER BY trade_date DESC
                LIMIT 1
            """)
            price_row = remote_db.execute(price_query, {"symbol": symbol.upper()}).fetchone()
            current_price = float(price_row[0]) if price_row and price_row[0] is not None else avg_price
            
            buy_val = qty * avg_price
            market_val = qty * current_price
            gain_loss = market_val - buy_val
            gain_loss_percent = (gain_loss / buy_val * 100.0) if buy_val > 0 else 0.0
            
            total_investment += buy_val
            total_value += market_val
            
            # Fetch company name if available from remote stock_daily
            comp_query = text('SELECT stock_name FROM stock_daily WHERE stock_code = :symbol LIMIT 1')
            comp_row = remote_db.execute(comp_query, {"symbol": symbol.upper()}).fetchone()
            comp_name = comp_row[0] if comp_row else symbol
            
            item = {
                "symbol": symbol,
                "company_name": comp_name,
                "avg_price": avg_price,
                "current_price": current_price,
                "gain_loss": gain_loss,
                "gain_loss_percent": gain_loss_percent,
                "quantity": qty,
                "sector": "Finansial" if symbol.upper().startswith("B") else "Teknologi" if symbol.upper().startswith("G") else "Lainnya"
            }
            portfolio.append(item)
            top_performers.append(item)
            
        # Sort by gain/loss percent and slice top 3
        top_performers.sort(key=lambda x: x["gain_loss_percent"], reverse=True)
        top3_performers = top_performers[:3]
        
        total_gain_loss = total_value - total_investment
        total_gain_loss_percent = (total_gain_loss / total_investment * 100.0) if total_investment > 0 else 0.0
        
        # 2. Get local watchlist symbols, then fetch current prices from remote stock_daily
        watchlist_local_query = text("""
            SELECT symbol 
            FROM user_watchlist 
            WHERE user_id = :user_id
            ORDER BY added_at DESC
        """)
        watchlist_local = db.execute(watchlist_local_query, {"user_id": user_id}).fetchall()
        watchlist_symbols = [w[0] for w in watchlist_local]
        
        watchlist = []
        if watchlist_symbols:
            watchlist_query = text("""
                SELECT stock_code, close_price, change_price, prev_price, stock_name
                FROM stock_daily
                WHERE stock_code = ANY(:symbols)
                  AND trade_date = (SELECT MAX(trade_date) FROM stock_daily)
            """)
            watchlist_rows = remote_db.execute(watchlist_query, {"symbols": watchlist_symbols}).fetchall()
            for w in watchlist_rows:
                sym = w[0]
                curr_price = float(w[1]) if w[1] is not None else 0.0
                change = float(w[2]) if w[2] is not None else 0.0
                prev_price = float(w[3]) if w[3] is not None else 0.0
                comp_name = w[4] if w[4] else sym
                
                change_percent = (change / prev_price * 100.0) if prev_price > 0 else 0.0
                
                watchlist.append({
                    "symbol": sym,
                    "company_name": comp_name,
                    "current_price": curr_price,
                    "change": change,
                    "change_percent": change_percent
                })
            
        # 3. Get recent transactions (last 5)
        tx_query = text("""
            SELECT symbol, type, qty, price, total_amount, transaction_date 
            FROM virtual_transactions 
            WHERE user_id = :user_id 
            ORDER BY transaction_date DESC
            LIMIT 5
        """)
        tx_rows = db.execute(tx_query, {"user_id": user_id}).fetchall()
        transactions = []
        for t in tx_rows:
            dt_val = t[5]
            dt_str = dt_val.strftime("%Y-%m-%d %H:%M:%S") if isinstance(dt_val, (datetime.date, datetime.datetime)) else str(dt_val)
            transactions.append({
                "date": dt_str,
                "symbol": t[0],
                "type": t[1],
                "quantity": t[2],
                "price": float(t[3]) if t[3] is not None else 0.0,
                "total_amount": float(t[4]) if t[4] is not None else 0.0
            })
            
        # 4. Get market indices from remote index_daily (IHSG as COMPOSITE, and LQ45)
        indices = []
        try:
            indices_query = text("""
                WITH ordered_indices AS (
                    SELECT 
                        index_code,
                        trade_date,
                        close_index,
                        LAG(close_index, 1) OVER (PARTITION BY index_code ORDER BY trade_date ASC) as prev_close
                    FROM index_daily
                    WHERE index_code IN ('COMPOSITE', 'LQ45')
                )
                SELECT 
                    index_code,
                    close_index,
                    (close_index - prev_close) as change_val,
                    ((close_index - prev_close) / prev_close * 100.0) as change_percent
                FROM ordered_indices
                WHERE trade_date = (SELECT MAX(trade_date) FROM index_daily)
            """)
            indices_rows = remote_db.execute(indices_query).fetchall()
            for ind in indices_rows:
                code = ind[0]
                sym = "IHSG" if code == "COMPOSITE" else "LQ45"
                prc = float(ind[1]) if ind[1] is not None else 0.0
                chg = float(ind[2]) if ind[2] is not None else 0.0
                chg_pct = float(ind[3]) if ind[3] is not None else 0.0
                indices.append({
                    "symbol": sym,
                    "price": prc,
                    "change": chg,
                    "change_percent": chg_pct
                })
        except Exception as idx_err:
            print(f"Index query failed: {str(idx_err)}")
            indices = [
                { "symbol": 'IHSG', "price": 7200.0, "change": 25.0, "change_percent": 0.35 },
                { "symbol": 'LQ45', "price": 980.0, "change": 5.0, "change_percent": 0.51 }
            ]
            
        # 5. Get trending stocks (top 5 by volume) from remote stock_daily
        trending = []
        try:
            trending_query = text("""
                SELECT stock_code, stock_name, close_price, volume, change_price, prev_price
                FROM stock_daily
                WHERE trade_date = (SELECT MAX(trade_date) FROM stock_daily)
                  AND volume > 0
                ORDER BY volume DESC
                LIMIT 5
            """)
            trending_rows = remote_db.execute(trending_query).fetchall()
            for tr in trending_rows:
                sym = tr[0]
                comp = tr[1]
                prc = float(tr[2]) if tr[2] is not None else 0.0
                vol = int(tr[3]) if tr[3] is not None else 0
                chg = float(tr[4]) if tr[4] is not None else 0.0
                prev = float(tr[5]) if tr[5] is not None else 0.0
                chg_pct = (chg / prev * 100.0) if prev > 0 else 0.0
                trending.append({
                    "symbol": sym,
                    "company_name": comp if comp else sym,
                    "price": prc,
                    "volume": vol,
                    "change": chg,
                    "change_percent": chg_pct
                })
        except Exception as trend_err:
            print(f"Trending query failed: {str(trend_err)}")
            
        # 6. Get IHSG chart (last 30 days) from remote index_daily
        ihsg_chart = []
        try:
            ihsg_chart_query = text("""
                SELECT trade_date, close_index
                FROM index_daily
                WHERE index_code = 'COMPOSITE'
                ORDER BY trade_date DESC
                LIMIT 30
            """)
            chart_rows = remote_db.execute(ihsg_chart_query).fetchall()
            for cr in reversed(chart_rows):
                ihsg_chart.append({
                    "date": cr[0],
                    "price": float(cr[1]) if cr[1] is not None else 0.0
                })
        except Exception as chart_err:
            print(f"Chart query failed: {str(chart_err)}")
            
        return {
            "success": True,
            "data": {
                "user": {
                    "id": user_id,
                    "email": email,
                    "username": username
                },
                "portfolio": {
                    "stocks": portfolio,
                    "summary": {
                        "total_value": round(total_value, 2),
                        "total_investment": round(total_investment, 2),
                        "total_gain_loss": round(total_gain_loss, 2),
                        "total_gain_loss_percent": round(total_gain_loss_percent, 2),
                        "top_performers": top3_performers
                    }
                },
                "watchlist": watchlist,
                "transactions": transactions,
                "market_data": {
                    "indices": indices,
                    "trending": trending,
                    "ihsg_chart": ihsg_chart
                },
                "ai_quota": {
                    "remaining": getattr(current_user, "ai_quota", 10),
                    "used": 10 - getattr(current_user, "ai_quota", 10)
                }
            },
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch summary: {str(e)}")

@router.get("/portfolio-allocation")
def get_portfolio_allocation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_local_db),
    remote_db: Session = Depends(get_remote_db)
):
    try:
        user_id = current_user.id
        
        # 1. Get user holdings from local
        holdings_local = db.execute(text("""
            SELECT symbol, qty FROM virtual_portfolio 
            WHERE user_id = :user_id AND qty > 0
        """), {"user_id": user_id}).fetchall()
        
        sector_allocation = {}
        total_value = 0.0
        
        if holdings_local:
            symbols = [h[0] for h in holdings_local]
            qty_map = {h[0]: h[1] for h in holdings_local}
            
            # Fetch latest prices from remote stock_daily
            price_query = text("""
                SELECT stock_code, close_price
                FROM stock_daily
                WHERE stock_code = ANY(:symbols)
                  AND trade_date = (SELECT MAX(trade_date) FROM stock_daily)
            """)
            rows = remote_db.execute(price_query, {"symbols": symbols}).fetchall()
            for r in rows:
                symbol = r[0]
                qty = qty_map[symbol]
                current_price = float(r[1]) if r[1] is not None else 0.0
                value = current_price * qty
                
                # Simple sector classification based on typical sectors
                sector = "Finansial" if symbol.startswith("B") else "Teknologi" if symbol.startswith("G") else "Lainnya"
                
                sector_allocation[sector] = sector_allocation.get(sector, 0.0) + value
                total_value += value
            
        chart_data = []
        for sector, val in sector_allocation.items():
            percentage = (val / total_value * 100.0) if total_value > 0 else 0.0
            chart_data.append({
                "sector": sector,
                "value": round(val, 2),
                "percentage": round(percentage, 2)
            })
            
        chart_data.sort(key=lambda x: x["value"], reverse=True)
        
        return {
            "success": True,
            "data": {
                "by_sector": chart_data,
                "total_value": round(total_value, 2)
            },
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query allocation: {str(e)}")
