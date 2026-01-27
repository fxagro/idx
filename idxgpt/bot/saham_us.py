# etl_us_300.py
import os
import psycopg2
import pandas as pd
import yfinance as yf
from datetime import date
from psycopg2.extras import execute_batch

DB = {
    'dbname': os.getenv("PG_DB", "stock"),
    'user': os.getenv("PG_USER", "openpg"),
    'password': os.getenv("PG_PWD", "openpgpwd"),
    'host': os.getenv("PG_HOST", "localhost"),
    'port': os.getenv("PG_PORT", "5432"),
}

def get_sp500_tickers():
    url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
    tables = pd.read_html(url)
    df = tables[0]
    tickers = df['Symbol'].tolist()
    tickers = [t.replace('.', '-') for t in tickers]
    return tickers

print("📥 Mengambil daftar S&P 500 dari Wikipedia…")
symbols = get_sp500_tickers()[:300]
print(f"✅ Ambil {len(symbols)} tickers.")

def get_company_name(symbol):
    try:
        return yf.Ticker(symbol).info.get("longName", symbol)
    except:
        return symbol

company_names = {sym: get_company_name(sym) for sym in symbols}

def ensure_table():
    conn = psycopg2.connect(**DB)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS usa_data (
          symbol TEXT NOT NULL,
          company_name TEXT,
          trade_date DATE NOT NULL,
          open NUMERIC, high NUMERIC, low NUMERIC, close NUMERIC,
          volume BIGINT, prev_close NUMERIC,
          PRIMARY KEY (symbol, trade_date)
        );""")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_usa_symbol ON usa_data(symbol);")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_usa_date ON usa_data(trade_date);")
    conn.commit()
    cur.close(); conn.close()

def upsert_equities(rows):
    if not rows:
        return
    conn = psycopg2.connect(**DB)
    cur = conn.cursor()
    upsert_sql = """
        INSERT INTO usa_data (symbol, company_name, trade_date, open, high, low, close, volume, prev_close)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (symbol, trade_date) DO UPDATE SET
          company_name=EXCLUDED.company_name,
          open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low, close=EXCLUDED.close,
          volume=EXCLUDED.volume, prev_close=EXCLUDED.prev_close;
    """
    execute_batch(cur, upsert_sql, rows, page_size=100)
    conn.commit()
    cur.close(); conn.close()

def fetch_for_date(symbols, target_date):
    start = pd.to_datetime(target_date)
    end = start + pd.Timedelta(days=1)
    hist = yf.download(
        tickers=" ".join(symbols),
        start=start, end=end,
        interval="1d", group_by="ticker",
        auto_adjust=False, threads=True
    )
    rows = []
    for sym in symbols:
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
            cname = company_names.get(sym, sym)
            rows.append((sym.upper(), cname, d, o, h, l, c, v, prev_close))
            prev_close = c
    return rows

if __name__ == "__main__":
    ensure_table()
    target_date = input("Masukkan tanggal (YYYY-MM-DD): ").strip() or date.today().isoformat()

    print(f"📥 Mengambil data {len(symbols)} saham untuk {target_date} …")
    rows = fetch_for_date(symbols, target_date)
    print(f"✅ Total rows fetched: {len(rows)}")
    upsert_equities(rows)
    print(f"💾 Data berhasil disimpan ke tabel usa_data untuk tanggal {target_date}")
