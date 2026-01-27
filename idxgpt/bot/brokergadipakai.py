# broker.py - Impor otomatis .csv, .xlsx, .xls dari 93 broker

import pandas as pd
import psycopg2
from psycopg2 import sql
import os
import re
from datetime import datetime

# --- Konfigurasi Database ---
DB_CONFIG = {
    'dbname': 'stock',
    'user': 'openpg',
    'password': 'openpgpwd',
    'host': 'localhost',
    'port': '5432'
}

# --- Folder tempat file berada ---
DATA_DIR = '.'  # Ubah jika perlu

# --- Pola nama file: xx-YYYY-MM-DD.(csv|xlsx|xls) ---
FILENAME_PATTERN = re.compile(r'^([a-zA-Z]{2})-(\d{4}-\d{2}-\d{2})\.(csv|xlsx|xls)$')


# --- Fungsi: Baca CSV korup (tanpa newline) ---
def read_corrupted_csv(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        # Ekstrak semua blok "kode",angka,... (13 kolom)
        import re
        pattern = r'"([^"]+)"(?:,"([^"]*)"){12}'
        matches = re.findall(pattern, content)
        if not matches:
            return None
        df = pd.DataFrame(matches)
        if df.shape[1] < 13:
            return None
        df = df.iloc[:, :13]
        df.columns = [
            'code', 'buy_trades', 'buy_volume', 'buy_value', 'buy_avg_price', 'buy_pct',
            'sell_trades', 'sell_volume', 'sell_value', 'sell_avg_price', 'sell_pct',
            'net_volume', 'net_value'
        ]
        return df
    except Exception as e:
        print(f"❌ Gagal baca CSV korup: {e}")
        return None


# --- Fungsi: Baca file CSV normal ---
def read_csv(filepath):
    try:
        df = pd.read_csv(filepath, header=None, on_bad_lines='skip')
        if df.shape[1] < 13:
            return None
        df = df.iloc[:, :13]
        df.columns = [
            'code', 'buy_trades', 'buy_volume', 'buy_value', 'buy_avg_price', 'buy_pct',
            'sell_trades', 'sell_volume', 'sell_value', 'sell_avg_price', 'sell_pct',
            'net_volume', 'net_value'
        ]
        return df
    except Exception as e:
        print(f"❌ Gagal baca CSV: {e}")
        return None


# --- Fungsi: Baca file XLSX ---
def read_xlsx(filepath):
    try:
        return pd.read_excel(filepath, engine='openpyxl', header=None)
    except Exception as e:
        print(f"⚠️  Gagal baca XLSX: {e}")
        return None


# --- Fungsi: Baca file XLS (format lama) ---
def read_xls(filepath):
    try:
        return pd.read_excel(filepath, engine='xlrd', header=None)
    except Exception as e:
        print(f"❌ Gagal baca XLS: {e}")
        return None


# --- Fungsi: Deteksi dan baca file ---
def read_broker_file(filepath):
    ext = filepath.lower().split('.')[-1]

    if ext == 'csv':
        print(f"📄 Membaca CSV: {filepath}")
        df = read_csv(filepath)
        if df is None:
            print("⚠️  Coba baca sebagai CSV korup...")
            df = read_corrupted_csv(filepath)
        return df

    elif ext == 'xlsx':
        print(f"📄 Mencoba baca XLSX: {filepath}")
        df = read_xlsx(filepath)
        if df is None:
            try:
                from openpyxl import load_workbook
                wb = load_workbook(filepath, read_only=True, data_only=True)
                ws = wb.active
                data = [[cell.value for cell in row] for row in ws.iter_rows()]
                wb.close()
                df = pd.DataFrame(data)
                return df
            except Exception as e:
                print(f"❌ Gagal baca manual XLSX: {e}")
                return None
        return df

    elif ext == 'xls':
        print(f"📄 Membaca XLS: {filepath}")
        df = read_xls(filepath)
        if df is None:
            try:
                # Alternatif: xlrd versi 1.2.0
                import xlrd
                wb = xlrd.open_workbook(filepath)
                sheet = wb.sheet_by_index(0)
                data = [[sheet.cell_value(r, c) for c in range(sheet.ncols)] for r in range(sheet.nrows)]
                df = pd.DataFrame(data)
                return df
            except Exception as e:
                print(f"❌ Gagal baca manual XLS: {e}")
                return None
        return df

    return None


# --- Fungsi: Ekstrak data dari DataFrame ---
def extract_data_from_df(df):
    # Cari baris header
    header_row_idx = None
    for idx in df.index:
        row = df.iloc[idx].astype(str).str.upper()
        if 'CODE' in row.values or 'CODE' in str(row.values):
            header_row_idx = idx
            break

    if header_row_idx is not None:
        df.columns = df.iloc[header_row_idx].astype(str).str.strip()
        df = df.iloc[header_row_idx + 1:].reset_index(drop=True)

    # Bersihkan angka
    for col in ['buy_value', 'buy_avg_price', 'sell_value', 'sell_avg_price']:
        if col in df.columns:
            df[col] = df[col].astype(str).str.replace(r'[^\d.-]', '', regex=True)

    for col in ['buy_pct', 'sell_pct']:
        if col in df.columns:
            df[col] = df[col].astype(str).str.replace(r'[^\d.%-]', '', regex=True).str.replace('%', '')

    numeric_cols = [
        'buy_volume', 'buy_value', 'buy_avg_price', 'buy_pct',
        'sell_volume', 'sell_value', 'sell_avg_price', 'sell_pct',
        'net_volume', 'net_value'
    ]

    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    df['buy_trades'] = pd.to_numeric(df['buy_trades'], errors='coerce').fillna(0).astype('Int64')
    df['sell_trades'] = pd.to_numeric(df['sell_trades'], errors='coerce').fillna(0).astype('Int64')
    df['code'] = df['code'].astype(str).str.strip()

    df.dropna(subset=['code'], inplace=True)
    df = df[df['code'] != 'nan']
    df = df[df['code'] != '']

    return df


# --- Fungsi: Buat tabel ---
def create_table_if_not_exists(conn, table_name):
    create_query = sql.SQL("""
        CREATE TABLE IF NOT EXISTS {table} (
            id SERIAL PRIMARY KEY,
            code VARCHAR(15),
            buy_trades INTEGER,
            buy_volume BIGINT,
            buy_value NUMERIC,
            buy_avg_price NUMERIC,
            buy_pct NUMERIC,
            sell_trades INTEGER,
            sell_volume BIGINT,
            sell_value NUMERIC,
            sell_avg_price NUMERIC,
            sell_pct NUMERIC,
            net_volume BIGINT,
            net_value NUMERIC,
            date DATE NOT NULL,
            UNIQUE (code, date)
        );
    """).format(table=sql.Identifier(table_name))

    with conn.cursor() as cur:
        try:
            cur.execute(create_query)
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"❌ Gagal buat tabel {table_name}: {e}")


