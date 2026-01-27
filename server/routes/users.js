const express = require("express");
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// list semua user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, subscription_expiry, api_usage, api_limit FROM users ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Users list error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get user profile with subscription status
router.get("/profile", authMiddleware, async (req, res) => {
  const userId = req.user.id; // From JWT
  try {
    const { rows } = await pool.query(
      'SELECT email, name, phone, subscription_expiry, api_usage, api_limit FROM users WHERE id = $1',
      [userId]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = rows[0];
    const isPaid = user.subscription_expiry && new Date(user.subscription_expiry) > new Date();
    res.json({
      ...user,
      subscription_status: isPaid ? 'Paid' : 'Free',
      is_admin: user.email === 'agro@demo.com',
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
