// server/middleware/requireAdmin.js
const logger = require('../utils/logger').console;

/**
 * Require Admin Middleware
 * Ensures only admin users can access protected routes
 */
function requireAdmin(req, res, next) {
  try {
    // Check if user is authenticated
    if (!req.user) {
      logger.warn('Admin access attempt without authentication', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'UNAUTHORIZED'
      });
    }

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      logger.warn('Non-admin user attempted to access admin resource', {
        userId: req.user.id,
        email: req.user.email,
        role: req.user.role,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
        error: 'FORBIDDEN'
      });
    }

    // Log successful admin access
    logger.info('Admin access granted', {
      userId: req.user.id,
      email: req.user.email,
      path: req.path,
      method: req.method
    });

    // Add admin info to request for tracking
    req.adminInfo = {
      userId: req.user.id,
      email: req.user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    next();
  } catch (error) {
    logger.error('Error in requireAdmin middleware:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      path: req.path
    });
    
    return res.status(500).json({
      success: false,
      message: 'Authorization check failed',
      error: 'INTERNAL_ERROR'
    });
  }
}

module.exports = requireAdmin;