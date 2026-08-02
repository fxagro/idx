import os
import re

FILE_PATH = "/var/www/idx.mytriv.com/fastapi-server/routers/stocks.py"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the incorrect /index implementation
content = re.sub(r'@router\.get\("/index"\).*?(?=@router\.get\("/broker"\))', '', content, flags=re.DOTALL)

replacement_code = """@router.get("/index")
def get_index_data(period: str = "1week", db: Session = Depends(get_remote_db)):
    try:
        from datetime import datetime, timedelta
        days = 7 if period == "1week" else 30 if period == "1month" else 90
        min_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        query = text(\"\"\"
            WITH latest_dates AS (
                SELECT index_code, MAX(trade_date) as max_date
                FROM index_daily
                GROUP BY index_code
            )
            SELECT 
                a.index_code, 
                a.close_index, 
                a.change_index as selisih,
                a.volume, 
                a.value, 
                a.frequency,
                a.trade_date,
                a.market_cap
            FROM index_daily a
            JOIN latest_dates ld ON a.index_code = ld.index_code AND a.trade_date = ld.max_date
            ORDER BY a.volume DESC NULLS LAST
            LIMIT 50
        \"\"\")
        rows = db.execute(query).fetchall()
        data = []
        for r in rows:
            data.append({
                "kode_indeks": r[0],
                "penutupan": float(r[1] or 0),
                "selisih": float(r[2] or 0),
                "volume": float(r[3] or 0),
                "nilai": float(r[4] or 0),
                "frekuensi": float(r[5] or 0),
                "tanggal_perdagangan_terakhir": str(r[6]) if r[6] else datetime.now().isoformat(),
                "kapitalisasi_pasar": float(r[7] or 0)
            })
        return {"success": True, "data": data}
    except Exception as e:
        print(f"Error /index: {e}")
        return {"success": False, "data": []}

"""

# Insert it before /broker
content = re.sub(r'(@router\.get\("/broker"\))', replacement_code + r'\1', content)

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch 3 applied successfully.")
