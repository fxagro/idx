from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from database import get_remote_db
import datetime
import pandas as pd
import numpy as np
import os

router = APIRouter(tags=["Finance & Accounting"])

class ProcessLedgerRequest(BaseModel):
    trade_date: str  # YYYY-MM-DD

class JournalCreateRequest(BaseModel):
    account_id: str
    ref_id: str
    description: str
    amount: float
    type: str  # 'Debit' or 'Credit'

@router.get("/finance/coa")
def get_chart_of_accounts(db: Session = Depends(get_remote_db)):
    try:
        query = text("""
            SELECT 
                account_id, account_name, type, class_id, is_group, level, depth, affiliated,
                default_ccy, default_office, vd51_52, vd51_52_cross, system_reval,
                lookup_in_finance, lookup_in_cashier, show_in_bs_pl, is_client_account,
                is_client_ar_ap, is_transaction, at_office, dept, broker, client,
                client_category, sales_person, stock, class_id_1, class_id_2,
                class_id_3, class_id_4, class_id_5, class_id_6, class_id_7,
                change_id, app_user_id, app_computer_name, app_ip_address, last_update
            FROM chart_of_accounts 
            ORDER BY account_id ASC
        """)
        rows = db.execute(query).fetchall()
        
        coa = []
        for r in rows:
            coa.append({
                "account_id": r[0],
                "account_name": r[1],
                "type": r[2],
                "class_id": r[3],
                "is_group": bool(r[4]),
                "level": r[5],
                "depth": r[6],
                "affiliated": bool(r[7]),
                "default_ccy": r[8],
                "default_office": r[9],
                "vd51_52": r[10],
                "vd51_52_cross": r[11],
                "system_reval": bool(r[12]),
                "lookup_in_finance": bool(r[13]),
                "lookup_in_cashier": bool(r[14]),
                "show_in_bs_pl": bool(r[15]),
                "is_client_account": bool(r[16]),
                "is_client_ar_ap": bool(r[17]),
                "is_transaction": bool(r[18]),
                "at_office": bool(r[19]),
                "dept": bool(r[20]),
                "broker": bool(r[21]),
                "client": bool(r[22]),
                "client_category": bool(r[23]),
                "sales_person": bool(r[24]),
                "stock": bool(r[25]),
                "class_id_1": r[26],
                "class_id_2": r[27],
                "class_id_3": r[28],
                "class_id_4": r[29],
                "class_id_5": r[30],
                "class_id_6": r[31],
                "class_id_7": r[32],
                "change_id": r[33],
                "app_user_id": r[34],
                "app_computer_name": r[35],
                "app_ip_address": r[36],
                "last_update": r[37].isoformat() if isinstance(r[37], datetime.datetime) else None
            })
            
        return {
            "success": True,
            "data": coa
        }
    except Exception as e:
        print(f"Error fetching Chart of Accounts: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to load Chart of Accounts data: {str(e)}"
        }

