#!/usr/bin/env python3

with open('/var/www/idx.mytriv.com/fastapi-server/routers/stocks.py', 'r') as f:
    content = f.read()

# Fix /index endpoint: replace close_index - change_index with prev_close via self-JOIN
old_block = '''            WITH latest_dates AS (
                SELECT index_code, MAX(trade_date) as max_date
                FROM index_daily
                GROUP BY index_code
            )
            SELECT 
                a.index_code, 
                a.close_index, 
                a.close_index - a.change_index as selisih,
                a.volume, 
                a.value, 
                a.frequency,
                a.trade_date,
                a.market_cap
            FROM index_daily a
            JOIN latest_dates ld ON a.index_code = ld.index_code AND a.trade_date = ld.max_date
            ORDER BY a.volume DESC NULLS LAST
            LIMIT 50
        """)
        rows = db.execute(query).fetchall()
        data = []
        for r in rows:
            data.append({
                "kode_indeks": r[0],
                "penutupan": float(r[1] or 0),
                "selisih": float(r[2] or 0),'''

new_block = '''            WITH latest_dates AS (
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
                "selisih": close_idx - prev_close,'''

if old_block in content:
    content = content.replace(old_block, new_block)
    with open('/var/www/idx.mytriv.com/fastapi-server/routers/stocks.py', 'w') as f:
        f.write(content)
    print('/index endpoint FIXED')
else:
    print('WARNING: Could not find old block in stocks.py')
