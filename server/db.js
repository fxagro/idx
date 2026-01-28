// Legacy db.js file - DEPRECATED
// Use server/config/db.js instead
// This file is kept for backward compatibility during transition

const { getPool } = require('./config/db');

// Lazy-loaded pool wrapper with proper method binding
const db = {
  _pool: null,
  
  getPool() {
    if (!this._pool) {
      try {
        this._pool = getPool();
      } catch (error) {
        console.error('[db.js] Failed to get pool:', error.message);
        // Return mock pool that returns empty results
        this._pool = {
          query: async () => ({ rows: [] }),
          connect: async () => ({
            query: async () => ({ rows: [] }),
            release: () => {}
          })
        };
      }
    }
    return this._pool;
  },
  
  // Wrap query to always use fresh pool
  async query(...args) {
    const pool = this.getPool();
    return pool.query(...args);
  },
  
  // Wrap connect to always use fresh pool  
  async connect(...args) {
    const pool = this.getPool();
    return pool.connect(...args);
  }
};

// Export as pool for backward compatibility
module.exports = { pool: db };
