from database import get_remote_db
db = next(get_remote_db())
from sqlalchemy import text
rows = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'dca_gold_forward_trades'")).fetchall()
print([r[0] for r in rows])
