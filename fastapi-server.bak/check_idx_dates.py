from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
conn = engine.connect()

# Check COMPOSITE dates vs IDX sector dates
print('=== COMPOSITE (IHSG) dates ===')
rows = conn.execute(text("SELECT trade_date, close_index FROM index_daily WHERE index_code = 'COMPOSITE' ORDER BY trade_date DESC LIMIT 5")).fetchall()
for r in rows:
    print(f'  {r[0]}  close={r[1]}')

print()
print('=== IDX sector dates ===')
rows = conn.execute(text("SELECT DISTINCT trade_date FROM index_daily WHERE index_code LIKE 'IDX%' ORDER BY trade_date DESC LIMIT 10")).fetchall()
for r in rows:
    print(f'  {r[0]}')

print()
print('=== Latest IDX sector with data ===')
rows = conn.execute(text("SELECT index_code, trade_date, close_index FROM index_daily WHERE index_code LIKE 'IDX%' ORDER BY trade_date DESC LIMIT 15")).fetchall()
for r in rows:
    print(f'  {r[0]:20s} {r[1]}  close={r[2]}')

conn.close()
