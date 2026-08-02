import sys
sys.path.append('/var/www/idx.mytriv.com/fastapi-server')
from database import get_remote_db, get_local_db
from sqlalchemy import text

print('--- Remote DB ---')
try:
    r_db = next(get_remote_db())
    print('index_daily count:', r_db.execute(text('SELECT COUNT(*) FROM index_daily')).scalar())
    print('stock_daily count:', r_db.execute(text('SELECT COUNT(*) FROM stock_daily')).scalar())
    print('transactions count:', r_db.execute(text('SELECT COUNT(*) FROM transactions')).scalar())
except Exception as e:
    print('Remote DB error:', e)

print('\n--- Local DB ---')
try:
    l_db = next(get_local_db())
    print('users count:', l_db.execute(text('SELECT COUNT(*) FROM users')).scalar())
    print('virtual_portfolio count:', l_db.execute(text('SELECT COUNT(*) FROM virtual_portfolio')).scalar())
    print('virtual_transactions count:', l_db.execute(text('SELECT COUNT(*) FROM virtual_transactions')).scalar())
    print('user_watchlist count:', l_db.execute(text('SELECT COUNT(*) FROM user_watchlist')).scalar())
except Exception as e:
    print('Local DB error:', e)
