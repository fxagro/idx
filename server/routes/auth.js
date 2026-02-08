const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { pool } = require('../config/db');
const logger = require('../utils/logger').console;
const inMemoryCache = require('../utils/cache');
const Session = require('../models/Session');
const { loginLimiter } = require('../middleware/rateLimiter');

// Load environment variables
require('dotenv').config({ path: '.env' });

console.log('🔧 Auth.js - Current working directory:', process.cwd());
console.log('🔧 Auth.js - JWT_SECRET from env:', process.env.JWT_SECRET);
console.log('🔧 Auth.js - __dirname:', __dirname);

// Redis client for quota tracking (skip in development mode)
let redisClient = null;
if (process.env.NODE_ENV !== 'development') {
  try {
    const Redis = require('ioredis');
    redisClient = new Redis({ host: '127.0.0.1', port: 6379 });
    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });
  } catch (error) {
    logger.warn('Redis not available for quota tracking, using in-memory fallback');
  }
} else {
  logger.info('🔧 Dev mode: Using in-memory cache for quota tracking');
}

// Constants
let JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 900; // 15 minutes

// Validate JWT_SECRET is loaded
if (!JWT_SECRET) {
  logger.error('JWT_SECRET not found in environment variables! Using fallback.');
  JWT_SECRET = 'fallback_secret_dev';
} else {
  logger.info('🔑 JWT_SECRET loaded from environment:', JWT_SECRET.slice(0, 10) + '...');
}

// Unified error response helper
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

// Success response helper
const createSuccessResponse = (data, message = 'Success') => {
  return {
    success: true,
    message: message,
    data: data
  };
};

// Input validation and sanitization helpers
const validateAndSanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') {
    throw new Error('Email must be a non-empty string');
  }

  const sanitized = email.trim().toLowerCase();

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    throw new Error('Invalid email format');
  }

  return sanitized;
};

const validateAndSanitizePassword = (password) => {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  const sanitized = password.trim();

  if (sanitized.length < 1) {
    throw new Error('Password must be at least 1 character long');
  }

  return sanitized;
};

const validateAndSanitizeName = (name) => {
   if (!name || typeof name !== 'string') {
     return 'User';
   }

   return name.trim().substring(0, 100); // Limit name length
 };

const validateAndSanitizePhone = (phone) => {
   if (!phone || typeof phone !== 'string') {
     return '';
   }

   const sanitized = phone.trim();

   // Allow empty string
   if (sanitized === '') {
     return '';
   }

   // Validate phone format - digits only, 3-15 characters
   const phonePattern = /^[0-9]{3,15}$/;
   if (!phonePattern.test(sanitized)) {
     throw new Error('Phone number must contain only digits and be between 3 and 15 characters long');
   }

   return sanitized;
 };

// Quota tracking helper functions with fallback
async function incrementLoginAttempts(email) {
  const key = `login_attempts:${email}`;
  const ttl = LOCKOUT_TIME;

  try {
    if (redisClient) {
      const count = await redisClient.get(key);
      const newCount = (parseInt(count) || 0) + 1;
      await redisClient.setEx(key, ttl, newCount.toString());
      return newCount;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logger.warn('Redis down, using in-memory cache for login attempts');
    } else {
      logger.error('Error incrementing login attempts in Redis:', error.message);
    }
  }

  // Fallback to in-memory cache
  const count = parseInt(inMemoryCache.get(key)) || 0;
  const newCount = count + 1;
  inMemoryCache.set(key, newCount.toString(), ttl);
  return newCount;
}

async function getUserQuota(userId) {
  const key = `user_quota:${userId}`;

  if (redisClient) {
    try {
      const quota = await redisClient.get(key);
      return quota ? parseInt(quota) : null;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logger.warn('Redis down, using in-memory cache for user quota');
      } else {
        logger.error('Error getting user quota from Redis:', error.message);
      }
    }
  }

  // Fallback to in-memory cache
  return parseInt(inMemoryCache.get(key)) || null;
}

