import sys
import os
sys.path.append('/var/www/idx.mytriv.com/fastapi-server')

from database import LocalSession
from models import User

db = LocalSession()
user = db.query(User).filter(User.email == 'super@mytriv.com').first()
if user:
    user.role = 'enterprise'
    user.virtual_saldo = 999000000000  # 999 Billion
    db.commit()
    print('Updated user and balance')
else:
    print('User not found')
