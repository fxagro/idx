from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
conn = engine.connect()

# Check stock_daily columns
rows = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'stock_daily' ORDER BY ordinal_position")).fetchall()
print('=== stock_daily columns ===')
for r in rows:
    print(f'  {r[0]:30s} {r[1]}')

print()
print('=== stock_daily sample data (1 row) ===')
rows = conn.execute(text("SELECT * FROM stock_daily ORDER BY trade_date DESC LIMIT 1")).fetchall()
if rows:
    desc = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_daily' ORDER BY ordinal_position")).fetchall()
    for i, val in enumerate(rows[0]):
        col_name = desc[i][0] if i < len(desc) else f'col{i}'
        print(f'  {col_name:30s} = {val}')
        
# Check how many rows with prev_price > 0
count = conn.execute(text("SELECT COUNT(*) FROM stock_daily WHERE prev_price > 0")).scalar()
total = conn.execute(text("SELECT COUNT(*) FROM stock_daily")).scalar()
print(f'\nstock_daily: {count}/{total} rows have prev_price > 0')

# Check stock_daily trade dates
print('\n=== stock_daily dates ===')
rows = conn.execute(text("SELECT DISTINCT trade_date, COUNT(*) as cnt FROM stock_daily GROUP BY trade_date ORDER BY trade_date DESC LIMIT 7")).fetchall()
for r in rows:
    print(f'  {r[0]:15s}  {r[1]} rows')

conn.close()
