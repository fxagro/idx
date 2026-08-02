from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_remote_db

router = APIRouter(tags=["Brokers"])

@router.get("/list")
def get_brokers_list(db: Session = Depends(get_remote_db)):
    try:
        query = text("SELECT broker_code, broker_name FROM brokers ORDER BY broker_code ASC")
        rows = db.execute(query).fetchall()
        
        brokers = []
        for r in rows:
            brokers.append({
                "code": r[0],
                "name": r[1] if r[1] else "Unknown Broker",
                "status": "active",
                "volume": 0
            })
            
        return {
            "success": True,
            "data": brokers
        }
    except Exception as e:
        print(f"Error fetching brokers: {str(e)}")
        return {
            "success": False,
            "error": "Failed to load broker data"
        }
