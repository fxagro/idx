const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken: authMiddleware } = require('../middleware/authMiddleware');
const logger = require('../utils/logger').console;

// Auth route logging (requestId is already set in main routes/index.js)
router.use((req, res, next) => {
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

module.exports = router;
