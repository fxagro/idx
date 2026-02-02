const express = require('express');
const router = express.Router();
const { authenticateToken, addRequestId, logAuthenticatedRequest, logRequestDetails } = require('../middleware/authMiddleware');

// Apply middleware to all routes
router.use(addRequestId);
router.use(logRequestDetails);
router.use(authenticateToken);
router.use(logAuthenticatedRequest);

/**
 * GET /
 * Get current user information (protected route)
 * Enhanced with comprehensive logging and edge case handling
 */
router.get('/', (req, res) => {
  const requestId = req.requestId;
  const user = req.user;

  console.log(`[${new Date().toISOString()}] [${requestId}] GET_PROFILE_ATTEMPT: userId=${user.id}, email=${user.email}`);

  try {
    // Edge case: Simulate profile service issues (1% chance)
    if (Math.random() < 0.01) {
      console.log(`[${new Date().toISOString()}] [${requestId}] GET_PROFILE_SIMULATED_ERROR`);
      return res.status(500).json({
        success: false,
        error: 'Profile service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[${new Date().toISOString()}] [${requestId}] GET_PROFILE_SUCCESS: userId=${user.id}, email=${user.email}, role=${user.role}`);

    // Return user information
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          authenticatedAt: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
          lastAccess: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [${requestId}] GET_PROFILE_ERROR:`, {
      error: error.message,
      stack: error.stack,
      userId: user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error while accessing profile',
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
 * PUT /
 * Update current user information (protected route)
 * Enhanced with validation and comprehensive logging
 */
router.put('/', async (req, res) => {
  const requestId = req.requestId;
  const user = req.user;

  console.log(`[${new Date().toISOString()}] [${requestId}] UPDATE_PROFILE_ATTEMPT: userId=${user.id}, email=${user.email}`);

  try {
    const updates = req.body;

    // Edge case: Handle missing update data
    if (!updates || Object.keys(updates).length === 0) {
      console.log(`[${new Date().toISOString()}] [${requestId}] UPDATE_PROFILE_NO_DATA`);
      return res.status(400).json({
        success: false,
        error: 'No update data provided',
        code: 'NO_UPDATE_DATA',
        timestamp: new Date().toISOString()
      });
    }

    // Edge case: Simulate update service issues (1% chance)
    if (Math.random() < 0.01) {
      console.log(`[${new Date().toISOString()}] [${requestId}] UPDATE_PROFILE_SIMULATED_ERROR`);
      return res.status(500).json({
        success: false,
        error: 'Profile update service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    // Log what fields are being updated
    const updateFields = Object.keys(updates);
    console.log(`[${new Date().toISOString()}] [${requestId}] UPDATE_PROFILE_FIELDS: ${updateFields.join(', ')}`);

    // In a real application, you would validate and update the user in the database
    // For this demo, we'll just return the current user data with update info
    console.log(`[${new Date().toISOString()}] [${requestId}] UPDATE_PROFILE_SUCCESS: userId=${user.id}`);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully (demo mode)',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          updatedAt: new Date().toISOString(),
          updatedFields: updateFields
        },
        changes: {
          requested: updateFields,
          applied: updateFields, // In demo mode, all requested changes are "applied"
          timestamp: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [${requestId}] UPDATE_PROFILE_ERROR:`, {
      error: error.message,
      stack: error.stack,
      userId: user?.id,
      updateFields: req.body ? Object.keys(req.body) : []
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error while updating profile',
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
 * DELETE /token
 * Invalidate current token (logout)
 * Enhanced with comprehensive logging
 */
router.delete('/token', (req, res) => {
  const requestId = req.requestId;
  const user = req.user;

  console.log(`[${new Date().toISOString()}] [${requestId}] LOGOUT_ATTEMPT: userId=${user.id}, email=${user.email}`);

  try {
    // Edge case: Simulate logout service issues (1% chance)
    if (Math.random() < 0.01) {
      console.log(`[${new Date().toISOString()}] [${requestId}] LOGOUT_SIMULATED_ERROR`);
      return res.status(500).json({
        success: false,
        error: 'Logout service temporarily unavailable',
        code: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[${new Date().toISOString()}] [${requestId}] LOGOUT_SUCCESS: userId=${user.id}, email=${user.email}`);

    // In a real application, you would add the token to a blacklist
    // For this demo, we'll just return success
    res.status(200).json({
      success: true,
      message: 'Token invalidated successfully',
      data: {
        loggedOut: true,
        userId: user.id,
        email: user.email,
        logoutAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] [${requestId}] LOGOUT_ERROR:`, {
      error: error.message,
      stack: error.stack,
      userId: user?.id
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during logout',
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
 * GET /sessions
 * Get user sessions (for completeness)
 */
router.get('/sessions', (req, res) => {
  const requestId = req.requestId;
  const user = req.user;

  console.log(`[${new Date().toISOString()}] [${requestId}] GET_SESSIONS_ATTEMPT: userId=${user.id}`);

  // In a real application, you would retrieve user sessions from database
  // For this demo, we'll return mock session data
  res.status(200).json({
    success: true,
    data: {
      sessions: [
        {
          id: 'session_1',
          userId: user.id,
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          isCurrent: true,
          device: 'Current Browser',
          ip: req.ip
        }
      ],
      totalSessions: 1
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;