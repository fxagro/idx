import pandas as pd
import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_values
from datetime import datetime
import os
import glob
import re

# Konfigurasi logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('import.log'),  # Simpan log ke file import.log
        logging.StreamHandler()  # Tampilkan log ke console
    ]
)
logger = logging.getLogger(__name__)

# Fungsi untuk parse tanggal dari format Indonesia seperti "15 Agt 2025" ke YYYY-MM-DD
def parse_indonesian_date(date_str):
    if pd.isna(date_str):
        return None
    month_map = {
        'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'Mei': 5, 'Jun': 6,
        'Jul': 7, 'Agt': 8, 'Sep': 9, 'Okt': 10, 'Nov': 11, 'Des': 12
    }
    try:
        parts = date_str.split()
        if len(parts) != 3:
            raise ValueError(f"Format tanggal tidak valid: {date_str}")
        day = int(parts[0])
        month_abbr = parts[1]
        year = int(parts[2])
        month = month_map.get(month_abbr)
        if month is None:
            raise ValueError(f"Bulan tidak dikenali: {month_abbr}")
        return datetime(year, month, day).date()
    except Exception as e:
        logger.error(f"Error parsing tanggal '{date_str}': {e}")
        raise

# Fungsi untuk parse tanggal dari nama file seperti "Ringkasan Indeks-20250815.xlsx" ke YYYY-MM-DD
def parse_date_from_filename(filename):
    date_pattern = re.compile(r'Ringkasan (?:Saham|Indeks)-(\d{8})\.xlsx')
    match = date_pattern.search(filename)
    if match:
        date_str = match.group(1)
        try:
            return datetime.strptime(date_str, '%Y%m%d').date()
        except ValueError as e:
            logger.error(f"Error parsing tanggal dari nama file '{filename}': {e}")
            raise
    else:
        logger.error(f"Nama file tidak sesuai pola: {filename}")
        raise ValueError(f"Nama file tidak sesuai pola: {filename}")

# Fungsi untuk menemukan semua file Excel dengan pola tertentu
def find_all_excel_files(directory, pattern):
    files = glob.glob(os.path.join(directory, pattern))
    date_pattern = re.compile(r'Ringkasan (?:Saham|Indeks)-(\d{8})\.xlsx')
    valid_files = []
    
    for file in files:
        match = date_pattern.search(file)
        if match:
            valid_files.append(file)
    
    return sorted(valid_files)  # Urutkan berdasarkan nama file (secara implisit mengurutkan tanggal)

# Konfigurasi koneksi PostgreSQL
db_config = {
    'dbname': 'stock',
    'user': 'openpg',
    'password': 'openpgpwd',
    'host': 'localhost',
    'port': '5432'
}

# Nama tabel di PostgreSQL
saham_table_name = 'saham_data'
index_table_name = 'index_data'

# Buat koneksi ke PostgreSQL
try:
    conn = psycopg2.connect(**db_config)
    cur = conn.cursor()
    logger.info("Berhasil terhubung ke PostgreSQL")
except Exception as e:
    logger.error(f"Error saat menghubungkan ke PostgreSQL: {e}")
    exit(1)

# Buat tabel saham_data jika belum ada
create_saham_table_query = sql.SQL('''
CREATE TABLE IF NOT EXISTS {table} (
    "No" INTEGER,
    "Kode Saham" TEXT,
    "Nama Perusahaan" TEXT,
    "Remarks" TEXT,
    "Sebelumnya" NUMERIC,
    "Open Price" NUMERIC,
    "Tanggal Perdagangan Terakhir" DATE,
    "First Trade" NUMERIC,
    "Tertinggi" NUMERIC,
    "Terendah" NUMERIC,
    "Penutupan" NUMERIC,
    "Selisih" NUMERIC,
    "Volume" BIGINT,
    "Nilai" BIGINT,
    "Frekuensi" INTEGER,
    "Index Individual" NUMERIC,
    "Offer" NUMERIC,
    "Offer Volume" BIGINT,
    "Bid" NUMERIC,
    "Bid Volume" BIGINT,
    "Listed Shares" BIGINT,
    "Tradeble Shares" BIGINT,
    "Weight For Index" NUMERIC,
    "Foreign Sell" BIGINT,
    "Foreign Buy" BIGINT,
    "Non Regular Volume" BIGINT,
    "Non Regular Value" BIGINT,
    "Non Regular Frequency" INTEGER,
    CONSTRAINT unique_kode_saham_tanggal UNIQUE ("Kode Saham", "Tanggal Perdagangan Terakhir")
);
''').format(table=sql.Identifier(saham_table_name))