@router.post("/finance/ledger/process")
def process_daily_journals(req: ProcessLedgerRequest, db: Session = Depends(get_remote_db)):
    try:
        trade_date = req.trade_date
        # Validate format
        datetime.datetime.strptime(trade_date, "%Y-%m-%d")
        
        # 1. Delete existing journal entries for BJB for this date
        entry_id = f"JB-JV-{trade_date.replace('-', '')}"
        db.execute(text("DELETE FROM journal_entries WHERE entry_id = :entry_id"), {"entry_id": entry_id})
        
        # 2. Fetch trade data for broker JB on this date
        tx_query = text("""
            SELECT 
                SUM(CASE WHEN buy_vol > 0 THEN buy_val ELSE 0.0 END) as total_buy_val,
                SUM(CASE WHEN sell_vol > 0 THEN sell_val ELSE 0.0 END) as total_sell_val
            FROM transactions
            WHERE broker_code = 'JB' AND trade_date = :trade_date
        """)
        row = db.execute(tx_query, {"trade_date": trade_date}).fetchone()
        
        total_buy_val = float(row[0]) if row[0] is not None else 0.0
        total_sell_val = float(row[1]) if row[1] is not None else 0.0
        
        if total_buy_val == 0.0 and total_sell_val == 0.0:
            db.commit()
            return {
                "success": True,
                "message": f"No transactions found for date {trade_date} and broker JB. Journal entries cleared.",
                "data": {
                    "total_buy_val": 0.0,
                    "total_sell_val": 0.0,
                    "records_created": 0
                }
            }
            
        entries = []
        
        # 3. Process Buy Side (Debit Client AR, Credit AP KPEI, Credit Commission, Credit Levy)
        if total_buy_val > 0.0:
            commission = total_buy_val * 0.0015
            levy = total_buy_val * 0.00043
            client_ar = total_buy_val + commission + levy
            
            # Debit 1.1.05.01.01 (AR Client Buy)
            entries.append({
                "account_id": "1.1.05.01.01",
                "debit": client_ar,
                "credit": 0.0,
                "description": f"JB Buy Trades Client Receivable for {trade_date}"
            })
            # Credit 2.1.06.00.03 (AP KPEI Buy)
            entries.append({
                "account_id": "2.1.06.00.03",
                "debit": 0.0,
                "credit": total_buy_val,
                "description": f"JB Buy Trades KPEI Payable for {trade_date}"
            })
            # Credit 4.1.02.00.01 (Commission Income)
            entries.append({
                "account_id": "4.1.02.00.01",
                "debit": 0.0,
                "credit": commission,
                "description": f"JB Buy Trades Commission Income for {trade_date}"
            })
            # Credit 2.1.10.03.01 (IDX Levy Payable)
            entries.append({
                "account_id": "2.1.10.03.01",
                "debit": 0.0,
                "credit": levy,
                "description": f"JB Buy Trades IDX Levy Payable for {trade_date}"
            })
            
        # 4. Process Sell Side (Debit AR KPEI, Credit Client AP, Credit Commission, Credit Levy, Credit Tax)
        if total_sell_val > 0.0:
            commission = total_sell_val * 0.0025
            levy = total_sell_val * 0.00043
            pph = total_sell_val * 0.001
            client_ap = total_sell_val - commission - levy - pph
            
            # Debit 1.1.06.01.03 (AR KPEI Sell)
            entries.append({
                "account_id": "1.1.06.01.03",
                "debit": total_sell_val,
                "credit": 0.0,
                "description": f"JB Sell Trades KPEI Receivable for {trade_date}"
            })
            # Credit 2.1.05.01.01 (AP Client Sell)
            entries.append({
                "account_id": "2.1.05.01.01",
                "debit": 0.0,
                "credit": client_ap,
                "description": f"JB Sell Trades Client Payable for {trade_date}"
            })
            # Credit 4.1.02.00.01 (Commission Income)
            entries.append({
                "account_id": "4.1.02.00.01",
                "debit": 0.0,
                "credit": commission,
                "description": f"JB Sell Trades Commission Income for {trade_date}"
            })
            # Credit 2.1.10.03.01 (IDX Levy Payable)
            entries.append({
                "account_id": "2.1.10.03.01",
                "debit": 0.0,
                "credit": levy,
                "description": f"JB Sell Trades IDX Levy Payable for {trade_date}"
            })
            # Credit 2.1.10.02.06 (Tax Payable)
            entries.append({
                "account_id": "2.1.10.02.06",
                "debit": 0.0,
                "credit": pph,
                "description": f"JB Sell Trades PPH Final Tax Payable for {trade_date}"
            })
            
        # --- PROPRIETARY DCA TRADES --- 
        dca_tables = db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'dca_%_trades'")).fetchall()
        dca_buy_total = 0.0
        dca_sell_total = 0.0
        dca_pnl_total = 0.0
        
        for t_tuple in dca_tables:
            t_name = t_tuple[0]
            # Fetch columns to handle schema variations (e.g. gold uses buy_price, fibo uses price/type)
            cols = db.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{t_name}'")).fetchall()
            columns = [c[0] for c in cols]
            
            if 'type' in columns and 'price' in columns: # fibo trades
                buy_query = text(f"""
                    SELECT SUM(price * lots * 100) 
                    FROM {t_name} 
                    WHERE DATE(trade_time) = :trade_date AND type = 'BUY'
                """)
                buy_val = db.execute(buy_query, {"trade_date": trade_date}).scalar()
                dca_buy_total += float(buy_val) if buy_val else 0.0
                
                sell_query = text(f"""
                    SELECT SUM(price * lots * 100), SUM(net_pnl)
                    FROM {t_name}
                    WHERE DATE(trade_time) = :trade_date AND type = 'SELL'
                """)
                sell_row = db.execute(sell_query, {"trade_date": trade_date}).fetchone()
                dca_sell_total += float(sell_row[0]) if sell_row and sell_row[0] else 0.0
                dca_pnl_total += float(sell_row[1]) if sell_row and sell_row[1] else 0.0
                
            else:
                buy_col = 'buy_at' if 'buy_at' in columns else 'buy_price' if 'buy_price' in columns else None
                sell_col = 'sell_at' if 'sell_at' in columns else 'sell_price' if 'sell_price' in columns else None
                buy_time_col = 'buy_time' if 'buy_time' in columns else 'trade_time'
                
                if buy_col and sell_col:
                    # Buy Query
                    buy_query = text(f"""
                        SELECT SUM({buy_col} * lots * 100) 
                        FROM {t_name} 
                        WHERE DATE({buy_time_col}) = :trade_date
                    """)
                    buy_val = db.execute(buy_query, {"trade_date": trade_date}).scalar()
                    dca_buy_total += float(buy_val) if buy_val else 0.0
                    
                    # Sell Query
                    sell_query = text(f"""
                        SELECT SUM({sell_col} * lots * 100), SUM(net_pnl)
                        FROM {t_name}
                        WHERE DATE(trade_time) = :trade_date AND {sell_col} IS NOT NULL
                    """)
                    sell_row = db.execute(sell_query, {"trade_date": trade_date}).fetchone()
                    dca_sell_total += float(sell_row[0]) if sell_row and sell_row[0] else 0.0
                    dca_pnl_total += float(sell_row[1]) if sell_row and sell_row[1] else 0.0
            
        if dca_buy_total > 0:
            # Debit 1.1.04.01.01 (Portofolio Efek Perusahaan) 
            entries.append({
                "account_id": "1.1.04.01.01",
                "debit": dca_buy_total,
                "credit": 0.0,
                "description": f"Proprietary DCA Buy Trades for {trade_date}"
            })
            # Credit 1.1.01.01.01 (Kas - dummy assuming Kas for prop trades)
            entries.append({
                "account_id": "1.1.01.01.01",
                "debit": 0.0,
                "credit": dca_buy_total,
                "description": f"Proprietary DCA Buy Cash Outflow for {trade_date}"
            })
            
        if dca_sell_total > 0:
            # Debit 1.1.01.01.01 (Kas)
            entries.append({
                "account_id": "1.1.01.01.01",
                "debit": dca_sell_total,
                "credit": 0.0,
                "description": f"Proprietary DCA Sell Cash Inflow for {trade_date}"
            })
            # Credit 1.1.04.01.01 (Portofolio Efek Perusahaan)
            prop_cost = dca_sell_total - dca_pnl_total
            entries.append({
                "account_id": "1.1.04.01.01",
                "debit": 0.0,
                "credit": prop_cost if prop_cost > 0 else 0.0,
                "description": f"Proprietary DCA Sell Cost Base for {trade_date}"
            })
            # PnL (4.1.01.00.01 - Keuntungan Transaksi Efek)
            if dca_pnl_total > 0:
                entries.append({
                    "account_id": "4.1.01.00.01",
                    "debit": 0.0,
                    "credit": dca_pnl_total,
                    "description": f"Proprietary DCA Realized Gain for {trade_date}"
                })
            elif dca_pnl_total < 0:
                entries.append({
                    "account_id": "4.1.01.00.01",
                    "debit": abs(dca_pnl_total),
                    "credit": 0.0,
                    "description": f"Proprietary DCA Realized Loss for {trade_date}"
                })

        # 5. Save all entries
        insert_query = text("""
            INSERT INTO journal_entries (entry_id, trade_date, account_id, debit, credit, description, status)
            VALUES (:entry_id, :trade_date, :account_id, :debit, :credit, :description, 'Posted')
        """)
        for ent in entries:
            db.execute(insert_query, {
                "entry_id": entry_id,
                "trade_date": trade_date,
                "account_id": ent["account_id"],
                "debit": ent["debit"],
                "credit": ent["credit"],
                "description": ent["description"]
            })
            
        db.commit()
        return {
            "success": True,
            "message": f"Successfully processed journal entries for date {trade_date}. Created {len(entries)} postings.",
            "data": {
                "total_buy_val": total_buy_val,
                "total_sell_val": total_sell_val,
                "dca_buy_total": dca_buy_total,
                "dca_sell_total": dca_sell_total,
                "records_created": len(entries)
            }
        }
    except Exception as e:
        db.rollback()
        print(f"Error processing daily journals: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process daily journals: {str(e)}")

