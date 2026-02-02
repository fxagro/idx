const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const inMemoryCache = require('../utils/cache');
const logger = require('../utils/logger').console;

// Lazy load JWT secret to ensure environment variables are loaded
function getJwtSecret() {
  return process.env.JWT_SECRET || 'your-super-secret-jwt-key-minimum-32-characters-fallback';
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRATION || '7d';
}

// Create a fresh pool for each request to avoid connection issues
function getFreshPool() {
  return new Pool({
    user: process.env.DB_USER,
    password: String(process.env.DB_PASSWORD),
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

class AuthService {
  constructor() {
    this.jwtSecret = getJwtSecret();
    this.jwtExpiresIn = getJwtExpiresIn();
    this.operationLog = [];
  }

  // Enhanced logging method
  logOperation(operation, details, requestId = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      details,
      requestId,
      service: 'AuthService'
    };
    this.operationLog.push(logEntry);
    console.log(`[${logEntry.timestamp}] [${requestId || 'SYSTEM'}] AuthService ${operation}:`, details);
  }

  // Generate JWT token for user with enhanced logging
  generateToken(user, requestId = null) {
    this.logOperation('GENERATE_TOKEN_START', {
      userId: user.id,
      email: user.email,
      role: user.role,
      requestId
    }, requestId);

    try {
      const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name || user.email.split('@')[0]
      };
      
      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn,
        issuer: 'idxgpt-auth-system',
        audience: 'idxgpt-client'
      });

      this.logOperation('GENERATE_TOKEN_SUCCESS', {
        userId: user.id,
        email: user.email,
        tokenLength: token.length,
        expiresIn: this.jwtExpiresIn
      }, requestId);

      return token;
    } catch (error) {
      this.logOperation('GENERATE_TOKEN_ERROR', {
        error: error.message,
        userId: user.id
      }, requestId);
      throw error;
    }
  }

  // Verify JWT token with enhanced logging and edge case handling
  verifyToken(token, requestId = null) {
    this.logOperation('VERIFY_TOKEN_START', {
      tokenLength: token ? token.length : 0,
      hasToken: !!token,
      requestId
    }, requestId);

    try {
      // Handle malformed tokens
      if (!token || typeof token !== 'string') {
        this.logOperation('VERIFY_TOKEN_INVALID_INPUT', {
          error: 'Token must be non-empty string',
          tokenType: typeof token
        }, requestId);
        throw new Error('Invalid token format');
      }

      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'idxgpt-auth-system',
        audience: 'idxgpt-client'
      });

      this.logOperation('VERIFY_TOKEN_SUCCESS', {
        userId: decoded.id,
        email: decoded.email,
        role: decoded.role,
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      }, requestId);

      return decoded;
    } catch (error) {
      this.logOperation('VERIFY_TOKEN_ERROR', {
        error: error.message,
        errorType: error.name,
        tokenLength: token ? token.length : 0
      }, requestId);

      // Provide specific error messages based on JWT error types
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token format');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not active yet');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  // Authenticate user using real PostgreSQL database
  async authenticateUser(email, password = null, requestId = null) {
    this.logOperation('AUTHENTICATE_USER_START', {
      email,
      hasPassword: !!password,
      passwordLength: password ? password.length : 0,
      requestId
    }, requestId);

    const pool = getFreshPool();

    try {
      // Find user by email in real PostgreSQL database
      const { rows } = await pool.query(
        'SELECT id, email, password, role FROM users WHERE email = $1',
        [email.toLowerCase().trim()]
      );

      const user = rows[0];

      this.logOperation('AUTHENTICATE_USER_DB_RESULT', {
        hasUser: !!user,
        email,
        requestId
      }, requestId);

      if (!user) {
        this.logOperation('AUTHENTICATE_USER_FAILED', {
          email,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          requestId
        }, requestId);

        await pool.end();
        return {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          user: null,
          token: null,
          timestamp: new Date().toISOString()
        };
      }

      // Verify password
      if (password) {
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          this.logOperation('AUTHENTICATE_USER_FAILED', {
            email,
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS',
            requestId
          }, requestId);

          await pool.end();
          return {
            success: false,
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS',
            user: null,
            token: null,
            timestamp: new Date().toISOString()
          };
        }
      }

      this.logOperation('AUTHENTICATE_USER_SUCCESS', {
        userId: user.id,
        email: user.email,
        role: user.role,
        requestId
      }, requestId);

      // Generate JWT token
      const token = this.generateToken(user, requestId);

      await pool.end();
      return {
        success: true,
        error: null,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.email.split('@')[0]
        },
        token,
        expiresIn: this.jwtExpiresIn,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logOperation('AUTHENTICATE_USER_ERROR', {
        error: error.message,
        stack: error.stack,
        email,
        requestId
      }, requestId);

      await pool.end();
      return {
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_ERROR',
        user: null,
        token: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get user from token with enhanced logging
  async getUserFromToken(token, requestId = null) {
    this.logOperation('GET_USER_FROM_TOKEN_START', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      requestId
    }, requestId);

    const pool = getFreshPool();

    try {
      const decoded = this.verifyToken(token, requestId);
      
      // Get user from real database
      const { rows } = await pool.query(
        'SELECT id, email, role FROM users WHERE id = $1',
        [decoded.id]
      );

      const user = rows[0];

      if (!user) {
        this.logOperation('GET_USER_FROM_TOKEN_USER_NOT_FOUND', {
          decodedId: decoded.id,
          decodedEmail: decoded.email
        }, requestId);
        await pool.end();
        throw new Error('User not found');
      }

      this.logOperation('GET_USER_FROM_TOKEN_SUCCESS', {
        userId: user.id,
        email: user.email,
        role: user.role,
        requestId
      }, requestId);

      await pool.end();
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.email.split('@')[0]
      };
    } catch (error) {
      this.logOperation('GET_USER_FROM_TOKEN_ERROR', {
        error: error.message,
        requestId
      }, requestId);
      await pool.end();
      throw new Error('Invalid token');
    }
  }

  // Check if passwordless mode is enabled
  isPasswordlessMode() {
    const env = (process.env.NODE_ENV || 'development').trim();
    const isDev = env === 'development';

    this.logOperation('CHECK_PASSWORDLESS_MODE', {
      rawEnv: process.env.NODE_ENV,
      trimmedEnv: env,
      isDevelopment: isDev
    });

    return isDev;
  }

  // Get authentication requirements based on environment
  getAuthRequirements() {
    const env = (process.env.NODE_ENV || 'development').trim();
    const passwordless = this.isPasswordlessMode();

    this.logOperation('GET_AUTH_REQUIREMENTS', {
      environment: env,
      passwordless,
      jwtExpiresIn: this.jwtExpiresIn
    });

    return {
      passwordless,
      requiresPassword: env === 'production',
      jwtExpiresIn: this.jwtExpiresIn,
      environment: env
    };
  }

  // Get operation log for debugging
  getOperationLog(limit = 50) {
    return this.operationLog.slice(-limit);
  }

  // Clear operation log
  clearOperationLog() {
    this.operationLog = [];
  }

  // Register new user using real PostgreSQL database
  async register(userData, requestId = null) {
    this.logOperation('REGISTER_START', {
      email: userData.email,
      hasPassword: !!userData.password,
      requestId
    }, requestId);

    const pool = getFreshPool();

    try {
      // Check if user already exists
      const { rows: existingUsers } = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [userData.email.toLowerCase().trim()]
      );

      if (existingUsers.length > 0) {
        this.logOperation('REGISTER_USER_EXISTS', { email: userData.email }, requestId);
        await pool.end();
        throw new Error('User already exists');
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Create new user
      const { rows } = await pool.query(
        `INSERT INTO users (email, password, role, subscription_expiry, api_usage, api_limit, ai_quota) 
         VALUES ($1, $2, $3, NOW() + INTERVAL '1 month', 0, 100, 10) 
         RETURNING id, email, role`,
        [userData.email.toLowerCase().trim(), hashedPassword, 'user']
      );

      const newUser = rows[0];

      this.logOperation('REGISTER_SUCCESS', {
        userId: newUser.id,
        email: newUser.email,
        requestId
      }, requestId);

      await pool.end();
      return {
        id: newUser.id,
        email: newUser.email,
        name: userData.name || userData.email.split('@')[0],
        role: newUser.role
      };
    } catch (error) {
      this.logOperation('REGISTER_ERROR', {
        error: error.message,
        stack: error.stack,
        email: userData.email,
        requestId
      }, requestId);
      
      await pool.end();
      
      // Handle specific errors
      if (error.message.includes('pool.query is not a function')) {
        this.logOperation('DATABASE_POOL_ERROR', {
          error: 'Database pool not initialized correctly',
          requestId
        }, requestId);
        throw new Error('Database connection error');
      }
      
      throw error;
    }
  }

  // Login user
  async login(email, password, requestId = null) {
    this.logOperation('LOGIN_START', {
      email,
      hasPassword: !!password,
      requestId
    }, requestId);

    try {
      const authResult = await this.authenticateUser(email, password, requestId);

      if (!authResult.success) {
        this.logOperation('LOGIN_FAILED', {
          email,
          error: authResult.error,
          requestId
        }, requestId);
        throw new Error(authResult.error);
      }

      this.logOperation('LOGIN_SUCCESS', {
        userId: authResult.user.id,
        email: authResult.user.email,
        requestId
      }, requestId);

      // Return token directly at root level for frontend compatibility
      return {
        token: authResult.token,
        user: authResult.user,
        expiresIn: authResult.expiresIn
      };
    } catch (error) {
      this.logOperation('LOGIN_ERROR', {
        error: error.message,
        email,
        requestId
      }, requestId);
      throw error;
    }
  }

  // Get current user info
  async getCurrentUser(userId, requestId = null) {
    this.logOperation('GET_CURRENT_USER_START', {
      userId,
      requestId
    }, requestId);

    const pool = getFreshPool();

    try {
      const { rows } = await pool.query(
        'SELECT id, email, role FROM users WHERE id = $1',
        [userId]
      );

      const user = rows[0];

      if (!user) {
        this.logOperation('GET_CURRENT_USER_NOT_FOUND', { userId }, requestId);
        await pool.end();
        throw new Error('User not found');
      }

      this.logOperation('GET_CURRENT_USER_SUCCESS', {
        userId: user.id,
        email: user.email,
        requestId
      }, requestId);

      await pool.end();
      return {
        id: user.id,
        email: user.email,
        name: user.email.split('@')[0],
        role: user.role,
        phone: user.phone || ''
      };
    } catch (error) {
      this.logOperation('GET_CURRENT_USER_ERROR', {
        error: error.message,
        userId,
        requestId
      }, requestId);
      await pool.end();
      throw error;
    }
  }

  // Check if token is blacklisted
  isTokenBlacklisted(token, requestId = null) {
    this.logOperation('CHECK_TOKEN_BLACKLISTED_START', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      requestId
    }, requestId);

    try {
      // In development mode, always return false (no blacklisting)
      if (process.env.NODE_ENV === 'development') {
        this.logOperation('CHECK_TOKEN_BLACKLISTED_DEV_MODE', {
          result: false,
          mode: 'development',
          requestId
        }, requestId);
        return false;
      }

      // Check in-memory cache for blacklisted tokens
      const blacklistKey = `blacklist:${token}`;
      const isBlacklisted = inMemoryCache.get(blacklistKey) === 'revoked';

      this.logOperation('CHECK_TOKEN_BLACKLISTED_RESULT', {
        isBlacklisted,
        requestId
      }, requestId);

      return isBlacklisted;
    } catch (error) {
      this.logOperation('CHECK_TOKEN_BLACKLISTED_ERROR', {
        error: error.message,
        requestId
      }, requestId);
      return false;
    }
  }

  // Refresh token
  async refreshToken(refreshToken, requestId = null) {
    this.logOperation('REFRESH_TOKEN_START', {
      hasToken: !!refreshToken,
      tokenLength: refreshToken ? refreshToken.length : 0,
      requestId
    }, requestId);

    const pool = getFreshPool();

    try {
      // Verify the refresh token
      const decoded = this.verifyToken(refreshToken, requestId);

      // Get user from real database
      const { rows } = await pool.query(
        'SELECT id, email, role FROM users WHERE id = $1',
        [decoded.id]
      );

      const user = rows[0];
      if (!user) {
        await pool.end();
        throw new Error('User not found');
      }

      // Generate new access token
      const newToken = this.generateToken(user, requestId);

      this.logOperation('REFRESH_TOKEN_SUCCESS', {
        userId: user.id,
        email: user.email,
        requestId
      }, requestId);

      await pool.end();
      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.email.split('@')[0]
        },
        token: newToken,
        expiresIn: this.jwtExpiresIn
      };
    } catch (error) {
      this.logOperation('REFRESH_TOKEN_ERROR', {
        error: error.message,
        requestId
      }, requestId);
      await pool.end();
      throw error;
    }
  }

  // Revoke token
  async revokeToken(refreshToken, requestId = null) {
    this.logOperation('REVOKE_TOKEN_START', {
      hasToken: !!refreshToken,
      tokenLength: refreshToken ? refreshToken.length : 0,
      requestId
    }, requestId);

    try {
      // Verify token before blacklisting
      const decoded = this.verifyToken(refreshToken, requestId);

      // Add to blacklist
      const blacklistKey = `blacklist:${refreshToken}`;
      inMemoryCache.set(blacklistKey, 'revoked', 24 * 60 * 60); // 24 hours

      this.logOperation('REVOKE_TOKEN_SUCCESS', {
        userId: decoded.id,
        email: decoded.email,
        requestId
      }, requestId);

      return { success: true };
    } catch (error) {
      this.logOperation('REVOKE_TOKEN_ERROR', {
        error: error.message,
        requestId
      }, requestId);
      throw error;
    }
  }
}

module.exports = new AuthService();
