const { pool } = require('../config/db');
const logger = require('../utils/logger').console;

class User {
  // Find user by ID
  static async findById(id) {
    try {
      const { rows } = await pool.query(
        'SELECT id, email, name, role, subscription_expiry, api_usage, api_limit, ai_quota, created_at FROM users WHERE id = $1',
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by ID:', { id, error: error.message });
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by email:', { email, error: error.message });
      throw error;
    }
  }

  // Create new user
  static async create(userData) {
    try {
      const { email, password, name, role = 'user' } = userData;
      const { rows } = await pool.query(
        'INSERT INTO users (email, password, name, role, subscription_expiry, api_usage, api_limit, ai_quota) VALUES ($1, $2, $3, $4, NOW() + INTERVAL \'1 month\', 0, 100, 10) RETURNING id, email, name, role',
        [email, password, name, role]
      );

      logger.info('User created successfully:', { id: rows[0].id, email: rows[0].email });
      return rows[0];
    } catch (error) {
      logger.error('Error creating user:', { email: userData.email, error: error.message });
      throw error;
    }
  }

  // Update user
  static async update(id, updateData) {
    try {
      const fields = Object.keys(updateData);
      const values = Object.values(updateData);

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      const query = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`;

      const { rows } = await pool.query(query, [id, ...values]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error updating user:', { id, error: error.message });
      throw error;
    }
  }

  // Delete user
  static async delete(id) {
    try {
      const { rows } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error deleting user:', { id, error: error.message });
      throw error;
    }
  }

  // Get all users (admin only)
  static async findAll(limit = 100, offset = 0) {
    try {
      const { rows } = await pool.query(
        'SELECT id, email, name, role, subscription_expiry, api_usage, api_limit, ai_quota, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      return rows;
    } catch (error) {
      logger.error('Error finding all users:', { error: error.message });
      throw error;
    }
  }

  // Update user quota
  static async updateQuota(userId, apiUsage, aiQuota) {
    try {
      const { rows } = await pool.query(
        'UPDATE users SET api_usage = $2, ai_quota = $3 WHERE id = $1 RETURNING *',
        [userId, apiUsage, aiQuota]
      );
      return rows[0] || null;
    } catch (error) {
      logger.error('Error updating user quota:', { userId, error: error.message });
      throw error;
    }
  }

  // Check if email exists
  static async emailExists(email) {
    try {
      const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      return rows.length > 0;
    } catch (error) {
      logger.error('Error checking if email exists:', { email, error: error.message });
      throw error;
    }
  }
}

module.exports = User;