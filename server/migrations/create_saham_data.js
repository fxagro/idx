const { Pool } = require('pg');

const pool = new Pool({
  user: 'openpg',
  host: 'localhost',
  database: 'stock',
  password: 'openpgpwd',
  port: 5432,
});

async function createSahamDataTable() {
  try {
    // Create saham_data table with the correct structure
    await pool.query(`
      CREATE TABLE IF NOT EXISTS saham_data (
        "Kode Saham" TEXT NOT NULL,
        "Nama Perusahaan" TEXT,
        "Tanggal Perdagangan Terakhir" DATE NOT NULL,
        "Open Price" NUMERIC,
        "Tertinggi" NUMERIC,
        "Terendah" NUMERIC,
        "Penutupan" NUMERIC,
        "Volume" BIGINT,
        "Nilai Transaksi" NUMERIC,
        PRIMARY KEY ("Kode Saham", "Tanggal Perdagangan Terakhir")
      );
    `);

    console.log('✅ saham_data table created successfully.');

    await pool.end();
  } catch (err) {
    console.error('❌ Error creating saham_data table:', err);
    process.exit(1);
  }
}

createSahamDataTable();