try:
    cur.execute(create_saham_table_query)
    conn.commit()
    logger.info(f"Tabel '{saham_table_name}' berhasil dibuat atau sudah ada")
except Exception as e:
    logger.error(f"Error saat membuat tabel '{saham_table_name}': {e}")
    cur.close()
    conn.close()
    exit(1)

# Buat tabel index_data jika belum ada
create_index_table_query = sql.SQL('''
CREATE TABLE IF NOT EXISTS {table} (
    "No" INTEGER,
    "Kode Indeks" TEXT,
    "Sebelumnya" NUMERIC,
    "Tertinggi" NUMERIC,
    "Terendah" NUMERIC,
    "Penutupan" NUMERIC,
    "# Stock" INTEGER,
    "Selisih" NUMERIC,
    "Volume" BIGINT,
    "Nilai" BIGINT,
    "Frekuensi" INTEGER,
    "Kapitalisasi Pasar" BIGINT,
    "Tanggal Perdagangan Terakhir" DATE,
    CONSTRAINT unique_kode_indeks_tanggal UNIQUE ("Kode Indeks", "Tanggal Perdagangan Terakhir")
);
''').format(table=sql.Identifier(index_table_name))

try:
    cur.execute(create_index_table_query)
    conn.commit()
    logger.info(f"Tabel '{index_table_name}' berhasil dibuat atau sudah ada")
except Exception as e:
    logger.error(f"Error saat membuat tabel '{index_table_name}': {e}")
    cur.close()
    conn.close()
    exit(1)

# Cari semua file Excel di direktori saat ini
saham_files = find_all_excel_files(os.getcwd(), "Ringkasan Saham-*.xlsx")
index_files = find_all_excel_files(os.getcwd(), "Ringkasan Indeks-*.xlsx")

# Proses file saham
for excel_file in saham_files:
    logger.info(f"Memproses file saham: {excel_file}")
    
    # Baca data dari Excel menggunakan pandas
    try:
        df = pd.read_excel(excel_file, sheet_name='Sheet1', engine='openpyxl')
    except Exception as e:
        logger.error(f"Error saat membaca file saham '{excel_file}': {e}")
        continue

    # Konversi kolom 'Tanggal Perdagangan Terakhir' ke date format YYYY-MM-DD
    try:
        df['Tanggal Perdagangan Terakhir'] = df['Tanggal Perdagangan Terakhir'].apply(parse_indonesian_date)
    except Exception as e:
        logger.error(f"Error saat memproses kolom tanggal di file saham '{excel_file}': {e}")
        continue

    # Filter data yang belum ada di database
    rows_to_insert = []
    for index, row in df.iterrows():
        kode_saham = row['Kode Saham']
        tanggal_perdagangan = row['Tanggal Perdagangan Terakhir']
        
        # Query untuk memeriksa apakah kombinasi Kode Saham dan Tanggal sudah ada
        check_query = sql.SQL('''
        SELECT 1 FROM {table}
        WHERE "Kode Saham" = %s AND "Tanggal Perdagangan Terakhir" = %s
        ''').format(table=sql.Identifier(saham_table_name))
        
        try:
            cur.execute(check_query, (kode_saham, tanggal_perdagangan))
            if cur.fetchone() is None:
                rows_to_insert.append(row)
            else:
                logger.info(f"Data untuk Kode Saham '{kode_saham}' pada tanggal {tanggal_perdagangan} sudah ada, dilewati.")
        except Exception as e:
            logger.error(f"Error saat memeriksa duplikasi untuk Kode Saham '{kode_saham}' pada tanggal {tanggal_perdagangan}: {e}")
            continue

    if not rows_to_insert:
        logger.info(f"Tidak ada data baru untuk diimpor dari file saham '{excel_file}'.")
        continue

    # Konversi rows_to_insert ke list of tuples untuk insert
    data_tuples = [tuple(row) for row in pd.DataFrame(rows_to_insert).itertuples(index=False, name=None)]

    # Insert data ke tabel saham_data
    columns = df.columns.tolist()
    insert_query = sql.SQL('INSERT INTO {table} ({fields}) VALUES %s').format(
        table=sql.Identifier(saham_table_name),
        fields=sql.SQL(', ').join(map(sql.Identifier, columns))
    )

    # Execute batch insert
    try:
        execute_values(cur, insert_query, data_tuples)
        conn.commit()
        logger.info(f"Data baru dari file saham '{excel_file}' berhasil diimport ke tabel '{saham_table_name}' ({len(data_tuples)} baris).")
    except Exception as e:
        logger.error(f"Error saat memasukkan data dari file saham '{excel_file}': {e}")
        continue