async function setUserQuota(userId, quota) {
  const key = `user_quota:${userId}`;
  const ttl = 3600; // 1 hour

  try {
    if (redisClient) {
      await redisClient.setEx(key, ttl, quota.toString());
      return;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      logger.warn('Redis down, using in-memory cache for user quota');
    } else {
      logger.error('Error setting user quota in Redis:', error.message);
    }
  }

  // Fallback to in-memory cache
  inMemoryCache.set(key, quota.toString(), ttl);
}

const router = express.Router();

// POST /login
router.post('/login', loginLimiter, async (req, res) => {
  const startTime = Date.now();
  let requestId = Math.random().toString(36).substring(7);

  try {
    logger.info(`[${requestId}] 🔄 Login request started`);

    // Check if request body exists
    if (!req.body) {
      logger.warn(`[${requestId}] ❌ Missing request body`);
      return res.status(400).json(createErrorResponse('Request body is required', 400));
    }

    // Log incoming request body for debugging
    logger.info(`[${requestId}] 📋 Incoming request body:`, JSON.stringify(req.body, null, 2));

    // Validate request body structure - allow both password and passwordless modes
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(1).optional() // Password is optional for passwordless mode
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      logger.warn(`[${requestId}] ❌ Validation failed: ${error.details[0].message}`);
      return res.status(400).json(createErrorResponse(
        `Validation error: ${error.details[0].message}`,
        400,
        { reason: 'validation_error', field: error.details[0].path[0] }
      ));
    }

    logger.info(`[${requestId}] ✅ Request validation successful`);

    // Sanitize and validate inputs
    let email, password;
    try {
      email = validateAndSanitizeEmail(value.email);
      // Password is optional - only validate if provided
      password = value.password ? validateAndSanitizePassword(value.password) : null;
      logger.info(`[${requestId}] 🔍 Input sanitization successful for email: ${email}`, {
        hasPassword: !!password
      });
    } catch (validationError) {
      logger.warn(`[${requestId}] ❌ Input validation error:`, {
        message: validationError.message,
        receivedBody: req.body
      });
      return res.status(400).json(createErrorResponse(
        `Validation error: ${validationError.message}`,
        400,
        { reason: 'validation_error' }
      ));
    }

    // Check login attempts (rate limiting)
    logger.info(`[${requestId}] 🔒 Checking login attempts for rate limiting`);
    try {
      const attempts = await incrementLoginAttempts(email);
      if (attempts > MAX_LOGIN_ATTEMPTS) {
        logger.warn(`[${requestId}] 🚫 Login blocked due to too many attempts for ${email} (${attempts} attempts)`);
        return res.status(429).json(createErrorResponse('Too many login attempts. Please try again later.', 429));
      }
      logger.info(`[${requestId}] ✅ Rate limiting check passed (${attempts}/${MAX_LOGIN_ATTEMPTS} attempts)`);
    } catch (error) {
      logger.error(`[${requestId}] ❌ Error checking login attempts:`, error.message);
      // Continue with login attempt even if rate limiting fails
    }

    // Get user from database
    logger.info(`[${requestId}] 🔍 Looking up user in database for email: ${email}`);
    let user;
    try {
      const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      user = rows[0];
      logger.info(`[${requestId}] 📋 User lookup completed`);
    } catch (dbError) {
      logger.error(`[${requestId}] ❌ Database error during user lookup:`, dbError.message);
      return res.status(500).json(createErrorResponse('Database error occurred', 500));
    }

    // Create demo user if not found (development only)
    if (!user && process.env.NODE_ENV === 'development') {
      logger.info(`[${requestId}] 🛠️ Creating demo user for ${email} (development mode)`);
      try {
        const hashedPassword = await bcrypt.hash('password', SALT_ROUNDS);

        await pool.query(
          'INSERT INTO users (email, password, name, role, subscription_expiry, api_usage, api_limit, ai_quota) VALUES ($1, $2, $3, $4, NOW() + INTERVAL \'1 month\', 0, 100, 10) RETURNING *',
          [email, hashedPassword, 'Demo User', 'user']
        );

        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        user = rows[0];

        logger.info(`[${requestId}] ✅ Demo user created successfully for ${email}`);
      } catch (demoUserError) {
        logger.error(`[${requestId}] ❌ Error creating demo user:`, demoUserError.message);
        return res.status(500).json(createErrorResponse('Error creating user account', 500));
      }
    }

    // Check if user exists
    if (!user) {
      logger.warn(`[${requestId}] 🚫 Login attempt for non-existent user: ${email}`);
      return res.status(401).json(createErrorResponse('Invalid credentials', 401));
    }

    logger.info(`[${requestId}] ✅ User found: ${user.email} (ID: ${user.id}, Role: ${user.role})`);

    // Handle password verification based on whether password was provided
    if (password) {
      logger.info(`[${requestId}] 🔐 Verifying password for ${email}`);
      let isValidPassword;
      try {
        isValidPassword = await bcrypt.compare(password, user.password);
        logger.info(`[${requestId}] ✅ Password verification completed`);
      } catch (bcryptError) {
        logger.error(`[${requestId}] ❌ Password verification error for ${email}:`, { error: bcryptError.message });
        return res.status(500).json(createErrorResponse('Authentication system error', 500));
      }

      if (!isValidPassword) {
        logger.warn(`[${requestId}] 🚫 Invalid password attempt for ${email}`);
        return res.status(401).json(createErrorResponse('Invalid credentials', 401));
      }
    } else {
      // Passwordless mode - only allow for existing users in development mode
      if (process.env.NODE_ENV !== 'development') {
        logger.warn(`[${requestId}] 🚫 Passwordless login not allowed in production mode`);
        return res.status(400).json(createErrorResponse('Password is required', 400));
      }
      logger.info(`[${requestId}] 🔓 Passwordless login allowed for development mode`);
    }

    logger.info(`[${requestId}] ✅ Password verified successfully for ${email}`);

    // Generate JWT token with JTI for session tracking
    logger.info(`[${requestId}] 🎫 Generating JWT token`);
    let token;
    try {
      // Generate JTI for session tracking
      const jti = require('crypto').randomBytes(16).toString('hex');
      
      token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, jti },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      logger.info(`[${requestId}] ✅ JWT token generated successfully for user: ${user.email} (JTI: ${jti})`);
    } catch (jwtError) {
      logger.error(`[${requestId}] ❌ JWT token generation error:`, jwtError.message);
      return res.status(500).json(createErrorResponse('Token generation failed', 500));
    }

    // Update user quota
    logger.info(`[${requestId}] 📊 Updating user quota`);
    try {
      const currentQuota = await getUserQuota(user.id);
      const newQuota = (currentQuota || (user.ai_quota || 10)) + 1;
      await setUserQuota(user.id, newQuota);
      logger.info(`[${requestId}] ✅ User quota updated successfully`);
    } catch (quotaError) {
      logger.warn(`[${requestId}] ⚠️ Failed to update user quota after login:`, quotaError.message);
      // Don't fail login if quota update fails
    }

    // Create user session
    logger.info(`[${requestId}] 📝 Creating user session`);
    try {
      // Decode token to get JTI for session creation
      const decoded = jwt.decode(token, { complete: true });
      const jti = decoded.payload.jti;
      
      // Get client IP and user agent
      const clientIP = req.ip || req.connection.remoteAddress || 'Unknown';
      const userAgent = req.get('User-Agent') || 'Unknown';
      
      // Create session record
      await Session.createSession(
        user.id,
        jti,
        clientIP,
        userAgent,
        await Session.getLocationFromIP(clientIP)
      );
      
      logger.info(`[${requestId}] ✅ User session created successfully for ${email}`);
    } catch (sessionError) {
      logger.warn(`[${requestId}] ⚠️ Failed to create session for user:`, {
        userId: user.id,
        error: sessionError.message
      });
      // Don't fail login if session creation fails
    }

    // Update user auth method
    try {
      const authMethod = password ? 'password' : 'passwordless';
      await pool.query(
        'UPDATE users SET auth_method = $1, updated_at = NOW() WHERE id = $2',
        [authMethod, user.id]
      );
      logger.info(`[${requestId}] ✅ User auth method updated: ${authMethod}`);
    } catch (updateError) {
      logger.warn(`[${requestId}] ⚠️ Failed to update user auth method:`, updateError.message);
      // Don't fail login if auth method update fails
    }

    const processingTime = Date.now() - startTime;
    logger.info(`[${requestId}] ✅ Login successful for ${email} (${processingTime}ms)`);

    // Return token directly at root level for frontend compatibility
    res.json({
      success: true,
      token: token,
      message: 'Login successful'
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[${requestId}] 💥 Unexpected login error (${processingTime}ms):`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    res.status(500).json(createErrorResponse('An unexpected error occurred during login', 500));
  }
});

// POST /register
router.post('/register', async (req, res) => {
   const startTime = Date.now();
   let requestId = Math.random().toString(36).substring(7);

   try {
     logger.info(`[${requestId}] 🔄 Registration request started`);

     // Check if request body exists
     if (!req.body) {
       logger.warn(`[${requestId}] ❌ Missing request body`);
       return res.status(400).json(createErrorResponse('Request body is required', 400));
     }

     // Log incoming request body for debugging
     logger.info(`[${requestId}] 📋 Incoming request body:`, JSON.stringify(req.body, null, 2));

     // Validate request body structure
     const schema = Joi.object({
       email: Joi.string().email().required(),
       password: Joi.string().min(6).required(),
       name: Joi.string().min(1).max(100).optional(),
       phone: Joi.string().pattern(/^[0-9]{3,15}$/).optional().allow('')
     });

     const { error, value } = schema.validate(req.body);
     if (error) {
       logger.warn(`[${requestId}] ❌ Validation failed: ${error.details[0].message}`);
       return res.status(400).json(createErrorResponse(
         `Validation error: ${error.details[0].message}`,
         400,
         { reason: 'validation_error', field: error.details[0].path[0] }
       ));
     }

     logger.info(`[${requestId}] ✅ Request validation successful`);

     // Sanitize and validate inputs
     let email, password, name, phone;
     try {
       email = validateAndSanitizeEmail(value.email);
       password = validateAndSanitizePassword(value.password);
       name = validateAndSanitizeName(value.name);

       // Validate phone using the validation function
       phone = validateAndSanitizePhone(value.phone);

       logger.info(`[${requestId}] 🔍 Input sanitization successful:`, {
         email,
         name: name || 'No name provided',
         phone: phone || 'No phone provided'
       });
     } catch (validationError) {
       logger.warn(`[${requestId}] ❌ Input validation error:`, {
         message: validationError.message,
         receivedBody: req.body
       });
       return res.status(400).json(createErrorResponse(
         `Validation error: ${validationError.message}`,
         400,
         { reason: 'validation_error' }
       ));
     }

     // Check if user already exists
     logger.info(`[${requestId}] 🔍 Checking if user already exists for email: ${email}`);
     try {
       const { rows: existingUsers } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
       if (existingUsers.length > 0) {
         logger.warn(`[${requestId}] ⚠️ Registration attempt for existing email: ${email}`);
         return res.status(409).json(createErrorResponse('User with this email already exists', 409, { reason: 'email_conflict' }));
       }
     } catch (dbError) {
       logger.error(`[${requestId}] ❌ Database error during user existence check:`, dbError.message);
       return res.status(500).json(createErrorResponse('Database error occurred while checking existing users', 500));
     }

     logger.info(`[${requestId}] ✅ User existence check passed`);

     // Hash password
     logger.info(`[${requestId}] 🔐 Hashing password`);
     let hashedPassword;
     try {
       hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
       logger.info(`[${requestId}] ✅ Password hashed successfully`);
     } catch (bcryptError) {
       logger.error(`[${requestId}] ❌ Password hashing error:`, bcryptError.message);
       return res.status(500).json(createErrorResponse('Password processing failed', 500));
     }

     // Create new user
     logger.info(`[${requestId}] 💾 Attempting to create user in database`);
     let newUser;
     try {
       const { rows } = await pool.query(
         'INSERT INTO users (email, password, role, subscription_expiry, api_usage, api_limit, ai_quota) VALUES ($1, $2, $3, NOW() + INTERVAL \'1 month\', 0, 100, 10) RETURNING id, email, role',
         [email, hashedPassword, 'user']
       );
       newUser = rows[0];

       logger.info(`[${requestId}] ✅ User created successfully in database:`, {
         id: newUser.id,
         email: newUser.email,
         role: newUser.role
       });
     } catch (dbError) {
       logger.error(`[${requestId}] ❌ Database error during user creation:`, {
         message: dbError.message,
         code: dbError.code,
         email
       });

       if (dbError.code === '23505') { // Unique constraint violation
         return res.status(409).json(createErrorResponse(
           'User with this email already exists',
           409,
           { reason: 'email_conflict' }
         ));
       }

       // Handle missing columns gracefully
       if (dbError.code === '42703') { // Column doesn't exist
         logger.warn(`[${requestId}] ⚠️ Database column missing, but continuing registration`);
         // Don't fail registration for missing optional columns
       }

       return res.status(500).json(createErrorResponse(
         'Failed to create user account due to database error',
         500,
         { reason: 'database_error', errorCode: dbError.code }
       ));
     }

     // Generate JWT token
     logger.info(`[${requestId}] 🎫 Generating JWT token`);
     let token;
     try {
       token = jwt.sign(
         { id: newUser.id, email: newUser.email, role: newUser.role },
         JWT_SECRET,
         { expiresIn: '7d' }
       );
       logger.info(`[${requestId}] ✅ JWT token generated successfully`);
     } catch (jwtError) {
       logger.error(`[${requestId}] ❌ JWT token generation error:`, jwtError.message);
       return res.status(500).json(createErrorResponse('Token generation failed', 500));
     }

     // Send success response
     const responseData = {
       token,
       user: {
         id: newUser.id,
         email: newUser.email,
         role: newUser.role
       }
     };

     const processingTime = Date.now() - startTime;
     logger.info(`[${requestId}] ✅ Registration successful for ${email} (${processingTime}ms)`);

     res.status(201).json(createSuccessResponse(responseData, 'Registration successful'));

   } catch (error) {
     const processingTime = Date.now() - startTime;
     logger.error(`[${requestId}] 💥 Unexpected registration error (${processingTime}ms):`, {
       message: error.message,
       stack: error.stack,
       code: error.code
     });

     res.status(500).json(createErrorResponse('An unexpected error occurred during registration', 500));
   }
 });

// POST /refresh
router.post('/refresh', async (req, res) => {
 const startTime = Date.now();
 let requestId = Math.random().toString(36).substring(7);

  try {
    logger.info(`[${requestId}] 🔄 Token refresh request started`);

    // Check if request body exists
    if (!req.body) {
      logger.warn(`[${requestId}] ❌ Missing request body`);
      return res.status(400).json(createErrorResponse('Request body is required', 400));
    }

    // Log incoming request body for debugging
    logger.info(`[${requestId}] 📋 Incoming request body:`, JSON.stringify(req.body, null, 2));

    // Validate request body structure
    const schema = Joi.object({
      refreshToken: Joi.string().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      logger.warn(`[${requestId}] ❌ Validation failed: ${error.details[0].message}`);
      return res.status(400).json(createErrorResponse(
        `Validation error: ${error.details[0].message}`,
        400,
        { reason: 'validation_error', field: error.details[0].path[0] }
      ));
    }

    logger.info(`[${requestId}] ✅ Request validation successful`);

    const { refreshToken } = value;

    // Validate and decode refresh token
    logger.info(`[${requestId}] 🔍 Validating refresh token`);
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
      logger.info(`[${requestId}] ✅ Refresh token decoded successfully for user: ${decoded.email}`);
    } catch (jwtError) {
      logger.warn(`[${requestId}] ❌ Invalid or expired refresh token:`, jwtError.message);

      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json(createErrorResponse('Refresh token has expired', 401));
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json(createErrorResponse('Invalid refresh token', 401));
      } else {
        return res.status(401).json(createErrorResponse('Token verification failed', 401));
      }
    }

    // Check if token is blacklisted (optional functionality)
    logger.info(`[${requestId}] 🚫 Checking if token is blacklisted`);
    const blacklistKey = `blacklist:${refreshToken}`;
    try {
      const isBlacklisted = inMemoryCache.get(blacklistKey);
      if (isBlacklisted) {
        logger.warn(`[${requestId}] 🚫 Refresh token is blacklisted for user: ${decoded.email}`);
        return res.status(401).json(createErrorResponse('Refresh token has been revoked', 401));
      }
      logger.info(`[${requestId}] ✅ Token is not blacklisted`);
    } catch (cacheError) {
      logger.warn(`[${requestId}] ⚠️ Error checking blacklist, continuing:`, cacheError.message);
      // Continue even if blacklist check fails
    }

    // Verify user still exists in database
    logger.info(`[${requestId}] 🔍 Verifying user exists in database: ${decoded.email}`);
    let user;
    try {
      const { rows } = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [decoded.id]);
      user = rows[0];

      if (!user) {
        logger.warn(`[${requestId}] 🚫 User not found in database: ${decoded.id}`);
        return res.status(401).json(createErrorResponse('User not found', 401));
      }

      logger.info(`[${requestId}] ✅ User verified: ${user.email} (ID: ${user.id}, Role: ${user.role})`);
    } catch (dbError) {
      logger.error(`[${requestId}] ❌ Database error during user verification:`, dbError.message);
      return res.status(500).json(createErrorResponse('Database error occurred', 500));
    }

    // Generate new access token
    logger.info(`[${requestId}] 🎫 Generating new access token`);
    let newToken;
    try {
      newToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      logger.info(`[${requestId}] ✅ New access token generated successfully for user: ${user.email}`);
    } catch (jwtError) {
      logger.error(`[${requestId}] ❌ New token generation error:`, jwtError.message);
      return res.status(500).json(createErrorResponse('Token generation failed', 500));
    }

    const processingTime = Date.now() - startTime;
    logger.info(`[${requestId}] ✅ Token refresh successful for ${user.email} (${processingTime}ms)`);

    res.json({
      success: true,
      token: newToken,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[${requestId}] 💥 Unexpected token refresh error (${processingTime}ms):`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    res.status(500).json(createErrorResponse('An unexpected error occurred during token refresh', 500));
  }
});

