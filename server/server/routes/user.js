// server/routes/user.js
const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const Session = require('../models/Session');
const logger = require('../utils/logger').console;
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Success response helper
const createSuccessResponse = (data, message = 'Success') => {
  return {
    success: true,
    message: message,
    data: data
  };
};

// Error response helper
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

// GET /api/user/profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    logger.info('Fetching user profile:', { userId: req.user.id });

    const { rows } = await pool.query(
      'SELECT id, email, name, avatar, auth_method, role, subscription_expiry, api_usage, api_limit, ai_quota, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    const user = rows[0];
    const profileData = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      authMethod: user.auth_method || 'password',
      role: user.role,
      joinedAt: user.created_at,
      subscriptionExpiry: user.subscription_expiry,
      apiUsage: user.api_usage,
      apiLimit: user.api_limit,
      aiQuota: user.ai_quota
    };

    logger.info('User profile fetched successfully:', { 
      userId: req.user.id, 
      email: user.email 
    });

    res.json(createSuccessResponse(profileData, 'Profile retrieved successfully'));
  } catch (error) {
    logger.error('Error fetching user profile:', { 
      userId: req.user.id, 
      error: error.message 
    });
    res.status(500).json(createErrorResponse('Failed to fetch profile', 500));
  }
});

// PATCH /api/user/profile
router.patch('/profile', authMiddleware, async (req, res) => {
  try {
    logger.info('Updating user profile:', { userId: req.user.id });

    // Validate request body
    const schema = Joi.object({
      name: Joi.string().max(100).optional(),
      avatar: Joi.string().uri().allow(null, '').optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      logger.warn('Profile update validation failed:', { 
        userId: req.user.id, 
        error: error.details[0].message 
      });
      return res.status(400).json(createErrorResponse(
        `Validation error: ${error.details[0].message}`,
        400
      ));
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (value.name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(value.name.trim() || null);
      paramCount++;
    }

    if (value.avatar !== undefined) {
      updates.push(`avatar = $${paramCount}`);
      values.push(value.avatar || null);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update', 400));
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.user.id);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount} 
      RETURNING id, email, name, avatar, auth_method, role, subscription_expiry, api_usage, api_limit, ai_quota, created_at
    `;

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    const user = rows[0];
    const profileData = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      authMethod: user.auth_method || 'password',
      role: user.role,
      joinedAt: user.created_at,
      subscriptionExpiry: user.subscription_expiry,
      apiUsage: user.api_usage,
      apiLimit: user.api_limit,
      aiQuota: user.ai_quota
    };

    logger.info('User profile updated successfully:', { 
      userId: req.user.id, 
      email: user.email 
    });

    res.json(createSuccessResponse(profileData, 'Profile updated successfully'));
  } catch (error) {
    logger.error('Error updating user profile:', { 
      userId: req.user.id, 
      error: error.message 
    });
    res.status(500).json(createErrorResponse('Failed to update profile', 500));
  }
});

// POST /api/user/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    logger.info('Change password request:', { userId: req.user.id });

    // Validate request body
    const schema = Joi.object({
      currentPassword: Joi.string().min(6).required(),
      newPassword: Joi.string().min(6).required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      logger.warn('Password change validation failed:', { 
        userId: req.user.id, 
        error: error.details[0].message 
      });
      return res.status(400).json(createErrorResponse(
        `Validation error: ${error.details[0].message}`,
        400
      ));
    }

    // Check if user has a password (not passwordless)
    const { rows: userRows } = await pool.query(
      'SELECT password, auth_method FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userRows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    const user = userRows[0];
    if (user.auth_method === 'passwordless' || !user.password) {
      logger.warn('Password change attempted on passwordless account:', { 
        userId: req.user.id 
      });
      return res.status(400).json(createErrorResponse(
        'Password change not available for passwordless accounts',
        400
      ));
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(value.currentPassword, user.password);
    if (!isValidPassword) {
      logger.warn('Invalid current password during password change:', { 
        userId: req.user.id 
      });
      return res.status(400).json(createErrorResponse(
        'Current password is incorrect',
        400
      ));
    }

    // Hash new password
    const SALT_ROUNDS = 10;
    const hashedNewPassword = await bcrypt.hash(value.newPassword, SALT_ROUNDS);

    // Update password
    const { rows: updatedRows } = await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [hashedNewPassword, req.user.id]
    );

    if (updatedRows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', 404));
    }

    // Revoke all other sessions for security
    const revokedCount = await Session.revokeAllOtherSessions(req.user.id, req.sessionInfo?.jti);

    logger.info('Password changed successfully:', { 
      userId: req.user.id,
      revokedSessions: revokedCount 
    });

    res.json(createSuccessResponse(
      { 
        revokedSessions: revokedCount,
        requiresReauth: true 
      }, 
      'Password changed successfully. Other sessions have been revoked.'
    ));
  } catch (error) {
    logger.error('Error changing password:', { 
      userId: req.user.id, 
      error: error.message 
    });
    res.status(500).json(createErrorResponse('Failed to change password', 500));
  }
});

// GET /api/user/sessions
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    logger.info('Fetching user sessions:', { userId: req.user.id });

    const sessions = await Session.getActiveSessionsByUser(req.user.id);
    
    // Enhance sessions with device info and mark current session
    const enhancedSessions = sessions.map(session => {
      const deviceInfo = Session.parseUserAgent(session.user_agent);
      const isCurrent = session.token_jti === req.sessionInfo?.jti;
      
      return {
        jti: session.token_jti,
        deviceName: `${deviceInfo.browser} on ${deviceInfo.os}`,
        deviceType: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ipAddress: session.ip_address,
        location: session.location || 'Unknown Location',
        userAgent: session.user_agent,
        createdAt: session.created_at,
        lastActive: session.last_active,
        isCurrent,
        expiresAt: session.expires_at
      };
    });

    logger.info('User sessions fetched successfully:', { 
      userId: req.user.id, 
      sessionCount: enhancedSessions.length 
    });

    res.json(createSuccessResponse(enhancedSessions, 'Sessions retrieved successfully'));
  } catch (error) {
    logger.error('Error fetching user sessions:', { 
      userId: req.user.id, 
      error: error.message 
    });
    res.status(500).json(createErrorResponse('Failed to fetch sessions', 500));
  }
});

// DELETE /api/user/sessions/:jti
router.delete('/sessions/:jti', authMiddleware, async (req, res) => {
  try {
    const { jti } = req.params;
    
    logger.info('Revoking user session:', { 
      userId: req.user.id, 
      sessionJti: jti 
    });

    // Check if trying to revoke current session
    if (jti === req.sessionInfo?.jti) {
      logger.warn('Attempt to revoke current session:', { 
        userId: req.user.id, 
        sessionJti: jti 
      });
      return res.status(400).json(createErrorResponse(
        'Cannot revoke the current session',
        400
      ));
    }

    // Verify session belongs to user
    const session = await Session.getSessionByJti(jti);
    if (!session || session.user_id !== req.user.id) {
      logger.warn('Session not found or does not belong to user:', { 
        userId: req.user.id, 
        sessionJti: jti 
      });
      return res.status(404).json(createErrorResponse('Session not found', 404));
    }

    // Revoke the session
    await Session.revokeSession(jti);

    logger.info('Session revoked successfully:', { 
      userId: req.user.id, 
      sessionJti: jti 
    });

    res.json(createSuccessResponse(null, 'Session revoked successfully'));
  } catch (error) {
    logger.error('Error revoking session:', { 
      userId: req.user.id, 
      sessionJti: req.params.jti, 
      error: error.message 
    });
    res.status(500).json(createErrorResponse('Failed to revoke session', 500));
  }
});

// DELETE /api/user/sessions/revoke-others
router.delete('/sessions/revoke-others', authMiddleware, async (req, res) => {
  try {
    logger.info('Revoking all other sessions:', { userId: req.user.id });

    const revokedCount = await Session.revokeAllOtherSessions(
      req.user.id, 
      req.sessionInfo?.jti
    );

    logger.info('Other sessions revoked successfully:', { 
      userId: req.user.id, 
      revokedCount 
    });

    res.json(createSuccessResponse(
      { revokedCount },
      `${revokedCount} other session(s) revoked successfully`
    ));
  } catch (error) {
    logger.error('Error revoking other sessions:', { 
      userId: req.user.id, 
      error: error.message 
    });
    res.status(500).json(createErrorResponse('Failed to revoke other sessions', 500));
  }
});

module.exports = router;