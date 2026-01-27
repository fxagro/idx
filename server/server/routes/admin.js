const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken: authMiddleware } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware').roleMiddleware;
const Joi = require('joi');

// Get all users
router.get('/users', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, role, subscription_expiry, api_usage, api_limit, ai_quota, referral_code, referred_by, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user subscription and API limit
router.put('/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const { id } = req.params;
  const { api_limit, subscription_expiry } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE users SET api_limit = $1, subscription_expiry = $2 WHERE id = $3 RETURNING *',
      [api_limit, subscription_expiry, id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user referral code
router.put('/users/:id/referral-code', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const { id } = req.params;
  const { referral_code } = req.body;

  // Validate referral code
  const schema = Joi.string()
    .alphanum()
    .min(6)
    .max(50)
    .required()
    .messages({
      'string.alphanum': 'Referral code must contain only letters and numbers',
      'string.min': 'Referral code must be at least 6 characters',
      'string.max': 'Referral code cannot exceed 50 characters',
    });
  const { error } = schema.validate(referral_code);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    // Check if referral code is already taken by another user
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE referral_code = $1 AND id != $2',
      [referral_code, id]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Referral code already exists' });
    }

    // Update referral code
    const { rows } = await pool.query(
      'UPDATE users SET referral_code = $1 WHERE id = $2 RETURNING referral_code',
      [referral_code, id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Clear Redis cache for this user's referral link
    const redis = require('redis');
    const client = redis.createClient();
    await client.connect();
    await client.del(`referral:${id}`);
    await client.disconnect();

    res.json({
      referral_code: rows[0].referral_code,
      referral_link: `${process.env.CLIENT_URL || 'http://localhost:5173'}/register?ref=${rows[0].referral_code}`
    });
  } catch (error) {
    console.error('Update referral code error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/users/affiliate - Get all users with affiliate data
router.get('/users/affiliate', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.id,
        u.email,
        u.role,
        u.ai_quota,
        u.referral_code,
        u.created_at,
        COALESCE(r.referral_count, 0) as referral_count,
        COALESCE(c.total_commissions, 0) as total_commissions,
        COALESCE(c.total_earned, 0) as total_earned
      FROM users u
      LEFT JOIN (
        SELECT referred_by, COUNT(*) as referral_count
        FROM users
        WHERE referred_by IS NOT NULL
        GROUP BY referred_by
      ) r ON u.id = r.referred_by
      LEFT JOIN (
        SELECT user_id,
               COUNT(*) as total_commissions,
               SUM(amount) as total_earned
        FROM affiliate_commissions
        GROUP BY user_id
      ) c ON u.id = c.user_id
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/updateQuota - Update user AI quota
router.post('/updateQuota', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const { userId, aiQuota } = req.body;

  // Validate input
  if (!userId || typeof aiQuota !== 'number' || aiQuota < 0) {
    return res.status(400).json({
      error: 'Invalid input',
      message: 'userId and aiQuota (non-negative number) are required'
    });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE users SET ai_quota = $1 WHERE id = $2 RETURNING id, email, ai_quota',
      [aiQuota, userId]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: rows[0],
      message: `AI quota updated to ${aiQuota}`
    });
  } catch (error) {
    console.error('Update quota error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/updateUser - Update user password and referral code
router.post('/updateUser', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const { userId, newPassword, referralCode } = req.body;

  if (!userId) {
    return res.status(400).json({
      error: 'Invalid input',
      message: 'userId is required'
    });
  }

  try {
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Update password if provided
    if (newPassword) {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updates.push(`password = $${paramCount}`);
      values.push(hashedPassword);
      paramCount++;
    }

    // Update referral code if provided
    if (referralCode !== undefined) {
      // Validate referral code format
      const referralRegex = /^[a-zA-Z0-9_-]{4,20}$/;
      if (!referralRegex.test(referralCode)) {
        return res.status(400).json({
          error: 'Invalid referral code',
          message: 'Referral code must be 4-20 characters, alphanumeric, underscore, or hyphen only'
        });
      }

      // Check if referral code is already taken by another user
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE referral_code = $1 AND id != $2',
        [referralCode, userId]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          error: 'Referral code already exists',
          message: 'This referral code is already taken by another user'
        });
      }

      updates.push(`referral_code = $${paramCount}`);
      values.push(referralCode);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        message: 'Provide either newPassword or referralCode'
      });
    }

    values.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, email, referral_code`;

    const { rows } = await pool.query(query, values);

    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: rows[0],
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/network/:userId - Get user's referral network
router.get('/network/:userId', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const { userId } = req.params;

  try {
    // Get L1 downlines
    const l1Query = `
      SELECT
        u.id,
        u.email,
        u.created_at as join_date,
        1 as level,
        COALESCE(c.total_commissions, 0) as total_commissions,
        COALESCE(c.total_earned, 0) as total_earned
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) as total_commissions, SUM(amount) as total_earned
        FROM affiliate_commissions
        GROUP BY user_id
      ) c ON u.id = c.user_id
      WHERE u.referred_by = $1
      ORDER BY u.created_at DESC
    `;

    // Get L2 downlines
    const l2Query = `
      WITH l1_users AS (
        SELECT id as user_id
        FROM users
        WHERE referred_by = $1
      )
      SELECT
        u.id,
        u.email,
        u.created_at as join_date,
        2 as level,
        COALESCE(c.total_commissions, 0) as total_commissions,
        COALESCE(c.total_earned, 0) as total_earned
      FROM l1_users l1
      JOIN users u ON l1.user_id = u.referred_by
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
    console.error('Admin network error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/commission-settings - Get current commission rates
router.get('/commission-settings', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, l1_rate, l2_rate, updated_at, updated_by FROM commission_settings ORDER BY id DESC LIMIT 1'
    );

    if (rows.length === 0) {
      // Return default settings if none exist
      return res.json({
        id: null,
        l1_rate: 0.40,
        l2_rate: 0.20,
        updated_at: null,
        updated_by: null
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Commission settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/commission-settings - Update commission rates
router.post('/commission-settings', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const { l1Rate, l2Rate } = req.body;

  // Validate input
  if (typeof l1Rate !== 'number' || typeof l2Rate !== 'number' ||
      l1Rate < 0 || l1Rate > 1 || l2Rate < 0 || l2Rate > 1) {
    return res.status(400).json({
      error: 'Invalid rates',
      message: 'Rates must be numbers between 0 and 1'
    });
  }

  if ((l1Rate + l2Rate) > 0.60) {
    return res.status(400).json({
      error: 'Invalid rates',
      message: 'Total commission rate cannot exceed 60% (L1 + L2 ≤ 0.6)'
    });
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO commission_settings (l1_rate, l2_rate, updated_by) VALUES ($1, $2, $3) RETURNING *',
      [l1Rate, l2Rate, req.user.id]
    );

    res.json({
      success: true,
      settings: rows[0],
      message: `Commission rates updated: L1=${l1Rate*100}%, L2=${l2Rate*100}%`
    });
  } catch (error) {
    console.error('Update commission settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/monthly-commissions - Get monthly commission summary
router.get('/monthly-commissions', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        month,
        COUNT(DISTINCT user_id) as users_count,
        SUM(amount) as total_commissions,
        COUNT(*) as commission_count
      FROM affiliate_commissions
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `);

    res.json({
      monthly_summary: rows,
      total_months: rows.length
    });
  } catch (error) {
    console.error('Monthly commissions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/updateVirtualSaldo - Update user virtual balance
router.post('/updateVirtualSaldo', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
const { userId, virtualSaldo } = req.body;

// Validate input
if (!userId || typeof virtualSaldo !== 'number' || virtualSaldo < 0) {
  return res.status(400).json({
    error: 'Invalid input',
    message: 'userId and virtualSaldo (non-negative number) are required'
  });
}

try {
  const { rows } = await pool.query(
    'UPDATE users SET virtual_saldo = $1 WHERE id = $2 RETURNING id, email, virtual_saldo',
    [virtualSaldo, userId]
  );

  if (!rows[0]) {
    return res.status(404).json({
      error: 'User not found',
      message: 'User account not found'
    });
  }

  console.log(`💰 Admin ${req.user.id} updated virtual balance for user ${userId} to ${virtualSaldo}`);

  res.json({
    success: true,
    user: rows[0],
    message: `Virtual balance updated to ${virtualSaldo.toLocaleString('id-ID')} IDR`
  });
} catch (error) {
  console.error('Update virtual balance error:', error);
  res.status(500).json({ error: 'Server error' });
}
});

// GET /api/admin/virtual-portfolio/:userId - Get user's virtual portfolio (admin view)
router.get('/virtual-portfolio/:userId', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
const { userId } = req.params;

try {
  // First check if user exists
  const userCheck = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
  if (userCheck.rows.length === 0) {
    return res.status(404).json({
      error: 'User not found',
      message: 'User account not found'
    });
  }

  // Get user's portfolio with current prices
  const portfolioQuery = `
    SELECT
      vp.symbol,
      vp.qty,
      vp.avg_price,
      vp.created_at,
      vp.updated_at
    FROM virtual_portfolio vp
    WHERE vp.user_id = $1
    ORDER BY vp.updated_at DESC
  `;

  const portfolioResult = await pool.query(portfolioQuery, [userId]);

  if (portfolioResult.rows.length === 0) {
    return res.json({
      user: userCheck.rows[0],
      portfolio: [],
      total_value: 0,
      total_investment: 0,
      total_gain_loss: 0,
      timestamp: new Date().toISOString()
    });
  }

  // Get current prices for all symbols using yfinance
  const symbols = [...new Set(portfolioResult.rows.map(row => row.symbol))];
  const portfolioWithPrices = [];

  for (const symbol of symbols) {
    try {
      const yfinance = require('yfinance');
      const ticker = yfinance.Ticker(symbol);
      const info = await ticker.getInfo();

      if (info && info.regularMarketPrice) {
        const portfolioItem = portfolioResult.rows.find(row => row.symbol === symbol);
        const currentValue = info.regularMarketPrice * portfolioItem.qty;
        const totalInvestment = portfolioItem.avg_price * portfolioItem.qty;
        const gainLoss = currentValue - totalInvestment;
        const gainLossPercent = totalInvestment > 0 ? (gainLoss / totalInvestment) * 100 : 0;

        portfolioWithPrices.push({
          symbol: portfolioItem.symbol,
          quantity: portfolioItem.qty,
          avg_price: parseFloat(portfolioItem.avg_price),
          current_price: info.regularMarketPrice,
          current_value: currentValue,
          total_investment: totalInvestment,
          gain_loss: gainLoss,
          gain_loss_percent: gainLossPercent,
          last_updated: portfolioItem.updated_at
        });
      }
    } catch (priceError) {
      console.error(`Error fetching price for ${symbol}:`, priceError.message);
      // Continue with other symbols
    }
  }

  const totalValue = portfolioWithPrices.reduce((sum, item) => sum + item.current_value, 0);
  const totalInvestment = portfolioWithPrices.reduce((sum, item) => sum + item.total_investment, 0);
  const totalGainLoss = totalValue - totalInvestment;

  console.log(`📊 Admin portfolio view for user ${userId}: ${portfolioWithPrices.length} positions`);

  res.json({
    user: userCheck.rows[0],
    portfolio: portfolioWithPrices,
    summary: {
      total_positions: portfolioWithPrices.length,
      total_value: totalValue,
      total_investment: totalInvestment,
      total_gain_loss: totalGainLoss,
      total_gain_loss_percent: totalInvestment > 0 ? (totalGainLoss / totalInvestment) * 100 : 0
    },
    timestamp: new Date().toISOString()
  });

} catch (error) {
  console.error("Error fetching admin virtual portfolio:", error);
  res.status(500).json({
    error: "Failed to fetch portfolio",
    message: "An error occurred while fetching the user's virtual portfolio"
  });
}
});

// GET /api/admin/virtual-transactions/:userId - Get user's virtual transaction history (admin view)
router.get('/virtual-transactions/:userId', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
const { userId } = req.params;
const { limit = 50, offset = 0 } = req.query;

try {
  // First check if user exists
  const userCheck = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId]);
  if (userCheck.rows.length === 0) {
    return res.status(404).json({
      error: 'User not found',
      message: 'User account not found'
    });
  }

  const historyQuery = `
    SELECT
      symbol,
      type,
      qty,
      price,
      total_amount,
      transaction_date
    FROM virtual_transactions
    WHERE user_id = $1
    ORDER BY transaction_date DESC
    LIMIT $2 OFFSET $3
  `;

  const historyResult = await pool.query(historyQuery, [userId, parseInt(limit), parseInt(offset)]);

  // Get total count
  const countQuery = 'SELECT COUNT(*) as total FROM virtual_transactions WHERE user_id = $1';
  const countResult = await pool.query(countQuery, [userId]);

  const transactions = historyResult.rows.map(row => ({
    symbol: row.symbol,
    type: row.type,
    quantity: parseInt(row.qty),
    price: parseFloat(row.price),
    total_amount: parseFloat(row.total_amount),
    transaction_date: row.transaction_date
  }));

  console.log(`📋 Admin transaction history view for user ${userId}: ${transactions.length} transactions`);

  res.json({
    user: userCheck.rows[0],
    transactions: transactions,
    pagination: {
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
      has_more: parseInt(offset) + parseInt(limit) < parseInt(countResult.rows[0].total)
    },
    timestamp: new Date().toISOString()
  });

} catch (error) {
  console.error("Error fetching admin virtual transaction history:", error);
  res.status(500).json({
    error: "Failed to fetch transaction history",
    message: "An error occurred while fetching the user's virtual transaction history"
  });
}
});

module.exports = router;
