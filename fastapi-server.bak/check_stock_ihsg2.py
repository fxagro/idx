from sqlalchemy import create_engine, text
try:
    engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT stock_code, close_price FROM stock_daily WHERE stock_code IN ('IHSG', 'COMPOSITE') ORDER BY trade_date DESC LIMIT 5")).fetchall()
        for r in rows:
            print(r)
except Exception as e:
    print(e)
