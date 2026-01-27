// server/migrations/create_users_table.js
const pool = require('../db');

async function createUsersTable() {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        phone VARCHAR(50),
        subscription_expiry TIMESTAMP,
        api_usage INTEGER DEFAULT 0,
        api_limit INTEGER DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user_balance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_balance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(15,2) DEFAULT 10000000.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user_portfolio table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_portfolio (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        symbol VARCHAR(10) NOT NULL,
        quantity INTEGER NOT NULL,
        average_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user_transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        symbol VARCHAR(10) NOT NULL,
        type VARCHAR(10) NOT NULL, -- 'BUY' or 'SELL'
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        total DECIMAL(15,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert admin user if not exists
    const adminExists = await pool.query('SELECT id FROM users WHERE email = $1', ['agro@demo.com']);
    if (adminExists.rows.length === 0) {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('password123', 10);

      await pool.query(`
        INSERT INTO users (email, password, name, api_limit, subscription_expiry)
        VALUES ($1, $2, $3, $4, $5)
      `, ['agro@demo.com', hashedPassword, 'Admin User', 1000, new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)]);

      // Get the inserted user ID
      const adminUser = await pool.query('SELECT id FROM users WHERE email = $1', ['agro@demo.com']);
      const adminId = adminUser.rows[0].id;

      // Insert initial balance for admin
      await pool.query('INSERT INTO user_balance (user_id) VALUES ($1)', [adminId]);
    }

    console.log('✅ Users table and related tables created successfully');
    console.log('✅ Admin user created: agro@demo.com / password123');
  } catch (error) {
    console.error('❌ Error creating users table:', error);
  } finally {
    await pool.end();
  }
}

createUsersTable();