# Proses file indeks
for excel_file in index_files:
    logger.info(f"Memproses file indeks: {excel_file}")
    
    # Baca data dari Excel menggunakan pandas
    try:
        df = pd.read_excel(excel_file, sheet_name='Sheet1', engine='openpyxl')
    except Exception as e:
        logger.error(f"Error saat membaca file indeks '{excel_file}': {e}")
        continue

    # Tambahkan kolom Tanggal Perdagangan Terakhir dari nama file
    try:
        tanggal_perdagangan = parse_date_from_filename(excel_file)
        df['Tanggal Perdagangan Terakhir'] = tanggal_perdagangan
    except Exception as e:
        logger.error(f"Error saat memproses tanggal dari nama file indeks '{excel_file}': {e}")
        continue

    # Ganti nama kolom 'Kapitalisasi Pasar*' menjadi 'Kapitalisasi Pasar' untuk konsistensi
    if 'Kapitalisasi Pasar*' in df.columns:
        df = df.rename(columns={'Kapitalisasi Pasar*': 'Kapitalisasi Pasar'})

    # Filter data yang belum ada di database
    rows_to_insert = []
    for index, row in df.iterrows():
        kode_indeks = row['Kode Indeks']
        tanggal_perdagangan = row['Tanggal Perdagangan Terakhir']
        
        # Query untuk memeriksa apakah kombinasi Kode Indeks dan Tanggal sudah ada
        check_query = sql.SQL('''
        SELECT 1 FROM {table}
        WHERE "Kode Indeks" = %s AND "Tanggal Perdagangan Terakhir" = %s
        ''').format(table=sql.Identifier(index_table_name))
        
        try:
            cur.execute(check_query, (kode_indeks, tanggal_perdagangan))
            if cur.fetchone() is None:
                rows_to_insert.append(row)
            else:
                logger.info(f"Data untuk Kode Indeks '{kode_indeks}' pada tanggal {tanggal_perdagangan} sudah ada, dilewati.")
        except Exception as e:
            logger.error(f"Error saat memeriksa duplikasi untuk Kode Indeks '{kode_indeks}' pada tanggal {tanggal_perdagangan}: {e}")
            continue

    if not rows_to_insert:
        logger.info(f"Tidak ada data baru untuk diimpor dari file indeks '{excel_file}'.")
        continue

    # Konversi rows_to_insert ke list of tuples untuk insert
    data_tuples = [tuple(row) for row in pd.DataFrame(rows_to_insert).itertuples(index=False, name=None)]

    # Insert data ke tabel index_data
    columns = df.columns.tolist()
    insert_query = sql.SQL('INSERT INTO {table} ({fields}) VALUES %s').format(
        table=sql.Identifier(index_table_name),
        fields=sql.SQL(', ').join(map(sql.Identifier, columns))
    )

    # Execute batch insert
    try:
        execute_values(cur, insert_query, data_tuples)
        conn.commit()
        logger.info(f"Data baru dari file indeks '{excel_file}' berhasil diimport ke tabel '{index_table_name}' ({len(data_tuples)} baris).")
    except Exception as e:
        logger.error(f"Error saat memasukkan data dari file indeks '{excel_file}': {e}")
        continue

# Tutup koneksi
cur.close()
conn.close()
logger.info("Selesai memproses semua file.")