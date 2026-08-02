from sqlalchemy import create_engine, text
try:
    engine = create_engine('postgresql://openpg:openpgpwd@localhost:5432/stock')
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT \"Kode Saham\", \"Penutupan\", \"Tanggal Perdagangan Terakhir\" FROM saham_data WHERE \"Kode Saham\" IN ('IHSG', 'COMPOSITE', 'LQ45') LIMIT 5")).fetchall()
        for r in rows:
            print(r)
except Exception as e:
    print(e)
