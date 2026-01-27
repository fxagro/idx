const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken: authMiddleware } = require('../middleware/authMiddleware');
const logger = require('../utils/logger').console;

// Request ID middleware for auth routes
router.use((req, res, next) => {
  req.requestId = Math.random().toString(36).substring(7);
  logger.info(`[${req.requestId}] 🔄 Auth route accessed: ${req.method} ${req.path}`);
  next();
});

// POST /api/auth/register - Register new user
router.post('/register', (req, res, next) => AuthController.register(req, res, next));

// POST /api/auth/login - Login user
router.post('/login', (req, res, next) => AuthController.login(req, res, next));

// POST /api/auth/refresh - Refresh token
router.post('/refresh', (req, res, next) => AuthController.refresh(req, res, next));

// POST /api/auth/revoke - Revoke token
router.post('/revoke', (req, res, next) => AuthController.revoke(req, res, next));

// POST /api/auth/me - Get current user info (protected)
router.post('/me', authMiddleware, (req, res, next) => AuthController.me(req, res, next));

// Legacy GET /api/auth/me support (for backward compatibility)
router.get('/me', authMiddleware, (req, res, next) => AuthController.me(req, res, next));

module.exports = router;