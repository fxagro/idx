import re

FILE_PATH = "/var/www/idx.mytriv.com/fastapi-server/routers/stocks.py"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Add ihsg_history logic before the return statement in get_index_data
ihsg_logic = """
        ihsg_query = text(\"\"\"
            SELECT trade_date, close_index 
            FROM index_daily 
            WHERE index_code IN ('IHSG', 'COMPOSITE') AND trade_date >= :min_date
            ORDER BY trade_date ASC
        \"\"\")
        ihsg_rows = db.execute(ihsg_query, {"min_date": min_date}).fetchall()
        ihsg_history = []
        for r in ihsg_rows:
            ihsg_history.append({
                "tanggal_perdagangan_terakhir": str(r[0]),
                "penutupan": float(r[1] or 0)
            })
            
        return {"success": True, "data": data, "ihsg_history": ihsg_history}
"""

content = re.sub(r'return \{"success": True, "data": data\}', ihsg_logic.strip(), content)

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch 6 applied successfully.")
