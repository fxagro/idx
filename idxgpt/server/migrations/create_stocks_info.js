const { Pool } = require('pg');

const pool = new Pool({
  user: 'openpg',
  host: 'localhost',
  database: 'stock',
  password: 'openpgpwd',
  port: 5432,
});

async function createStocksInfo() {
  try {
    // Create stocks_info table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stocks_info (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        sector VARCHAR(100) NOT NULL,
        market VARCHAR(10) DEFAULT 'idx',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert sample data (common IDX stocks with sectors)
    const sampleStocks = [
      { symbol: 'BBCA', name: 'Bank Central Asia Tbk', sector: 'Financials' },
      { symbol: 'BBRI', name: 'Bank Rakyat Indonesia Tbk', sector: 'Financials' },
      { symbol: 'ANTM', name: 'Aneka Tambang Tbk', sector: 'Basic Materials' },
      { symbol: 'TLKM', name: 'Telkom Indonesia Tbk', sector: 'Telecommunications' },
      { symbol: 'ASII', name: 'Astra International Tbk', sector: 'Consumer Cyclical' },
      { symbol: 'UNTR', name: 'United Tractors Tbk', sector: 'Industrials' },
      { symbol: 'BBNI', name: 'Bank Negara Indonesia Tbk', sector: 'Financials' },
      { symbol: 'BMRI', name: 'Bank Mandiri Tbk', sector: 'Financials' },
      { symbol: 'PGAS', name: 'Perusahaan Gas Negara Tbk', sector: 'Energy' },
      { symbol: 'ADRO', name: 'Adaro Energy Indonesia Tbk', sector: 'Energy' }
    ];

    for (const stock of sampleStocks) {
      try {
        await pool.query(
          `INSERT INTO stocks_info (symbol, name, sector, market) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (symbol) DO NOTHING`,
          [stock.symbol, stock.name, stock.sector, 'idx']
        );
      } catch (err) {
        console.error(`Error inserting ${stock.symbol}:`, err);
      }
    }

    console.log('✅ Stocks info table created and populated with sample data.');

    await pool.end();
  } catch (err) {
    console.error('❌ Error creating stocks_info:', err);
    process.exit(1);
  }
}

createStocksInfo();