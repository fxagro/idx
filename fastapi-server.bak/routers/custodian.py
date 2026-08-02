from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_local_db as get_db
import traceback

router = APIRouter(prefix="/custodian", tags=["custodian"])

@router.get("/assets")
def get_assets(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT * FROM pe_custodian_assets ORDER BY updated_at DESC LIMIT 100")).fetchall()
        assets = [dict(row._mapping) for row in result]
        return {"status": "success", "data": assets}
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/assets/sync")
def sync_assets(asset_ids: list[int] = Body(...), db: Session = Depends(get_db)):
    try:
        # Simulate syncing with KSEI C-BEST
        for asset_id in asset_ids:
            db.execute(text("UPDATE pe_custodian_assets SET ksei_synced = true, last_synced_at = CURRENT_TIMESTAMP WHERE id = :id"), {"id": asset_id})
        db.commit()
        return {"status": "success", "message": f"Successfully synced {len(asset_ids)} assets with KSEI"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