@router.get("/finance/ledger")
def get_ledger_entries(trade_date: str, db: Session = Depends(get_remote_db)):
    try:
        # Validate format
        datetime.datetime.strptime(trade_date, "%Y-%m-%d")
        
        query = text("""
            SELECT j.id, j.entry_id, j.trade_date, j.account_id, c.account_name, j.debit, j.credit, j.description, j.status
            FROM journal_entries j
            JOIN chart_of_accounts c ON j.account_id = c.account_id
            WHERE j.trade_date = :trade_date
            ORDER BY j.id ASC
        """)
        rows = db.execute(query, {"trade_date": trade_date}).fetchall()
        
        data = []
        for r in rows:
            data.append({
                "id": r[0],
                "entry_id": r[1],
                "trade_date": r[2].isoformat() if isinstance(r[2], datetime.date) else str(r[2]),
                "account_id": r[3],
                "account_name": r[4],
                "debit": float(r[5]),
                "credit": float(r[6]),
                "description": r[7],
                "status": r[8]
            })
            
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        print(f"Error fetching ledger entries: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to load ledger entries: {str(e)}")

@router.get("/finance/mkbd")
def get_adjusted_mkbd(trade_date: str, db: Session = Depends(get_remote_db)):
    try:
        # Validate format
        datetime.datetime.strptime(trade_date, "%Y-%m-%d")
        
        # 1. Locate the excel template
        # Check if there is an excel file specific to this date, e.g. PED folder
        date_clean = trade_date.replace('-', '')
        xls_path = f"/var/www/idx.mytriv.com/ped/{date_clean}.xls"
        if not os.path.exists(xls_path):
            # Fallback to the default 20260521 template
            xls_path = "/var/www/idx.mytriv.com/ped/20260521.xls"
            
        if not os.path.exists(xls_path):
            raise HTTPException(status_code=404, detail=f"Base MKBD excel template not found at {xls_path}")
            
        # 2. Parse the Excel file
        xl = pd.ExcelFile(xls_path)
        df_vd59 = xl.parse('V.D.5-9')
        
        mkbd_summary = {
            "total_current_assets": 0.0,
            "total_liabilities": 0.0,
            "total_ranking_liabilities": 0.0,
            "net_working_capital": 0.0,
            "total_mkbd": 0.0,
            "required_mkbd": 0.0,
            "excess_mkbd": 0.0,
            "excess_ratio": 0.0
        }
        haircut_items = []
        
        for idx, row in df_vd59.iterrows():
            row_vals = list(row.values)
            if len(row_vals) < 14:
                continue
                
            desc = ""
            for col_idx in [1, 2, 3, 4]:
                val = row_vals[col_idx]
                if pd.notna(val) and isinstance(val, str) and val.strip() != "":
                    cleaned = val.strip()
                    if cleaned not in ['B', 'A', 'C', 'D', 'E', 'F', 'G'] and not cleaned.startswith('V.D.5-'):
                        desc = cleaned
                        break
            
            src_form = str(row_vals[8]).strip() if pd.notna(row_vals[8]) else ""
            
            val_11 = row_vals[11] if pd.notna(row_vals[11]) and isinstance(row_vals[11], (int, float)) else 0.0
            val_13 = row_vals[13] if pd.notna(row_vals[13]) and isinstance(row_vals[13], (int, float)) else 0.0
            val_actual = val_13 if val_13 != 0.0 else val_11
            
            if "Total Aset Lancar" in desc:
                mkbd_summary["total_current_assets"] = val_actual
            elif "Total Liabilitas" in desc and "V.D.5-2" in src_form:
                mkbd_summary["total_liabilities"] = val_actual
            elif "Total Ranking Liabilities" in desc and "V.D.5-3" in src_form:
                mkbd_summary["total_ranking_liabilities"] = val_actual
            elif "Total Modal Kerja" in desc and ("Baris 9" in desc or "Baris 13" in desc or "dikurangi" in desc):
                mkbd_summary["net_working_capital"] = val_actual
            elif "Total Modal Kerja Bersih Disesuaikan" in desc:
                mkbd_summary["total_mkbd"] = val_actual
            elif "NILAI MKBD YANG DIWAJIBKAN" in desc:
                mkbd_summary["required_mkbd"] = val_actual
            elif "LEBIH (KURANG) MKBD" in desc:
                mkbd_summary["excess_mkbd"] = val_actual

            if src_form == "V.D.5-1":
                book_val = row_vals[11]
                haircut_pct = row_vals[12]
                haircut_val = row_vals[13]
                
                if pd.notna(book_val) and isinstance(book_val, (int, float)) and book_val > 0:
                    h_pct = haircut_pct * 100 if pd.notna(haircut_pct) and isinstance(haircut_pct, (int, float)) else 0.0
                    h_val = haircut_val if pd.notna(haircut_val) and isinstance(haircut_val, (int, float)) else 0.0
                    
                    haircut_items.append({
                        "desc": desc,
                        "book_value": float(book_val),
                        "haircut_pct": round(float(h_pct), 2),
                        "haircut_value": float(h_val),
                        "adjusted_value": float(book_val - h_val)
                    })

        # 3. Query processed ledger accounts for this date to layer the BJB transactions dynamically
        ledger_query = text("""
            SELECT account_id, SUM(debit) as total_debit, SUM(credit) as total_credit
            FROM journal_entries
            WHERE trade_date = :trade_date
            GROUP BY account_id
        """)
        ledger_rows = db.execute(ledger_query, {"trade_date": trade_date}).fetchall()
        
        # Calculate dynamic offsets from trades
        client_ar_debit = 0.0
        client_ap_credit = 0.0
        kpei_ar_debit = 0.0
        kpei_ap_credit = 0.0
        tax_levy_credit = 0.0
        commission_credit = 0.0
        
        for r in ledger_rows:
            acc_id = r[0]
            debit = float(r[1])
            credit = float(r[2])
            
            if acc_id == "1.1.05.01.01": # Client AR
                client_ar_debit += debit - credit
            elif acc_id == "2.1.05.01.01": # Client AP
                client_ap_credit += credit - debit
            elif acc_id == "1.1.06.01.03": # KPEI AR
                kpei_ar_debit += debit - credit
            elif acc_id == "2.1.06.00.03": # KPEI AP
                kpei_ap_credit += credit - debit
            elif acc_id in ["2.1.10.03.01", "2.1.10.02.06"]: # Levy / Tax
                tax_levy_credit += credit - debit
            elif acc_id == "4.1.02.00.01": # Commission
                commission_credit += credit - debit
                
        # 4. Apply adjustments
        # Assets adjustment: Client AR + KPEI AR
        assets_offset = client_ar_debit + kpei_ar_debit
        # Liabilities adjustment: Client AP + KPEI AP + Tax Levy
        liabilities_offset = client_ap_credit + kpei_ap_credit + tax_levy_credit
        
        # Dynamic haircut on Client AR: 10%
        client_ar_haircut = 0.0
        if client_ar_debit > 0.0:
            client_ar_haircut = client_ar_debit * 0.10
            haircut_items.append({
                "desc": "PT BJB Sekuritas Client AR (Dynamic Trade Processing)",
                "book_value": client_ar_debit,
                "haircut_pct": 10.0,
                "haircut_value": client_ar_haircut,
                "adjusted_value": client_ar_debit - client_ar_haircut
            })
            
        # Recalculate summary metrics
        orig_summary = mkbd_summary.copy()
        
        mkbd_summary["total_current_assets"] += assets_offset
        mkbd_summary["total_liabilities"] += liabilities_offset
        mkbd_summary["net_working_capital"] = mkbd_summary["total_current_assets"] - mkbd_summary["total_liabilities"] - mkbd_summary["total_ranking_liabilities"]
        
        # Recalculate total haircuts
        base_haircuts = sum(item["haircut_value"] for item in haircut_items[:-1]) if client_ar_haircut > 0.0 else sum(item["haircut_value"] for item in haircut_items)
        total_haircuts = base_haircuts + client_ar_haircut
        
        mkbd_summary["total_mkbd"] = mkbd_summary["net_working_capital"] - total_haircuts
        # required_mkbd is static OJK requirements or dynamic minimum. Let's keep base requirement.
        if mkbd_summary["required_mkbd"] == 0.0:
            # Fallback if required was not parsed
            mkbd_summary["required_mkbd"] = 4149923094.75
            
        mkbd_summary["excess_mkbd"] = mkbd_summary["total_mkbd"] - mkbd_summary["required_mkbd"]
        
        if mkbd_summary["required_mkbd"] > 0.0:
            mkbd_summary["excess_ratio"] = round((mkbd_summary["total_mkbd"] / mkbd_summary["required_mkbd"]) * 100, 2)
            
        # Clean any NaN or Inf to avoid JSON errors
        for k, v in mkbd_summary.items():
            if pd.isna(v) or np.isinf(v):
                mkbd_summary[k] = 0.0
                
        return {
            "success": True,
            "data": {
                "summary": mkbd_summary,
                "original_summary": orig_summary,
                "haircut_items": haircut_items,
                "adjustments": {
                    "client_ar_debit": client_ar_debit,
                    "kpei_ar_debit": kpei_ar_debit,
                    "client_ap_credit": client_ap_credit,
                    "kpei_ap_credit": kpei_ap_credit,
                    "tax_levy_credit": tax_levy_credit,
                    "commission_credit": commission_credit,
                    "client_ar_haircut": client_ar_haircut
                }
            }
        }
    except Exception as e:
        print(f"Error calculating MKBD: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to calculate MKBD: {str(e)}")

