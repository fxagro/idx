#!/usr/bin/env python3
import re

with open('/var/www/idx.mytriv.com/fastapi-server/routers/android_compat.py', 'r') as f:
    content = f.read()

old_ihsg = '''@router.get("/market/ihsg")
def get_ihsg(db: Session = Depends(get_remote_db)):
    try:
        query = text("""
            SELECT trade_date, close_index, change_index
            FROM index_daily
            WHERE index_code = 'COMPOSITE'
            ORDER BY trade_date DESC
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
        raise HTTPException(status_code=500, detail=str(e))'''

new_ihsg = '''@router.get("/market/ihsg")
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
        raise HTTPException(status_code=500, detail=str(e))'''

if old_ihsg in content:
    content = content.replace(old_ihsg, new_ihsg)
    with open('/var/www/idx.mytriv.com/fastapi-server/routers/android_compat.py', 'w') as f:
        f.write(content)
    print('IHSG endpoint FIXED')
else:
    print('WARNING: Could not find old IHSG endpoint code')
    # Debug: print first 30 chars of match attempt
    idx = content.find('def get_ihsg')
    if idx >= 0:
        print(f'Found at position {idx}')
        print(content[idx:idx+500])
