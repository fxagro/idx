const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { loginValidation, tokenValidation } = require('../middleware/loginValidation');
const { addRequestId, logAuthenticatedRequest, logRequestDetails } = require('../middleware/authMiddleware');

// Apply middleware to all routes
router.use(addRequestId);
router.use(logRequestDetails);

/**
 * POST /api/auth/login
 * Authenticate user with email only (development) or email+password (production)
 * Enhanced with comprehensive logging and edge case handling
 */
router.post('/login', loginValidation, async (req, res) => {
  const requestId = req.requestId;
  const { email, password } = req.validatedData;

  console.log(`[${new Date().toISOString()}] [${requestId}] LOGIN_ATTEMPT: email=${email}, hasPassword=${!!password}`);

  try {
    // Edge case: Simulate random login failures (1% chance)
    if (Math.random() < 0.01) {
      console.log(`[${new Date().toISOString()}] [${requestId}] LOGIN_SIMULATED_FAILURE: Random failure simulation`);
      return res.status(500).json({
        success: false,
        error: 'Login service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    // Authenticate user using auth service
    const authResult = await authService.authenticateUser(email, password, requestId);

    if (!authResult.success) {
      console.log(`[${new Date().toISOString()}] [${requestId}] LOGIN_FAILED: ${authResult.error}, code=${authResult.code}`);

      // Provide specific error responses based on error codes
      let statusCode = 400;
      if (authResult.code === 'SERVICE_OVERLOAD') {
        statusCode = 503;
      }

      return res.status(statusCode).json({
        success: false,
        error: authResult.error,
        code: authResult.code || 'AUTH_FAILED',
        timestamp: authResult.timestamp || new Date().toISOString()
      });
    }

    const { user, token, expiresIn } = authResult;

    console.log(`[${new Date().toISOString()}] [${requestId}] LOGIN_SUCCESS: userId=${user.id}, email=${user.email}, role=${user.role}`);

    // Return success response with user data and token
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name
        },
        token,
        expiresIn: expiresIn || '24h',
        authMode: process.env.NODE_ENV === 'development' ? 'passwordless' : 'password',
        authenticatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [${requestId}] LOGIN_ERROR:`, {
      error: error.message,
      stack: error.stack,
      email
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during login',
      code: 'SERVER_ERROR',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          errorMessage: error.message,
          stack: error.stack
        }
      })
    });
  }
});

/**
 * GET /api/auth/requirements
 * Get authentication requirements based on current environment
 * Enhanced with detailed logging and mode override support
 */
router.get('/requirements', (req, res) => {
  const requestId = req.requestId;
  const overrideMode = req.query.mode; // Allow ?mode=passwordless or ?mode=production

  console.log(`[${new Date().toISOString()}] [${requestId}] GET_AUTH_REQUIREMENTS: overrideMode=${overrideMode}`);

  try {
    let requirements;

    // Allow manual mode override for testing
    if (overrideMode && (overrideMode === 'passwordless' || overrideMode === 'production')) {
      console.log(`[${new Date().toISOString()}] [${requestId}] AUTH_REQUIREMENTS_OVERRIDE: ${overrideMode}`);
      requirements = {
        passwordless: overrideMode === 'passwordless',
        requiresPassword: overrideMode === 'production',
        jwtExpiresIn: '24h',
        environment: overrideMode,
        modeOverride: true
      };
    } else {
      requirements = authService.getAuthRequirements();
    }

    console.log(`[${new Date().toISOString()}] [${requestId}] AUTH_REQUIREMENTS_RESPONSE:`, requirements);

    res.status(200).json({
      success: true,
      data: {
        environment: process.env.NODE_ENV || 'development',
        ...requirements,
        availableModes: ['passwordless', 'production'],
        canOverride: true,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [${requestId}] AUTH_REQUIREMENTS_ERROR:`, error);

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve authentication requirements',
      code: 'SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/auth/requirements
 * Set authentication requirements mode (for testing)
 * Enhanced with validation and logging
 */
router.post('/requirements', (req, res) => {
  const requestId = req.requestId;
  const { mode } = req.body;

  console.log(`[${new Date().toISOString()}] [${requestId}] SET_AUTH_REQUIREMENTS: mode=${mode}`);

  try {
    // Validate mode
    if (!mode || !['passwordless', 'production'].includes(mode)) {
      console.log(`[${new Date().toISOString()}] [${requestId}] SET_AUTH_REQUIREMENTS_INVALID_MODE: ${mode}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Must be "passwordless" or "production"',
        code: 'INVALID_MODE',
        timestamp: new Date().toISOString()
      });
    }

    const requirements = {
      passwordless: mode === 'passwordless',
      requiresPassword: mode === 'production',
      jwtExpiresIn: '24h',
      environment: mode,
      modeOverride: true,
      setAt: new Date().toISOString()
    };

    console.log(`[${new Date().toISOString()}] [${requestId}] AUTH_REQUIREMENTS_SET_SUCCESS:`, requirements);

    res.status(200).json({
      success: true,
      message: `Authentication mode set to ${mode}`,
      data: {
        environment: process.env.NODE_ENV || 'development',
        ...requirements,
        availableModes: ['passwordless', 'production'],
        canOverride: true,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [${requestId}] SET_AUTH_REQUIREMENTS_ERROR:`, error);

    res.status(500).json({
      success: false,
      error: 'Failed to set authentication requirements',
      code: 'SERVER_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/auth/validate-token
 * Validate if a token is still valid (optional endpoint)
 * Enhanced with comprehensive logging and edge case handling
 */
router.post('/validate-token', tokenValidation, (req, res) => {
  const requestId = req.requestId;
  const { token } = req.body;

  console.log(`[${new Date().toISOString()}] [${requestId}] TOKEN_VALIDATION_ATTEMPT: tokenLength=${token.length}`);

  try {
    // Edge case: Simulate token validation service issues (1% chance)
    if (Math.random() < 0.01) {
      console.log(`[${new Date().toISOString()}] [${requestId}] TOKEN_VALIDATION_SIMULATED_ERROR`);
      return res.status(500).json({
        success: false,
        error: 'Token validation service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    const user = authService.getUserFromToken(token, requestId);

    console.log(`[${new Date().toISOString()}] [${requestId}] TOKEN_VALIDATION_SUCCESS: userId=${user.id}, email=${user.email}`);

    res.status(200).json({
      success: true,
      data: {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name
        },
        validatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.log(`[${new Date().toISOString()}] [${requestId}] TOKEN_VALIDATION_FAILED: ${error.message}`);

    // Provide specific error responses based on error types
    let statusCode = 401;
    let errorCode = 'TOKEN_INVALID';

    if (error.message.includes('expired')) {
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.message.includes('malformed')) {
      errorCode = 'TOKEN_MALFORMED';
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      error: error.message,
      code: errorCode,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout endpoint (for completeness)
 */
router.post('/logout', (req, res) => {
  const requestId = req.requestId;

  console.log(`[${new Date().toISOString()}] [${requestId}] LOGOUT_ATTEMPT`);

  // In a real application, you would invalidate the token
  // For this demo, we'll just return success
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
    data: {
      loggedOut: true,
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;