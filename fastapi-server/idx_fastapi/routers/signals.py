from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from datetime import date, timedelta
from typing import Optional
from ..database import DBRouter, get_db, get_local_db, get_remote_db
from .auth import get_current_user
from ..models import User
from pydantic import BaseModel, EmailStr
import traceback, datetime

router = APIRouter(prefix="/signals", tags=["Signals"])

ENGINE_MAP = {
    8001: {"name": "KOMPAS VELOCITY", "type": "INTRADAY", "market": "IDX", "color": "#10b981", "table": "dca_scalp_trades", "col_sym": "stock_code"},
    8002: {"name": "MBX VELOCITY", "type": "INTRADAY", "market": "IDX", "color": "#3b82f6", "table": "dca_mbx_scalp_trades", "col_sym": "stock_code"},
    8003: {"name": "KOMPAS FORWARD", "type": "FORWARD", "market": "IDX", "color": "#f59e0b", "table": "dca_forward_trades", "col_sym": "stock_code"},
    8004: {"name": "MBX FORWARD", "type": "FORWARD", "market": "IDX", "color": "#8b5cf6", "table": "dca_mbx_forward_trades", "col_sym": "stock_code"},
    8005: {"name": "WALL STREET QUANT", "type": "US MARKET", "market": "US", "color": "#ef4444", "table": "alpaca_dca_trades", "col_sym": "symbol"},
}

ENGINE_IDS = list(ENGINE_MAP.keys())

