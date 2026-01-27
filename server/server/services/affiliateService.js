const { pool } = require('../config/db');
const crypto = require('crypto');

class AffiliateService {
  // Generate a unique referral code
  static generateUniqueCode() {
    return crypto.randomBytes(8).toString('hex').toUpperCase();
  }

  // Generate referral link for a user
  static async generateReferralLink(userId) {
    try {
      // Check if user already has a referral link
      const existingLink = await pool.query(
        'SELECT referral_link FROM affiliate_referrals WHERE referrer_user_id = $1 AND level = 1',
        [userId]
      );

      if (existingLink.rows.length > 0) {
        return existingLink.rows[0].referral_link;
      }

      // Generate unique referral code
      let referralCode;
      let isUnique = false;

      while (!isUnique) {
        referralCode = this.generateUniqueCode();
        const checkUnique = await pool.query(
          'SELECT id FROM affiliate_referrals WHERE referral_link = $1',
          [referralCode]
        );
        isUnique = checkUnique.rows.length === 0;
      }

      // Save referral link to database
      await pool.query(
        'INSERT INTO affiliate_referrals (referrer_user_id, referral_link, level) VALUES ($1, $2, $3)',
        [userId, referralCode, 1]
      );

      // Log the action
      await this.logAuditAction(userId, 'generate_link', { referral_code: referralCode });

      return referralCode;
    } catch (error) {
      console.error('Error generating referral link:', error);
      throw new Error('Failed to generate referral link');
    }
  }

