from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
with engine.connect() as conn:
    idx_max = conn.execute(text('SELECT MAX(trade_date) FROM index_daily')).scalar()
    idx_dates = conn.execute(text('SELECT DISTINCT trade_date FROM index_daily ORDER BY trade_date DESC LIMIT 10')).fetchall()
    tx_dates = conn.execute(text('SELECT DISTINCT trade_date FROM transactions ORDER BY trade_date DESC LIMIT 10')).fetchall()
    print('Index Max Date:', idx_max)
    print('Recent index dates:')
    for d in idx_dates:
        print(' -', d[0])
    print('Recent transaction dates:')
    for d in tx_dates:
        print(' -', d[0])
