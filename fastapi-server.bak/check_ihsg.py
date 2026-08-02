from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
with engine.connect() as conn:
    rows = conn.execute(text("SELECT trade_date, close_index, change_index FROM index_daily WHERE index_code='COMPOSITE' ORDER BY trade_date DESC LIMIT 5")).fetchall()
    for r in rows:
        print(f"Date: {r[0]}, Close: {r[1]}, Change: {r[2]}")
