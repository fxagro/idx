# us_1000.py (versi hybrid: single date atau range date)
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

CSV_SP500 = "sp500.csv"
CSV_NASDAQ100 = "nasdaq100.csv"
CSV_DOW30 = "dow30.csv"

# -------- Downloader Index --------
def prepare_index(url, csv_file):
    print(f"📥 Mengambil daftar index dari {url} …")
    tables = pd.read_html(url)

    df = None
    for t in tables:
        cols = [str(c).lower() for c in t.columns]
        if any("symbol" in c for c in cols) or any("ticker" in c for c in cols):
            df = t
            break

    if df is None:
        raise ValueError(f"Tidak menemukan tabel symbol/ticker di {url}")

    cols = [str(c).lower() for c in df.columns]

    if "symbol" in cols:  # S&P500 & Dow30
        df['Symbol'] = df['Symbol'].astype(str).str.replace('.', '-', regex=False)
        if "Security" in df.columns:
            name_col = "Security"
        elif "Company" in df.columns:
            name_col = "Company"
        else:
            raise ValueError(f"Tabel {url} tidak punya kolom nama perusahaan")
        df[['Symbol', name_col]].rename(columns={name_col: "Security"}).to_csv(csv_file, index=False)

    elif "ticker" in cols:  # NASDAQ100
        ticker_col = [c for c in df.columns if "ticker" in str(c).lower()][0]
        company_col = [c for c in df.columns if "company" in str(c).lower()][0]
        df[ticker_col] = df[ticker_col].astype(str).str.replace('.', '-', regex=False)
        df[[ticker_col, company_col]].rename(
            columns={ticker_col:"Symbol", company_col:"Security"}
        ).to_csv(csv_file, index=False)

    else:
        raise ValueError(f"Tabel di {url} tidak dikenali: kolom = {df.columns.tolist()}")

    print(f"✅ Simpan {len(df)} symbols ke {csv_file}")

def load_index(csv_file, url=None, refresh=False):
    if refresh or not os.path.exists(csv_file):
        if not url:
            raise ValueError(f"Tidak ada URL untuk {csv_file}")
        prepare_index(url, csv_file)
    return pd.read_csv(csv_file)

def load_all_symbols(limit=1000, refresh=False):
    sp500 = load_index(
        CSV_SP500,
        url="https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
        refresh=refresh
    )
    nasdaq100 = load_index(
        CSV_NASDAQ100,
        url="https://en.wikipedia.org/wiki/NASDAQ-100",
        refresh=refresh
    )
    dow30 = load_index(
        CSV_DOW30,
        url="https://en.wikipedia.org/wiki/Dow_Jones_Industrial_Average",
        refresh=refresh
    )

    all_df = pd.concat([sp500, nasdaq100, dow30]).drop_duplicates("Symbol")
    symbols = all_df['Symbol'].tolist()[:limit]
    company_names = dict(zip(all_df['Symbol'], all_df['Security']))
    return symbols, company_names

# -------- Database --------
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
        );
    """)
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
    execute_batch(cur, upsert_sql, rows, page_size=200)
    conn.commit()
    cur.close(); conn.close()

# -------- Fetch --------
def fetch_for_range(symbols, company_names, start_date, end_date, batch_size=200):
    rows = []
    for i in range(0, len(symbols), batch_size):
        batch = symbols[i:i+batch_size]
        print(f"📡 Download batch {i//batch_size+1} ({len(batch)} tickers)…")
        hist = yf.download(
            tickers=" ".join(batch),
            start=start_date, end=end_date,
            interval="1d", group_by="ticker",
            auto_adjust=False, threads=True
        )
        for sym in batch:
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

# -------- Main --------
if __name__ == "__main__":
    refresh = "--refresh" in sys.argv
    symbols, company_names = load_all_symbols(limit=1000, refresh=refresh)
    print(f"✅ Ambil {len(symbols)} tickers dari S&P500 + NASDAQ100 + Dow30")

    ensure_table()

    start_date = input("Masukkan start date (YYYY-MM-DD): ").strip()
    end_date = input("Masukkan end date   (YYYY-MM-DD / kosong jika hanya 1 hari): ").strip()

    if not start_date:
        start_date = date.today().isoformat()

    if not end_date:  
        # single date mode → end_date = start_date + 1 hari
        end_date = (pd.to_datetime(start_date) + timedelta(days=1)).date().isoformat()
        print(f"📥 Mode single-date: {start_date}")
    else:
        print(f"📥 Mode range-date: {start_date} → {end_date}")

    rows = fetch_for_range(symbols, company_names, start_date, end_date)
    print(f"✅ Total rows fetched: {len(rows)}")
    upsert_equities(rows)
    print(f"💾 Data berhasil disimpan ke tabel usa_data untuk periode {start_date} → {end_date}")