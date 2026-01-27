const jwt = require("jsonwebtoken");
const { pool } = require("../db");

// Load environment variables
require('dotenv').config({ path: '.env' });

// Validate JWT_SECRET is loaded
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET not found in environment variables! Using fallback.');
  process.env.JWT_SECRET = 'fallback_secret_dev';
} else {
  console.log('🔑 JWT_SECRET loaded from environment in middleware:', process.env.JWT_SECRET.slice(0, 10) + '...');
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: "Token missing" });
  }

  try {
    console.log('🔍 Verifying token in middleware with secret:', process.env.JWT_SECRET.slice(0, 10) + '...');
    console.log('🔍 Incoming token in middleware:', token.slice(0, 30) + '...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified in middleware for user:', decoded.email);

    // Fetch user role from database
    const { rows } = await pool.query(
      'SELECT id, email, role, subscription_expiry, api_usage, api_limit, ai_quota FROM users WHERE id = $1',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = rows[0];
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      subscription_expiry: user.subscription_expiry,
      api_usage: user.api_usage,
      api_limit: user.api_limit,
      ai_quota: user.ai_quota
    };

    next();
  } catch (err) {
    console.error("JWT error:", err.message);
    return res.status(401).json({ error: "Token invalid or expired" });
  }
}

module.exports = authMiddleware;
