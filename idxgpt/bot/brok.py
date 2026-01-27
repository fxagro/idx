import pandas as pd
import sqlalchemy
from sqlalchemy import create_engine, text
import os
import re
import glob
import shutil

# === KONFIGURASI DATABASE ===
DB_HOST = 'localhost'
DB_PORT = '5432'
DB_NAME = 'stock'
DB_USER = 'openpg'
DB_PASSWORD = 'openpgpwd'

# Buat koneksi SQLAlchemy
engine = create_engine(
    f'postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}',
    future=True
)

# === UTIL: NORMALISASI NAMA TABEL ===
def make_table_name(broker_code: str) -> str:
    return f"{broker_code.lower()}_data"

# === FUNGSI: BUAT TABEL JIKA BELUM ADA (DENGAN DEFAULT KODE BROKER) ===
def create_table_if_not_exists(table_name: str, broker_code: str):
    """
    Membuat tabel jika belum ada. Menyertakan kolom kode_broker dengan DEFAULT broker_code.
    """
    # broker_code aman: sudah divalidasi regex [a-zA-Z]+ → uppercase di caller
    create_table_query = f"""
    CREATE TABLE IF NOT EXISTS {table_name} (
        date DATE NOT NULL,
        code VARCHAR(50) NOT NULL,
        buy_freq INTEGER,
        buy_vol BIGINT,
        buy_val_t BIGINT,
        buy_avg NUMERIC,
        buy_freq_percent NUMERIC,
        sell_freq INTEGER,
        sell_vol BIGINT,
        sell_val_t BIGINT,
        sell_avg NUMERIC,
        sell_freq_percent NUMERIC,
        net_vol BIGINT,
        net_val_t BIGINT,
        kode_broker VARCHAR(2) NOT NULL DEFAULT '{broker_code}',
        PRIMARY KEY (date, code)
    );
    """
    with engine.begin() as conn:
        conn.execute(text(create_table_query))
    print(f"✅ Tabel '{table_name}' siap digunakan (DEFAULT kode_broker='{broker_code}').")

# === FUNGSI: PASTIKAN KOLOM kode_broker ADA DI TABEL LAMA ===
def ensure_kode_broker_column(table_name: str, broker_code: str):
    """
    Jika tabel sudah ada tetapi belum punya kolom kode_broker, tambahkan, backfill, set DEFAULT, dan NOT NULL.
    """
    with engine.begin() as conn:
        exists = conn.execute(
            text("""
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :tname
                  AND column_name = 'kode_broker'
                LIMIT 1
            """),
            {"tname": table_name}
        ).fetchone()

        if not exists:
            print(f"ℹ️  Menambahkan kolom 'kode_broker' ke {table_name} ...")
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN kode_broker VARCHAR(10);"))
            conn.execute(text(f"UPDATE {table_name} SET kode_broker = :kb WHERE kode_broker IS NULL;"), {"kb": broker_code})
            # DEFAULT & NOT NULL – literal diinline karena DDL tidak konsisten menerima bind param
            conn.execute(text(f"ALTER TABLE {table_name} ALTER COLUMN kode_broker SET DEFAULT '{broker_code}';"))
            conn.execute(text(f"ALTER TABLE {table_name} ALTER COLUMN kode_broker SET NOT NULL;"))
            print(f"✅ Kolom 'kode_broker' ditambahkan & diisi '{broker_code}' untuk baris lama.")