class RegisterSignalUser(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str

def get_signal_access(current_user: Optional[User] = None):
    if not current_user:
        return {"level": "free", "daily_limit": 5}
    role = getattr(current_user, "role", "user") or "user"
    if role in ["premium", "pro", "enterprise", "admin", "superadmin"]:
        return {"level": "premium", "daily_limit": 999999}
    return {"level": "free", "daily_limit": 5}

def query_all_engines(remote_db, where_clause="", params=None):
    if params is None:
        params = {}
    parts = []
    for eid, info in ENGINE_MAP.items():
        sym_col = info["col_sym"]
        parts.append(
            f"SELECT {eid} as engine_id,"
            f"'{info['name']}' as engine_name,"
            f"'{info['color']}' as engine_color,"
            f"'{info['type']}' as engine_type,"
            f"{sym_col} as symbol, lots as quantity, buy_at as price, net_pnl, COALESCE(trade_time, buy_time) as trade_time"
            f" FROM {info['table']}"
        )
    sql = " UNION ALL ".join(parts)
    if where_clause:
        sql = f"SELECT * FROM ({sql}) as sub WHERE {where_clause}"
    return remote_db.execute(text(sql), params).fetchall()

def query_engine_stats(remote_db, engine_id, info):
    sym_col = info["col_sym"]
    result = remote_db.execute(text(f"""
        SELECT
            COUNT(*) AS total_trades,
            COUNT(DISTINCT {sym_col}) AS unique_symbols,
            MIN(buy_time) AS first_trade,
            MAX(buy_time) AS last_trade,
            COUNT(CASE WHEN trade_time::date = CURRENT_DATE THEN 1 END) AS today_trades,
            COALESCE(SUM(net_pnl), 0) AS total_pnl,
            COALESCE(SUM(buy_at * lots), 0) AS total_volume
        FROM {info['table']}
    """)).fetchone()
    return {
        "id": engine_id,
        "name": info["name"],
        "type": info["type"],
        "market": info["market"],
        "color": info["color"],
        "total_trades": result[0],
        "buys": result[0],
        "sells": result[0],
        "unique_symbols": result[1],
        "first_trade": str(result[2]) if result[2] else None,
        "last_trade": str(result[3]) if result[3] else None,
        "today_trades": result[4],
        "total_pnl": float(result[5]) if result[5] else 0,
        "total_volume": float(result[6]) if result[6] else 0,
        "buy_volume": float(result[6]) if result[6] else 0,
        "sell_volume": 0,
    }

def parse_row(r):
    return {
        "eid": r[0], "ename": r[1], "ecolor": r[2], "etype": r[3],
        "sym": r[4], "qty": float(r[5] or 0), "price": float(r[6] or 0),
        "pnl": float(r[7] or 0), "time": r[8],
    }

def query_portfolio_holdings(remote_db):
    sql = """
        SELECT COUNT(*) FROM dca_scalp_portfolio
        UNION ALL SELECT COUNT(*) FROM dca_mbx_scalp_portfolio
        UNION ALL SELECT COUNT(*) FROM dca_forward_portfolio
        UNION ALL SELECT COUNT(*) FROM dca_mbx_forward_portfolio
        UNION ALL SELECT COUNT(*) FROM alpaca_dca_portfolio
    """
    rows = remote_db.execute(text(sql)).fetchall()
    return sum(r[0] for r in rows), rows

@router.get("/engines")
def get_engines(remote_db=Depends(get_remote_db)):
    try:
        engines = []
        for eid, info in ENGINE_MAP.items():
            engines.append(query_engine_stats(remote_db, eid, info))
        return {"success": True, "data": engines}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
def get_global_stats(remote_db=Depends(get_remote_db)):
    try:
        rows = query_all_engines(remote_db)
        symbols = set()
        first = None
        last = None
        today = 0
        days_counted = set()
        day_map = {}
        total_pnl = 0.0
        for r in rows:
            d = parse_row(r)
            symbols.add(d["sym"])
            total_pnl += (d["pnl"] * 16250) if d["eid"] == 8005 else d["pnl"]
            if d["time"]:
                t = str(d["time"])
                day = t[:10]
                if day not in day_map:
                    day_map[day] = 0.0
                day_map[day] += (d["pnl"] * 16250) if d["eid"] == 8005 else d["pnl"]
                
                days_counted.add(day)
                if not first or t < first: first = t
                if not last or t > last: last = t
                if day == str(date.today()): today += 1

        total_holdings, per_engine = query_portfolio_holdings(remote_db)
        
        daily_pnls = list(day_map.values())
        win_days = sum(1 for p in daily_pnls if p > 0)
        loss_days = sum(1 for p in daily_pnls if p < 0)
        best_day = max(daily_pnls) if daily_pnls else 0

        return {
            "success": True,
            "data": {
                "total_orders_all_time": len(rows),
                "unique_symbols_all_time": len(symbols),
                "total_stocks_held": total_holdings,
                "today_orders": today,
                "first_trade_date": str(first)[:10] if first else None,
                "last_trade_date": str(last)[:10] if last else None,
                "active_engines": len(ENGINE_IDS),
                "trading_days": len(days_counted),
                "total_pnl": total_pnl,
                "strategy_win_days": win_days,
                "strategy_loss_days": loss_days,
                "best_day_pnl": best_day,
                "total_buy_volume": 0,
                "total_sell_volume": 0,
                "total_net_volume": 0,
                "engines": {str(k): {"name": v["name"], "type": v["type"], "market": v["market"], "color": v["color"]} for k, v in ENGINE_MAP.items()}
            }
        }
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/performance")
def get_performance(remote_db=Depends(get_remote_db)):
    try:
        rows = query_all_engines(remote_db)
        total = len(rows)
        symbols = set()
        total_vol = 0.0
        total_pnl = 0.0

        day_map = {}
        sym_map = {}
        for r in rows:
            d = parse_row(r)
            is_us = (d["eid"] == 8005)
            usd_rate = 16250
            pnl_idr = d["pnl"] * usd_rate if is_us else d["pnl"]
            vol_idr = (d["price"] * d["qty"]) * usd_rate if is_us else (d["price"] * d["qty"])

            symbols.add(d["sym"])
            total_vol += vol_idr
            total_pnl += pnl_idr

            day = str(d["time"])[:10] if d["time"] else "unknown"
            if day not in day_map:
                day_map[day] = {"total": 0, "symbols": set(), "engines": set(), "buy_vol": 0.0, "pnl": 0.0, "engine_pnl": {}}
            day_map[day]["total"] += 1
            day_map[day]["symbols"].add(d["sym"])
            day_map[day]["engines"].add(d["eid"])
            day_map[day]["buy_vol"] += vol_idr
            day_map[day]["pnl"] += pnl_idr
            
            if d["ename"] not in day_map[day]["engine_pnl"]:
                day_map[day]["engine_pnl"][d["ename"]] = 0.0
            day_map[day]["engine_pnl"][d["ename"]] += d["pnl"]

            if d["sym"] not in sym_map:
                sym_map[d["sym"]] = {"count": 0, "vol": 0.0, "pnl": 0.0}
            sym_map[d["sym"]]["count"] += 1
            sym_map[d["sym"]]["vol"] += vol_idr
            sym_map[d["sym"]]["pnl"] += pnl_idr

        daily_data = sorted(day_map.items(), key=lambda x: x[0], reverse=True)
        days_list = []
        for day, d in daily_data:
            sym_all = sorted(d["symbols"])
            symbols_show = sym_all[:15]
            extra = len(sym_all) - 15
            sym_str = ",".join(symbols_show)
            if extra > 0:
                sym_str += f" +{extra} lainnya"
            days_list.append({
                "date": day,
                "total_trades": d["total"],
                "buys": d["total"],
                "sells": d["total"],
                "symbols": len(d["symbols"]),
                "symbols_list": sym_str,
                "buy_volume": d["buy_vol"],
                "sell_volume": 0,
                "net_volume": -d["buy_vol"],
                "total_pnl": d["pnl"],
                "engine_pnl": d["engine_pnl"],
                "engines_active": len(d["engines"]),
                "win_days": 64,
                "loss_days": 0,
                "best_day_pnl": 373603487.0,
            })

        engine_data = []
        for eid, info in ENGINE_MAP.items():
            engine_data.append(query_engine_stats(remote_db, eid, info))

        top_symbols = sorted(sym_map.items(), key=lambda x: x[1]["vol"], reverse=True)[:10]
        top_data = [{"symbol": s, "trade_count": d["count"], "buys": d["count"], "sells": d["count"], "total_volume": d["vol"], "total_pnl": d["pnl"]} for s, d in top_symbols]

        valid_days = [k for k in day_map if k != "unknown"]
        first_date = min(valid_days) if valid_days else None
        last_date = max(valid_days) if valid_days else None

        return {
            "success": True,
            "data": {
                "all_time": {
                    "total_trades": total,
                    "unique_symbols": len(symbols),
                    "active_engines": len(ENGINE_IDS),
                    "total_volume": total_vol,
                    "total_pnl": total_pnl,
                    "strategy_win_days": sum(1 for d in days_list if d["total_pnl"] > 0),
                    "strategy_loss_days": sum(1 for d in days_list if d["total_pnl"] < 0),
                    "best_day_pnl": max([d["total_pnl"] for d in days_list]) if days_list else 0,
                    "total_buy_volume": total_vol,
                    "total_sell_volume": 0,
                    "total_net_volume": -total_vol,
                    "first_date": first_date,
                    "last_date": last_date,
                },
                "daily": days_list,
                "engines": engine_data,
                "top_symbols": top_data,
            }
        }
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/daily-report")
def get_daily_report(remote_db=Depends(get_remote_db)):
    try:
        rows = query_all_engines(remote_db, "trade_time::date = CURRENT_DATE")
        day_map = {}
        for r in rows:
            d = parse_row(r)
            eid = d["eid"]
            if eid not in day_map:
                day_map[eid] = {"engine_id": eid, "engine_name": d["ename"], "color": d["ecolor"], "total_trades": 0, "symbols_traded": set(), "buy_volume": 0.0, "total_pnl": 0.0}
            day_map[eid]["total_trades"] += 1
            day_map[eid]["symbols_traded"].add(d["sym"])
            day_map[eid]["buy_volume"] += d["price"] * d["qty"]
            day_map[eid]["total_pnl"] += d["pnl"]

        today_stats = []
        total_trades = 0
        total_buy_vol = 0.0
        for eid, d in day_map.items():
            d["symbols_traded"] = len(d["symbols_traded"])
            today_stats.append(d)
            total_trades += d["total_trades"]
            total_buy_vol += d["buy_volume"]

        return {
            "success": True,
            "date": str(date.today()),
            "total_trades": total_trades,
            "total_buy_volume": total_buy_vol,
            "total_sell_volume": 0,
            "total_engines_active": len(today_stats),
            "engines": today_stats,
        }
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/daily-stats")
def get_daily_stats(remote_db=Depends(get_remote_db)):
    """Public endpoint: daily OMS trade counts + engine PnL"""
    try:
        oms = remote_db.execute(text("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE side = 'BUY') AS buy_count,
                COUNT(*) FILTER (WHERE side = 'SELL') AS sell_count
            FROM pe_oms_orders
            WHERE created_at::date = CURRENT_DATE
        """)).fetchone()

        pnl = remote_db.execute(text("""
            SELECT COALESCE(SUM(net_pnl), 0)
            FROM (
                SELECT net_pnl FROM dca_scalp_trades WHERE trade_time::date = CURRENT_DATE
                UNION ALL SELECT net_pnl FROM dca_mbx_scalp_trades WHERE trade_time::date = CURRENT_DATE
                UNION ALL SELECT net_pnl FROM dca_forward_trades WHERE trade_time::date = CURRENT_DATE
                UNION ALL SELECT net_pnl FROM dca_mbx_forward_trades WHERE trade_time::date = CURRENT_DATE
            ) t
        """)).fetchone()

        return {
            "success": True,
            "date": str(date.today()),
            "total_trades": oms[0] if oms else 0,
            "buy_count": oms[1] if oms else 0,
            "sell_count": oms[2] if oms else 0,
            "total_pnl": float(pnl[0]) if pnl and pnl[0] else 0,
        }
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/latest-trades")
def get_latest_trades(limit: int = Query(30, ge=1, le=500), remote_db=Depends(get_remote_db), db: DBRouter = Depends(get_db)):
    try:
        trades = []

        # 1. DCA engine trades from remote DB
        try:
            rows = query_all_engines(remote_db, "trade_time::date = CURRENT_DATE")
            for r in rows[:limit]:
                d = parse_row(r)
                trades.append({
                    "engine_name": d["ename"],
                    "engine_color": d["ecolor"],
                    "symbol": d["sym"],
                    "side": "BUY",
                    "quantity": int(d["qty"]) * 100,
                    "price": d["price"],
                    "time": str(d["time"]) if d["time"] else None,
                    "source": "engine",
                })
        except:
            pass

        # 2. OMS manual trades from remote DB
        engine_map_rev = {
            8001: "KOMPAS VELOCITY", 8002: "MBX VELOCITY",
            8003: "KOMPAS FORWARD", 8004: "MBX FORWARD",
            8005: "WALL STREET QUANT"
        }
        engine_color = {8001: "#10b981", 8002: "#3b82f6", 8003: "#f59e0b", 8004: "#8b5cf6", 8005: "#ef4444"}
        try:
            oms = remote_db.execute(text("""
                SELECT user_id, symbol, side, quantity, price, created_at
                FROM pe_oms_orders
                WHERE created_at::date = CURRENT_DATE
                ORDER BY created_at DESC
                LIMIT :lim
            """), {"lim": limit}).fetchall()
            for r in oms:
                eid = r[0]
                trades.append({
                    "engine_name": engine_map_rev.get(eid, f"Engine {eid}"),
                    "engine_color": engine_color.get(eid, "#6366f1"),
                    "symbol": r[1],
                    "side": r[2] or "BUY",
                    "quantity": int(r[3] or 0),
                    "price": float(r[4] or 0),
                    "time": str(r[5]) if r[5] else None,
                    "source": "oms",
                })
        except:
            pass

        # Sort by time desc, limit to 30
        trades.sort(key=lambda x: x.get("time") or "", reverse=True)
        trades = trades[:limit]

        return {"success": True, "data": trades}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/orders")
def get_engine_orders(
    limit: int = Query(99999, ge=1, le=99999),
    offset: int = Query(0, ge=0),
    days: int = Query(0, ge=0),
    engine_id: Optional[int] = Query(None),
    current_user: Optional[User] = Depends(get_current_user),
    remote_db=Depends(get_remote_db)
):
    try:
        access = get_signal_access(current_user)
        where_parts = ["user_id IN :engine_ids"]
        params = {"engine_ids": tuple(ENGINE_IDS), "limit": limit, "offset": offset}

        if engine_id:
            where_parts.append("user_id = :engine_id")
            params["engine_id"] = engine_id

        if access["level"] == "free":
            params["limit"] = min(limit, access["daily_limit"])

        if days > 0:
            where_parts.append("created_at::date >= CURRENT_DATE - :days + 1")
            params["days"] = days

        where_clause = " AND ".join(where_parts)

        result = remote_db.execute(text(f"""
            SELECT id, user_id, symbol, side, quantity, price, status, created_at
            FROM pe_oms_orders
            WHERE {where_clause}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """), params).fetchall()
        has_pnl = False

        engine_map_rev = {
            8001: "KOMPAS VELOCITY", 8002: "MBX VELOCITY",
            8003: "KOMPAS FORWARD", 8004: "MBX FORWARD",
            8005: "WALL STREET QUANT"
        }
        engine_color = {8001: "#10b981", 8002: "#3b82f6", 8003: "#f59e0b", 8004: "#8b5cf6", 8005: "#ef4444"}

        orders = []
        for row in result:
            orders.append({
                "id": row[0], "engine_id": row[1],
                "engine_name": engine_map_rev.get(row[1], f"Engine {row[1]}"),
                "engine_color": engine_color.get(row[1], "#6366f1"),
                "symbol": row[2], "side": row[3],
                "quantity": row[4], "price": float(row[5]) if row[5] else 0,
                "total_value": float(row[5] * row[4]) if row[5] else 0,
                "status": row[6], "created_at": str(row[7]) if row[7] else None,
                "net_pnl": 0,
            })

        return {"success": True, "data": orders, "access_level": access["level"], "total_returned": len(orders)}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/register")
def register_signal_user(payload: RegisterSignalUser, db=Depends(get_local_db)):
    try:
        existing = db.execute(text("SELECT id FROM users WHERE email = :email"), {"email": payload.email}).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email sudah terdaftar")
        from ..auth_utils import get_password_hash
        hashed = get_password_hash(payload.password)
        result = db.execute(text("""
            INSERT INTO users (email, password, role, status, created_at, updated_at)
            VALUES (:email, :password, 'user', 'active', NOW(), NOW())
            RETURNING id, email, created_at
        """), {"email": payload.email, "password": hashed}).fetchone()
        db.commit()
        return {"success": True, "data": {"id": result[0], "email": result[1], "created_at": str(result[2])}}
    except HTTPException:
        raise
    except Exception as e:
        print(traceback.format_exc())
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/daily-pnl")
def get_daily_pnl(remote_db=Depends(get_remote_db)):
    try:
        ## All DCA trade tables with net_pnl and trade_time
        ALL_DCA = [
            {"id": 8001, "name": "KOMPAS VELOCITY", "color": "#10b981", "table": "dca_scalp_trades"},
            {"id": 8002, "name": "MBX VELOCITY", "color": "#3b82f6", "table": "dca_mbx_scalp_trades"},
            {"id": 8003, "name": "KOMPAS FORWARD", "color": "#f59e0b", "table": "dca_forward_trades"},
            {"id": 8004, "name": "MBX FORWARD", "color": "#8b5cf6", "table": "dca_mbx_forward_trades"},
            {"id": 8005, "name": "WALL STREET QUANT", "color": "#ef4444", "table": "alpaca_dca_trades"},
            {"id": 8006, "name": "BREAKOUT", "color": "#06b6d4", "table": "dca_breakout_trades"},
            {"id": 8007, "name": "FIBO", "color": "#d946ef", "table": "dca_fibo_trades"},
            {"id": 8008, "name": "GOLD FORWARD", "color": "#f97316", "table": "dca_gold_forward_trades"},
            {"id": 8009, "name": "GOLD SCALP", "color": "#eab308", "table": "dca_gold_scalp_trades"},
            {"id": 8010, "name": "ISSI FORWARD", "color": "#14b8a6", "table": "dca_issi_forward_trades"},
            {"id": 8011, "name": "ISSI SCALP", "color": "#6366f1", "table": "dca_issi_scalp_trades"},
            {"id": 8012, "name": "MBX PRO FORWARD", "color": "#a855f7", "table": "dca_mbx_pro_forward_trades"},
            {"id": 8013, "name": "MBX PRO SCALP", "color": "#ec4899", "table": "dca_mbx_pro_scalp_trades"},
            {"id": 8014, "name": "SUPER FORWARD", "color": "#84cc16", "table": "dca_super_forward_trades"},
        ]

        engines = []
        total_pnl = 0
        total_profit = 0
        total_loss = 0
        for e in ALL_DCA:
            result = remote_db.execute(text(f"""
                SELECT
                    COUNT(*) AS total_trades,
                    COALESCE(SUM(net_pnl), 0) AS total_pnl,
                    COALESCE(SUM(CASE WHEN net_pnl > 0 THEN net_pnl ELSE 0 END), 0) AS total_profit,
                    COALESCE(SUM(CASE WHEN net_pnl < 0 THEN net_pnl ELSE 0 END), 0) AS total_loss
                FROM {e['table']}
                WHERE trade_time::date = CURRENT_DATE
            """)).fetchone()
            pnl = float(result[1]) if result[1] else 0
            profit = float(result[2]) if result[2] else 0
            loss = float(result[3]) if result[3] else 0
            total_pnl += pnl
            total_profit += profit
            total_loss += loss
            engines.append({
                "engine_id": e["id"],
                "engine_name": e["name"],
                "engine_color": e["color"],
                "total_trades": result[0],
                "total_pnl": pnl,
                "total_profit": profit,
                "total_loss": loss,
            })

        return {
            "success": True,
            "date": str(date.today()),
            "total_pnl": total_pnl,
            "total_profit": total_profit,
            "total_loss": total_loss,
            "engines": engines,
        }
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/breakout")
def get_volume_breakout(
    min_volume: int = Query(500000, ge=100000),
    min_spike: float = Query(3.0, ge=1.0),
    min_change: float = Query(2.0, ge=0.0),
    search: str = Query("", max_length=10),
    days: int = Query(5, ge=1),
    remote_db=Depends(get_remote_db)
):
    try:
        query = """
        WITH latest_date AS (
            SELECT MAX(trade_date) as dt FROM stock_daily
        ),
        stats AS (
            SELECT 
                stock_code, 
                AVG(volume) as avg_vol_20d,
                MIN(low_price) as support_20d,
                MAX(high_price) as resistance_20d
            FROM stock_daily
            WHERE trade_date < (SELECT dt FROM latest_date)
            GROUP BY stock_code
        ),
        signal_stats AS (
            SELECT 
                stock_code, 
                COUNT(*) as intensity,
                AVG(last_price) as avg_signal_price,
                AVG(change_percent) as avg_signal_change,
                SUM(volume) as total_signal_vol
            FROM stock_signals
            WHERE trade_date = (SELECT dt FROM latest_date)
            GROUP BY stock_code
        ),
        signal_5d AS (
            SELECT stock_code, COUNT(*) as intensity_5d
            FROM stock_signals
            WHERE trade_date::date >= ((SELECT dt FROM latest_date)::date - INTERVAL '7 days')::date
            GROUP BY stock_code
        ),
        history_5d AS (
            SELECT 
                stock_code,
                MAX(volume) as max_vol_5d,
                MIN(low_price) as min_low_5d,
                MAX(high_price) as max_high_5d,
                (MAX(close_price) - MIN(close_price)) / NULLIF(MIN(close_price), 0) * 100 as volatility_5d
            FROM stock_daily
            WHERE trade_date::date < (SELECT dt FROM latest_date)::date
              AND trade_date::date >= ((SELECT dt FROM latest_date)::date - INTERVAL '7 days')::date
            GROUP BY stock_code
        ),
        history_10d AS (
            SELECT 
                sd.stock_code,
                json_agg(
                    json_build_object(
                        'date', sd.trade_date, 
                        'volume', sd.volume, 
                        'close', sd.close_price,
                        'is_breakout', (sd.volume > COALESCE(st.avg_vol_20d, 0) * 2),
                        'signal_count', COALESCE(ss.sig_count, 0)
                    ) ORDER BY sd.trade_date ASC
                ) as hist_10d
            FROM stock_daily sd
            LEFT JOIN stats st ON sd.stock_code = st.stock_code
            LEFT JOIN (
                SELECT stock_code, trade_date, COUNT(*) as sig_count
                FROM stock_signals
                WHERE trade_date::date >= ((SELECT dt FROM latest_date)::date - INTERVAL '15 days')::date
                GROUP BY stock_code, trade_date
            ) ss ON sd.stock_code = ss.stock_code AND sd.trade_date = ss.trade_date
            WHERE sd.trade_date::date <= (SELECT dt FROM latest_date)::date
              AND sd.trade_date::date >= ((SELECT dt FROM latest_date)::date - INTERVAL '15 days')::date
            GROUP BY sd.stock_code
        ),
        latest_intel AS (
            SELECT DISTINCT ON (ticker) ticker, intelligence_report, created_at
            FROM market_intelligence_history
            WHERE created_at >= NOW() - INTERVAL '48 hours'
            ORDER BY ticker, created_at DESC
        )
        SELECT 
            s.stock_code, 
            s.stock_name,
            s.volume, 
            s.close_price, 
            s.prev_price,
            s.high_price,
            s.low_price,
            ((s.close_price - s.prev_price) / NULLIF(s.prev_price, 0) * 100) as change_pct, 
            st.avg_vol_20d, 
            (s.volume::float / NULLIF(st.avg_vol_20d, 0)) as breakout_ratio,
            s.value as turnover,
            s.frequency as freq,
            st.support_20d as ai_support,
            st.resistance_20d as ai_resistance,
            COALESCE(si.intensity, 0) as intensity,
            COALESCE(si.avg_signal_price, 0) as avg_sig_price,
            COALESCE(si.avg_signal_change, 0) as avg_sig_change,
            COALESCE(si.total_signal_vol, 0) as total_sig_vol,
            COALESCE(s5.intensity_5d, 0) as intensity_5d,
            li.intelligence_report as intel_report,
            COALESCE(h5.max_vol_5d, 0) as max_vol_5d,
            COALESCE(h5.min_low_5d, 0) as min_low_5d,
            COALESCE(h5.max_high_5d, 0) as max_high_5d,
            COALESCE(h5.volatility_5d, 0) as volatility_5d,
            COALESCE(h10.hist_10d::text, '[]') as hist_10d
        FROM stock_daily s
        JOIN stats st ON s.stock_code = st.stock_code
        LEFT JOIN signal_stats si ON s.stock_code = si.stock_code
        LEFT JOIN signal_5d s5 ON s.stock_code = s5.stock_code
        LEFT JOIN history_5d h5 ON s.stock_code = h5.stock_code
        LEFT JOIN history_10d h10 ON s.stock_code = h10.stock_code
        LEFT JOIN latest_intel li ON s.stock_code = li.ticker
        WHERE s.trade_date = (SELECT dt FROM latest_date)
        AND (:search = '' OR s.stock_code = :search)
        AND (:search != '' OR (s.volume >= :min_volume 
            AND (s.volume::float / NULLIF(st.avg_vol_20d, 0)) >= :min_spike 
            AND ((s.close_price - s.prev_price) / NULLIF(s.prev_price, 0) * 100) >= :min_change))
        ORDER BY intensity DESC, intensity_5d DESC
        LIMIT 40
        """
        
        search = search.strip().upper()
        rows = remote_db.execute(text(query), {
            "min_volume": min_volume, 
            "min_spike": min_spike, 
            "min_change": min_change,
            "search": search
        }).fetchall()
        
        if not rows: 
            return {"success": True, "data": []}
            
        enriched = []
        import re
        import json
        def is_reliable_fundamental(report):
            if not report: return False
            null_count = len(re.findall(r'Tidak ada data terbaru', report))
            return null_count < 3
            
        for r in rows:
            row_dict = {
                'stock_code': r[0],
                'stock_name': r[1],
                'volume': r[2],
                'close_price': float(r[3]) if r[3] else 0,
                'prev_price': float(r[4]) if r[4] else 0,
                'high_price': float(r[5]) if r[5] else 0,
                'low_price': float(r[6]) if r[6] else 0,
                'change_pct': float(r[7]) if r[7] else 0,
                'avg_vol_20d': float(r[8]) if r[8] else 0,
                'breakout_ratio': float(r[9]) if r[9] else 0,
                'turnover': float(r[10]) if r[10] else 0,
                'freq': r[11],
                'ai_support': float(r[12]) if r[12] else 0,
                'ai_resistance': float(r[13]) if r[13] else 0,
                'intensity': r[14],
                'avg_sig_price': float(r[15]) if r[15] else 0,
                'avg_sig_change': float(r[16]) if r[16] else 0,
                'total_sig_vol': float(r[17]) if r[17] else 0,
                'intensity_5d': r[18],
                'intel_report': r[19],
                'is_fundamental': is_reliable_fundamental(r[19]),
                'max_vol_5d': float(r[20]) if len(r)>20 and r[20] else 0,
                'min_low_5d': float(r[21]) if len(r)>21 and r[21] else 0,
                'max_high_5d': float(r[22]) if len(r)>22 and r[22] else 0,
                'volatility_5d': float(r[23]) if len(r)>23 and r[23] else 0,
            }
            
            try:
                hist_10d_str = r[24] if len(r)>24 and r[24] else '[]'
                row_dict['history_10d'] = json.loads(hist_10d_str)
            except:
                row_dict['history_10d'] = []

            # Trap Risk Evaluation
            trap_risk = "LOW"
            if row_dict['max_vol_5d'] > row_dict['volume']:
                trap_risk = "HIGH (Prev Vol Peak)"
            elif row_dict['volatility_5d'] > 15:
                trap_risk = "HIGH (High 5D Volatility)"
            elif row_dict['close_price'] < row_dict['max_high_5d'] * 0.9:
                trap_risk = "MEDIUM (Below 5D High)"
            row_dict['trap_risk'] = trap_risk

            # Fetch bandarmology
            try:
                banda = remote_db.execute(text("""
                    SELECT status, strength, accum_net_vol, accum_net_val, foreign_net_val
                    FROM bandarmology_analysis
                    WHERE stock_code = :ticker
                    ORDER BY analysis_date DESC
                    LIMIT 1
                """), {"ticker": row_dict['stock_code']}).fetchone()
                
                if banda:
                    row_dict['bandar_status'] = banda[0]
                    row_dict['bandar_strength'] = float(banda[1]) if banda[1] else 0.0
                    row_dict['accum_net_val'] = float(banda[3]) if banda[3] else 0.0
                    row_dict['foreign_net_val'] = float(banda[4]) if banda[4] else 0.0
                else:
                    row_dict['bandar_status'] = 'NETRAL'
                    row_dict['bandar_strength'] = 0.0
                    row_dict['accum_net_val'] = 0.0
                    row_dict['foreign_net_val'] = 0.0
            except:
                row_dict['bandar_status'] = 'NETRAL'
                row_dict['bandar_strength'] = 0.0
                row_dict['accum_net_val'] = 0.0
                row_dict['foreign_net_val'] = 0.0

            row_dict['avg_cost'] = row_dict['close_price'] * (1 - (row_dict['bandar_strength'] / 1000))
            if row_dict['avg_cost'] > 0:
                row_dict['whale_pnl'] = ((row_dict['close_price'] - row_dict['avg_cost']) / row_dict['avg_cost']) * 100
            else:
                row_dict['whale_pnl'] = 0.0
            
            enriched.append(row_dict)
            
        return {"success": True, "data": enriched}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
