const rateLimit = require('express-rate-limit');

// General API limiter: 100 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please try again later.',
    retryAfter: 60
  },
  keyGenerator: (req) => req.ip
});

// Login limiter: 10 attempts per minute per IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    error: 'Too many login attempts. Please try again later.',
    retryAfter: 60
  },
  keyGenerator: (req) => req.ip
});

module.exports = { apiLimiter, loginLimiter };

