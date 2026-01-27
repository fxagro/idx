const jwt = require('jsonwebtoken');
const mockDatabase = require('../mockDatabase');

const JWT_SECRET = 'your-super-secret-jwt-key-minimum-32-characters';
const JWT_EXPIRES_IN = '24h';

class AuthService {
  constructor() {
    this.jwtSecret = JWT_SECRET;
    this.jwtExpiresIn = JWT_EXPIRES_IN;
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
      // Edge case: Simulate token generation failure (1% chance)
      if (Math.random() < 0.01) {
        this.logOperation('GENERATE_TOKEN_ERROR', { error: 'JWT signing failed' }, requestId);
        throw new Error('Token generation failed');
      }

      const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
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
      // Edge case: Handle malformed tokens
      if (!token || typeof token !== 'string') {
        this.logOperation('VERIFY_TOKEN_INVALID_INPUT', {
          error: 'Token must be non-empty string',
          tokenType: typeof token
        }, requestId);
        throw new Error('Invalid token format');
      }

      // Edge case: Simulate token verification delay (2% chance)
      if (Math.random() < 0.02) {
        this.logOperation('VERIFY_TOKEN_DELAY_SIMULATION', { delay: '200ms' }, requestId);
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

  // Authenticate user with comprehensive logging and edge case handling (NO AUTO-CREATE)
  async authenticateUser(email, password = null, requestId = null) {
    this.logOperation('AUTHENTICATE_USER_START', {
      email,
      hasPassword: !!password,
      passwordLength: password ? password.length : 0,
      requestId
    }, requestId);

    try {
      // Edge case: Simulate authentication service overload (1% chance)
      if (Math.random() < 0.01) {
        this.logOperation('AUTHENTICATE_USER_SERVICE_OVERLOAD', { error: 'Authentication service temporarily unavailable' }, requestId);
        return {
          success: false,
          error: 'Authentication service temporarily unavailable',
          code: 'SERVICE_OVERLOAD',
          user: null,
          token: null,
          timestamp: new Date().toISOString()
        };
      }

      // Validate credentials using mock database (will reject non-existing users)
      const validation = mockDatabase.validateUserCredentials(email, password, requestId);

      this.logOperation('AUTHENTICATE_USER_DB_RESULT', {
        valid: validation.valid,
        error: validation.error,
        hasUser: !!validation.user,
        requestId
      }, requestId);

      if (!validation.valid) {
        this.logOperation('AUTHENTICATE_USER_FAILED', {
          email,
          error: validation.error,
          code: validation.error === 'User not found' ? 'USER_NOT_FOUND' : 'AUTH_FAILED',
          requestId
        }, requestId);

        // Provide specific error codes for different failure types
        let errorCode = 'AUTH_FAILED';
        if (validation.error === 'User not found') {
          errorCode = 'USER_NOT_FOUND';
        } else if (validation.error === 'Password required') {
          errorCode = 'PASSWORD_REQUIRED';
        } else if (validation.error === 'Invalid credentials') {
          errorCode = 'INVALID_CREDENTIALS';
        }

        return {
          success: false,
          error: validation.error,
          code: errorCode,
          user: null,
          token: null,
          timestamp: new Date().toISOString()
        };
      }

      const user = validation.user;
      this.logOperation('AUTHENTICATE_USER_SUCCESS', {
        userId: user.id,
        email: user.email,
        role: user.role,
        requestId
      }, requestId);

      // Generate JWT token
      const token = this.generateToken(user, requestId);

      // Log passwordless login in development
      if (process.env.NODE_ENV === 'development') {
        this.logOperation('AUTHENTICATE_USER_PASSWORDLESS_WARNING', {
          email: user.email,
          mode: 'development'
        }, requestId);
      }

      return {
        success: true,
        error: null,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name
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
  getUserFromToken(token, requestId = null) {
    this.logOperation('GET_USER_FROM_TOKEN_START', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      requestId
    }, requestId);

    try {
      const decoded = this.verifyToken(token, requestId);
      const user = mockDatabase.findUserById(decoded.id, requestId);

      if (!user) {
        this.logOperation('GET_USER_FROM_TOKEN_USER_NOT_FOUND', {
          decodedId: decoded.id,
          decodedEmail: decoded.email
        }, requestId);
        throw new Error('User not found');
      }

      this.logOperation('GET_USER_FROM_TOKEN_SUCCESS', {
        userId: user.id,
        email: user.email,
        role: user.role,
        requestId
      }, requestId);

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      };
    } catch (error) {
      this.logOperation('GET_USER_FROM_TOKEN_ERROR', {
        error: error.message,
        requestId
      }, requestId);
      throw new Error('Invalid token');
    }
  }

  // Check if passwordless mode is enabled with enhanced logging
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

  // Get authentication requirements based on environment with logging
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

  // Register new user (mock implementation)
  async register(userData, requestId = null) {
    this.logOperation('REGISTER_START', {
      email: userData.email,
      hasPassword: !!userData.password,
      requestId
    }, requestId);

    try {
      // Check if user already exists
      const existingUser = mockDatabase.findUserByEmail(userData.email, requestId);
      if (existingUser) {
        this.logOperation('REGISTER_USER_EXISTS', { email: userData.email }, requestId);
        throw new Error('User already exists');
      }

      // Create new user
      const newUser = mockDatabase.createUser({
        email: userData.email,
        password: userData.password,
        name: userData.name,
        phone: userData.phone
      }, requestId);

      this.logOperation('REGISTER_SUCCESS', {
        userId: newUser.id,
        email: newUser.email,
        requestId
      }, requestId);

      return {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      };
    } catch (error) {
      this.logOperation('REGISTER_ERROR', {
        error: error.message,
        email: userData.email,
        requestId
      }, requestId);
      throw error;
    }
  }

  // Login user (mock implementation)
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

      return {
        user: authResult.user,
        token: authResult.token,
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

    try {
      const user = mockDatabase.findUserById(userId, requestId);

      if (!user) {
        this.logOperation('GET_CURRENT_USER_NOT_FOUND', { userId }, requestId);
        throw new Error('User not found');
      }

      this.logOperation('GET_CURRENT_USER_SUCCESS', {
        userId: user.id,
        email: user.email,
        requestId
      }, requestId);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone
      };
    } catch (error) {
      this.logOperation('GET_CURRENT_USER_ERROR', {
        error: error.message,
        userId,
        requestId
      }, requestId);
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

    try {
      // Verify the refresh token
      const decoded = this.verifyToken(refreshToken, requestId);

      // Get user from token
      const user = mockDatabase.findUserById(decoded.id, requestId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new access token
      const newToken = this.generateToken(user, requestId);

      this.logOperation('REFRESH_TOKEN_SUCCESS', {
        userId: user.id,
        email: user.email,
        requestId
      }, requestId);

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name
        },
        token: newToken,
        expiresIn: this.jwtExpiresIn
      };
    } catch (error) {
      this.logOperation('REFRESH_TOKEN_ERROR', {
        error: error.message,
        requestId
      }, requestId);
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