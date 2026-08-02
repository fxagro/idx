import sys
sys.path.append("/var/www/idx.mytriv.com/fastapi-server")
from database import get_remote_db
from sqlalchemy import text

try:
    db = next(get_remote_db())
    result = db.execute(text("SELECT * FROM stock_signals LIMIT 1")).mappings().first()
    if result:
        print(dict(result))
    else:
        print("No data in stock_signals table.")
except Exception as e:
    print(f"Error: {e}")
