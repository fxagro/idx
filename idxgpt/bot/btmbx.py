#!/usr/bin/env python3
"""
Backtest script: MBX list, Accounts 1..5 (lot progression configurable)
- Connects to PostgreSQL using db_config dict (edit if needed)
- Prompts user for start/end date for backtest (YYYY-MM-DD)
- Runs strategies:
    * account1: momentum (ret > +1%) buy 1 lot, TP at +1% same day, reentry once at same price
    * account2: buy 2 lots if ret <= -1%
    * account3: buy 3 lots if ret <= -2%
    * account4: buy 5 lots if ret <= -3%
    * account5: buy 8 lots if ret <= -5%
  For accounts 2..5, profit realized only if the same day ret > +1% (per your rule)
- Outputs:
    backtest_output/backtest_results_<from>_to_<to>.xlsx
    backtest_output/equity_<account>.png per account
    printed summary stats
"""

import os
import sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sqlalchemy import create_engine
from datetime import datetime

# -------------------------
# DB CONFIG (use the one you provided)
# -------------------------
db_config = {
    'dbname': 'stock',
    'user': 'openpg',
    'password': 'openpgpwd',
    'host': 'localhost',
    'port': '5432'
}

# -------------------------
# MBX symbol list (from your screenshot / pasted list)
# -------------------------
MBX_SYMBOLS = [
"JARR","IMPC","EMTK","SCMA","DSNG","BBHI","SGRO","TOBA","ENRG","NCKL","BBYB","BREN","FILM","PTRO","BUKA","BSDE",
"BRPT","INKP","TAPG","SHIP","SAME","SSIA","CASS","ARTO","IMAS","TKIM","MDLA","STAA","LPKR","INTP","AALI","INPC",
"SMRA","SIMP","MAYA","MSTI","PSGO","DEWA","CBDK","AGRO","ASII","BBTN","BRMS","TOWR","EXCL","MDKA","BNLI","SRTG",
"RAJA","MCOR","AUTO","TLKM","KIJA","ASSA","MTDL","SSMS","HRUM","HEAL","HEXA","UNTR","HRTA","MTEL","BKSL","MORA",
"BTPS","BBRI","SMDR","BBNI","MIDI","BNII","BRIS","INCO","JPFA","UNVR","BACA","MMLP","CTRA","MSIN","SIDO","ELSA",
"BJTM","PGAS","DRMA","GOOD","PNLF","LSIP","ADMR","MNCN","MEGA","NISP","PGEO","OMED","BDMN","GEMS","BFIN","AKRA",
"POWR","GOLF","GOTO","MLBI","CMNP","TMAS","SGER","ELPI","BNGA","KEEN","UNIC","PNBN","PWON","TUGU","SMGR","CLEO",
"ITMG","SMSM","MAPI","BINA","DMAS","AADI","BMRI","ADRO","BSIM","PTBA","ABMM","MYOR","SAMF","SMMA","TSPC","RALS",
"MPMX","CMRY","BBSI","BUMI","BTPN","DGWG","BJBR","PBID","ESSA","ARNA","TINS","PRDA","TBIG","SMBR","INDY","TBLA",
"SILO","ULTJ","VICI","MYOH","BBCA","BISI","MBMA","AVIA","LPPF","ISAT","PNIN","ANTM","BIRD","ACES","JSMR","MTLA",
"MEDC","PTPP","INDF","AMRT","SKRN","DOID","BELI","GGRM","GJTL","BYAN","CPIN","AMMN","ALII","MAPA","BALI","ICBP",
"HMSP","CNMA","MIKA","MCOL","HILL","ERAA","MDIY","KLBF","DAAZ","YUPI","BWPT","TEBE","BOLA","SMIL","CARS","RMKE",
"MLPL","ASRI","BVIC","PNGO","BEST","BCAP","JKON","ASGR","ISSP","JTPE","VICO","MTMH","ADHI","APLN","MLIA","DILD",
"TOTL","BMTR","CSRA","TRGU","MREI","WINS","MBSS","WTON","IPCC","BUKK","MAIN","CFIN","UNIQ","MINE","TRIM","TPMA",
"SPTO","PSSI","ERAL","BAYU","BUDI","WIIM","MARK","WOOD","SUNI","RAAM","DLTA","LTLS","MKTR","BDKR","BMHS","MAHA",
"KBLI","PDPP","UCID","KKGI","AISA","HATM","PANR","PANS","MCAS","CUAN"
]

# -------------------------
# Backtest parameters (customize as needed)
# -------------------------
LOT_SIZE = 100                # shares per lot
FEE_PCT = 0.15 / 100         # buy/sell fee percentage, default 0.15%
TAX_SELL_PCT = 0.1 / 100     # sell tax percentage, default 0.1%
START_CAPITAL = 100_000_000   # default starting capital per account (IDR or unit)
# Lot progression (you asked 1,2,3,5,8)
LOT_PROGRESSION = {
    "account1": 1,
    "account2": 2,
    "account3": 3,
    "account4": 5,
    "account5": 8,
}
# Account rules: type 'gt' means ret > threshold, 'le' means ret <= threshold
ACCOUNT_RULES = {
    "account1": {"type": "gt", "threshold": 1.0, "reentry": True},
    "account2": {"type": "le", "threshold": -1.0, "reentry": False},
    "account3": {"type": "le", "threshold": -2.0, "reentry": False},
    "account4": {"type": "le", "threshold": -3.0, "reentry": False},
    "account5": {"type": "le", "threshold": -5.0, "reentry": False},
}