@router.get("/finance/report")
def get_ojk_report(form: str, trade_date: str):
    try:
        # Validate format
        datetime.datetime.strptime(trade_date, "%Y-%m-%d")
        
        # 1. Locate the excel template
        date_clean = trade_date.replace('-', '')
        xls_path = f"/var/www/idx.mytriv.com/ped/{date_clean}.xls"
        if not os.path.exists(xls_path):
            xls_path = "/var/www/idx.mytriv.com/ped/20260521.xls"
            
        if not os.path.exists(xls_path):
            # Fallback for local testing
            xls_path = r"C:\Users\USER\Downloads\ped\20260521.xls"
            
        if not os.path.exists(xls_path):
            raise HTTPException(status_code=404, detail=f"Base MKBD excel template not found at {xls_path}")
            
        # 2. Parse the specified sheet
        xl = pd.ExcelFile(xls_path)
        if form not in xl.sheet_names:
            raise HTTPException(status_code=404, detail=f"Sheet {form} not found in template")
            
        df = xl.parse(form)
        rows = []
        for idx, row in df.iterrows():
            vals = []
            for v in list(row.values):
                if pd.isna(v):
                    vals.append(None)
                elif isinstance(v, (datetime.datetime, datetime.date)):
                    vals.append(v.isoformat())
                else:
                    vals.append(v)
                    
            if all(v is None for v in vals):
                continue
                
            # Try to get row number
            row_no = vals[0]
            if row_no is not None and isinstance(row_no, (int, float)):
                row_no = int(row_no) if row_no == int(row_no) else row_no
            else:
                row_no = None
                
            # Find description (first non-empty text in cols 1, 2, 3, 4)
            desc = ""
            for c in [1, 2, 3, 4]:
                if c < len(vals) and vals[c] is not None:
                    val_str = str(vals[c]).strip()
                    if val_str != "" and val_str not in ['A', 'B', 'C', 'D', 'E', 'F', 'G']:
                        desc = val_str
                        break
                        
            rows.append({
                "index": idx,
                "row_no": row_no,
                "description": desc,
                "values": vals
            })
            
        return {
            "success": True,
            "form": form,
            "trade_date": trade_date,
            "rows": rows
        }
    except Exception as e:
        print(f"Error parsing report sheet {form}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to load report sheet {form}: {str(e)}")

