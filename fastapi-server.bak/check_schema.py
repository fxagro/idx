from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
conn = engine.connect()
rows = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'index_daily' ORDER BY ordinal_position")).fetchall()
for r in rows:
    print(f'{r[0]:30s} {r[1]}')
conn.close()
