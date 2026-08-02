from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from database import get_remote_db

router = APIRouter()

def calculate_ema(prices, period):
    if not prices: return []
    k = 2 / (period + 1)
    ema = [prices[0]]
    for p in prices[1:]:
        ema.append(p * k + ema[-1] * (1 - k))
    return ema

@router.get("/sniper-lens/{symbol}")
def get_sniper_lens_data(symbol: str, db: Session = Depends(get_remote_db)):
    symbol_upper = symbol.upper().strip()
    try:
        # Fetch last 100 days for Technicals
        query = text("""
            SELECT trade_date, close_price
            FROM stock_daily
            WHERE stock_code = :symbol
            ORDER BY trade_date ASC
            LIMIT 100
        """)
        rows = db.execute(query, {"symbol": symbol_upper}).fetchall()
        
        if not rows:
            return {"success": False, "message": "No data found"}
            
        prices = [float(r[1]) for r in rows]
        current_price = prices[-1]
        
        # Calculate RSI 14
        rsi = 50
        if len(prices) > 15:
            gains = []
            losses = []
            for i in range(1, len(prices)):
                diff = prices[i] - prices[i-1]
                if diff > 0:
                    gains.append(diff)
                    losses.append(0)
                else:
                    gains.append(0)
                    losses.append(abs(diff))
            
            avg_gain = sum(gains[-14:]) / 14
            avg_loss = sum(losses[-14:]) / 14
            if avg_loss == 0:
                rsi = 100
            else:
                rs = avg_gain / avg_loss
                rsi = 100 - (100 / (1 + rs))
                
        # Calculate MACD
        macd_val, sig_val = 0, 0
        if len(prices) > 26:
            ema12 = calculate_ema(prices, 12)
            ema26 = calculate_ema(prices, 26)
            macd_line = [e12 - e26 for e12, e26 in zip(ema12, ema26)]
            signal_line = calculate_ema(macd_line, 9)
            macd_val = macd_line[-1]
            sig_val = signal_line[-1]
            
        # SuperTrend (Mocked based on MA50 for simplicity if no high/low available)
        trend_up = current_price > (sum(prices[-50:])/50) if len(prices) >= 50 else True
        st_level = (sum(prices[-50:])/50) if len(prices) >= 50 else current_price * 0.9

        # Fetch Broker Flow (last 30 transactions max)
        bf_query = text("""
            SELECT broker_code, SUM(buy_vol) as total_buy, SUM(sell_vol) as total_sell, 
                   SUM(buy_vol) - SUM(sell_vol) as net_vol
            FROM transactions
            WHERE stock_code = :symbol
            AND trade_date >= to_char(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')
            GROUP BY broker_code
            ORDER BY net_vol DESC
        """)
        
        # Fetch Signal Logs (Full one day - latest date)
        sig_query = text("""
            SELECT trade_date, signal_time, division, signal_type, last_price, volume
            FROM stock_signals
            WHERE stock_code = :symbol
            AND trade_date = (SELECT MAX(trade_date) FROM stock_signals WHERE stock_code = :symbol)
            ORDER BY signal_time DESC
        """)
        
        bf_rows = db.execute(bf_query, {"symbol": symbol_upper}).fetchall()
        sig_rows = db.execute(sig_query, {"symbol": symbol_upper}).fetchall()

        # Fetch 5-Day Chart Data
        chart_5d_query = text("""
            SELECT trade_date, signal_time, last_price, signal_type, division
            FROM stock_signals
            WHERE stock_code = :symbol
            AND trade_date >= COALESCE(
                (SELECT trade_date 
                 FROM (
                     SELECT DISTINCT trade_date 
                     FROM stock_signals 
                     WHERE stock_code = :symbol 
                     ORDER BY trade_date DESC 
                     LIMIT 5
                 ) sub
                 ORDER BY trade_date ASC LIMIT 1), 
                '1970-01-01'
            )
            ORDER BY trade_date ASC, signal_time ASC
        """)
        chart_5d_rows = db.execute(chart_5d_query, {"symbol": symbol_upper}).fetchall()
        
        broker_flow = []
        for r in bf_rows:
            broker_flow.append({
                "broker": r[0],
                "buy_vol": int(r[1] or 0),
                "sell_vol": int(r[2] or 0),
                "net_vol": int(r[3] or 0)
            })

        return {
            "success": True,
            "symbol": symbol_upper,
            "technical": {
                "current_price": current_price,
                "rsi": round(rsi, 2),
                "macd": round(macd_val, 4),
                "macd_signal": round(sig_val, 4),
                "trend_up": trend_up,
                "st_level": round(st_level, 2)
            },
            "broker_flow": broker_flow,
            "signal_logs": [
                {
                    "date": str(r[0]),
                    "time": str(r[1]),
                    "division": r[2],
                    "signal_type": r[3],
                    "price": float(r[4]) if r[4] else 0,
                    "volume": float(r[5]) if r[5] else 0
                } for r in sig_rows
            ],
            "chart_5d": [
                {
                    "date": str(r[0]),
                    "time": str(r[1]),
                    "datetime": f"{r[0]} {r[1]}",
                    "price": float(r[2]) if r[2] else 0,
                    "signal_type": r[3],
                    "division": r[4]
                } for r in chart_5d_rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
