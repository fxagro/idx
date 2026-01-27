/**
 * Migration: Create user_watchlist table for Stocklist page
 * Created: 2025-10-06 10:50 AM WIB
 * Purpose: Create table to store user's stock watchlist
 */

const db = require('../db');

async function createUserWatchlistTable() {

  try {
    console.log('[Migration] Creating user_watchlist table...');

    // Create user_watchlist table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_watchlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol VARCHAR(10) NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, symbol)
      );
    `);

    // Create indexes for better performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_watchlist_user_id ON user_watchlist(user_id);
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_watchlist_symbol ON user_watchlist(symbol);
    `);

    console.log('[Migration] ✅ user_watchlist table created successfully');

    // Verify table creation
    const result = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'user_watchlist'
    `);

    if (result.rows.length > 0) {
      console.log('[Migration] ✅ Verified user_watchlist table exists');
    } else {
      throw new Error('Failed to create user_watchlist table');
    }

  } catch (error) {
    console.error('[Migration] ❌ Error creating user_watchlist table:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  createUserWatchlistTable()
    .then(() => {
      console.log('[Migration] ✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Migration] ❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createUserWatchlistTable };