# --- Fungsi: Impor data (per baris agar tidak gagal semua) ---
def insert_data_to_db(conn, table_name, df):
    insert_query = sql.SQL("""
        INSERT INTO {table} 
        (code, buy_trades, buy_volume, buy_value, buy_avg_price, buy_pct,
         sell_trades, sell_volume, sell_value, sell_avg_price, sell_pct,
         net_volume, net_value, date)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (code, date) DO UPDATE SET
            buy_trades = EXCLUDED.buy_trades,
            buy_volume = EXCLUDED.buy_volume,
            buy_value = EXCLUDED.buy_value,
            buy_avg_price = EXCLUDED.buy_avg_price,
            buy_pct = EXCLUDED.buy_pct,
            sell_trades = EXCLUDED.sell_trades,
            sell_volume = EXCLUDED.sell_volume,
            sell_value = EXCLUDED.sell_value,
            sell_avg_price = EXCLUDED.sell_avg_price,
            sell_pct = EXCLUDED.sell_pct,
            net_volume = EXCLUDED.net_volume,
            net_value = EXCLUDED.net_value;
    """).format(table=sql.Identifier(table_name))

    with conn.cursor() as cur:
        success = 0
        for _, row in df.iterrows():
            try:
                cur.execute(insert_query, (
                    row['code'],
                    row['buy_trades'],
                    int(row['buy_volume']) if pd.notna(row['buy_volume']) else None,
                    row['buy_value'],
                    row['buy_avg_price'],
                    row['buy_pct'],
                    row['sell_trades'],
                    int(row['sell_volume']) if pd.notna(row['sell_volume']) else None,
                    row['sell_value'],
                    row['sell_avg_price'],
                    row['sell_pct'],
                    int(row['net_volume']) if pd.notna(row['net_volume']) else None,
                    row['net_value'],
                    row['date']
                ))
                success += 1
            except Exception as e:
                print(f"⚠️  Lewati baris {row['code']}: {e}")
                conn.rollback()
                continue
        conn.commit()
        print(f"✅ {success}/{len(df)} baris berhasil diimpor ke {table_name}")


# --- Fungsi Utama ---
def main():
    print("🔍 Mencari file broker harian (.csv, .xlsx, .xls)...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("🟢 Koneksi ke database berhasil")
    except Exception as e:
        print(f"🔴 Gagal koneksi ke database: {e}")
        return

    success_count = 0
    failed_files = []

    # Kumpulkan file
    files = {}
    for filename in os.listdir(DATA_DIR):
        match = FILENAME_PATTERN.match(filename)
        if not match:
            continue
        broker, date, ext = match.group(1).lower(), match.group(2), match.group(3)
        if (broker, date) not in files:
            files[(broker, date)] = {'csv': None, 'xlsx': None, 'xls': None}
        files[(broker, date)][ext] = filename

    for (broker, date), file_dict in files.items():
        table_name = f"{broker}_data"
        date_obj = datetime.strptime(date, "%Y-%m-%d").date()

        # Prioritas: csv > xlsx > xls
        filepath = None
        for ext in ['csv', 'xlsx', 'xls']:
            if file_dict[ext]:
                filepath = os.path.join(DATA_DIR, file_dict[ext])
                break
        if not filepath:
            continue

        print(f"\n📄 Memproses: {os.path.basename(filepath)} → Tabel: {table_name}, Tanggal: {date_obj}")

        try:
            raw_df = read_broker_file(filepath)
            if raw_df is None or raw_df.empty:
                print(f"❌ Tidak bisa baca data dari {filepath}")
                failed_files.append(os.path.basename(filepath))
                continue

            df = extract_data_from_df(raw_df)
            if df is None or df.empty:
                print(f"❌ Tidak ada data valid setelah proses")
                failed_files.append(os.path.basename(filepath))
                continue

            df['date'] = date_obj
            create_table_if_not_exists(conn, table_name)
            insert_data_to_db(conn, table_name, df)
            success_count += 1

        except Exception as e:
            print(f"❌ Gagal proses {filepath}: {str(e)}")
            failed_files.append(os.path.basename(filepath))
            conn.rollback()

    # Ringkasan
    print("\n" + "="*60)
    print(f"✅ Selesai! {success_count} file berhasil diimpor.")
    if failed_files:
        print(f"🔴 Gagal: {len(failed_files)} file:")
        for f in failed_files:
            print(f"   - {f}")
    else:
        print("🎉 Semua file berhasil diimpor!")

    conn.close()


if __name__ == "__main__":
    main()