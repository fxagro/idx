const logger = require('../utils/logger').console;

// Load environment variables
require('dotenv').config({ path: '.env' });

// Unified error response helper (matching auth.js pattern)
const createErrorResponse = (message, statusCode = 500, details = null) => {
  const isDev = process.env.NODE_ENV === 'development';
  const response = {
    success: false,
    message: message
  };

  if (isDev && details) {
    response.details = details;
  }

  return response;
};

// Role-based access control middleware
const roleMiddleware = (allowedRoles) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    let requestId = Math.random().toString(36).substring(7);

    try {
      logger.info(`[${requestId}] 🔄 Access check started`);

      // Validate input parameters
      if (!allowedRoles || !Array.isArray(allowedRoles) || allowedRoles.length === 0) {
        logger.error(`[${requestId}] ❌ Invalid allowedRoles parameter provided`);
        const processingTime = Date.now() - startTime;
        logger.info(`[${requestId}] ❌ Role middleware failed - invalid configuration (${processingTime}ms)`);
        return res.status(500).json(createErrorResponse('Server configuration error', 500));
      }

      // Check if user is authenticated (req.user should exist from authMiddleware)
      if (!req.user) {
        logger.warn(`[${requestId}] ❌ Authentication required before role check`);
        const processingTime = Date.now() - startTime;
        logger.info(`[${requestId}] ❌ Role middleware failed - no user object (${processingTime}ms)`);
        return res.status(401).json(createErrorResponse('Authentication required', 401));
      }

      // Check if user has a role
      if (!req.user.role) {
        logger.warn(`[${requestId}] ❌ User missing role field: ${req.user.email}`);
        const processingTime = Date.now() - startTime;
        logger.info(`[${requestId}] ❌ Role middleware failed - no role field (${processingTime}ms)`);
        return res.status(401).json(createErrorResponse('User role information missing', 401));
      }

      const userRole = req.user.role;
      logger.info(`[${requestId}] 🔍 User role detected: ${userRole}`);

      // Check if user's role is in the allowed roles list
      if (!allowedRoles.includes(userRole)) {
        logger.warn(`[${requestId}] 🚫 Access denied: insufficient privileges`);
        logger.info(`[${requestId}] 🚫 User role '${userRole}' not in allowed roles: [${allowedRoles.join(', ')}]`);
        const processingTime = Date.now() - startTime;
        logger.info(`[${requestId}] 🚫 Access denied: insufficient privileges (${processingTime}ms)`);

        return res.status(403).json(createErrorResponse('Access denied: insufficient privileges', 403, {
          userRole: userRole,
          allowedRoles: allowedRoles,
          reason: 'role_not_authorized'
        }));
      }

      logger.info(`[${requestId}] ✅ Access granted for role: ${userRole}`);
      const processingTime = Date.now() - startTime;
      logger.info(`[${requestId}] ✅ Role middleware completed successfully (${processingTime}ms)`);

      // Continue to next middleware/route
      next();

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`[${requestId}] 💥 Unexpected error in role middleware (${processingTime}ms):`, {
        message: error.message,
        stack: error.stack,
        code: error.code,
        userRole: req.user?.role,
        allowedRoles: allowedRoles
      });

      return res.status(500).json(createErrorResponse('An unexpected error occurred during authorization', 500));
    }
  };
};

// Convenience middleware functions for common role combinations
const adminOnly = roleMiddleware(['admin', 'superadmin']);
const superAdminOnly = roleMiddleware(['superadmin']);
const userOrAbove = roleMiddleware(['user', 'admin', 'superadmin']);
const adminOrAbove = roleMiddleware(['admin', 'superadmin']);

module.exports = {
  roleMiddleware,
  adminOnly,
  superAdminOnly,
  userOrAbove,
  adminOrAbove
};