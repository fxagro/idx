import psycopg2
import pandas as pd

# Parameter koneksi database
db_params = {
    'dbname': 'stock',
    'user': 'openpg',
    'password': 'openpgpwd',
    'host': 'localhost',
    'port': '5432'
}

# Baca file Excel, gunakan baris pertama sebagai header
df = pd.read_excel('MBX.xlsx', sheet_name='MBX', header=0)

# Cetak nama kolom untuk debugging
print("Nama kolom di file Excel:", df.columns.tolist())

# Pilih kolom 'No.' dan 'Kode', hilangkan baris dengan nilai null
mbx_data = df[['No.', 'Kode']].dropna()

# Hubungkan ke PostgreSQL
try:
    conn = psycopg2.connect(**db_params)
    cursor = conn.cursor()

    # Hapus tabel mbx_data jika sudah ada
    drop_table_query = '''
    DROP TABLE IF EXISTS mbx_data;
    '''
    cursor.execute(drop_table_query)
    print("Tabel mbx_data dihapus jika sudah ada")

    # Buat tabel mbx_data
    create_table_query = '''
    CREATE TABLE mbx_data (
        no INTEGER,
        kode VARCHAR(10),
        PRIMARY KEY (no)
    );
    '''
    cursor.execute(create_table_query)
    print("Tabel mbx_data berhasil dibuat")

    # Masukkan data ke tabel mbx_data
    for index, row in mbx_data.iterrows():
        insert_query = '''
        INSERT INTO mbx_data (no, kode) 
        VALUES (%s, %s)
        ON CONFLICT (no) DO UPDATE 
        SET kode = EXCLUDED.kode;
        '''
        cursor.execute(insert_query, (int(row['No.']), row['Kode']))
        print(f"Memasukkan data: No.={int(row['No.'])}, Kode={row['Kode']}")

    # Commit transaksi
    conn.commit()
    print("Data berhasil dimasukkan ke tabel mbx_data")

except Exception as e:
    print(f"Error: {e}")

finally:
    if cursor:
        cursor.close()
    if conn:
        conn.close()