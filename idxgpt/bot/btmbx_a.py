#!/usr/bin/env python3
"""
btmbx_A.py
Strategi A - Same-Day (intraday rebound TP)
- account1: momentum (ret > +1%) buy configured lots, TP at +1% same day, reentry once if configured
- account2..5: buy on dip (ret <= threshold), TP if intraday high >= entry * 1.01
              if not hit, close at daily close (same day)
Outputs:
  - backtest_output_A/backtest_results_<from>_to_<to>.xlsx
  - backtest_output_A/equity_<account>_<from>_to_<to>.png
"""
import os
import sys
from datetime import datetime
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sqlalchemy import create_engine

# -------------------------
# DB CONFIG (edit if needed)
# -------------------------
db_config = {
    'dbname': 'stock',
    'user': 'openpg',
    'password': 'openpgpwd',
    'host': 'localhost',
    'port': '5432'
}

# -------------------------
# MBX symbol list (full list from your original)
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
# Parameters
# -------------------------
LOT_SIZE = 100                # shares per lot
FEE_PCT = 0.15 / 100         # buy/sell fee percentage
TAX_SELL_PCT = 0.1 / 100     # sell tax
START_CAPITAL = 100_000_000   # starting capital per account
LOT_PROGRESSION = {
    "account1": 1,
    "account2": 2,
    "account3": 3,
    "account4": 5,
    "account5": 8,
}
ACCOUNT_RULES = {
    "account1": {"type": "gt", "threshold": 1.0, "reentry": True},
    "account2": {"type": "le", "threshold": -1.0},
    "account3": {"type": "le", "threshold": -2.0},
    "account4": {"type": "le", "threshold": -3.0},
    "account5": {"type": "le", "threshold": -5.0},
}

OUTPUT_FOLDER = "backtest_output_A"
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# -------------------------
# Helpers
# -------------------------
def build_connection_url(cfg):
    return f"postgresql://{cfg['user']}:{cfg['password']}@{cfg['host']}:{cfg['port']}/{cfg['dbname']}"

def load_prices(engine, symbols, date_from=None, date_to=None):
    syms = ",".join(f"'{s}'" for s in symbols)
    sql = f"""
        SELECT symbol, trade_date::date, open::numeric, high::numeric, low::numeric, 
               close::numeric, prev_close::numeric, volume::bigint
        FROM idx_data
        WHERE symbol IN ({syms})
    """
    if date_from:
        sql += f" AND trade_date >= '{date_from}'"
    if date_to:
        sql += f" AND trade_date <= '{date_to}'"
    sql += " ORDER BY trade_date, symbol"
    df = pd.read_sql(sql, engine)
    df['ret_pct'] = (df['close'] - df['prev_close']) / df['prev_close'] * 100.0
    return df

def max_drawdown(series):
    s = pd.Series(series).fillna(method='ffill').fillna(0)
    roll_max = s.cummax()
    drawdown = (s - roll_max) / roll_max
    if drawdown.empty:
        return 0.0
    return drawdown.min()

# -------------------------
# Run backtest - Same day
# -------------------------
def run_backtest_same_day(df_prices):
    accounts = list(LOT_PROGRESSION.keys())
    capital = {acc: float(START_CAPITAL) for acc in accounts}
    equity_timeseries = {acc: [] for acc in accounts}
    trade_logs = []

    dates = sorted(df_prices['trade_date'].unique())
    for dt in dates:
        day_df = df_prices[df_prices['trade_date'] == dt].copy()
        day_df = day_df.sort_values(['symbol'])
        for acc in accounts:
            rule = ACCOUNT_RULES[acc]
            lots = int(LOT_PROGRESSION[acc])
            if rule['type'] == 'gt':
                picks = day_df[day_df['ret_pct'] > rule['threshold']]
            else:
                picks = day_df[day_df['ret_pct'] <= rule['threshold']]

            for _, row in picks.iterrows():
                symbol = row['symbol']
                entry_price = float(row['close'])
                buy_cost = entry_price * LOT_SIZE * lots
                buy_fee = buy_cost * FEE_PCT
                total_buy = buy_cost + buy_fee

                if capital[acc] < total_buy:
                    # can't afford
                    continue

                # Simulate buy (deduct cash), then same-day sell (either target or close)
                capital[acc] -= total_buy

                if acc == 'account1':
                    target_price = entry_price * 1.01
                    sell_price = target_price
                    # account1 reentry: we simulate immediate TP and optional second identical trade
                    sell_proceeds = sell_price * LOT_SIZE * lots
                    sell_fee = sell_proceeds * FEE_PCT
                    tax = sell_proceeds * TAX_SELL_PCT
                    net_sell = sell_proceeds - sell_fee - tax
                    profit = net_sell - (buy_cost + buy_fee)
                    capital[acc] += net_sell  # add proceeds back
                    trade_logs.append({
                        'date': dt, 'account': acc, 'symbol': symbol,
                        'entry_price': entry_price, 'exit_price': sell_price,
                        'lots': lots, 'profit': profit, 'capital_after': capital[acc]
                    })
                    # reentry once if configured and still enough capital
                    if rule.get('reentry', False):
                        # second identical full buy/sell (simulate same-day reentry)
                        if capital[acc] >= total_buy:
                            capital[acc] -= total_buy
                            capital[acc] += net_sell
                            trade_logs.append({
                                'date': dt, 'account': acc, 'symbol': symbol,
                                'entry_price': entry_price, 'exit_price': sell_price,
                                'lots': lots, 'profit': profit, 'capital_after': capital[acc]
                            })
                else:
                    # For accounts 2..5: check if intraday high >= target; if yes sell at target else sell at close
                    target_price = entry_price * 1.01
                    if float(row['high']) >= target_price:
                        sell_price = target_price
                    else:
                        # close at today's close
                        sell_price = float(row['close'])
                    sell_proceeds = sell_price * LOT_SIZE * lots
                    sell_fee = sell_proceeds * FEE_PCT
                    tax = sell_proceeds * TAX_SELL_PCT
                    net_sell = sell_proceeds - sell_fee - tax
                    profit = net_sell - (buy_cost + buy_fee)
                    capital[acc] += net_sell
                    trade_logs.append({
                        'date': dt, 'account': acc, 'symbol': symbol,
                        'entry_price': entry_price, 'exit_price': sell_price,
                        'lots': lots, 'profit': profit, 'capital_after': capital[acc]
                    })
            equity_timeseries[acc].append({'date': dt, 'capital': capital[acc]})

    trades_df = pd.DataFrame(trade_logs)
    equity_dfs = {acc: pd.DataFrame(equity_timeseries[acc]) for acc in equity_timeseries.keys()}
    return trades_df, equity_dfs

