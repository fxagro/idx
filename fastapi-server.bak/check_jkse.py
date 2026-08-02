from sqlalchemy import create_engine, text
try:
    engine = create_engine('postgresql://postgres:newpassword@62.171.183.236:5434/broker_db')
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT index_code, close_index FROM index_daily WHERE index_code LIKE '%JKSE%' OR index_code LIKE '%IHSG%' LIMIT 5")).fetchall()
        for r in rows:
            print(r)
except Exception as e:
    print(e)
