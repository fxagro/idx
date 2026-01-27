const express = require('express');
const router = express.Router();
const logger = require('../utils/logger').console;

// Import route modules - use authRoutes.js which uses AuthController
const authRoutes = require('./authRoutes');
const meRouter = require('./me');
const plansRouter = require('./plans');
const usersRouter = require('./users');
const adminRouter = require('./admin');
const commandRouter = require('./command');
const portfolioRouter = require('./portfolio');
const affiliateRouter = require('./affiliate');
const virtualTradingRouter = require('./virtualTrading');
const brokersRouter = require('./brokers');
const aiRouter = require('./ai');
const paymentsRouter = require('./payments');
const dashboardRouter = require('./dashboard');
const protectedRouter = require('./protected');

// Import existing stocks router
const stocksRouterInstance = require('./stocks');

// Simple request ID middleware for all routes
router.use((req, res, next) => {
  req.requestId = Math.random().toString(36).substring(7);
  next();
});

// Mount route modules
logger.info('🔗 Mounting API routes...');

// Auth routes
router.use('/auth', authRoutes);

// Existing routes (maintaining backward compatibility)
router.use('/me', meRouter);
router.use('/plans', plansRouter);
router.use('/users', usersRouter);
router.use('/admin', adminRouter);
router.use('/run-command', commandRouter);
router.use('/portfolio', portfolioRouter);
router.use('/affiliate', affiliateRouter);
router.use('/stocks/virtual', virtualTradingRouter);
router.use('/brokers', brokersRouter);
router.use('/ai', aiRouter);
router.use('/payments', paymentsRouter);
router.use('/dashboard', dashboardRouter);
router.use('/protected', protectedRouter);

// Mount stocks router explicitly (single declaration)
router.use('/stocks', stocksRouterInstance);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '2.0.0'
    }
  });
});

// 404 handler for undefined routes (exclude socket.io)
router.use('*', (req, res, next) => {
  // Allow socket.io connections to pass through
  if (req.path.startsWith('/socket.io/') || req.headers['upgrade'] === 'websocket') {
    logger.info(`[${req.requestId}] 🔌 Socket.io request allowed: ${req.path}`);
    return next();
  }
  
  logger.warn(`[${req.requestId}] ❌ Route not found: ${req.method} ${req.path}`);
  res.error('Endpoint not found', 404);
});

logger.info('✅ All API routes mounted successfully');

module.exports = router;