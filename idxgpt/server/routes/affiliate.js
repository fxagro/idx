const express = require('express');
const router = express.Router();
const { authenticateToken: authMiddleware } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware').roleMiddleware;
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const AffiliateService = require('../services/affiliateService');
const pool = require('../db');
const cron = require('node-cron');

// Schema for commission rate updates
const commissionSchema = Joi.object({
  level_1_commission_rate: Joi.number().min(0).max(100).required()
});

// Schema for referral signup
const referralSignupSchema = Joi.object({
  referral_code: Joi.string().required()
});

// Get affiliate dashboard data
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const dashboardData = await AffiliateService.getDashboardData(userId);

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error getting affiliate dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get affiliate dashboard data'
    });
  }
});

// Generate new referral link
router.post('/generate-link', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const referralCode = await AffiliateService.generateReferralLink(userId);

    res.json({
      success: true,
      referral_code: referralCode,
      referral_link: `${process.env.CLIENT_URL || 'http://localhost:5173'}/register?ref=${referralCode}`
    });
  } catch (error) {
    console.error('Error generating referral link:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate referral link'
    });
  }
});

// Admin: Update commission rates
router.put('/settings', authMiddleware, validate(commissionSchema), async (req, res) => {
  try {
    const userId = req.user.id;
    const { level_1_commission_rate } = req.body;

    // Check if user is admin (you may want to create an admin middleware)
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].email !== 'agro@demo.com') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const result = await AffiliateService.updateAffiliateSettings(level_1_commission_rate, userId);

    res.json({
      success: true,
      message: 'Commission rates updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error updating commission rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update commission rates'
    });
  }
});

// Admin: Get current affiliate settings
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is admin
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].email !== 'agro@demo.com') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const settings = await AffiliateService.getAffiliateSettings();

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error getting affiliate settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get affiliate settings'
    });
  }
});

// Handle referral signup
router.post('/signup/:referralCode', async (req, res) => {
  try {
    const { referralCode } = req.params;

    // For now, we'll handle the referral association after user registration
    // This endpoint validates the referral code
    const referral = await pool.query(
      'SELECT referrer_user_id, level FROM affiliate_referrals WHERE referral_link = $1',
      [referralCode]
    );

    if (referral.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid referral code'
      });
    }

    res.json({
      success: true,
      message: 'Referral code is valid',
      data: {
        referrer_user_id: referral.rows[0].referrer_user_id,
        level: referral.rows[0].level
      }
    });
  } catch (error) {
    console.error('Error validating referral code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate referral code'
    });
  }
});

