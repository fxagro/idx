import os
import re

FILE_PATH = "/var/www/idx.mytriv.com/fastapi-server/routers/stocks.py"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the /index and /broker mock routes and append /top-brokers
mock_index_pattern = r'@router\.get\("/index"\).*?\]\s*\}'
mock_broker_pattern = r'@router\.get\("/broker"\).*?\]\s*\}'

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
                a.close_index - COALESCE(b.close_index, a.close_index) as selisih,
                a.volume, 
                a.value, 
                a.freq,
                a.trade_date
            FROM index_daily a
            JOIN latest_dates ld ON a.index_code = ld.index_code AND a.trade_date = ld.max_date
            LEFT JOIN index_daily b ON a.index_code = b.index_code AND b.trade_date = (
                SELECT MAX(trade_date) FROM index_daily WHERE index_code = a.index_code AND trade_date < a.trade_date
            )
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
                "kapitalisasi_pasar": 0,
                "frekuensi": float(r[5] or 0),
                "tanggal_perdagangan_terakhir": str(r[6]) if r[6] else datetime.now().isoformat()
            })
        return {"success": True, "data": data}
    except Exception as e:
        print(f"Error /index: {e}")
        return {"success": False, "data": []}

@router.get("/broker")
def get_broker_data(period: str = "1week", db: Session = Depends(get_remote_db)):
    try:
        from datetime import datetime, timedelta
        days = 7 if period == "1week" else 30 if period == "1month" else 90
        min_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        query = text(\"\"\"
            SELECT 
                t.broker_code, 
                MAX(b.broker_name) as broker_name,
                SUM(t.buy_vol + t.sell_vol) as volume,
                SUM(t.buy_val + t.sell_val) as nilai,
                SUM(t.buy_freq + t.sell_freq) as frekuensi,
                MAX(t.trade_date) as tanggal
            FROM broker_transactions_daily t
            LEFT JOIN brokers b ON UPPER(t.broker_code) = UPPER(b.broker_code)
            WHERE t.trade_date >= :min_date
            GROUP BY t.broker_code
            ORDER BY volume DESC
            LIMIT 50
        \"\"\")
        rows = db.execute(query, {"min_date": min_date}).fetchall()
        data = []
        for r in rows:
            data.append({
                "kode_broker": r[0],
                "nama_perusahaan": r[1] or r[0],
                "volume": float(r[2] or 0),
                "nilai": float(r[3] or 0),
                "frekuensi": float(r[4] or 0),
                "tanggal": str(r[5]) if r[5] else datetime.now().isoformat()
            })
        return {"success": True, "data": data}
    except Exception as e:
        print(f"Error /broker: {e}")
        return {"success": False, "data": []}

@router.get("/top-brokers")
def get_top_brokers(days: int = 30, limit: int = 15, db: Session = Depends(get_remote_db)):
    try:
        from datetime import datetime, timedelta
        min_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        query = text(\"\"\"
            SELECT 
                t.broker_code, 
                MAX(b.broker_name) as broker_name,
                SUM(t.buy_vol) as total_buy, 
                SUM(t.sell_vol) as total_sell, 
                SUM(t.buy_vol) - SUM(t.sell_vol) as net_volume,
                SUM(t.buy_vol) + SUM(t.sell_vol) as total_volume
            FROM broker_transactions_daily t
            LEFT JOIN brokers b ON UPPER(t.broker_code) = UPPER(b.broker_code)
            WHERE t.trade_date >= :min_date
            GROUP BY t.broker_code
            ORDER BY net_volume DESC
            LIMIT :limit
        \"\"\")
        
        rows = db.execute(query, {"min_date": min_date, "limit": limit}).fetchall()
        
        brokers = []
        for idx, row in enumerate(rows):
            brokers.append({
                "rank": idx + 1,
                "brokerCode": row[0],
                "brokerName": row[1] or row[0],
                "totalBuy": float(row[2] or 0),
                "totalSell": float(row[3] or 0),
                "netVolume": float(row[4] or 0),
                "totalVolume": float(row[5] or 0),
                "netPercent": (float(row[4] or 0) / float(row[2] or 1) * 100) if float(row[2] or 0) > 0 else 0
            })
            
        return {"success": True, "period": f"{days} days", "brokers": brokers}
    except Exception as e:
        print(f"[top-brokers] Error: {e}")
        return {"success": False, "error": str(e), "brokers": []}
"""

content = re.sub(mock_index_pattern, '', content, flags=re.DOTALL)
content = re.sub(mock_broker_pattern, '', content, flags=re.DOTALL)

# Append to the end
content += "\n" + replacement_code + "\n"

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied successfully.")
