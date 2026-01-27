import yfinance as yf
import psycopg2
from datetime import datetime

# Konfigurasi DB
db_config = {
    'dbname': 'stock',
    'user': 'openpg',
    'password': 'openpgpwd',
    'host': 'localhost',
    'port': '5432'
}

def save_fundamental(symbol, market):
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info

        eps = info.get("trailingEps")
        per = info.get("trailingPE")
        pbv = info.get("priceToBook")
        dividend_yield = info.get("dividendYield")

        # --- Cari ROE ---
        roe = info.get("returnOnEquity")
        roe_source = "info"

        if roe is None:
            try:
                # hitung manual: Net Income / Total Equity
                net_income = ticker.financials.loc["Net Income", :].iloc[0]
                equity = ticker.balance_sheet.loc["Total Stockholder Equity", :].iloc[0]
                roe = float(net_income) / float(equity) if equity != 0 else None
                roe_source = "calculated"
            except Exception:
                roe = None
                roe_source = "missing"

        report_date = datetime.today().date()

        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO fundamental_data 
            (symbol, market, report_date, eps, per, pbv, roe, dividend_yield)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (symbol, market, report_date) DO UPDATE
            SET eps = EXCLUDED.eps,
                per = EXCLUDED.per,
                pbv = EXCLUDED.pbv,
                roe = EXCLUDED.roe,
                dividend_yield = EXCLUDED.dividend_yield;
        """, (symbol, market, report_date, eps, per, pbv, roe, dividend_yield))
        conn.commit()
        cur.close()
        conn.close()

        print(f"✅ {symbol} ({market}) tersimpan: EPS={eps}, PER={per}, PBV={pbv}, ROE={roe} [{roe_source}], DY={dividend_yield}")
    except Exception as e:
        print(f"❌ Error {symbol} ({market}): {e}")

def get_symbols():
    conn = psycopg2.connect(**db_config)
    cur = conn.cursor()

    cur.execute("SELECT DISTINCT symbol FROM idx_data;")
    idx_symbols = [row[0] for row in cur.fetchall()]

    cur.execute("SELECT DISTINCT symbol FROM usa_data;")
    us_symbols = [row[0] for row in cur.fetchall()]

    cur.close()
    conn.close()
    return idx_symbols, us_symbols

if __name__ == "__main__":
    idx_symbols, us_symbols = get_symbols()

    print(f"🔄 Update IDX ({len(idx_symbols)} saham)...")
    for s in idx_symbols:
        save_fundamental(f"{s}.JK", "idx")

    print(f"🔄 Update USA ({len(us_symbols)} saham)...")
    for s in us_symbols:
        save_fundamental(s, "us")

    print("🚀 Update selesai")
