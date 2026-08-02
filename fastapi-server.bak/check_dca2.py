from sqlalchemy import create_engine, text

engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')

with engine.connect() as conn:
    tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'dca_%_trades'")).fetchall()
    for t in tables:
        t_name = t[0]
        cols = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{t_name}'")).fetchall()
        print(f"{t_name}: {[c[0] for c in cols]}")