OUTPUT_FOLDER = "backtest_output"
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# -------------------------
# Helper functions
# -------------------------
def build_connection_url(cfg):
    user = cfg['user']
    pwd = cfg['password']
    host = cfg['host']
    port = cfg['port']
    db = cfg['dbname']
    return f"postgresql://{user}:{pwd}@{host}:{port}/{db}"

def load_prices(engine, symbols, date_from=None, date_to=None):
    """
    Load price data dari DB untuk symbols tertentu dalam rentang tanggal.
    Sekaligus hitung return harian (%).
    """
    # bentuk string '(..., ...)' untuk IN
    symbols_str = ",".join(f"'{s}'" for s in symbols)

    sql = f"""
        SELECT symbol, trade_date::date, open::numeric, high::numeric, 
               low::numeric, close::numeric, prev_close::numeric, volume::bigint
        FROM idx_data
        WHERE symbol IN ({symbols_str})
    """

    if date_from:
        sql += f" AND trade_date >= '{date_from}'"
    if date_to:
        sql += f" AND trade_date <= '{date_to}'"

    sql += " ORDER BY trade_date, symbol"

    df = pd.read_sql(sql, engine)

    # tambahkan kolom return harian (%)
    df['ret_pct'] = (df['close'] - df['prev_close']) / df['prev_close'] * 100.0

    return df



def max_drawdown(series):
    """Compute maximum drawdown for a capital series (list/Series)."""
    s = pd.Series(series)
    roll_max = s.cummax()
    drawdown = (s - roll_max) / roll_max
    if drawdown.empty:
        return 0.0
    return drawdown.min()  # negative value

# -------------------------
# Backtest core
# -------------------------
def run_backtest(df_prices, lot_progression, account_rules, lot_size=LOT_SIZE, start_capital=START_CAPITAL, fee_pct=FEE_PCT, tax_sell_pct=TAX_SELL_PCT):
    accounts = list(lot_progression.keys())
    # Initialize capital and logs
    capital = {acc: float(start_capital) for acc in accounts}
    equity_timeseries = {acc: [] for acc in accounts}
    trade_logs = []

    dates = sorted(df_prices['trade_date'].unique())
    for dt in dates:
        day_df = df_prices[df_prices['trade_date'] == dt].copy()
        # For deterministic ordering
        day_df = day_df.sort_values(['symbol'])
        for acc in accounts:
            rule = account_rules[acc]
            lots = int(lot_progression[acc])
            # select picks
            if rule['type'] == 'gt':
                picks = day_df[day_df['ret_pct'] > rule['threshold']]
            else:
                picks = day_df[day_df['ret_pct'] <= rule['threshold']]

            for _, row in picks.iterrows():
                symbol = row['symbol']
                price = float(row['close'])
                # cost to buy
                buy_cost = price * lot_size * lots
                buy_fee = buy_cost * fee_pct
                total_buy = buy_cost + buy_fee

                if capital[acc] < total_buy:
                    # can't afford this buy for this account
                    continue

                # Behavior:
                # - account1: buy 1 lot (or configured) and immediately TP at price*1.01; reentry once at same price if reentry True
                # - others: buy defined lots; realize profit only if same-day ret_pct > 1.0
                if acc == 'account1':
                    sell_price = price * 1.01
                    sell_proceeds = sell_price * lot_size * lots
                    sell_fee = sell_proceeds * fee_pct
                    tax = sell_proceeds * tax_sell_pct
                    profit = (sell_proceeds - sell_fee - tax) - (buy_cost + buy_fee)
                    capital[acc] += profit
                    trade_logs.append({
                        'date': dt, 'account': acc, 'symbol': symbol, 'entry_price': price, 'exit_price': sell_price,
                        'lots': lots, 'profit': profit, 'capital_after': capital[acc]
                    })
                    # reentry once if configured and still enough capital
                    if rule.get('reentry', False):
                        # attempt second immediate reentry & TP
                        if capital[acc] >= total_buy:
                            capital[acc] += profit
                            trade_logs.append({
                                'date': dt, 'account': acc, 'symbol': symbol, 'entry_price': price, 'exit_price': sell_price,
                                'lots': lots, 'profit': profit, 'capital_after': capital[acc]
                            })
                else:
                    # other accounts: buy, but realize only if same-day ret_pct > 1
                    if row['ret_pct'] > 1.0:
                        sell_price = price * 1.01
                        sell_proceeds = sell_price * lot_size * lots
                        sell_fee = sell_proceeds * fee_pct
                        tax = sell_proceeds * tax_sell_pct
                        profit = (sell_proceeds - sell_fee - tax) - (buy_cost + buy_fee)
                        capital[acc] += profit
                    else:
                        profit = 0.0
                        sell_price = None
                    trade_logs.append({
                        'date': dt, 'account': acc, 'symbol': symbol, 'entry_price': price, 'exit_price': sell_price,
                        'lots': lots, 'profit': profit, 'capital_after': capital[acc]
                    })
            # record equity for date after processing that account's picks
            equity_timeseries[acc].append({'date': dt, 'capital': capital[acc]})

    trades_df = pd.DataFrame(trade_logs)
    equity_dfs = {acc: pd.DataFrame(equity_timeseries[acc]) for acc in equity_timeseries.keys()}
    return trades_df, equity_dfs