# -------------------------
# CLI + output
# -------------------------
def prompt_date(prompt_text):
    while True:
        s = input(prompt_text).strip()
        try:
            d = datetime.strptime(s, "%Y-%m-%d").date()
            return d
        except Exception:
            print("Format tanggal harus YYYY-MM-DD. Contoh: 2024-01-01")

def main():
    print("=== MBX Backtest - Strategi A (Same-Day) ===")
    start_date = prompt_date("Masukkan tanggal mulai backtest (YYYY-MM-DD): ")
    end_date = prompt_date("Masukkan tanggal akhir backtest (YYYY-MM-DD): ")
    if start_date > end_date:
        print("Tanggal mulai harus <= tanggal akhir.")
        return

    engine = create_engine(build_connection_url(db_config), pool_pre_ping=True)
    print(f"Loading price data for {len(MBX_SYMBOLS)} symbols from {start_date} to {end_date} ...")
    df = load_prices(engine, MBX_SYMBOLS, date_from=start_date, date_to=end_date)
    if df.empty:
        print("Tidak ada data. Periksa DB/tabel/periode.")
        return

    print("Running backtest (same-day)...")
    trades_df, equity_dfs = run_backtest_same_day(df)

    safe_from = start_date.isoformat()
    safe_to = end_date.isoformat()
    out_excel = os.path.join(OUTPUT_FOLDER, f"backtest_results_A_{safe_from}_to_{safe_to}.xlsx")
    with pd.ExcelWriter(out_excel) as writer:
        trades_df.to_excel(writer, sheet_name="trades", index=False)
        for acc, edf in equity_dfs.items():
            edf.to_excel(writer, sheet_name=f"equity_{acc}", index=False)
    print(f"Saved results to: {out_excel}")

    # Print summary & plot
    for acc, edf in equity_dfs.items():
        if edf.empty:
            print(f"[{acc}] no equity data.")
            continue
        edf = edf.sort_values('date').reset_index(drop=True)
        capitals = edf['capital'].tolist()
        final_cap = capitals[-1] if capitals else START_CAPITAL
        trades_acc = trades_df[trades_df['account'] == acc]
        wins = trades_acc[trades_acc['profit'] > 0.0]
        losses = trades_acc[trades_acc['profit'] <= 0.0]
        win_rate = (len(wins) / len(trades_acc) * 100.0) if len(trades_acc) > 0 else 0.0
        total_profit = trades_acc['profit'].sum() if len(trades_acc) > 0 else 0.0
        mdd = max_drawdown(edf['capital'])
        print(f"--- {acc} ---")
        print(f"Trades: {len(trades_acc)}, Wins: {len(wins)}, Win rate: {win_rate:.2f} %")
        print(f"Total profit: {total_profit:,.2f}, Final capital: {final_cap:,.2f}, Max Drawdown: {mdd:.2%}")

        # plot equity
        try:
            plt.figure(figsize=(10,4))
            plt.plot(pd.to_datetime(edf['date']), edf['capital'])
            plt.title(f"Equity Curve - {acc} (Strategi A)")
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

    if not trades_df.empty:
        print("\nTop 10 wins:")
        print(trades_df.sort_values('profit', ascending=False).head(10)[['date','account','symbol','lots','profit']].to_string(index=False))
        print("\nTop 10 losses:")
        print(trades_df.sort_values('profit', ascending=True).head(10)[['date','account','symbol','lots','profit']].to_string(index=False))

    print("\nBacktest Strategi A complete.")

if __name__ == "__main__":
    main()
