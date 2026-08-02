from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
with engine.connect() as conn:
    rows = conn.execute(text("SELECT index_code, close_index, change_index FROM index_daily WHERE trade_date='2026-05-21' AND index_code IN ('COMPOSITE', 'IHSG')")).fetchall()
    for r in rows:
        print(f"Code: {r[0]}, Close: {r[1]}, Change: {r[2]}")
