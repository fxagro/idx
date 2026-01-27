// server/models/Session.js
const { pool } = require('../config/db');
const logger = require('../utils/logger').console;
const jwt = require('jsonwebtoken');

class Session {
  // Create a new session record
  static async createSession(userId, tokenJti, ipAddress, userAgent, location) {
    try {
      // Calculate expiration date (7 days from now to match JWT)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { rows } = await pool.query(
        `INSERT INTO user_sessions 
         (user_id, token_jti, ip_address, user_agent, location, expires_at) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [userId, tokenJti, ipAddress, userAgent, location, expiresAt]
      );

      logger.info('Session created successfully:', {
        sessionId: rows[0].id,
        userId,
        tokenJti,
        expiresAt: rows[0].expires_at
      });

      return rows[0];
    } catch (error) {
      logger.error('Error creating session:', { userId, tokenJti, error: error.message });
      throw error;
    }
  }

  // Update last activity for a session
  static async updateLastActive(tokenJti) {
    try {
      const { rows } = await pool.query(
        'UPDATE user_sessions SET last_active = NOW() WHERE token_jti = $1 AND is_revoked = false RETURNING *',
        [tokenJti]
      );

      if (rows.length === 0) {
        return null;
      }

      return rows[0];
    } catch (error) {
      logger.error('Error updating session last active:', { tokenJti, error: error.message });
      throw error;
    }
  }

  // Get all active sessions for a user
  static async getActiveSessionsByUser(userId) {
    try {
      const { rows } = await pool.query(
        `SELECT id, token_jti, ip_address, user_agent, location, 
                created_at, last_active, is_revoked, expires_at
         FROM user_sessions 
         WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()
         ORDER BY last_active DESC`,
        [userId]
      );

      return rows;
    } catch (error) {
      logger.error('Error getting active sessions:', { userId, error: error.message });
      throw error;
    }
  }

  // Get session by JTI
  static async getSessionByJti(tokenJti) {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM user_sessions WHERE token_jti = $1',
        [tokenJti]
      );

      return rows[0] || null;
    } catch (error) {
      logger.error('Error getting session by JTI:', { tokenJti, error: error.message });
      throw error;
    }
  }

  // Check if session is valid (not revoked and not expired)
  static async isSessionValid(tokenJti) {
    try {
      const session = await this.getSessionByJti(tokenJti);
      
      if (!session) {
        return false;
      }

      if (session.is_revoked) {
        return false;
      }

      if (new Date(session.expires_at) <= new Date()) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking session validity:', { tokenJti, error: error.message });
      return false;
    }
  }

  // Revoke a specific session
  static async revokeSession(tokenJti) {
    try {
      const { rows } = await pool.query(
        'UPDATE user_sessions SET is_revoked = true WHERE token_jti = $1 RETURNING *',
        [tokenJti]
      );

      if (rows.length === 0) {
        throw new Error('Session not found');
      }

      logger.info('Session revoked successfully:', { tokenJti });
      return rows[0];
    } catch (error) {
      logger.error('Error revoking session:', { tokenJti, error: error.message });
      throw error;
    }
  }

  // Revoke all sessions for a user except the current one
  static async revokeAllOtherSessions(userId, currentTokenJti) {
    try {
      const { rows } = await pool.query(
        `UPDATE user_sessions 
         SET is_revoked = true 
         WHERE user_id = $1 AND token_jti != $2 AND is_revoked = false
         RETURNING *`,
        [userId, currentTokenJti]
      );

      logger.info(`Revoked ${rows.length} other sessions for user:`, { userId });
      return rows.length;
    } catch (error) {
      logger.error('Error revoking all other sessions:', { userId, error: error.message });
      throw error;
    }
  }

  // Revoke all sessions for a user
  static async revokeAllSessions(userId) {
    try {
      const { rows } = await pool.query(
        'UPDATE user_sessions SET is_revoked = true WHERE user_id = $1 AND is_revoked = false RETURNING *',
        [userId]
      );

      logger.info(`Revoked ${rows.length} sessions for user:`, { userId });
      return rows.length;
    } catch (error) {
      logger.error('Error revoking all sessions:', { userId, error: error.message });
      throw error;
    }
  }

  // Clean up expired sessions (for maintenance)
  static async cleanupExpiredSessions() {
    try {
      const { rows } = await pool.query(
        'DELETE FROM user_sessions WHERE expires_at < NOW() - INTERVAL \'7 days\' RETURNING id'
      );

      if (rows.length > 0) {
        logger.info(`Cleaned up ${rows.length} expired sessions`);
      }

      return rows.length;
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', { error: error.message });
      throw error;
    }
  }

  // Get session count for a user
  static async getSessionCount(userId) {
    try {
      const { rows } = await pool.query(
        'SELECT COUNT(*) as count FROM user_sessions WHERE user_id = $1 AND is_revoked = false AND expires_at > NOW()',
        [userId]
      );

      return parseInt(rows[0].count);
    } catch (error) {
      logger.error('Error getting session count:', { userId, error: error.message });
      throw error;
    }
  }

  // Extract device info from user agent
  static parseUserAgent(userAgent) {
    if (!userAgent) {
      return {
        device: 'Unknown Device',
        browser: 'Unknown Browser',
        os: 'Unknown OS'
      };
    }

    // Simple parsing for common browsers and devices
    const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/i)?.[1] || 'Unknown Browser';
    const os = userAgent.match(/(Windows|Mac|Linux|iOS|Android)/i)?.[1] || 'Unknown OS';
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
    const device = isMobile ? 'Mobile Device' : 'Desktop Computer';

    return {
      device,
      browser,
      os
    };
  }

  // Get location from IP (placeholder for geolocation service)
  static async getLocationFromIP(ipAddress) {
    try {
      // In a real implementation, you'd use a geolocation API like ipapi.co
      // For now, return a default or try to get location
      if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === 'localhost') {
        return 'Local Network';
      }

      // You could implement actual IP geolocation here
      // For example, using ipapi.co free tier: `https://ipapi.co/${ipAddress}/json/`
      
      return 'Unknown Location';
    } catch (error) {
      logger.error('Error getting location from IP:', { ipAddress, error: error.message });
      return 'Unknown Location';
    }
  }
}

module.exports = Session;