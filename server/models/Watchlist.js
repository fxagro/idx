const { pool } = require('../config/db');
const logger = require('../utils/logger').console;

class Watchlist {
  // Get all watchlist items for a user
  static async findByUserId(userId) {
    try {
      const { rows } = await pool.query(
        `SELECT w.id, w.symbol, w.name, w.created_at 
         FROM watchlists w 
         WHERE w.user_id = $1 
         ORDER BY w.created_at DESC`,
        [userId]
      );
      return rows;
    } catch (error) {
      logger.error('Error finding watchlist by user ID:', { userId, error: error.message });
      throw error;
    }
  }

  // Check if a symbol exists in user's watchlist
  static async exists(userId, symbol) {
    try {
      const { rows } = await pool.query(
        'SELECT id FROM watchlists WHERE user_id = $1 AND symbol = $2',
        [userId, symbol.toUpperCase()]
      );
      return rows.length > 0;
    } catch (error) {
      logger.error('Error checking if watchlist item exists:', { userId, symbol, error: error.message });
      throw error;
    }
  }

  // Add a symbol to user's watchlist
  static async add(userId, symbol, name = null) {
    try {
      // Check if already exists
      const exists = await this.exists(userId, symbol);
      if (exists) {
        return { success: false, message: 'Symbol already in watchlist' };
      }

      const { rows } = await pool.query(
        `INSERT INTO watchlists (user_id, symbol, name) 
         VALUES ($1, $2, $3) 
         RETURNING id, symbol, name, created_at`,
        [userId, symbol.toUpperCase(), name]
      );

      logger.info('Watchlist item added:', { userId, symbol: rows[0].symbol });
      return { success: true, data: rows[0] };
    } catch (error) {
      logger.error('Error adding to watchlist:', { userId, symbol, error: error.message });
      throw error;
    }
  }

  // Remove a symbol from user's watchlist
  static async remove(userId, symbol) {
    try {
      const { rows } = await pool.query(
        `DELETE FROM watchlists 
         WHERE user_id = $1 AND symbol = $2 
         RETURNING id, symbol`,
        [userId, symbol.toUpperCase()]
      );

      if (rows.length === 0) {
        return { success: false, message: 'Symbol not found in watchlist' };
      }

      logger.info('Watchlist item removed:', { userId, symbol: rows[0].symbol });
      return { success: true, data: rows[0] };
    } catch (error) {
      logger.error('Error removing from watchlist:', { userId, symbol, error: error.message });
      throw error;
    }
  }

  // Delete all watchlist items for a user
  static async clear(userId) {
    try {
      const { rowCount } = await pool.query(
        'DELETE FROM watchlists WHERE user_id = $1',
        [userId]
      );

      logger.info('Watchlist cleared:', { userId, deletedCount: rowCount });
      return { success: true, deletedCount: rowCount };
    } catch (error) {
      logger.error('Error clearing watchlist:', { userId, error: error.message });
      throw error;
    }
  }

  // Get watchlist count for a user
  static async getCount(userId) {
    try {
      const { rows } = await pool.query(
        'SELECT COUNT(*) as count FROM watchlists WHERE user_id = $1',
        [userId]
      );
      return parseInt(rows[0].count);
    } catch (error) {
      logger.error('Error getting watchlist count:', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = Watchlist;
