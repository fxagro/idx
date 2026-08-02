from sqlalchemy import create_engine, text

engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')

with engine.connect() as conn:
    # Get DCA tables
    tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'dca%'")).fetchall()
    print("DCA Tables:", [t[0] for t in tables])

    # Get columns for dca_mbx_trades
    columns_trades = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dca_mbx_trades'")).fetchall()
    print("\ndca_mbx_trades columns:", columns_trades)

    # Get columns for dca_kompas_trades (or similar)
    columns_kompas = conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'dca_kompas_trades'")).fetchall()
    print("\ndca_kompas_trades columns:", columns_kompas)
