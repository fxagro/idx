// Database configuration
const { Pool } = require('pg');

// Database connection configuration using DATABASE_URL or individual params
// Note: dotenv is already configured in server/server.js with correct path
// Use lazy initialization to ensure environment variables are loaded before creating pool
let poolInstance = null;

function getPool() {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return poolInstance;
}

// Create a pool proxy that lazily initializes the actual pool
// This allows direct use of pool.query() while maintaining lazy initialization
const pool = new Proxy({}, {
  get(target, prop) {
    const actualPool = getPool();
    return actualPool[prop];
  }
});

module.exports = { getPool, pool };