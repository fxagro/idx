#!/usr/bin/env python3

with open('/var/www/idx.mytriv.com/fastapi-server/routers/android_compat.py', 'r') as f:
    content = f.read()

old_sectors = '''@router.get("/market/sectors")
def get_sectors(db: Session = Depends(get_remote_db)):
    try:
        query = text("""
            SELECT index_code, close_index, change_index
            FROM index_daily i
            INNER JOIN (
                SELECT MAX(trade_date) as max_date 
                FROM index_daily 
                WHERE index_code LIKE 'IDX%' 
            ) m ON i.trade_date = m.max_date
            WHERE i.index_code LIKE 'IDX%' 
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
        raise HTTPException(status_code=500, detail=str(e))'''

new_sectors = '''@router.get("/market/sectors")
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
        raise HTTPException(status_code=500, detail=str(e))'''

if old_sectors in content:
    content = content.replace(old_sectors, new_sectors)
    with open('/var/www/idx.mytriv.com/fastapi-server/routers/android_compat.py', 'w') as f:
        f.write(content)
    print('Sectors endpoint FIXED')
else:
    print('WARNING: Could not find old Sectors endpoint code')
    idx = content.find('def get_sectors')
    if idx >= 0:
        print(f'Found at position {idx}')
        print(content[idx:idx+600])
