from sqlalchemy import create_engine, text
engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
with engine.connect() as conn:
    idx_max = conn.execute(text('SELECT MAX(trade_date) FROM index_daily')).scalar()
    trx_max = conn.execute(text('SELECT MAX(trade_date) FROM transactions')).scalar()
    print('Index Max Date:', idx_max)
    print('Transactions Max Date:', trx_max)