# -------------------------
# CLI menu & run
# -------------------------
def prompt_date(prompt_text):
    while True:
        s = input(prompt_text).strip()
        try:
            d = datetime.strptime(s, "%Y-%m-%d").date()
            return d
        except Exception as e:
            print("Format tanggal harus YYYY-MM-DD. Contoh: 2020-01-01")

def main():
    print("=== MBX Backtest Accounts 1..5 ===")
    print("Default DB config will be used. Edit script if needed.")
    start_date = prompt_date("Masukkan tanggal mulai backtest (YYYY-MM-DD): ")
    end_date = prompt_date("Masukkan tanggal akhir backtest (YYYY-MM-DD): ")
    if start_date > end_date:
        print("Tanggal mulai harus <= tanggal akhir. Keluar.")
        sys.exit(1)

    # Build DB engine and load data
    db_url = build_connection_url(db_config)
    print("Connecting to DB...")
    engine = create_engine(db_url, pool_pre_ping=True)

    print(f"Loading price data for {len(MBX_SYMBOLS)} symbols from {start_date} to {end_date} ... (this may take a while)")
    df = load_prices(engine, MBX_SYMBOLS, date_from=start_date, date_to=end_date)
    if df.empty:
        print("Tidak ada data yang dimuat. Periksa koneksi DB, tabel idx_data, atau periode yang dimasukkan.")
        sys.exit(1)

    print("Running backtest...")
    trades_df, equity_dfs = run_backtest(df, LOT_PROGRESSION, ACCOUNT_RULES, lot_size=LOT_SIZE, start_capital=START_CAPITAL)

    # Save results
    safe_from = start_date.isoformat()
    safe_to = end_date.isoformat()
    out_excel = os.path.join(OUTPUT_FOLDER, f"backtest_results_{safe_from}_to_{safe_to}.xlsx")
    with pd.ExcelWriter(out_excel) as writer:
        trades_df.to_excel(writer, sheet_name="trades", index=False)
        for acc, edf in equity_dfs.items():
            edf.to_excel(writer, sheet_name=f"equity_{acc}", index=False)

    print(f"Saved results to: {out_excel}")

    # Print summary stats and save equity plots
    for acc, edf in equity_dfs.items():
        if edf.empty:
            print(f"[{acc}] no equity data.")
            continue
        # fill continuous date series for plotting (make sure sorted)
        edf = edf.sort_values('date').reset_index(drop=True)
        capitals = edf['capital'].tolist()
        final_cap = capitals[-1] if len(capitals) > 0 else START_CAPITAL
        trades_acc = trades_df[trades_df['account'] == acc]
        wins = trades_acc[trades_acc['profit'] > 0.0]
        losses = trades_acc[trades_acc['profit'] <= 0.0]
        win_rate = (len(wins) / len(trades_acc) * 100.0) if len(trades_acc) > 0 else 0.0
        total_profit = trades_acc['profit'].sum() if len(trades_acc) > 0 else 0.0
        mdd = max_drawdown(edf['capital'])
        print(f"--- {acc} ---")
        print(f"Trades: {len(trades_acc)}, Wins: {len(wins)}, Win rate: {win_rate:.2f} %")
        print(f"Total profit: {total_profit:,.2f}, Final capital: {final_cap:,.2f}, Max Drawdown: {mdd:.2%}")

        # plot equity curve
        try:
            plt.figure(figsize=(10,4))
            plt.plot(pd.to_datetime(edf['date']), edf['capital'])
            plt.title(f"Equity Curve - {acc}")
            plt.xlabel("Date")
            plt.ylabel("Capital")
            plt.grid(True)
            out_png = os.path.join(OUTPUT_FOLDER, f"equity_{acc}_{safe_from}_to_{safe_to}.png")
            plt.tight_layout()
            plt.savefig(out_png)
            plt.close()
            print(f"Saved equity plot: {out_png}")
        except Exception as e:
            print("Failed to plot equity for", acc, ":", e)

    # Optional: print top trades overall
    if not trades_df.empty:
        top_wins = trades_df.sort_values('profit', ascending=False).head(10)
        top_losses = trades_df.sort_values('profit').head(10)
        print("\nTop 10 wins:")
        print(top_wins[['date','account','symbol','lots','profit']].to_string(index=False))
        print("\nTop 10 losses (or zero-profits):")
        print(top_losses[['date','account','symbol','lots','profit']].to_string(index=False))

    print("\nBacktest complete.")

if __name__ == "__main__":
    main()
