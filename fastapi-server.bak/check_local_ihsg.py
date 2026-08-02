from sqlalchemy import create_engine, text
try:
    engine = create_engine('postgresql://openpg:openpgpwd@localhost:5432/stock')
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT * FROM saham_data WHERE \"Kode Indeks\" = 'IHSG' OR \"Kode Saham\" = 'IHSG' LIMIT 5")).fetchall()
        for r in rows:
            print(r)
except Exception as e:
    print(e)