@router.post("/finance/journal")
def create_journal_entry(req: JournalCreateRequest, db: Session = Depends(get_remote_db)):
    try:
        trade_date = datetime.datetime.now().strftime("%Y-%m-%d")
        # Generate entry_id
        entry_id = f"JN-{datetime.datetime.now().year}-{str(np.random.randint(100, 999))}"
        
        debit = req.amount if req.type == 'Debit' else 0.0
        credit = req.amount if req.type == 'Credit' else 0.0
        
        # Extract only the ID part if account string contains name (e.g. '10101 - Cash on Hand')
        acc_id = req.account_id.split(' - ')[0] if ' - ' in req.account_id else req.account_id
        
        insert_query = text("""
            INSERT INTO journal_entries (entry_id, trade_date, account_id, debit, credit, description, status)
            VALUES (:entry_id, :trade_date, :account_id, :debit, :credit, :description, 'Pending')
        """)
        db.execute(insert_query, {
            "entry_id": entry_id,
            "trade_date": trade_date,
            "account_id": acc_id,
            "debit": debit,
            "credit": credit,
            "description": f"[{req.ref_id}] {req.description}"
        })
        db.commit()
        return {"success": True, "message": "Journal entry created successfully.", "entry_id": entry_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create journal entry: {str(e)}")

@router.put("/finance/journal/approve/{entry_id}")
def approve_journal_entry(entry_id: str, db: Session = Depends(get_remote_db)):
    try:
        update_query = text("UPDATE journal_entries SET status = 'Posted' WHERE entry_id = :entry_id")
        res = db.execute(update_query, {"entry_id": entry_id})
        if res.rowcount == 0:
            # Try matching id if entry_id doesn't match
            update_query = text("UPDATE journal_entries SET status = 'Posted' WHERE id = :id_val")
            try:
                res = db.execute(update_query, {"id_val": int(entry_id.split('-')[-1]) if '-' in entry_id else int(entry_id)})
            except:
                pass
        db.commit()
        return {"success": True, "message": f"Journal entry {entry_id} approved."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to approve journal entry: {str(e)}")

@router.get("/finance/financial_statements")
def get_financial_statements(trade_date: str, report_type: str, db: Session = Depends(get_remote_db)):
    try:
        datetime.datetime.strptime(trade_date, "%Y-%m-%d")
        # Query aggregated ledger
        query = text("""
            SELECT c.account_name, SUM(j.debit) as total_debit, SUM(j.credit) as total_credit, c.type
            FROM journal_entries j
            JOIN chart_of_accounts c ON j.account_id = c.account_id
            WHERE j.trade_date <= :trade_date AND j.status = 'Posted'
            GROUP BY c.account_name, c.type
        """)
        rows = db.execute(query, {"trade_date": trade_date}).fetchall()
        
        report_rows = []
        total = 0.0
        idx = 1
        for r in rows:
            acc_name = r[0]
            debit = float(r[1]) if r[1] else 0.0
            credit = float(r[2]) if r[2] else 0.0
            ctype = r[3] or ''
            
            # Simple assignment for balance sheet / income statement
            if report_type == 'balance_sheet':
                if 'Asset' in ctype or 'Aset' in ctype or '1' in ctype:
                    balance = debit - credit
                    total += balance
                    report_rows.append({"id": idx, "description": acc_name, "amount": balance})
                    idx += 1
                elif 'Liab' in ctype or 'Equit' in ctype or '2' in ctype or '3' in ctype:
                    balance = credit - debit
                    total += balance
                    report_rows.append({"id": idx, "description": acc_name, "amount": balance})
                    idx += 1
            else: # income_statement
                if 'Rev' in ctype or 'Income' in ctype or 'Pendapatan' in ctype or '4' in ctype:
                    balance = credit - debit
                    total += balance
                    report_rows.append({"id": idx, "description": acc_name, "amount": balance})
                    idx += 1
                elif 'Exp' in ctype or 'Beban' in ctype or '5' in ctype:
                    balance = debit - credit
                    total -= balance
                    report_rows.append({"id": idx, "description": acc_name, "amount": balance})
                    idx += 1
                    
        # Add total row
        report_rows.append({"id": idx, "description": f"Total {report_type.replace('_', ' ').title()}", "amount": total})
        
        return {
            "success": True,
            "data": {
                "report_type": report_type,
                "trade_date": trade_date,
                "rows": report_rows
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load financial statements: {str(e)}")

@router.get("/finance/subsidiary_ledger")
def get_subsidiary_ledger(trade_date: str, client_code: str = None, db: Session = Depends(get_remote_db)):
    try:
        datetime.datetime.strptime(trade_date, "%Y-%m-%d")
        return {
            "success": True,
            "data": [
                {"id": "TRX-001", "client": "NID-8291", "trade_date": trade_date, "description": "Beli BBCA", "debit": 50000000, "credit": 0, "balance": 50000000},
                {"id": "TRX-002", "client": "NID-8291", "trade_date": trade_date, "description": "Setoran Tunai", "debit": 0, "credit": 50000000, "balance": 0}
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load subsidiary ledger: {str(e)}")

@router.get("/finance/cash_management")
def get_cash_management(trade_date: str, db: Session = Depends(get_remote_db)):
    try:
        return {
            "success": True,
            "data": {
                "internal_accounts": [
                    {"bank": "BCA Operasional", "balance": 25000000000},
                    {"bank": "Mandiri Settlement", "balance": 18000000000}
                ],
                "rdn_summary": {
                    "total_rdn_balance": 125000000000,
                    "total_clients": 1542
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load cash management: {str(e)}")

@router.get("/finance/ar_ageing")
def get_ar_ageing(trade_date: str, db: Session = Depends(get_remote_db)):
    try:
        return {
            "success": True,
            "data": [
                {"client": "Budi Santoso", "ar_amount": 15000000, "t_plus": 0, "haircut_penalty": 0, "status": "T+0"},
                {"client": "Siti Aminah", "ar_amount": 25000000, "t_plus": 2, "haircut_penalty": 0, "status": "T+2"},
                {"client": "John Doe", "ar_amount": 50000000, "t_plus": 5, "haircut_penalty": 50000000, "status": "T+5 (Overdue)"}
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load AR ageing: {str(e)}")

import uuid as uuid_lib

class TradeJournalRequest(BaseModel):
    user_id: int
    symbol: str
    side: str
    quantity: int
    price: float
    total_value: float
    engine: str = ""

@router.post("/finance/trade-journal")
def create_trade_journal(req: TradeJournalRequest, db: Session = Depends(get_remote_db)):
    '''Create double-entry journal entries for DCA trades.'''
    try:
        trade_date = datetime.datetime.now().strftime("%Y-%m-%d")
        entry_id = "DCA-" + uuid_lib.uuid4().hex[:8].upper()
        fee_rate = 0.0015 if req.side.upper() == "BUY" else 0.0025
        fee = req.total_value * fee_rate
        
        if req.side.upper() == "BUY":
            entries = [
                ("1.1.04.01.01", req.total_value, 0.0, "DCA Buy " + req.symbol + " User " + str(req.user_id)),
                ("1.1.01.01.01", 0.0, req.total_value, "DCA Buy Cash Out " + req.symbol),
                ("4.1.02.00.01", 0.0, fee, "DCA Buy Fee " + req.symbol),
            ]
        else:
            pnl = req.total_value - (req.price * req.quantity)
            entries = [
                ("1.1.01.01.01", req.total_value, 0.0, "DCA Sell Cash In " + req.symbol + " User " + str(req.user_id)),
                ("1.1.04.01.01", 0.0, req.total_value - max(pnl, 0), "DCA Sell Cost " + req.symbol),
            ]
            if pnl > 0:
                entries.append(("4.1.01.00.01", 0.0, pnl, "DCA Realized Gain " + req.symbol))
            elif pnl < 0:
                entries.append(("4.1.01.00.01", abs(pnl), 0.0, "DCA Realized Loss " + req.symbol))
            entries.append(("4.1.02.00.01", 0.0, fee, "DCA Sell Fee " + req.symbol))
        
        for acc_id, debit, credit, desc in entries:
            db.execute(
                text("INSERT INTO journal_entries (entry_id, trade_date, account_id, debit, credit, description, status) VALUES (:eid, :td, :aid, :d, :c, :desc, 'Posted')"),
                {"eid": entry_id, "td": trade_date, "aid": acc_id, "d": debit, "c": credit, "desc": desc}
            )
        
        db.commit()
        return {"success": True, "message": "Journal created: " + entry_id, "entries": len(entries)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
