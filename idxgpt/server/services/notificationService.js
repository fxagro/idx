// server/services/notificationService.js
const pool = require('../db');

class NotificationService {
  static async send({ to, message, type = 'info' }) {
    try {
      // For now, we'll log notifications
      // In production, this would integrate with email service, push notifications, etc.
      console.log(`📧 Notification [${type.toUpperCase()}]:`, {
        to,
        message,
        timestamp: new Date().toISOString()
      });

      // Store notification in database for admin review
      await pool.query(
        'INSERT INTO notifications (recipient, message, type, created_at) VALUES ($1, $2, $3, $4)',
        [to, message, type, new Date()]
      );

      return { success: true, message: 'Notification sent successfully' };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendToAllUsers(message, type = 'info') {
    try {
      // Get all users
      const users = await pool.query('SELECT email FROM users WHERE role = $1', ['user']);

      const promises = users.rows.map(user =>
        this.send({ to: user.email, message, type })
      );

      await Promise.all(promises);
      return { success: true, recipients: users.rows.length };
    } catch (error) {
      console.error('Error sending to all users:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendToAdmins(message, type = 'info') {
    try {
      // Get all admins
      const admins = await pool.query('SELECT email FROM users WHERE role = $1', ['admin']);

      const promises = admins.rows.map(admin =>
        this.send({ to: admin.email, message, type })
      );

      await Promise.all(promises);
      return { success: true, recipients: admins.rows.length };
    } catch (error) {
      console.error('Error sending to admins:', error);
      return { success: false, error: error.message };
    }
  }

  static async getNotifications(limit = 50) {
    try {
      const result = await pool.query(
        'SELECT * FROM notifications ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
      return { success: true, notifications: result.rows };
    } catch (error) {
      console.error('Error getting notifications:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NotificationService;