  // Get affiliate dashboard data
  static async getDashboardData(userId) {
    try {
      // Get referral link
      const referralLinkResult = await pool.query(
        'SELECT referral_link FROM affiliate_referrals WHERE referrer_user_id = $1 AND level = 1',
        [userId]
      );
      const referralLink = referralLinkResult.rows.length > 0 ? referralLinkResult.rows[0].referral_link : null;

      // Get total referrals by level
      const totalReferralsResult = await pool.query(`
        SELECT
          COUNT(CASE WHEN level = 1 THEN 1 END) as level_1_referrals,
          COUNT(CASE WHEN level = 2 THEN 1 END) as level_2_referrals
        FROM affiliate_referrals
        WHERE referrer_user_id = $1
      `, [userId]);

      const { level_1_referrals, level_2_referrals } = totalReferralsResult.rows[0];

      // Get total commissions by level
      const totalCommissionsResult = await pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN level = 1 THEN amount END), 0) as level_1_commissions,
          COALESCE(SUM(CASE WHEN level = 2 THEN amount END), 0) as level_2_commissions
        FROM affiliate_commissions
        WHERE user_id = $1
      `, [userId]);

      const { level_1_commissions, level_2_commissions } = totalCommissionsResult.rows[0];

      // Get referral history
      const historyResult = await pool.query(`
        SELECT
          ar.referred_user_id,
          u.email as referred_email,
          ar.level,
          ar.created_at,
          COALESCE(SUM(ac.amount), 0) as total_commission
        FROM affiliate_referrals ar
        LEFT JOIN users u ON ar.referred_user_id = u.id
        LEFT JOIN affiliate_commissions ac ON ar.id = ac.referral_id AND ac.user_id = $1
        WHERE ar.referrer_user_id = $1
        GROUP BY ar.id, u.id, u.email, ar.level, ar.created_at
        ORDER BY ar.created_at DESC
        LIMIT 50
      `, [userId]);

      return {
        referral_link: referralLink,
        total_referrals: {
          level_1: parseInt(level_1_referrals) || 0,
          level_2: parseInt(level_2_referrals) || 0,
          total: (parseInt(level_1_referrals) || 0) + (parseInt(level_2_referrals) || 0)
        },
        total_commissions: {
          level_1: parseFloat(level_1_commissions) || 0,
          level_2: parseFloat(level_2_commissions) || 0,
          total: (parseFloat(level_1_commissions) || 0) + (parseFloat(level_2_commissions) || 0)
        },
        history: historyResult.rows
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw new Error('Failed to get dashboard data');
    }
  }

  // Process commission for a sale
  static async processCommission(saleId, referredUserId, amount) {
    try {
      // Get referral information
      const referral = await pool.query(
        'SELECT referrer_user_id, level FROM affiliate_referrals WHERE referred_user_id = $1',
        [referredUserId]
      );

      if (referral.rows.length === 0) {
        return { success: false, message: 'No referral found for user' };
      }

      const referralData = referral.rows[0];

      // Get current affiliate settings
      const settings = await pool.query('SELECT * FROM affiliate_settings ORDER BY updated_at DESC LIMIT 1');
      if (settings.rows.length === 0) {
        throw new Error('No affiliate settings found');
      }

      const { level_1_commission_rate } = settings.rows[0];
      const level1Commission = (amount * level_1_commission_rate) / 100;
      const level2Commission = level1Commission / 2;

      // Save commission for Level 1
      await pool.query(
        'INSERT INTO affiliate_commissions (user_id, referral_id, amount, level, sale_id) VALUES ($1, $2, $3, $4, $5)',
        [referralData.referrer_user_id, referralData.id, level1Commission, 1, saleId]
      );

      // Check for Level 2 referrer
      const level2Referral = await pool.query(
        'SELECT referrer_user_id FROM affiliate_referrals WHERE referred_user_id = $1',
        [referralData.referrer_user_id]
      );

      if (level2Referral.rows.length > 0) {
        await pool.query(
          'INSERT INTO affiliate_commissions (user_id, referral_id, amount, level, sale_id) VALUES ($1, $2, $3, $4, $5)',
          [level2Referral.rows[0].referrer_user_id, referralData.id, level2Commission, 2, saleId]
        );
      }

      // Log the commission action
      await this.logAuditAction(referralData.referrer_user_id, 'commission_paid', {
        sale_id: saleId,
        referred_user_id: referredUserId,
        level_1_commission: level1Commission,
        level_2_commission: level2Commission
      });

      // Emit real-time update via Socket.io
      if (global.io) {
        global.io.emit('affiliate_commission_update', {
          user_id: referralData.referrer_user_id,
          amount: level1Commission,
          level: 1
        });

        if (level2Referral.rows.length > 0) {
          global.io.emit('affiliate_commission_update', {
            user_id: level2Referral.rows[0].referrer_user_id,
            amount: level2Commission,
            level: 2
          });
        }
      }

      return {
        success: true,
        level_1_commission: level1Commission,
        level_2_commission: level2Commission,
        level_1_user_id: referralData.referrer_user_id,
        level_2_user_id: level2Referral.rows.length > 0 ? level2Referral.rows[0].referrer_user_id : null
      };
    } catch (error) {
      console.error('Error processing commission:', error);
      throw new Error('Failed to process commission');
    }
  }

  // Get affiliate settings (admin only)
  static async getAffiliateSettings() {
    try {
      const settings = await pool.query('SELECT * FROM affiliate_settings ORDER BY updated_at DESC LIMIT 1');
      return settings.rows[0];
    } catch (error) {
      console.error('Error getting affiliate settings:', error);
      throw new Error('Failed to get affiliate settings');
    }
  }

  // Update affiliate settings (admin only)
  static async updateAffiliateSettings(level1Rate, adminUserId) {
    try {
      await pool.query(
        'INSERT INTO affiliate_settings (level_1_commission_rate, updated_by) VALUES ($1, $2)',
        [level1Rate, adminUserId]
      );

      // Log the settings update
      await this.logAuditAction(adminUserId, 'settings_updated', {
        level_1_commission_rate: level1Rate,
        level_2_commission_rate: level1Rate / 2
      });

      return { success: true, level_1_rate: level1Rate, level_2_rate: level1Rate / 2 };
    } catch (error) {
      console.error('Error updating affiliate settings:', error);
      throw new Error('Failed to update affiliate settings');
    }
  }

  // Handle referral signup
  static async handleReferralSignup(referralCode, newUserId) {
    try {
      // Validate referral code and get referrer info
      const referral = await pool.query(
        'SELECT referrer_user_id, level FROM affiliate_referrals WHERE referral_link = $1',
        [referralCode]
      );

      if (referral.rows.length === 0) {
        throw new Error('Invalid referral code');
      }

      const referralData = referral.rows[0];

      // Check if user is trying to refer themselves
      if (referralData.referrer_user_id === newUserId) {
        throw new Error('Cannot refer yourself');
      }

      // Determine the level for this referral
      let level = 1;
      if (referralData.level === 1) {
        level = 2; // This is a level 2 referral
      }

      // Create the referral relationship
      await pool.query(
        'INSERT INTO affiliate_referrals (referrer_user_id, referred_user_id, level, referral_link) VALUES ($1, $2, $3, $4)',
        [referralData.referrer_user_id, newUserId, level, referralCode]
      );

      // Log the referral signup
      await this.logAuditAction(referralData.referrer_user_id, 'referral_signup', {
        referred_user_id: newUserId,
        referral_code: referralCode,
        level: level
      });

      return {
        success: true,
        referrer_user_id: referralData.referrer_user_id,
        level: level
      };
    } catch (error) {
      console.error('Error handling referral signup:', error);
      throw error;
    }
  }

  // Log audit actions for security
  static async logAuditAction(userId, action, details) {
    try {
      await pool.query(
        'INSERT INTO affiliate_audit_log (user_id, action, details) VALUES ($1, $2, $3)',
        [userId, action, JSON.stringify(details)]
      );
    } catch (error) {
      console.error('Error logging audit action:', error);
      // Don't throw error for audit logging failures
    }
  }
}

module.exports = AffiliateService;