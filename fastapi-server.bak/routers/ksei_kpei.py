from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_local_db as get_db
import traceback
from datetime import datetime

router = APIRouter(prefix="/clearing", tags=["ksei_kpei"])

@router.post("/run_settlement_batch")
def run_settlement_batch(db: Session = Depends(get_db)):
    """
    Simulasi KPEI Clearing & Settlement T+2.
    Fungsi ini dipanggil oleh cron job setiap hari (End of Day).
    Mencari semua ledger PENDING yang tanggal settlement-nya hari ini atau lewat, lalu mengeksekusinya.
    """
    try:
        today = datetime.now().date()
        
        # Ambil semua transaksi PENDING yang sudah masuk T+2
        pending_ledgers = db.execute(
            text("SELECT * FROM pe_settlement_ledger WHERE status = 'PENDING' AND settlement_date <= :today"),
            {"today": today}
        ).fetchall()
        
        settled_count = 0
        
        for ledger in pending_ledgers:
            # 1. Update RDN / Portfolio balances based on type
            if ledger.type == 'BUY_SETTLEMENT':
                # Dana benar-benar dipotong dari saldo RDN
                # Kita kurangi balance dan held_balance
                db.execute(
                    text("UPDATE pe_rdn_balance SET balance = balance - :amount, held_balance = held_balance - :amount WHERE user_id = :user_id"),
                    {"amount": ledger.amount, "user_id": ledger.user_id}
                )
                
                # Tambahkan saham ke portfolio (Custodian / KSEI)
                order = db.execute(text("SELECT symbol, quantity FROM pe_oms_orders WHERE id = :order_id"), {"order_id": ledger.order_id}).fetchone()
                if order:
                    # Cek apakah sudah punya
                    existing_asset = db.execute(text("SELECT id FROM pe_custodian_assets WHERE user_id = :user_id AND symbol = :symbol"), {"user_id": ledger.user_id, "symbol": order.symbol}).fetchone()
                    if existing_asset:
                        db.execute(
                            text("UPDATE pe_custodian_assets SET balance = balance + :qty, ksei_synced = false WHERE id = :id"),
                            {"qty": order.quantity, "id": existing_asset.id}
                        )
                    else:
                        db.execute(
                            text("INSERT INTO pe_custodian_assets (user_id, asset_type, symbol, balance, ksei_synced) VALUES (:user_id, 'STOCK', :symbol, :qty, false)"),
                            {"user_id": ledger.user_id, "symbol": order.symbol, "qty": order.quantity}
                        )

            elif ledger.type == 'SELL_SETTLEMENT':
                # Dana ditambahkan ke saldo RDN (T+2 good funds)
                db.execute(
                    text("UPDATE pe_rdn_balance SET balance = balance + :amount WHERE user_id = :user_id"),
                    {"amount": ledger.amount, "user_id": ledger.user_id}
                )
                
                # Kurangi saham dari portfolio
                order = db.execute(text("SELECT symbol, quantity FROM pe_oms_orders WHERE id = :order_id"), {"order_id": ledger.order_id}).fetchone()
                if order:
                    db.execute(
                        text("UPDATE pe_custodian_assets SET balance = balance - :qty, ksei_synced = false WHERE user_id = :user_id AND symbol = :symbol"),
                        {"qty": order.quantity, "user_id": ledger.user_id, "symbol": order.symbol}
                    )
            
            # 2. Tandai Ledger sebagai SETTLED
            db.execute(
                text("UPDATE pe_settlement_ledger SET status = 'SETTLED' WHERE id = :id"),
                {"id": ledger.id}
            )
            settled_count += 1
            
        db.commit()
        return {"status": "success", "message": f"Settlement Batch completed. {settled_count} records settled."}
    except Exception as e:
        db.rollback()
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ksei_sync")
def ksei_sync(db: Session = Depends(get_db)):
    """
    Simulasi Pelaporan Mutasi Harian ke KSEI AKSes / S-INVEST.
    Mengubah semua portfolio yang ksei_synced = false menjadi true.
    """
    try:
        res = db.execute(text("UPDATE pe_custodian_assets SET ksei_synced = true, last_synced_at = CURRENT_TIMESTAMP WHERE ksei_synced = false"))
        db.commit()
        return {"status": "success", "message": f"Successfully reported {res.rowcount} portfolio mutations to KSEI S-INVEST / AKSes"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
