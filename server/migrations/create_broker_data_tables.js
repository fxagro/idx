const { Pool } = require('pg');

const pool = new Pool({
  user: 'openpg',
  host: 'localhost',
  database: 'stock',
  password: 'openpgpwd',
  port: 5432,
});

// List of all broker codes
const brokerCodes = [
  'ad', 'af', 'ag', 'ah', 'ai', 'ak', 'an', 'ao', 'ap', 'ar', 'at', 'az',
  'bb', 'bf', 'bk', 'bq', 'br', 'bs', 'cc', 'cd', 'cp', 'dd', 'dh', 'dp',
  'dr', 'du', 'dx', 'el', 'ep', 'es', 'fo', 'fs', 'fz', 'ga', 'gi', 'gr',
  'gw', 'hd', 'hp', 'ic', 'id', 'if', 'ih', 'ii', 'in', 'ip', 'it', 'iu',
  'jb', 'ki', 'kk', 'kz', 'lg', 'ls', 'mg', 'mi', 'mu', 'ni', 'od', 'ok',
  'pc', 'pd', 'pf', 'pg', 'pi', 'po', 'pp', 'ps', 'qa', 'rb', 'rf', 'rg',
  'ro', 'rs', 'rx', 'sa', 'sf', 'sh', 'sq', 'ss', 'tf', 'tp', 'ts', 'xa',
  'xc', 'xl', 'yb', 'yj', 'yo', 'yp', 'yu', 'zp', 'zr'
];

async function createBrokerDataTables() {
  try {
    // Create each broker_data table
    for (const brokerCode of brokerCodes) {
      const tableName = `${brokerCode}_data`;

      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
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
          kode_broker VARCHAR(2) NOT NULL DEFAULT '${brokerCode.toUpperCase()}',
          PRIMARY KEY (date, code)
        );
      `);

      console.log(`✅ ${tableName} table created successfully.`);
    }

    // Create indexes for better query performance
    for (const brokerCode of brokerCodes) {
      const tableName = `${brokerCode}_data`;

      // Index on code for faster stock-specific queries
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_${tableName}_code
        ON ${tableName} (code);
      `);

      // Index on date for faster date-specific queries
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_${tableName}_date
        ON ${tableName} (date);
      `);

      // Index on net_vol for sorting performance
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_${tableName}_net_vol
        ON ${tableName} (net_vol);
      `);

      console.log(`✅ Indexes created for ${tableName}.`);
    }

    console.log('✅ All broker data tables and indexes created successfully.');

    await pool.end();
  } catch (err) {
    console.error('❌ Error creating broker data tables:', err);
    process.exit(1);
  }
}

createBrokerDataTables();