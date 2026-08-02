import sys
from database import get_remote_db, get_local_db
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()
try:
    r_db = next(get_remote_db())
    print('MAX trade_date in index_daily:', r_db.execute(text('SELECT MAX(trade_date) FROM index_daily')).scalar())
    print('Indices on MAX date:', r_db.execute(text('SELECT index_code, close_index FROM index_daily WHERE trade_date = (SELECT MAX(trade_date) FROM index_daily)')).fetchall())
    print('IHSG chart sample:', r_db.execute(text('SELECT trade_date, close_index FROM index_daily WHERE index_code = \'COMPOSITE\' ORDER BY trade_date DESC LIMIT 5')).fetchall())
except Exception as e:
    print('Error:', e)
