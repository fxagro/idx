// Database configuration
const { Pool } = require('pg');

// Database connection configuration using DATABASE_URL or individual params
// Note: dotenv is already configured in server/server.js with correct path
// Use lazy initialization to ensure environment variables are loaded before creating pool
let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

module.exports = { getPool };