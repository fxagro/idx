from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
conn = engine.connect()

rows = conn.execute(text("""
    SELECT trade_date, index_code, prev_index, close_index, change_index,
           (close_index - prev_index) as calc_change,
           CASE WHEN prev_index > 0 THEN ((close_index - prev_index) / prev_index * 100) ELSE 0 END as calc_pct
    FROM index_daily 
    WHERE index_code = 'COMPOSITE' 
    ORDER BY trade_date DESC 
    LIMIT 3
""")).fetchall()
for r in rows:
    print(f'Date: {r[0]}')
    print(f'  prev_index={r[2]}, close_index={r[3]}, change_index={r[4]}')
    print(f'  calc_change={r[5]}, calc_pct={r[6]}')
    print()

# Check what the current endpoint returns (WRONG calculation)
rows2 = conn.execute(text("SELECT trade_date, close_index, change_index FROM index_daily WHERE index_code = 'COMPOSITE' ORDER BY trade_date DESC LIMIT 1")).fetchall()
for r in rows2:
    close_idx = float(r[1] or 0)
    prev = float(r[2] or 0)
    chg_idx_wrong = close_idx - prev
    chg_pct_wrong = (chg_idx_wrong / prev * 100) if prev > 0 else 0.0
    print(f'CURRENT BUGGY OUTPUT:')
    print(f'  Treating change_index({prev}) as prev_index')
    print(f'  price={close_idx}, change={chg_idx_wrong}, change_pct={chg_pct_wrong}')
    
    # What it SHOULD be
    row3 = conn.execute(text("SELECT prev_index FROM index_daily WHERE index_code = 'COMPOSITE' ORDER BY trade_date DESC LIMIT 1")).fetchone()
    prev_idx = float(row3[0] or 0) if row3 and row3[0] else 0
    correct_change = close_idx - prev_idx
    correct_pct = (correct_change / prev_idx * 100) if prev_idx > 0 else 0.0
    print(f'CORRECT OUTPUT (using prev_index={prev_idx}):')
    print(f'  price={close_idx}, change={correct_change}, change_pct={correct_pct}')

conn.close()