// Get affiliate statistics for admin
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is admin
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0 || userResult.rows[0].email !== 'agro@demo.com') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // Get overall affiliate statistics
    const statsResult = await require('../db').query(`
      SELECT
        COUNT(DISTINCT ar.referrer_user_id) as total_affiliates,
        COUNT(DISTINCT ar.referred_user_id) as total_referred_users,
        COUNT(ar.id) as total_referrals,
        COALESCE(SUM(ac.amount), 0) as total_commissions_paid,
        COUNT(CASE WHEN ar.level = 1 THEN 1 END) as level_1_referrals,
        COUNT(CASE WHEN ar.level = 2 THEN 1 END) as level_2_referrals
      FROM affiliate_referrals ar
      LEFT JOIN affiliate_commissions ac ON ar.id = ac.referral_id
    `);

    const stats = statsResult.rows[0];

    // Get top affiliates
    const topAffiliatesResult = await require('../db').query(`
      SELECT
        u.id,
        u.name,
        u.email,
        COUNT(ar.id) as total_referrals,
        COALESCE(SUM(ac.amount), 0) as total_earned
      FROM users u
      LEFT JOIN affiliate_referrals ar ON u.id = ar.referrer_user_id
      LEFT JOIN affiliate_commissions ac ON u.id = ac.user_id
      GROUP BY u.id, u.name, u.email
      HAVING COUNT(ar.id) > 0
      ORDER BY total_earned DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        overview: stats,
        top_affiliates: topAffiliatesResult.rows
      }
    });
  } catch (error) {
    console.error('Error getting affiliate stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get affiliate statistics'
    });
  }
});

// GET /api/affiliate/network - Get user's referral network
router.get('/network', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get L1 downlines
    const l1Query = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.created_at as join_date,
        1 as level,
        COALESCE(c.total_commissions, 0) as total_commissions,
        COALESCE(c.total_earned, 0) as total_earned
      FROM affiliate_referrals r
      JOIN users u ON r.referred_user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as total_commissions, SUM(amount) as total_earned
        FROM affiliate_commissions
        GROUP BY user_id
      ) c ON u.id = c.user_id
      WHERE r.referred_by = $1
      ORDER BY u.created_at DESC
    `;

    // Get L2 downlines
    const l2Query = `
      WITH l1_users AS (
        SELECT referred_user_id as user_id
        FROM affiliate_referrals
        WHERE referred_by = $1
      )
      SELECT
        u.id,
        u.username,
        u.email,
        u.created_at as join_date,
        2 as level,
        COALESCE(c.total_commissions, 0) as total_commissions,
        COALESCE(c.total_earned, 0) as total_earned
      FROM l1_users l1
      JOIN affiliate_referrals r ON l1.user_id = r.referred_by
      JOIN users u ON r.referred_user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) as total_commissions, SUM(amount) as total_earned
        FROM affiliate_commissions
        GROUP BY user_id
      ) c ON u.id = c.user_id
      ORDER BY u.created_at DESC
    `;

    const [l1Result, l2Result] = await Promise.all([
      pool.query(l1Query, [userId]),
      pool.query(l2Query, [userId])
    ]);

    res.json({
      success: true,
      user_id: userId,
      l1_downlines: l1Result.rows,
      l2_downlines: l2Result.rows,
      summary: {
        l1_count: l1Result.rows.length,
        l2_count: l2Result.rows.length,
        total_downlines: l1Result.rows.length + l2Result.rows.length
      }
    });
  } catch (error) {
    console.error('Error getting user network:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get network data'
    });
  }
});

