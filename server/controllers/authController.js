const Joi = require('joi');
const AuthService = require('../services/authService');
const logger = require('../utils/logger').console;

// Input validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(1).max(100).optional(),
  phone: Joi.string().pattern(/^[0-9]{3,15}$/).optional().allow('')
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6)
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const revokeTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

class AuthController {
  // Register new user
  static async register(req, res, next) {
    const startTime = Date.now();

    try {
      logger.info(`[${req.requestId || 'no-id'}] 🔄 Registration request started`);

      // Validate request body
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        logger.warn(`[${req.requestId || 'no-id'}] ❌ Registration validation failed: ${error.details[0].message}`);
        return res.status(400).json({
          success: false,
          message: `Validation error: ${error.details[0].message}`
        });
      }

      // Call service
      const result = await AuthService.register(value);

      const processingTime = Date.now() - startTime;
      logger.info(`[${req.requestId || 'no-id'}] ✅ Registration successful for ${value.email} (${processingTime}ms)`);

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: result
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`[${req.requestId || 'no-id'}] 💥 Registration error (${processingTime}ms):`, {
        message: error.message,
        email: req.body?.email
      });

      // Handle specific error types
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      next(error);
    }
  }

  // Login user
  static async login(req, res, next) {
    const startTime = Date.now();

    try {
      logger.info(`[${req.requestId || 'no-id'}] 🔄 Login request started`);
      logger.info(`[${req.requestId || 'no-id'}] 📋 Request body:`, req.body);

      // Validate request body
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        logger.warn(`[${req.requestId || 'no-id'}] ❌ Login validation failed: ${error.details[0].message}`);
        return res.status(400).json({
          success: false,
          message: `Validation error: ${error.details[0].message}`
        });
      }

      // Call service
      const result = await AuthService.login(value.email, value.password);

      const processingTime = Date.now() - startTime;
      logger.info(`[${req.requestId || 'no-id'}] ✅ Login successful for ${value.email} (${processingTime}ms)`);

      // Return token directly at root level for frontend compatibility
      res.json({
        success: true,
        message: 'Login successful',
        token: result.token
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`[${req.requestId || 'no-id'}] 💥 Login error (${processingTime}ms):`, {
        message: error.message,
        email: req.body?.email
      });

      // Handle specific error types
      if (error.message.includes('Invalid credentials') || error.message.includes('User not found')) {
        return res.status(401).json({
          success: false,
          message: error.message.includes('User not found') ? 'Invalid credentials' : 'Invalid credentials'
        });
      }

      next(error);
    }
  }

  // Get current user info
  static async me(req, res, next) {
    const startTime = Date.now();

    try {
      logger.info(`[${req.requestId || 'no-id'}] 👤 Getting current user info for ${req.user.email}`);

      // Call service
      const userData = await AuthService.getCurrentUser(req.user.id);

      const processingTime = Date.now() - startTime;
      logger.info(`[${req.requestId || 'no-id'}] ✅ User info retrieved for ${req.user.email} (${processingTime}ms)`);

      res.json({
        success: true,
        message: 'User data retrieved successfully',
        data: userData
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`[${req.requestId || 'no-id'}] 💥 Get user info error (${processingTime}ms):`, {
        message: error.message,
        userId: req.user?.id
      });

      next(error);
    }
  }

  // Refresh token
  static async refresh(req, res, next) {
    const startTime = Date.now();

    try {
      logger.info(`[${req.requestId || 'no-id'}] 🔄 Token refresh request started`);

      // Validate request body
      const { error, value } = refreshTokenSchema.validate(req.body);
      if (error) {
        logger.warn(`[${req.requestId || 'no-id'}] ❌ Refresh validation failed: ${error.details[0].message}`);
        return res.status(400).json({
          success: false,
          message: `Validation error: ${error.details[0].message}`
        });
      }

      // Check if token is blacklisted
      if (AuthService.isTokenBlacklisted(value.refreshToken)) {
        logger.warn(`[${req.requestId || 'no-id'}] 🚫 Blacklisted token used for refresh`);
        return res.status(401).json({
          success: false,
          message: 'Refresh token has been revoked'
        });
      }

      // Call service
      const result = await AuthService.refreshToken(value.refreshToken);

      const processingTime = Date.now() - startTime;
      logger.info(`[${req.requestId || 'no-id'}] ✅ Token refresh successful for ${result.user.email} (${processingTime}ms)`);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`[${req.requestId || 'no-id'}] 💥 Token refresh error (${processingTime}ms):`, {
        message: error.message
      });

      // Handle specific error types
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }

      next(error);
    }
  }

  // Revoke token
  static async revoke(req, res, next) {
    const startTime = Date.now();

    try {
      logger.info(`[${req.requestId || 'no-id'}] 🔄 Token revocation request started`);

      // Validate request body
      const { error, value } = revokeTokenSchema.validate(req.body);
      if (error) {
        logger.warn(`[${req.requestId || 'no-id'}] ❌ Revoke validation failed: ${error.details[0].message}`);
        return res.status(400).json({
          success: false,
          message: `Validation error: ${error.details[0].message}`
        });
      }

      // Call service
      const result = await AuthService.revokeToken(value.refreshToken);

      const processingTime = Date.now() - startTime;
      logger.info(`[${req.requestId || 'no-id'}] ✅ Token revocation successful (${processingTime}ms)`);

      res.json({
        success: true,
        message: 'Token revoked successfully'
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`[${req.requestId || 'no-id'}] 💥 Token revocation error (${processingTime}ms):`, {
        message: error.message
      });

      next(error);
    }
  }
}

module.exports = AuthController;