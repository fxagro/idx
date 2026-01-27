# etl_us.py
import os
import psycopg2
import yfinance as yf
import pandas as pd
from datetime import date, timedelta

DB = dict(
    dbname=os.getenv("PG_DB", "stock"),
    user=os.getenv("PG_USER", "openpg"),
    password=os.getenv("PG_PWD", "openpgpwd"),
    host=os.getenv("PG_HOST", "localhost"),
    port=os.getenv("PG_PORT", "5432"),
)

def ensure_table():
    conn = psycopg2.connect(**DB)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS equities (
          market TEXT NOT NULL,
          symbol TEXT NOT NULL,
          trade_date DATE NOT NULL,
          open NUMERIC, high NUMERIC, low NUMERIC, close NUMERIC,
          volume BIGINT, value NUMERIC, prev_close NUMERIC,
          PRIMARY KEY (market, symbol, trade_date)
        );
    """)
    conn.commit()
    cur.close(); conn.close()

def upsert_equities(rows):
    conn = psycopg2.connect(**DB)
    cur = conn.cursor()
    upsert_sql = """
        INSERT INTO equities (market, symbol, trade_date, open, high, low, close, volume, value, prev_close)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (market, symbol, trade_date) DO UPDATE SET
          open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low, close=EXCLUDED.close,
          volume=EXCLUDED.volume, value=EXCLUDED.value, prev_close=EXCLUDED.prev_close;
    """
    cur.executemany(upsert_sql, rows)
    conn.commit()
    cur.close(); conn.close()

def fetch_yf_daily(symbols, start=None, end=None):
    rows = []
    for sym in symbols:
        t = yf.Ticker(sym)
        hist = t.history(
            start=start or (date.today() - timedelta(days=90)),
            end=end or (date.today() + timedelta(days=1)),
            interval="1d",
            auto_adjust=False
        )
        prev_close = None
        for idx, r in hist.iterrows():
            d = idx.date()
            # convert numpy dtype ke native Python
            o = float(r["Open"]) if not pd.isna(r["Open"]) else None
            h = float(r["High"]) if not pd.isna(r["High"]) else None
            l = float(r["Low"]) if not pd.isna(r["Low"]) else None
            c = float(r["Close"]) if not pd.isna(r["Close"]) else None
            v = int(r["Volume"]) if not pd.isna(r["Volume"]) else 0

            prev_val = float(prev_close) if prev_close is not None else None
            rows.append(("US", sym.upper(), d, o, h, l, c, v, None, prev_val))
            prev_close = c
    return rows

if __name__ == "__main__":
    ensure_table()
    # contoh list saham US
    symbols = ["AAPL", "MSFT", "NVDA", "AMZN", "TSLA"]
    rows = fetch_yf_daily(symbols)
    upsert_equities(rows)
    print(f"Inserted {len(rows)} rows into equities table.")
