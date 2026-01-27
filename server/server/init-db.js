const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

async function initDatabase() {
  try {
    console.log("🔄 Initializing database...");

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        subscription_expiry TIMESTAMP,
        api_usage INTEGER DEFAULT 0,
        api_limit INTEGER DEFAULT 100,
        ai_quota INTEGER DEFAULT 10,
        referral_code VARCHAR(50) UNIQUE,
        referred_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user_balance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_balance (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        balance DECIMAL(15,2) DEFAULT 1000000.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Database tables created successfully!");

    // Check if we need to create a default admin user
    const adminCheck = await pool.query("SELECT * FROM users WHERE email = 'admin@example.com'");
    if (adminCheck.rows.length === 0) {
      const bcrypt = require("bcrypt");
      const hashedPassword = await bcrypt.hash("admin123", 10);

      // Check if role column exists
      const roleColumnCheck = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role'");
      const hasRoleColumn = roleColumnCheck.rows.length > 0;

      if (hasRoleColumn) {
        await pool.query(
          "INSERT INTO users (email, password, role, subscription_expiry, api_usage, api_limit) VALUES ($1, $2, $3, NOW() + interval '1 year', 0, 1000)",
          ["admin@example.com", hashedPassword, "admin"]
        );
      } else {
        await pool.query(
          "INSERT INTO users (email, password, subscription_expiry, api_usage, api_limit) VALUES ($1, $2, NOW() + interval '1 year', 0, 1000)",
          ["admin@example.com", hashedPassword]
        );
      }

      console.log("✅ Default admin user created (admin@example.com / admin123)");
    }

  } catch (error) {
    console.error("❌ Database initialization error:", error);
  } finally {
    await pool.end();
  }
}

initDatabase();