const { Pool } = require('pg');

const pool = new Pool({
  user: 'openpg',
  host: 'localhost',
  database: 'stock',
  password: 'openpgpwd',
  port: 5432,
});

async function createBrokerTypeTable() {
  try {
    // Create broker_type table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS broker_type (
        kode_broker VARCHAR(2) PRIMARY KEY,
        nama_broker VARCHAR(255),
        jenis_broker VARCHAR(50) -- e.g., 'asing', 'bumn', 'lokal retail'
      );
    `);

    console.log('✅ broker_type table created successfully.');

    // Insert sample broker types
    const brokerTypes = [
      { kode: 'XL', nama: 'MNC Sekuritas', jenis: 'lokal retail' },
      { kode: 'AD', nama: 'Aditya Sekuritas', jenis: 'lokal retail' },
      { kode: 'AF', nama: 'Affin Sekuritas', jenis: 'lokal retail' },
      { kode: 'AG', nama: 'AG Sekuritas', jenis: 'lokal retail' },
      { kode: 'AH', nama: 'AHA Sekuritas', jenis: 'lokal retail' },
      { kode: 'AI', nama: 'AIA Sekuritas', jenis: 'lokal retail' },
      { kode: 'AK', nama: 'AKS Sekuritas', jenis: 'lokal retail' },
      { kode: 'AN', nama: 'Anugerah Sekuritas', jenis: 'lokal retail' },
      { kode: 'AO', nama: 'AOS Sekuritas', jenis: 'lokal retail' },
      { kode: 'AP', nama: 'AP Sekuritas', jenis: 'lokal retail' },
      { kode: 'AR', nama: 'AR Sekuritas', jenis: 'lokal retail' },
      { kode: 'AT', nama: 'AT Sekuritas', jenis: 'lokal retail' },
      { kode: 'AZ', nama: 'AZ Sekuritas', jenis: 'lokal retail' },
      { kode: 'BB', nama: 'BB Sekuritas', jenis: 'lokal retail' },
      { kode: 'BF', nama: 'BF Sekuritas', jenis: 'lokal retail' },
      { kode: 'BK', nama: 'BK Sekuritas', jenis: 'lokal retail' },
      { kode: 'BQ', nama: 'BQ Sekuritas', jenis: 'lokal retail' },
      { kode: 'BR', nama: 'BR Sekuritas', jenis: 'lokal retail' },
      { kode: 'BS', nama: 'BS Sekuritas', jenis: 'lokal retail' },
      { kode: 'CC', nama: 'CC Sekuritas', jenis: 'lokal retail' },
      { kode: 'CD', nama: 'CD Sekuritas', jenis: 'lokal retail' },
      { kode: 'CP', nama: 'CP Sekuritas', jenis: 'lokal retail' },
      { kode: 'DD', nama: 'DD Sekuritas', jenis: 'lokal retail' },
      { kode: 'DH', nama: 'DH Sekuritas', jenis: 'lokal retail' },
      { kode: 'DP', nama: 'DP Sekuritas', jenis: 'lokal retail' },
      { kode: 'DR', nama: 'DR Sekuritas', jenis: 'lokal retail' },
      { kode: 'DU', nama: 'DU Sekuritas', jenis: 'lokal retail' },
      { kode: 'DX', nama: 'DX Sekuritas', jenis: 'lokal retail' },
      { kode: 'EL', nama: 'EL Sekuritas', jenis: 'lokal retail' },
      { kode: 'EP', nama: 'EP Sekuritas', jenis: 'lokal retail' },
      { kode: 'ES', nama: 'ES Sekuritas', jenis: 'lokal retail' },
      { kode: 'FO', nama: 'FO Sekuritas', jenis: 'lokal retail' },
      { kode: 'FS', nama: 'FS Sekuritas', jenis: 'lokal retail' },
      { kode: 'FZ', nama: 'FZ Sekuritas', jenis: 'lokal retail' },
      { kode: 'GA', nama: 'GA Sekuritas', jenis: 'lokal retail' },
      { kode: 'GI', nama: 'GI Sekuritas', jenis: 'lokal retail' },
      { kode: 'GR', nama: 'GR Sekuritas', jenis: 'lokal retail' },
      { kode: 'GW', nama: 'GW Sekuritas', jenis: 'lokal retail' },
      { kode: 'HD', nama: 'HD Sekuritas', jenis: 'lokal retail' },
      { kode: 'HP', nama: 'HP Sekuritas', jenis: 'lokal retail' },
      { kode: 'IC', nama: 'IC Sekuritas', jenis: 'lokal retail' },
      { kode: 'ID', nama: 'ID Sekuritas', jenis: 'lokal retail' },
      { kode: 'IF', nama: 'IF Sekuritas', jenis: 'lokal retail' },
      { kode: 'IH', nama: 'IH Sekuritas', jenis: 'lokal retail' },
      { kode: 'II', nama: 'II Sekuritas', jenis: 'lokal retail' },
      { kode: 'IN', nama: 'IN Sekuritas', jenis: 'lokal retail' },
      { kode: 'IP', nama: 'IP Sekuritas', jenis: 'lokal retail' },
      { kode: 'IT', nama: 'IT Sekuritas', jenis: 'lokal retail' },
      { kode: 'IU', nama: 'IU Sekuritas', jenis: 'lokal retail' },
      { kode: 'JB', nama: 'JB Sekuritas', jenis: 'lokal retail' },
      { kode: 'KI', nama: 'KI Sekuritas', jenis: 'lokal retail' },
      { kode: 'KK', nama: 'KK Sekuritas', jenis: 'lokal retail' },
      { kode: 'KZ', nama: 'KZ Sekuritas', jenis: 'lokal retail' },
      { kode: 'LG', nama: 'LG Sekuritas', jenis: 'lokal retail' },
      { kode: 'LS', nama: 'LS Sekuritas', jenis: 'lokal retail' },
      { kode: 'MG', nama: 'MG Sekuritas', jenis: 'lokal retail' },
      { kode: 'MI', nama: 'MI Sekuritas', jenis: 'lokal retail' },
      { kode: 'MU', nama: 'MU Sekuritas', jenis: 'lokal retail' },
      { kode: 'NI', nama: 'NI Sekuritas', jenis: 'lokal retail' },
      { kode: 'OD', nama: 'OD Sekuritas', jenis: 'lokal retail' },
      { kode: 'OK', nama: 'OK Sekuritas', jenis: 'lokal retail' },
      { kode: 'PC', nama: 'PC Sekuritas', jenis: 'lokal retail' },
      { kode: 'PD', nama: 'PD Sekuritas', jenis: 'lokal retail' },
      { kode: 'PF', nama: 'PF Sekuritas', jenis: 'lokal retail' },
      { kode: 'PG', nama: 'PG Sekuritas', jenis: 'lokal retail' },
      { kode: 'PI', nama: 'PI Sekuritas', jenis: 'lokal retail' },
      { kode: 'PO', nama: 'PO Sekuritas', jenis: 'lokal retail' },
      { kode: 'PP', nama: 'PP Sekuritas', jenis: 'lokal retail' },
      { kode: 'PS', nama: 'PS Sekuritas', jenis: 'lokal retail' },
      { kode: 'QA', nama: 'QA Sekuritas', jenis: 'lokal retail' },
      { kode: 'RB', nama: 'RB Sekuritas', jenis: 'lokal retail' },
      { kode: 'RF', nama: 'RF Sekuritas', jenis: 'lokal retail' },
      { kode: 'RG', nama: 'RG Sekuritas', jenis: 'lokal retail' },
      { kode: 'RO', nama: 'RO Sekuritas', jenis: 'lokal retail' },
      { kode: 'RS', nama: 'RS Sekuritas', jenis: 'lokal retail' },
      { kode: 'RX', nama: 'RX Sekuritas', jenis: 'lokal retail' },
      { kode: 'SA', nama: 'SA Sekuritas', jenis: 'lokal retail' },
      { kode: 'SF', nama: 'SF Sekuritas', jenis: 'lokal retail' },
      { kode: 'SH', nama: 'SH Sekuritas', jenis: 'lokal retail' },
      { kode: 'SQ', nama: 'SQ Sekuritas', jenis: 'lokal retail' },
      { kode: 'SS', nama: 'SS Sekuritas', jenis: 'lokal retail' },
      { kode: 'TF', nama: 'TF Sekuritas', jenis: 'lokal retail' },
      { kode: 'TP', nama: 'TP Sekuritas', jenis: 'lokal retail' },
      { kode: 'TS', nama: 'TS Sekuritas', jenis: 'lokal retail' },
      { kode: 'XA', nama: 'XA Sekuritas', jenis: 'lokal retail' },
      { kode: 'XC', nama: 'XC Sekuritas', jenis: 'lokal retail' },
      { kode: 'YB', nama: 'YB Sekuritas', jenis: 'lokal retail' },
      { kode: 'YJ', nama: 'YJ Sekuritas', jenis: 'lokal retail' },
      { kode: 'YO', nama: 'YO Sekuritas', jenis: 'lokal retail' },
      { kode: 'YP', nama: 'YP Sekuritas', jenis: 'lokal retail' },
      { kode: 'YU', nama: 'YU Sekuritas', jenis: 'lokal retail' },
      { kode: 'ZP', nama: 'ZP Sekuritas', jenis: 'lokal retail' },
      { kode: 'ZR', nama: 'ZR Sekuritas', jenis: 'lokal retail' }
    ];

    // Insert broker types
    for (const broker of brokerTypes) {
      await pool.query(`
        INSERT INTO broker_type (kode_broker, nama_broker, jenis_broker)
        VALUES ($1, $2, $3)
        ON CONFLICT (kode_broker) DO UPDATE SET
          nama_broker = EXCLUDED.nama_broker,
          jenis_broker = EXCLUDED.jenis_broker
      `, [broker.kode, broker.nama, broker.jenis]);
    }

    console.log('✅ Sample broker types inserted successfully.');

    await pool.end();
  } catch (err) {
    console.error('❌ Error creating broker_type table:', err);
    process.exit(1);
  }
}

createBrokerTypeTable();