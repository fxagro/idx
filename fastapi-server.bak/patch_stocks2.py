import os
import re

FILE_PATH = "/var/www/idx.mytriv.com/fastapi-server/routers/stocks.py"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the incorrect /broker and /top-brokers implementations we just added
content = re.sub(r'@router\.get\("/broker"\).*?(?=@router\.get\("/top-brokers"\))', '', content, flags=re.DOTALL)
content = re.sub(r'@router\.get\("/top-brokers"\).*', '', content, flags=re.DOTALL)

replacement_code = """@router.get("/broker")
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
            FROM transactions t
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
                SUM(t.net_vol) as net_volume,
                SUM(t.buy_vol) + SUM(t.sell_vol) as total_volume
            FROM transactions t
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

content += replacement_code

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch 2 applied successfully.")
