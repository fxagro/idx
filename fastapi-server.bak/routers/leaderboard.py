from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_local_db as get_db

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])

@router.get("")
def get_leaderboard(db: Session = Depends(get_db)):
    try:
        result = db.execute(
            text("SELECT id, email, virtual_saldo FROM users WHERE virtual_saldo > 0 ORDER BY virtual_saldo DESC LIMIT 10")
        ).fetchall()
        leaderboard = []
        for i, row in enumerate(result):
            leaderboard.append({
                "rank": i + 1,
                "email": row.email,
                "virtual_saldo": float(row.virtual_saldo) if row.virtual_saldo else 0.0,
                "avatar": None
            })
        return {"success": True, "leaderboard": leaderboard}
    except Exception as e:
        return {"success": False, "leaderboard": [], "message": str(e)}
