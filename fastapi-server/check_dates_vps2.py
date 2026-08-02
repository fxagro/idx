from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
with engine.connect() as conn:
    for tbl in ['index_daily', 'stock_daily', 'transactions', 'idx_top_gainers', 'broker_transactions_daily']:
        try:
            mx = conn.execute(text(f'SELECT MAX(trade_date) FROM {tbl}')).scalar()
            print(f'{tbl}: {mx}')
        except:
            print(f'{tbl}: TABLE NOT FOUND')
    
    print('\n--- stock_daily dates ---')
    dates = conn.execute(text('SELECT DISTINCT trade_date FROM stock_daily ORDER BY trade_date DESC LIMIT 7')).fetchall()
    for d in dates:
        print(f'  {d[0]}')
    
    print('\n--- index_daily dates ---')
    dates = conn.execute(text('SELECT DISTINCT trade_date FROM index_daily ORDER BY trade_date DESC LIMIT 7')).fetchall()
    for d in dates:
        print(f'  {d[0]}')