# === FUNGSI: BERSIHKAN DAN KONVERSI DATA ===
def clean_and_convert_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Membersihkan data: hapus koma, konversi ke tipe numerik.
    """
    numeric_cols = [
        'Buy Freq', 'Buy Vol', 'Buy Val(T)', 'Buy Avg', 'Buy Freq(%)',
        'Sell Freq', 'Sell Vol', 'Sell Val(T)', 'Sell Avg', 'Sell Freq(%)',
        'Net Vol', 'Net Val(T)'
    ]

    for col in numeric_cols:
        if col in df.columns:
            # pastikan string, bersihkan koma/spasi
            df[col] = df[col].astype(str).str.replace(',', '', regex=False).str.strip()
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Isi NaN numerik dengan 0
    df[numeric_cols] = df[numeric_cols].fillna(0)

    # Konversi ke int untuk kolom yang memang integer
    int_cols = ['Buy Freq', 'Buy Vol', 'Buy Val(T)', 'Sell Freq', 'Sell Vol', 'Sell Val(T)', 'Net Vol', 'Net Val(T)']
    for col in int_cols:
        if col in df.columns:
            df[col] = df[col].astype('int64')

    return df

# === FUNGSI: IMPORT CSV KE DATABASE ===
def import_csv_to_db(filename: str):
    """
    Proses satu file CSV:
    - Ekstrak broker & tanggal dari nama file: <broker>-YYYY-MM-DD.csv
    - Buat / upgrade tabel
    - Baca CSV, bersihkan
    - Tambah kolom date & kode_broker
    - Simpan ke PostgreSQL (skip jika tanggal sudah ada)
    - Pindahkan file ke folder processed
    """
    if not os.path.exists(filename):
        raise FileNotFoundError(f"File tidak ditemukan: {filename}")

    basename = os.path.basename(filename)
    match = re.match(r'([a-zA-Z]+)-(\d{4}-\d{2}-\d{2})\.csv$', basename)
    if not match:
        raise ValueError(f"Format nama file salah: {basename}. Harus: <broker>-YYYY-MM-DD.csv (contoh: jb-2025-08-20.csv)")

    broker_code = match.group(1).upper()   # 'JB', 'BK', dst
    date_str = match.group(2)
    table_name = make_table_name(broker_code)

    print(f"\n📄 Memproses file: {basename} → Tabel: {table_name}, Tanggal: {date_str}, Broker: {broker_code}")

    # --- 1. BUAT/UPGRADE TABEL ---
    create_table_if_not_exists(table_name, broker_code)
    ensure_kode_broker_column(table_name, broker_code)

    # --- 2. CEK DUPLIKASI TANGGAL (AMAN DARI SQL INJECTION) ---
    with engine.connect() as conn:
        result = conn.execute(
            text(f"SELECT 1 FROM {table_name} WHERE date = :d LIMIT 1"),
            {"d": date_str}
        ).fetchone()
        if result:
            print(f"🟡 Data untuk tanggal {date_str} di {table_name} sudah ada. Lewati.")
            return

    # --- 3. BACA CSV: SKIP 2 BARIS PERTAMA (HEADER & SUB-HEADER) ---
    try:
        df = pd.read_csv(filename, header=None, skiprows=2, dtype=str)
    except Exception as e:
        raise IOError(f"Gagal membaca file {filename}: {e}")

    # --- 4. ATUR KOLOM ---
    df.columns = [
        'Code',
        'Buy Freq', 'Buy Vol', 'Buy Val(T)', 'Buy Avg', 'Buy Freq(%)',
        'Sell Freq', 'Sell Vol', 'Sell Val(T)', 'Sell Avg', 'Sell Freq(%)',
        'Net Vol', 'Net Val(T)'
    ]

    # --- 5. BERSIHKAN BARIS KOSONG / INVALID ---
    invalid_codes = ['', 'Code', '0', 'nan', None]
    df = df.dropna(subset=['Code'])
    df = df[~df['Code'].astype(str).str.strip().isin(invalid_codes)]
    df = df.dropna(how='all').reset_index(drop=True)

    # --- 6. BERSIHKAN DATA ---
    df = clean_and_convert_data(df)

    # --- 7. TAMBAHKAN TANGGAL & KODE_BROKER (INI KUNCI) ---
    df['date'] = pd.to_datetime([date_str])[0].date()
    df['kode_broker'] = broker_code  # <-- pastikan kolom ini ADA dan TERISI

    # --- 8. NORMALISASI NAMA KOLOM UNTUK DATABASE ---
    df.columns = [
        c.lower().replace(' ', '_').replace('(t)', '_t').replace('(%)', '_percent')
        for c in df.columns
    ]
    # Sekarang kolom-kolomnya: code, buy_freq, ..., net_val_t, date, kode_broker

    # --- 9. URUTKAN KOLOM SESUAI TABEL (SERTAKAN kode_broker) ---
    columns_order = [
        'date', 'code',
        'buy_freq', 'buy_vol', 'buy_val_t', 'buy_avg', 'buy_freq_percent',
        'sell_freq', 'sell_vol', 'sell_val_t', 'sell_avg', 'sell_freq_percent',
        'net_vol', 'net_val_t',
        'kode_broker'
    ]
    missing = [c for c in columns_order if c not in df.columns]
    if missing:
        raise ValueError(f"Kolom hilang setelah normalisasi: {missing}")
    df = df[columns_order]

    if df.empty:
        print(f"⚠️ Tidak ada data valid setelah pembersihan. Lewati {basename}.")
        return

    # --- 10. SIMPAN KE DATABASE ---
    try:
        df.to_sql(table_name, engine, if_exists='append', index=False, method='multi')
        print(f"✅ Sukses: {len(df)} baris data dimasukkan ke {table_name}. (kode_broker='{broker_code}')")
    except Exception as e:
        print(f"❌ Gagal menyimpan ke database: {e}")
        return

    # --- 11. PINDAHKAN FILE ---
    processed_dir = 'processed'
    os.makedirs(processed_dir, exist_ok=True)
    target_path = os.path.join(processed_dir, basename)
    try:
        shutil.move(filename, target_path)
        print(f"📁 File {basename} dipindahkan ke {processed_dir}/")
    except Exception as e:
        print(f"⚠️ Gagal memindahkan file {basename}: {e}")

# === MAIN: PROSES SEMUA FILE CSV ===
if __name__ == "__main__":
    print("🚀 Memulai proses impor CSV ke PostgreSQL...")

    # Cari semua file: <broker>-YYYY-MM-DD.csv
    csv_files = glob.glob('*-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].csv')
    csv_files = [f for f in csv_files if os.path.isfile(f)]

    if not csv_files:
        print("📭 Tidak ada file CSV dengan format yang sesuai ditemukan.")
    else:
        print(f"📦 Menemukan {len(csv_files)} file untuk diproses.")
        for file in csv_files:
            try:
                import_csv_to_db(file)
            except Exception as e:
                print(f"🚨 Error memproses {file}: {e}")

    print("✅ Proses selesai.")