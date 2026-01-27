const express = require('express');
const { authenticateToken: authMiddleware } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware').roleMiddleware;
const logger = require('../utils/logger').console;

// Load environment variables
require('dotenv').config({ path: '.env' });

// Unified response helpers (matching auth.js pattern)
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

const createSuccessResponse = (data, message = 'Success') => {
  return {
    success: true,
    message: message,
    data: data
  };
};

const router = express.Router();

// Protected test route - demonstrates authMiddleware functionality
router.get('/test', authMiddleware, async (req, res) => {
  const startTime = Date.now();
  let requestId = Math.random().toString(36).substring(7);

  try {
    logger.info(`[${requestId}] 🛡️ Protected test route accessed`);

    // Access user data attached by authMiddleware
    const user = req.user;

    logger.info(`[${requestId}] 👤 User data from middleware:`, {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    });

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 50));

    const responseData = {
      message: 'You have successfully accessed a protected route!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      timestamp: new Date().toISOString(),
      middleware: 'authMiddleware.js',
      features: [
        'JWT token verification',
        'User data fetching from database',
        'Structured logging with request IDs',
        'Unified error response format',
        'Performance timing'
      ]
    };

    const processingTime = Date.now() - startTime;
    logger.info(`[${requestId}] ✅ Protected test route completed successfully (${processingTime}ms)`);

    res.json(createSuccessResponse(responseData, 'Protected route accessed successfully'));

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[${requestId}] 💥 Unexpected error in protected test route (${processingTime}ms):`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    res.status(500).json(createErrorResponse('An unexpected error occurred', 500));
  }
});

// Protected route with role-based access example
router.get('/admin-test', authMiddleware, async (req, res) => {
  const startTime = Date.now();
  let requestId = Math.random().toString(36).substring(7);

  try {
    logger.info(`[${requestId}] 🔐 Admin test route accessed by user: ${req.user.email}`);

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      logger.warn(`[${requestId}] 🚫 Non-admin user attempted to access admin route: ${req.user.email}`);
      const processingTime = Date.now() - startTime;
      logger.info(`[${requestId}] ❌ Admin test route - access denied (${processingTime}ms)`);

      return res.status(403).json(createErrorResponse('Access denied - Admin role required', 403));
    }

    logger.info(`[${requestId}] 👑 Admin access granted for: ${req.user.email}`);

    const responseData = {
      message: 'Welcome to the admin-only area!',
      admin_user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role
      },
      admin_features: [
        'User management',
        'System configuration',
        'Analytics access',
        'Audit logs'
      ],
      timestamp: new Date().toISOString()
    };

    const processingTime = Date.now() - startTime;
    logger.info(`[${requestId}] ✅ Admin test route completed successfully (${processingTime}ms)`);

    res.json(createSuccessResponse(responseData, 'Admin access granted'));

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[${requestId}] 💥 Unexpected error in admin test route (${processingTime}ms):`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    res.status(500).json(createErrorResponse('An unexpected error occurred', 500));
  }
});

// Protected route showing user quota information
router.get('/profile', authMiddleware, async (req, res) => {
  const startTime = Date.now();
  let requestId = Math.random().toString(36).substring(7);

  try {
    logger.info(`[${requestId}] 👤 Profile route accessed by: ${req.user.email}`);

    const user = req.user;

    // Calculate subscription status
    const subscriptionStatus = user.subscription_expiry && new Date(user.subscription_expiry) > new Date() ? 'active' : 'expired';

    const responseData = {
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      subscription: {
        status: subscriptionStatus,
        expiry: user.subscription_expiry,
        api_usage: user.api_usage,
        api_limit: user.api_limit,
        ai_quota: user.ai_quota
      },
      usage_stats: {
        api_usage_percentage: Math.round((user.api_usage / user.api_limit) * 100),
        ai_quota_remaining: user.ai_quota,
        account_created: '2024-01-01' // This would come from database in real implementation
      },
      timestamp: new Date().toISOString()
    };

    const processingTime = Date.now() - startTime;
    logger.info(`[${requestId}] ✅ Profile route completed successfully (${processingTime}ms)`);

    res.json(createSuccessResponse(responseData, 'Profile data retrieved successfully'));

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[${requestId}] 💥 Unexpected error in profile route (${processingTime}ms):`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    res.status(500).json(createErrorResponse('An unexpected error occurred', 500));
  }
});

// Protected admin dashboard route - requires admin or superadmin role
router.get('/admin/dashboard', authMiddleware, roleMiddleware(['admin', 'superadmin']), async (req, res) => {
  const startTime = Date.now();
  let requestId = Math.random().toString(36).substring(7);

  try {
    logger.info(`[${requestId}] 📊 Admin dashboard accessed by: ${req.user.email} (Role: ${req.user.role})`);

    // Simulate dashboard data processing
    await new Promise(resolve => setTimeout(resolve, 30));

    const responseData = {
      dashboard: {
        title: 'Admin Dashboard',
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role
        },
        sections: [
          'User Management',
          'System Analytics',
          'Security Overview',
          'Audit Logs'
        ]
      },
      stats: {
        total_users: 1247,
        active_sessions: 89,
        system_health: 'good',
        last_updated: new Date().toISOString()
      },
      admin_features: [
        'User role management',
        'System configuration',
        'Security monitoring',
        'Data analytics',
        'Audit trail access'
      ],
      timestamp: new Date().toISOString()
    };

    const processingTime = Date.now() - startTime;
    logger.info(`[${requestId}] ✅ Admin dashboard completed successfully (${processingTime}ms)`);

    res.json(createSuccessResponse(responseData, 'Admin dashboard accessed successfully'));

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[${requestId}] 💥 Unexpected error in admin dashboard (${processingTime}ms):`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    res.status(500).json(createErrorResponse('An unexpected error occurred', 500));
  }
});

// Protected user settings route - accessible to all authenticated users
router.get('/user/settings', authMiddleware, async (req, res) => {
  const startTime = Date.now();
  let requestId = Math.random().toString(36).substring(7);

  try {
    logger.info(`[${requestId}] ⚙️ User settings accessed by: ${req.user.email} (Role: ${req.user.role})`);

    // Simulate settings data processing
    await new Promise(resolve => setTimeout(resolve, 20));

    const responseData = {
      settings: {
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role
        },
        preferences: {
          theme: 'light',
          language: 'en',
          notifications: true,
          email_updates: false
        },
        account: {
          subscription_status: req.user.subscription_expiry && new Date(req.user.subscription_expiry) > new Date() ? 'active' : 'expired',
          api_usage: req.user.api_usage,
          api_limit: req.user.api_limit,
          ai_quota: req.user.ai_quota,
          member_since: '2024-01-01'
        }
      },
      available_features: [
        'Profile customization',
        'Notification settings',
        'API usage monitoring',
        'Subscription management'
      ],
      timestamp: new Date().toISOString()
    };

    const processingTime = Date.now() - startTime;
    logger.info(`[${requestId}] ✅ User settings completed successfully (${processingTime}ms)`);

    res.json(createSuccessResponse(responseData, 'User settings retrieved successfully'));

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[${requestId}] 💥 Unexpected error in user settings (${processingTime}ms):`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    res.status(500).json(createErrorResponse('An unexpected error occurred', 500));
  }
});

module.exports = router;