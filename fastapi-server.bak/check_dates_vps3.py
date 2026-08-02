from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
with engine.connect() as conn:
    tables = ['index_daily', 'stock_daily', 'transactions']
    for tbl in tables:
        try:
            mx = conn.execute(text(f'SELECT MAX(trade_date) FROM {tbl}')).scalar()
            print(f'{tbl}: max={mx}')
            dates = conn.execute(text(f'SELECT DISTINCT trade_date FROM {tbl} ORDER BY trade_date DESC LIMIT 5')).fetchall()
            for d in dates:
                print(f'  {d[0]}')
            print()
        except Exception as e:
            conn.rollback()
            print(f'{tbl}: ERROR - {e}')
            print()
