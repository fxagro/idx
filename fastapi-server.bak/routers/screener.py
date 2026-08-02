from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from database import get_local_db
from .auth import get_current_user
from models import User

router = APIRouter()

@router.get("/screener")
def stock_screener(
    sector: Optional[str] = Query(None),
    min_per: Optional[float] = Query(None),
    max_per: Optional[float] = Query(None),
    min_pbv: Optional[float] = Query(None),
    max_pbv: Optional[float] = Query(None),
    min_roe: Optional[float] = Query(None),
    max_roe: Optional[float] = Query(None),
    min_dividend: Optional[float] = Query(None),
    market: str = Query("idx"),
    sort_by: str = Query("symbol"),
    sort_dir: str = Query("asc"),
    limit: int = Query(50),
    offset: int = Query(0),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_local_db)
):
    base_query = """
        FROM fundamental_data fd
        JOIN stocks_info si ON fd.symbol = si.symbol AND fd.market = si.market
        WHERE fd.market = :market
    """
    params = {"market": market}

    if sector:
        base_query += " AND si.sector = :sector"
        params["sector"] = sector
    if min_per is not None:
        base_query += " AND fd.per >= :min_per"
        params["min_per"] = min_per
    if max_per is not None:
        base_query += " AND fd.per <= :max_per"
        params["max_per"] = max_per
    if min_pbv is not None:
        base_query += " AND fd.pbv >= :min_pbv"
        params["min_pbv"] = min_pbv
    if max_pbv is not None:
        base_query += " AND fd.pbv <= :max_pbv"
        params["max_pbv"] = max_pbv
    if min_roe is not None:
        base_query += " AND fd.roe >= :min_roe"
        params["min_roe"] = min_roe
    if max_roe is not None:
        base_query += " AND fd.roe <= :max_roe"
        params["max_roe"] = max_roe
    if min_dividend is not None:
        base_query += " AND fd.dividend_yield >= :min_dividend"
        params["min_dividend"] = min_dividend
    if search:
        base_query += " AND (si.symbol ILIKE :search OR si.name ILIKE :search2)"
        params["search"] = f"%{search}%"
        params["search2"] = f"%{search}%"

    allowed_sort = {
        "symbol": "si.symbol", "per": "fd.per", "pbv": "fd.pbv",
        "roe": "fd.roe", "dividend_yield": "fd.dividend_yield", "name": "si.name"
    }
    sort_col = allowed_sort.get(sort_by, "si.symbol")
    dir_sql = "DESC" if sort_dir.lower() == "desc" else "ASC"

    count_query = f"SELECT COUNT(*) {base_query}"
    total = db.execute(text(count_query), params).scalar() or 0

    data_query = f"""
        SELECT si.symbol, si.name, si.sector, fd.report_date, fd.eps, fd.per, fd.pbv, fd.roe, fd.dividend_yield
        {base_query}
        ORDER BY {sort_col} {dir_sql}
        LIMIT :lim OFFSET :off
    """
    params["lim"] = limit
    params["off"] = offset

    rows = db.execute(text(data_query), params).fetchall()
    results = []
    for r in rows:
        results.append({
            "symbol": r[0], "name": r[1], "sector": r[2],
            "report_date": str(r[3]) if r[3] else None,
            "eps": float(r[4]) if r[4] else None,
            "per": float(r[5]) if r[5] else None,
            "pbv": float(r[6]) if r[6] else None,
            "roe": float(r[7]) if r[7] else None,
            "dividend_yield": float(r[8]) if r[8] else None
        })

    sectors = db.execute(text("SELECT DISTINCT sector FROM stocks_info WHERE market = :m ORDER BY sector"), {"m": market}).fetchall()
    sector_list = [r[0] for r in sectors if r[0]]

    return {
        "success": True,
        "total": total,
        "results": results,
        "sectors": sector_list,
        "page": {"limit": limit, "offset": offset}
    }


@router.get("/sectors")
def get_sectors(market: str = Query("idx"), current_user: User = Depends(get_current_user), db: Session = Depends(get_local_db)):
    query = """
        SELECT si.sector, COUNT(*) as total_stocks,
               AVG(fd.per) as avg_per, AVG(fd.pbv) as avg_pbv,
               AVG(fd.roe) as avg_roe, AVG(fd.dividend_yield) as avg_dividend
        FROM stocks_info si
        LEFT JOIN fundamental_data fd ON fd.symbol = si.symbol AND fd.market = si.market
        WHERE si.market = :market
        GROUP BY si.sector
        ORDER BY total_stocks DESC
    """
    rows = db.execute(text(query), {"market": market}).fetchall()
    sectors = []
    for r in rows:
        sectors.append({
            "sector": r[0],
            "total_stocks": r[1],
            "avg_per": round(float(r[2]), 2) if r[2] else None,
            "avg_pbv": round(float(r[3]), 2) if r[3] else None,
            "avg_roe": round(float(r[4]), 2) if r[4] else None,
            "avg_dividend": round(float(r[5]), 2) if r[5] else None
        })
    return {"success": True, "sectors": sectors}
