const { Pool } = require('pg');

const pool = new Pool({
  user: 'openpg',
  host: 'localhost',
  database: 'stock',
  password: 'openpgpwd',
  port: 5432,
});

async function createTables() {
  try {
    // Create user_balance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_balance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(15,2) DEFAULT 10000000.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user_holdings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_holdings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        symbol VARCHAR(10) NOT NULL,
        market VARCHAR(10) DEFAULT 'idx',
        quantity DECIMAL(15,4) DEFAULT 0,
        avg_price DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, symbol, market)
      );
    `);

    // Create user_transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        symbol VARCHAR(10) NOT NULL,
        market VARCHAR(10) DEFAULT 'idx',
        type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
        quantity DECIMAL(15,4) NOT NULL,
        price DECIMAL(15,2) NOT NULL,
        total_amount DECIMAL(15,2) NOT NULL,
        fee DECIMAL(15,2) DEFAULT 0,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Portfolio tables created successfully.');

    // Close pool
    await pool.end();
  } catch (err) {
    console.error('❌ Error creating tables:', err);
    process.exit(1);
  }
}

createTables();