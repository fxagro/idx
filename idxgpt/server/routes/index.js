const express = require('express');
const router = express.Router();
const logger = require('../utils/logger').console;

// Import route modules
const authRoutes = require('./authRoutes');

// Import existing routes (for backward compatibility)
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

// Request logging middleware for all routes
router.use((req, res, next) => {
  const startTime = Date.now();
  req.requestId = Math.random().toString(36).substring(7);

  // Log request
  logger.console.request(req.method, req.path, 200, 0);

  // Override res.end to log response time
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    logger.console.request(req.method, req.path, res.statusCode, duration);
    originalEnd.call(this, chunk, encoding);
  };

  next();
});

// Mount route modules
logger.info('🔗 Mounting API routes...');

// Auth routes (new modular structure)
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
  res.success('API is healthy', {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0'
  });
});

// 404 handler for undefined routes
router.use('*', (req, res) => {
  logger.warn(`[${req.requestId}] ❌ Route not found: ${req.method} ${req.path}`);
  res.error('Endpoint not found', 404);
});

logger.info('✅ All API routes mounted successfully');

module.exports = router;