// GET /api/affiliate/commissions - Get user's monthly commissions
router.get('/commissions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`[Affiliate API] Getting commissions for user ${userId}`);

    // First check if affiliate_commissions table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'affiliate_commissions'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('[Affiliate API] affiliate_commissions table does not exist');
      return res.status(500).json({
        success: false,
        error: 'Affiliate commissions table not found. Please run database migrations.'
      });
    }

    // Check table structure
    const structureCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'affiliate_commissions'
      ORDER BY ordinal_position;
    `);

    console.log('[Affiliate API] affiliate_commissions table structure:', structureCheck.rows);

    // Check if month column exists before using it
    const hasMonthColumn = structureCheck.rows.some(col => col.column_name === 'month');

    let query;
    let queryParams;

    if (hasMonthColumn) {
      query = `
        SELECT
          COALESCE(month, TO_CHAR(created_at, 'YYYY-MM')) as month,
          SUM(amount) as total_earned,
          COUNT(*) as commission_count,
          'subscription' as commission_types
        FROM affiliate_commissions
        WHERE user_id = $1
        GROUP BY COALESCE(month, TO_CHAR(created_at, 'YYYY-MM'))
        ORDER BY month DESC
        LIMIT 12
      `;
      queryParams = [userId];
    } else {
      query = `
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') as month,
          SUM(amount) as total_earned,
          COUNT(*) as commission_count,
          'subscription' as commission_types
        FROM affiliate_commissions
        WHERE user_id = $1
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `;
      queryParams = [userId];
    }

    const { rows } = await pool.query(query, queryParams);

    console.log(`[Affiliate API] Found ${rows.length} commission records for user ${userId}`);

    res.json({
      success: true,
      commissions: rows,
      total_months: rows.length,
      user_id: userId
    });
  } catch (error) {
    console.error('[Affiliate API] Error getting user commissions:', error);
    console.error('Failed to query affiliate_commissions:', error.message);
    global.logger?.error('Failed to get commission data', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get commission data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/affiliate/processCommission - Process subscription commission (admin only)
router.post('/processCommission', authMiddleware, authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const { userId, amount, description } = req.body;

  // Validate input
  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input',
      message: 'userId and amount (> 0) are required'
    });
  }

  try {
    // Insert subscription commission
    const { rows } = await pool.query(
      'INSERT INTO affiliate_commissions (user_id, amount, type, description, month, created_at) VALUES ($1, $2, $3, $4, TO_CHAR(NOW(), \'YYYY-MM\'), NOW()) RETURNING *',
      [userId, amount, 'subscription', description || 'Subscription commission', NOW()]
    );

    res.json({
      success: true,
      commission: rows[0],
      message: 'Commission processed successfully. 2-level commissions will be calculated automatically.'
    });
  } catch (error) {
    console.error('Error processing commission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process commission'
    });
  }
});

// GET /api/affiliate/commission-settings - Get current commission rates
router.get('/commission-settings', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, l0_commission, l1_commission, updated_at, updated_by FROM commission_settings ORDER BY id DESC LIMIT 1'
    );

    if (rows.length === 0) {
      // Return default settings if none exist
      return res.json({
        success: true,
        settings: {
          id: null,
          l0_commission: 0.40,
          l1_commission: 0.40,
          updated_at: null,
          updated_by: null
        }
      });
    }

    res.json({
      success: true,
      settings: rows[0]
    });
  } catch (error) {
    console.error('Error getting commission settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get commission settings'
    });
  }
});

// POST /api/affiliate/commission-settings - Update commission rates (admin only)
router.post('/commission-settings', authMiddleware, authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const { l1Rate, l2Rate } = req.body;

  // Validate input
  if (typeof l1Rate !== 'number' || typeof l2Rate !== 'number' ||
      l1Rate < 0 || l1Rate > 1 || l2Rate < 0 || l2Rate > 1) {
    return res.status(400).json({
      success: false,
      error: 'Invalid rates',
      message: 'Rates must be numbers between 0 and 1'
    });
  }

  if ((l1Rate + l2Rate) > 0.60) {
    return res.status(400).json({
      success: false,
      error: 'Invalid rates',
      message: 'Total commission rate cannot exceed 60% (L1 + L2 ≤ 0.6)'
    });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO commission_settings (l0_commission, l1_commission, updated_by) VALUES ($1, $2, $3) RETURNING *',
      [l1Rate, l2Rate, req.user.id]
    );

    res.json({
      success: true,
      settings: rows[0],
      message: `Commission rates updated: L0=${l1Rate*100}%, L1=${l2Rate*100}%`
    });
  } catch (error) {
    console.error('Error updating commission settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update commission settings'
    });
  }
});

// Monthly commission processing function
const processMonthlyCommissions = async () => {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting monthly commission processing...');

    // Get current commission rates
    const settingsResult = await client.query(
      'SELECT l0_commission, l1_commission FROM commission_settings ORDER BY id DESC LIMIT 1'
    );
    const l1Rate = settingsResult.rows[0]?.l0_commission || 0.40;
    const l2Rate = settingsResult.rows[0]?.l1_commission || 0.40;

    console.log(`📊 Using commission rates: L1=${l1Rate*100}%, L2=${l2Rate*100}%`);

    // Get current month
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    // Check if commissions already processed for this month
    const existingResult = await client.query(
      'SELECT COUNT(*) as count FROM affiliate_commissions WHERE month = $1',
      [currentMonth]
    );

    if (parseInt(existingResult.rows[0].count) > 0) {
      console.log(`⚠️ Commissions already processed for ${currentMonth}, skipping...`);
      return;
    }

    // Get all active subscriptions
    const subscriptionsResult = await client.query(`
      SELECT
        u.id as user_id,
        u.subscription_amount,
        u.subscription_status,
        r.referred_by as l1_referrer,
        r2.referred_by as l2_referrer
      FROM users u
      LEFT JOIN affiliate_referrals r ON u.id = r.referred_user_id
      LEFT JOIN affiliate_referrals r2 ON r.referred_by = r2.referred_user_id
      WHERE u.subscription_status = 'active'
      AND u.subscription_amount > 0
    `);

    const subscriptions = subscriptionsResult.rows;
    console.log(`📈 Processing ${subscriptions.length} active subscriptions...`);

    let totalCommissions = 0;
    const commissionRecords = [];

    // Process each subscription
    for (const sub of subscriptions) {
      const subscriptionAmount = parseFloat(sub.subscription_amount);

      // L1 commission (direct referrer)
      if (sub.l1_referrer) {
        const l1Commission = subscriptionAmount * l1Rate;
        commissionRecords.push({
          user_id: sub.l1_referrer,
          referred_id: sub.user_id,
          amount: l1Commission,
          level: 1,
          type: 'subscription',
          month: currentMonth
        });
        totalCommissions += l1Commission;
      }

      // L2 commission (referrer's referrer)
      if (sub.l2_referrer) {
        const l2Commission = subscriptionAmount * l2Rate;
        commissionRecords.push({
          user_id: sub.l2_referrer,
          referred_id: sub.user_id,
          amount: l2Commission,
          level: 2,
          type: 'subscription',
          month: currentMonth
        });
        totalCommissions += l2Commission;
      }
    }

    // Insert all commission records
    if (commissionRecords.length > 0) {
      const values = commissionRecords.map((record, index) =>
        `($${index * 6 + 1}, $${index * 6 + 2}, $${index * 6 + 3}, $${index * 6 + 4}, $${index * 6 + 5}, $${index * 6 + 6})`
      ).join(', ');

      const params = commissionRecords.flatMap(record => [
        record.user_id,
        record.referred_id,
        record.amount,
        record.level,
        record.type,
        record.month
      ]);

      await client.query(`
        INSERT INTO affiliate_commissions (user_id, referred_id, amount, level, type, month)
        VALUES ${values}
      `, params);

      console.log(`✅ Processed ${commissionRecords.length} commission records`);
      console.log(`💰 Total commissions: $${totalCommissions.toFixed(2)}`);
    } else {
      console.log('ℹ️ No commissions to process this month');
    }

    // Emit Socket.io event for real-time updates
    if (global.io) {
      global.io.emit('commissionUpdate', {
        message: 'Monthly commissions processed',
        month: currentMonth,
        totalCommissions: totalCommissions,
        commissionCount: commissionRecords.length
      });
      console.log('📡 Socket.io commission update emitted');
    }

  } catch (error) {
    console.error('❌ Error processing monthly commissions:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Manual commission processing endpoint
router.post('/process-monthly-commissions', authMiddleware, authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    await processMonthlyCommissions();
    res.json({
      success: true,
      message: 'Monthly commissions processed successfully'
    });
  } catch (error) {
    console.error('Error in manual commission processing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process monthly commissions'
    });
  }
});

// Setup cron job to run on 1st of each month at 00:00
const setupCronJob = () => {
  // Run on 1st of each month at 00:00 (UTC)
  cron.schedule('0 0 1 * *', async () => {
    console.log('⏰ Cron job triggered: Processing monthly commissions...');
    try {
      await processMonthlyCommissions();
      console.log('✅ Monthly commission cron job completed successfully');
    } catch (error) {
      console.error('❌ Monthly commission cron job failed:', error);
    }
  }, {
    timezone: 'UTC'
  });

  console.log('📅 Monthly commission cron job scheduled (1st of each month at 00:00 UTC)');
};

// Initialize cron job when module is loaded
setupCronJob();

module.exports = router;