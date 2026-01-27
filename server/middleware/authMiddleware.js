const authService = require('../services/authService');

// Enhanced logging utility for auth middleware
const logAuth = (operation, details, requestId = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${requestId || 'AUTH_MIDDLEWARE'}] ${operation}:`, details);
};

// Enhanced middleware to verify JWT token with comprehensive logging and edge cases
const authenticateToken = (req, res, next) => {
  const requestId = req.requestId;
  logAuth('AUTHENTICATE_TOKEN_START', {
    method: req.method,
    path: req.path,
    hasAuthHeader: !!req.headers.authorization,
    requestId
  }, requestId);

  try {
    const authHeader = req.headers.authorization;

    // Edge case: Missing authorization header
    if (!authHeader) {
      logAuth('AUTHENTICATE_TOKEN_MISSING_HEADER', { requestId }, requestId);
      return res.status(401).json({
        success: false,
        error: 'Authorization header is required',
        code: 'TOKEN_MISSING',
        timestamp: new Date().toISOString()
      });
    }

    // Edge case: Malformed authorization header
    if (typeof authHeader !== 'string') {
      logAuth('AUTHENTICATE_TOKEN_INVALID_HEADER_TYPE', {
        headerType: typeof authHeader,
        requestId
      }, requestId);
      return res.status(401).json({
        success: false,
        error: 'Authorization header must be a string',
        code: 'INVALID_AUTH_HEADER_TYPE',
        timestamp: new Date().toISOString()
      });
    }

    // Edge case: Authorization header doesn't start with Bearer
    if (!authHeader.startsWith('Bearer ')) {
      logAuth('AUTHENTICATE_TOKEN_INVALID_FORMAT', {
        authHeader: authHeader.substring(0, 20) + '...',
        requestId
      }, requestId);
      return res.status(401).json({
        success: false,
        error: 'Authorization header must be in Bearer token format',
        code: 'INVALID_AUTH_FORMAT',
        timestamp: new Date().toISOString()
      });
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN

    // Edge case: Missing token after Bearer
    if (!token || token.trim() === '') {
      logAuth('AUTHENTICATE_TOKEN_MISSING_TOKEN', { requestId }, requestId);
      return res.status(401).json({
        success: false,
        error: 'Token is required after Bearer',
        code: 'TOKEN_MISSING',
        timestamp: new Date().toISOString()
      });
    }

    // Edge case: Token too short or too long
    if (token.length < 10) {
      logAuth('AUTHENTICATE_TOKEN_TOO_SHORT', {
        tokenLength: token.length,
        requestId
      }, requestId);
      return res.status(401).json({
        success: false,
        error: 'Token appears to be malformed (too short)',
        code: 'TOKEN_MALFORMED',
        timestamp: new Date().toISOString()
      });
    }

    if (token.length > 1000) {
      logAuth('AUTHENTICATE_TOKEN_TOO_LONG', {
        tokenLength: token.length,
        requestId
      }, requestId);
      return res.status(401).json({
        success: false,
        error: 'Token appears to be malformed (too long)',
        code: 'TOKEN_MALFORMED',
        timestamp: new Date().toISOString()
      });
    }

    // Edge case: Simulate token verification delay (2% chance)
    if (Math.random() < 0.02) {
      logAuth('AUTHENTICATE_TOKEN_DELAY_SIMULATION', { delay: '200ms', requestId }, requestId);
    }

    // Verify token and get user data
    const user = authService.getUserFromToken(token, requestId);

    logAuth('AUTHENTICATE_TOKEN_SUCCESS', {
      userId: user.id,
      email: user.email,
      role: user.role,
      requestId
    }, requestId);

    // Add user to request object
    req.user = user;
    next();

  } catch (error) {
    logAuth('AUTHENTICATE_TOKEN_ERROR', {
      error: error.message,
      errorType: error.constructor.name,
      requestId
    }, requestId);

    // Provide specific error responses based on error types
    if (error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED',
        timestamp: new Date().toISOString()
      });
    } else if (error.message.includes('malformed') || error.message.includes('invalid')) {
      return res.status(401).json({
        success: false,
        error: 'Token is malformed or invalid',
        code: 'TOKEN_INVALID',
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Token verification failed',
        code: 'TOKEN_VERIFICATION_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  }
};

// Enhanced middleware to check if user has required role with logging
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const requestId = req.requestId;

    logAuth('REQUIRE_ROLE_CHECK', {
      userRole: req.user?.role,
      allowedRoles,
      requestId
    }, requestId);

    if (!req.user) {
      logAuth('REQUIRE_ROLE_NO_USER', { requestId }, requestId);
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logAuth('REQUIRE_ROLE_INSUFFICIENT_PERMISSIONS', {
        userRole: req.user.role,
        allowedRoles,
        requestId
      }, requestId);

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.role,
        timestamp: new Date().toISOString()
      });
    }

    logAuth('REQUIRE_ROLE_SUCCESS', {
      userRole: req.user.role,
      requestId
    }, requestId);

    next();
  };
};

// Middleware to check if user is admin
const requireAdmin = requireRole(['admin']);

// Middleware to check if user is admin or user
const requireUserOrAdmin = requireRole(['user', 'admin']);

// Enhanced optional authentication middleware with logging
const optionalAuth = (req, res, next) => {
  const requestId = req.requestId;
  logAuth('OPTIONAL_AUTH_START', {
    hasAuthHeader: !!req.headers.authorization,
    requestId
  }, requestId);

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      logAuth('OPTIONAL_AUTH_TOKEN_FOUND', {
        tokenLength: token.length,
        requestId
      }, requestId);

      const user = authService.getUserFromToken(token, requestId);
      req.user = user;

      logAuth('OPTIONAL_AUTH_SUCCESS', {
        userId: user.id,
        email: user.email,
        role: user.role,
        requestId
      }, requestId);
    } else {
      logAuth('OPTIONAL_AUTH_NO_TOKEN', { requestId }, requestId);
    }

    next();
  } catch (error) {
    logAuth('OPTIONAL_AUTH_ERROR', {
      error: error.message,
      requestId
    }, requestId);
    // Ignore token errors for optional auth - still proceed
    next();
  }
};

// Enhanced middleware to add request ID for logging
const addRequestId = (req, res, next) => {
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logAuth('REQUEST_ID_GENERATED', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  }, req.requestId);

  next();
};

// Enhanced logging middleware for authenticated requests
const logAuthenticatedRequest = (req, res, next) => {
  if (req.user) {
    logAuth('AUTHENTICATED_REQUEST', {
      method: req.method,
      path: req.path,
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
      requestId: req.requestId
    }, req.requestId);
  } else {
    logAuth('UNAUTHENTICATED_REQUEST', {
      method: req.method,
      path: req.path,
      requestId: req.requestId
    }, req.requestId);
  }
  next();
};

// Middleware to log request details for debugging
const logRequestDetails = (req, res, next) => {
  const requestId = req.requestId;
  logAuth('REQUEST_DETAILS', {
    method: req.method,
    path: req.path,
    query: req.query,
    bodySize: req.body ? JSON.stringify(req.body).length : 0,
    headers: {
      contentType: req.get('Content-Type'),
      userAgent: req.get('User-Agent'),
      authorization: req.headers.authorization ? '[PRESENT]' : '[MISSING]'
    },
    requestId
  }, requestId);

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireUserOrAdmin,
  optionalAuth,
  addRequestId,
  logAuthenticatedRequest,
  logRequestDetails
};