// POST /revoke
router.post('/revoke', async (req, res) => {
  const startTime = Date.now();
  let requestId = Math.random().toString(36).substring(7);

  try {
    logger.info(`[${requestId}] 🔄 Token revocation request started`);

    // Check if request body exists
    if (!req.body) {
      logger.warn(`[${requestId}] ❌ Missing request body`);
      return res.status(400).json(createErrorResponse('Request body is required', 400));
    }

    // Validate request body structure
    const schema = Joi.object({
      refreshToken: Joi.string().required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      logger.warn(`[${requestId}] ❌ Validation failed: ${error.details[0].message}`);
      return res.status(400).json(createErrorResponse(
        `Validation error: ${error.details[0].message}`,
        400,
        { reason: 'validation_error', field: error.details[0].path[0] }
      ));
    }

    logger.info(`[${requestId}] ✅ Request validation successful`);

    const { refreshToken } = value;

    // Decode token to verify it's valid before blacklisting
    logger.info(`[${requestId}] 🔍 Validating token before blacklisting`);
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
      logger.info(`[${requestId}] ✅ Token validated for user: ${decoded.email}`);
    } catch (jwtError) {
      logger.warn(`[${requestId}] ❌ Invalid token for blacklisting:`, jwtError.message);
      return res.status(400).json(createErrorResponse('Invalid token provided for revocation', 400));
    }

    // Add token to blacklist
    logger.info(`[${requestId}] 🚫 Adding token to blacklist`);
    const blacklistKey = `blacklist:${refreshToken}`;
    const ttl = 7 * 24 * 60 * 60; // 7 days (same as token expiry)

    try {
      inMemoryCache.set(blacklistKey, 'revoked', ttl);
      logger.info(`[${requestId}] ✅ Token successfully blacklisted for user: ${decoded.email}`);
    } catch (cacheError) {
      logger.error(`[${requestId}] ❌ Error adding token to blacklist:`, cacheError.message);
      return res.status(500).json(createErrorResponse('Failed to revoke token', 500));
    }

    const processingTime = Date.now() - startTime;
    logger.info(`[${requestId}] ✅ Token revocation successful for ${decoded.email} (${processingTime}ms)`);

    res.json({
      success: true,
      message: 'Token revoked successfully'
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[${requestId}] 💥 Unexpected token revocation error (${processingTime}ms):`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    res.status(500).json(createErrorResponse('An unexpected error occurred during token revocation', 500));
  }
 });

 // POST /auth/update-profile - Update user profile
 router.post('/update-profile', async (req, res) => {
   const startTime = Date.now();
   let requestId = Math.random().toString(36).substring(7);

   try {
     logger.info(`[${requestId}] 🔄 Update profile request started`);

     // Check if request body exists
     if (!req.body) {
       logger.warn(`[${requestId}] ❌ Missing request body`);
       return res.status(400).json(createErrorResponse('Request body is required', 400));
     }

     // Get user from token
     const authHeader = req.headers.authorization;
     if (!authHeader || !authHeader.startsWith('Bearer ')) {
       logger.warn(`[${requestId}] ❌ No authorization token provided`);
       return res.status(401).json(createErrorResponse('Authorization token required', 401));
     }

     const token = authHeader.split(' ')[1];
     let decoded;
     try {
       decoded = jwt.verify(token, JWT_SECRET);
       logger.info(`[${requestId}] ✅ Token verified for user: ${decoded.email}`);
     } catch (jwtError) {
       logger.warn(`[${requestId}] ❌ Invalid token:`, jwtError.message);
       return res.status(401).json(createErrorResponse('Invalid or expired token', 401));
     }

     // Validate request body
     const schema = Joi.object({
       email: Joi.string().email().optional(),
       username: Joi.string().min(1).max(100).optional()
     });

     const { error, value } = schema.validate(req.body);
     if (error) {
       logger.warn(`[${requestId}] ❌ Validation failed: ${error.details[0].message}`);
       return res.status(400).json(createErrorResponse(
         `Validation error: ${error.details[0].message}`,
         400,
         { reason: 'validation_error', field: error.details[0].path[0] }
       ));
     }

     logger.info(`[${requestId}] ✅ Request validation successful`);

     // Build update query dynamically
     const updates = [];
     const values = [];
     let paramIndex = 1;

     if (value.email) {
       updates.push(`email = $${paramIndex}`);
       values.push(value.email);
       paramIndex++;
     }

     if (updates.length === 0) {
       logger.warn(`[${requestId}] ❌ No valid fields to update`);
       return res.status(400).json(createErrorResponse('No valid fields to update', 400));
     }

     values.push(decoded.id);
     const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

     logger.info(`[${requestId}] 📝 Executing update query`);
     await pool.query(updateQuery, values);

     logger.info(`[${requestId}] ✅ Profile updated successfully for user: ${decoded.email}`);

     res.json({
       success: true,
       message: 'Profile updated successfully',
       data: {
         user: {
           id: decoded.id,
           email: value.email || decoded.email
         }
       }
     });

   } catch (error) {
     const processingTime = Date.now() - startTime;
     logger.error(`[${requestId}] 💥 Unexpected update profile error (${processingTime}ms):`, {
       message: error.message,
       stack: error.stack,
       code: error.code
     });

     res.status(500).json(createErrorResponse('An unexpected error occurred during profile update', 500));
   }
 });

 module.exports = router;
