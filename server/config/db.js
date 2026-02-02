// Database configuration
const { Pool } = require('pg');

// Database connection configuration using DATABASE_URL or individual params
// Note: dotenv is already configured in server/server.js with correct path
// Use lazy initialization to ensure environment variables are loaded before creating pool
let poolInstance = null;

function getPool() {
  if (!poolInstance) {
    try {
      // First, try to create pool with individual connection parameters
      poolInstance = new Pool({
        user: String(process.env.DB_USER),
        password: String(process.env.DB_PASSWORD),
        host: String(process.env.DB_HOST),
        port: parseInt(process.env.DB_PORT, 10),
        database: String(process.env.DB_NAME),
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      console.log('✅ PostgreSQL pool created successfully');
    } catch (error) {
      console.error('❌ Error creating PostgreSQL pool:', error.message);
      // Return a mock pool if real pool creation fails
      poolInstance = {
        query: async (text, params) => {
          console.warn('⚠️  Mock pool query called:', text);
          return { rows: [] };
        },
        connect: async () => {
          return {
            query: async (text, params) => {
              console.warn('⚠️  Mock pool connect query called:', text);
              return { rows: [] };
            },
            release: () => {}
          };
        }
      };
    }
  }
  return poolInstance;
}

// Direct pool export with error handling
const pool = getPool();

module.exports = { getPool, pool };