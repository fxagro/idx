import psycopg2
import pandas as pd
import matplotlib.pyplot as plt

# Konfigurasi DB
db_config = {
    "host": "localhost",
    "port": 5432,
    "dbname": "stock",
    "user": "postgres",
    "password": "yourpassword"
}

def get_fundamental_history(symbol, market):
    conn = psycopg2.connect(**db_config)
    query = """
        SELECT report_date, eps, per, pbv, dividend_yield
        FROM fundamental_data
        WHERE symbol = %s AND market = %s
        ORDER BY report_date;
    """
    df = pd.read_sql(query, conn, params=(symbol, market))
    conn.close()
    return df

def plot_fundamental(df, symbol):
    if df.empty:
        print("⚠️ Data kosong, tidak ada yang bisa diplot.")
        return

    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    fig.suptitle(f"Tren Fundamental {symbol}", fontsize=16)

    # EPS
    axes[0,0].plot(df["report_date"], df["eps"], marker="o")
    axes[0,0].set_title("EPS (Earning Per Share)")
    axes[0,0].set_ylabel("EPS")

    # PER
    axes[0,1].plot(df["report_date"], df["per"], marker="o", color="orange")
    axes[0,1].set_title("PER (Price to Earnings Ratio)")
    axes[0,1].set_ylabel("PER")

    # PBV
    axes[1,0].plot(df["report_date"], df["pbv"], marker="o", color="green")
    axes[1,0].set_title("PBV (Price to Book Value)")
    axes[1,0].set_ylabel("PBV")

    # Dividend Yield
    axes[1,1].plot(df["report_date"], df["dividend_yield"], marker="o", color="red")
    axes[1,1].set_title("Dividend Yield")
    axes[1,1].set_ylabel("%")

    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.show()

if __name__ == "__main__":
    # Contoh: BBCA.JK di IDX
    symbol = "BBCA.JK"
    market = "idx"

    df = get_fundamental_history(symbol, market)
    print(df.tail())  # cek data terakhir
    plot_fundamental(df, symbol)
