from database import RemoteSession, LocalSession
from sqlalchemy import text

db_remote = RemoteSession()
db_local = LocalSession()
try:
    # Update tier in remote DB
    db_remote.execute(text("UPDATE users SET tier = 'admin' WHERE email = 'super@mytriv.com'"))
    db_remote.commit()
    print('Successfully updated remote database!')
    
    # Also update role in local DB
    db_local.execute(text("UPDATE users SET role = 'admin' WHERE email = 'super@mytriv.com'"))
    db_local.commit()
    print('Successfully updated local database!')
except Exception as e:
    print('Error:', e)
finally:
    db_remote.close()
    db_local.close()
