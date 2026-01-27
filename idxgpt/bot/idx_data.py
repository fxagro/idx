# idx_data.py
import os
import sys
import psycopg2
import pandas as pd
import yfinance as yf
from datetime import date, timedelta
from psycopg2.extras import execute_batch

DB = dict(
    dbname=os.getenv("PG_DB", "stock"),
    user=os.getenv("PG_USER", "openpg"),
    password=os.getenv("PG_PWD", "openpgpwd"),
    host=os.getenv("PG_HOST", "localhost"),
    port=os.getenv("PG_PORT", "5432"),
)

CSV_IDX = "idx_list.csv"  # hasil dari data CSV kamu

# -------- Load IDX symbols --------
def load_idx_symbols(limit=None):
    df = pd.read_csv(CSV_IDX)
    # asumsi kolom = "Kode Saham","Nama Perusahaan"
    df["Kode Saham"] = df["Kode Saham"].astype(str).str.upper()
    symbols = df["Kode Saham"].tolist()
    company_names = dict(zip(df["Kode Saham"], df["Nama Perusahaan"]))
    if limit:
        symbols = symbols[:limit]
    return symbols, company_names

# -------- Database --------
def ensure_table():
    conn = psycopg2.connect(**DB)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS idx_data (
          symbol TEXT NOT NULL,
          company_name TEXT,
          trade_date DATE NOT NULL,
          open NUMERIC, high NUMERIC, low NUMERIC, close NUMERIC,
          volume BIGINT, prev_close NUMERIC,
          PRIMARY KEY (symbol, trade_date)
        );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_idx_symbol ON idx_data(symbol);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_idx_date ON idx_data(trade_date);")
    conn.commit()
    cur.close(); conn.close()

def upsert_equities(rows):
    if not rows:
        return
    conn = psycopg2.connect(**DB)
    cur = conn.cursor()
    upsert_sql = """
        INSERT INTO idx_data (symbol, company_name, trade_date, open, high, low, close, volume, prev_close)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (symbol, trade_date) DO UPDATE SET
          company_name=EXCLUDED.company_name,
          open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low, close=EXCLUDED.close,
          volume=EXCLUDED.volume, prev_close=EXCLUDED.prev_close;
    """
    execute_batch(cur, upsert_sql, rows, page_size=200)
    conn.commit()
    cur.close(); conn.close()

# -------- Fetch --------
def fetch_for_range(symbols, company_names, start_date, end_date, batch_size=50):
    rows = []
    # Yahoo Finance pakai suffix ".JK" untuk saham IDX
    symbols_jk = [s + ".JK" for s in symbols]

    for i in range(0, len(symbols_jk), batch_size):
        batch = symbols_jk[i:i+batch_size]
        print(f"📡 Download batch {i//batch_size+1} ({len(batch)} tickers)…")
        hist = yf.download(
            tickers=" ".join(batch),
            start=start_date, end=end_date,
            interval="1d", group_by="ticker",
            auto_adjust=False, threads=True
        )
        for sym in batch:
            base_sym = sym.replace(".JK", "")
            try:
                df = hist[sym].dropna()
            except Exception:
                continue
            prev_close = None
            for idx, r in df.iterrows():
                d = idx.date()
                o = float(r["Open"]) if not pd.isna(r["Open"]) else None
                h = float(r["High"]) if not pd.isna(r["High"]) else None
                l = float(r["Low"]) if not pd.isna(r["Low"]) else None
                c = float(r["Close"]) if not pd.isna(r["Close"]) else None
                v = int(r["Volume"]) if not pd.isna(r["Volume"]) else 0
                cname = company_names.get(base_sym, base_sym)
                rows.append((base_sym, cname, d, o, h, l, c, v, prev_close))
                prev_close = c
    return rows

# -------- Main --------
if __name__ == "__main__":
    symbols, company_names = load_idx_symbols()
    print(f"✅ Ambil {len(symbols)} tickers dari IDX CSV")

    ensure_table()

    start_date = input("Masukkan start date (YYYY-MM-DD): ").strip()
    end_date = input("Masukkan end date   (YYYY-MM-DD / kosong jika hanya 1 hari): ").strip()

    if not start_date:
        start_date = date.today().isoformat()

    if not end_date:  
        end_date = (pd.to_datetime(start_date) + timedelta(days=1)).date().isoformat()
        print(f"📥 Mode single-date: {start_date}")
    else:
        print(f"📥 Mode range-date: {start_date} → {end_date}")

    rows = fetch_for_range(symbols, company_names, start_date, end_date)
    print(f"✅ Total rows fetched: {len(rows)}")
    upsert_equities(rows)
    print(f"💾 Data berhasil disimpan ke tabel idx_data untuk periode {start_date} → {end_date}")
