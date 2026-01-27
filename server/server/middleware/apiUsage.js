// server/middleware/apiUsage.js
const pool = require('../db');

const checkApiUsage = async (req, res, next) => {
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(
      'SELECT api_usage, api_limit, subscription_expiry FROM users WHERE id = $1',
      [userId]
    );
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const isPaid = user.subscription_expiry && new Date(user.subscription_expiry) > new Date();
    if (user.api_usage >= user.api_limit) {
      return res.status(429).json({ error: 'API limit exceeded' });
    }
    await pool.query('UPDATE users SET api_usage = api_usage + 1 WHERE id = $1', [userId]);
    next();
  } catch (error) {
    console.error('API usage error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = checkApiUsage;