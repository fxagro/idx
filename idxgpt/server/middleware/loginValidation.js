const Joi = require('joi');

// Enhanced email validation schema with comprehensive validation
const emailSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .min(5)
    .max(254) // RFC 5321 limit
    .lowercase()
    .trim()
    .pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    .required()
    .messages({
      'string.email': 'Please provide a valid email address format',
      'string.min': 'Email must be at least 5 characters long',
      'string.max': 'Email must not exceed 254 characters',
      'string.pattern.base': 'Email format is invalid',
      'any.required': 'Email is required'
    })
});

// Enhanced password validation schema for production
const passwordSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .min(5)
    .max(254)
    .lowercase()
    .trim()
    .pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    .required()
    .messages({
      'string.email': 'Please provide a valid email address format',
      'string.min': 'Email must be at least 5 characters long',
      'string.max': 'Email must not exceed 254 characters',
      'string.pattern.base': 'Email format is invalid',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .min(6)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'string.max': 'Password must not exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required'
    })
});

// Schema for empty payload validation
const emptyPayloadSchema = Joi.object().max(0).messages({
  'object.max': 'Payload should be empty'
});

// Enhanced logging utility
const logValidation = (operation, details, requestId = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${requestId || 'VALIDATION'}] ${operation}:`, details);
};

// Development mode validation with comprehensive logging and edge cases
const developmentValidation = (req, res, next) => {
  const requestId = req.requestId;
  logValidation('DEVELOPMENT_VALIDATION_START', {
    hasBody: !!req.body,
    bodyType: typeof req.body,
    contentLength: req.body ? JSON.stringify(req.body).length : 0,
    requestId
  }, requestId);

  // Edge case: Handle completely missing body
  if (!req.body) {
    logValidation('DEVELOPMENT_VALIDATION_MISSING_BODY', { requestId }, requestId);
    return res.status(400).json({
      success: false,
      error: 'Request body is required',
      code: 'MISSING_BODY',
      timestamp: new Date().toISOString()
    });
  }

  // Edge case: Handle non-object body
  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    logValidation('DEVELOPMENT_VALIDATION_INVALID_BODY_TYPE', {
      bodyType: typeof req.body,
      isArray: Array.isArray(req.body),
      requestId
    }, requestId);
    return res.status(400).json({
      success: false,
      error: 'Request body must be a valid object',
      code: 'INVALID_BODY_TYPE',
      timestamp: new Date().toISOString()
    });
  }

  // Edge case: Simulate validation processing delay (3% chance)
  if (Math.random() < 0.03) {
    logValidation('DEVELOPMENT_VALIDATION_DELAY_SIMULATION', { delay: '300ms', requestId }, requestId);
  }

  const { error, value } = emailSchema.validate(req.body, {
    abortEarly: false, // Return all validation errors
    allowUnknown: false, // Reject unknown properties
    stripUnknown: true // Remove unknown properties
  });

  if (error) {
    logValidation('DEVELOPMENT_VALIDATION_ERROR', {
      errorCount: error.details.length,
      errors: error.details.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        value: err.context.value
      })),
      requestId
    }, requestId);

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.details.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        value: err.context.value
      })),
      timestamp: new Date().toISOString()
    });
  }

  logValidation('DEVELOPMENT_VALIDATION_SUCCESS', {
    validatedEmail: value.email,
    requestId
  }, requestId);

  // Add validated data to request
  req.validatedData = value;
  next();
};

// Production mode validation with enhanced security
const productionValidation = (req, res, next) => {
  const requestId = req.requestId;
  logValidation('PRODUCTION_VALIDATION_START', {
    hasBody: !!req.body,
    bodyType: typeof req.body,
    requestId
  }, requestId);

  // Edge case: Handle completely missing body
  if (!req.body) {
    logValidation('PRODUCTION_VALIDATION_MISSING_BODY', { requestId }, requestId);
    return res.status(400).json({
      success: false,
      error: 'Request body is required',
      code: 'MISSING_BODY',
      timestamp: new Date().toISOString()
    });
  }

  // Edge case: Handle non-object body
  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    logValidation('PRODUCTION_VALIDATION_INVALID_BODY_TYPE', {
      bodyType: typeof req.body,
      isArray: Array.isArray(req.body),
      requestId
    }, requestId);
    return res.status(400).json({
      success: false,
      error: 'Request body must be a valid object',
      code: 'INVALID_BODY_TYPE',
      timestamp: new Date().toISOString()
    });
  }

  const { error, value } = passwordSchema.validate(req.body, {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true
  });

  if (error) {
    logValidation('PRODUCTION_VALIDATION_ERROR', {
      errorCount: error.details.length,
      errors: error.details.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        value: err.context.value
      })),
      requestId
    }, requestId);

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.details.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        value: err.context.value
      })),
      timestamp: new Date().toISOString()
    });
  }

  logValidation('PRODUCTION_VALIDATION_SUCCESS', {
    validatedEmail: value.email,
    hasPassword: !!value.password,
    requestId
  }, requestId);

  req.validatedData = value;
  next();
};

// Enhanced malformed request detection middleware
const malformedRequestHandler = (req, res, next) => {
  const requestId = req.requestId;
  const contentType = req.get('Content-Type');

  logValidation('MALFORMED_REQUEST_CHECK_START', {
    contentType,
    contentLength: req.get('Content-Length'),
    hasBody: !!req.body,
    requestId
  }, requestId);

  // Edge case: Missing Content-Type header
  if (!contentType) {
    logValidation('MALFORMED_REQUEST_MISSING_CONTENT_TYPE', { requestId }, requestId);
    return res.status(400).json({
      success: false,
      error: 'Content-Type header is required',
      code: 'MISSING_CONTENT_TYPE',
      timestamp: new Date().toISOString()
    });
  }

  // Edge case: Invalid Content-Type
  if (!contentType.includes('application/json')) {
    logValidation('MALFORMED_REQUEST_INVALID_CONTENT_TYPE', {
      contentType,
      requestId
    }, requestId);
    return res.status(400).json({
      success: false,
      error: 'Content-Type must be application/json',
      code: 'INVALID_CONTENT_TYPE',
      timestamp: new Date().toISOString()
    });
  }

  // Edge case: Content-Type present but body is not valid JSON
  if (req.body && typeof req.body === 'string') {
    try {
      JSON.parse(req.body);
    } catch (error) {
      logValidation('MALFORMED_REQUEST_INVALID_JSON', {
        error: error.message,
        bodyLength: req.body.length,
        requestId
      }, requestId);
      return res.status(400).json({
        success: false,
        error: 'Request body contains malformed JSON',
        code: 'MALFORMED_JSON',
        timestamp: new Date().toISOString()
      });
    }
  }

  logValidation('MALFORMED_REQUEST_CHECK_SUCCESS', { requestId }, requestId);
  next();
};

// Main validation middleware with enhanced environment detection
const loginValidation = (req, res, next) => {
  const env = (process.env.NODE_ENV || 'development').trim();
  const isDevelopment = env === 'development';

  logValidation('LOGIN_VALIDATION_MODE_SELECTED', {
    environment: env,
    isDevelopment,
    requestId: req.requestId
  }, req.requestId);

  // First check for malformed requests
  malformedRequestHandler(req, res, (err) => {
    if (err) return; // Error already handled

    if (isDevelopment) {
      return developmentValidation(req, res, next);
    } else {
      return productionValidation(req, res, next);
    }
  });
};

// Enhanced token validation with comprehensive logging
const tokenValidation = (req, res, next) => {
  const requestId = req.requestId;
  const authHeader = req.headers.authorization;

  logValidation('TOKEN_VALIDATION_START', {
    hasAuthHeader: !!authHeader,
    authHeaderLength: authHeader ? authHeader.length : 0,
    requestId
  }, requestId);

  // Edge case: Missing authorization header
  if (!authHeader) {
    logValidation('TOKEN_VALIDATION_MISSING_HEADER', { requestId }, requestId);
    return res.status(401).json({
      success: false,
      error: 'Authorization header is required',
      code: 'AUTH_HEADER_MISSING',
      timestamp: new Date().toISOString()
    });
  }

  // Edge case: Malformed authorization header
  if (typeof authHeader !== 'string') {
    logValidation('TOKEN_VALIDATION_INVALID_HEADER_TYPE', {
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
    logValidation('TOKEN_VALIDATION_INVALID_FORMAT', {
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
    logValidation('TOKEN_VALIDATION_MISSING_TOKEN', { requestId }, requestId);
    return res.status(401).json({
      success: false,
      error: 'Token is required after Bearer',
      code: 'TOKEN_MISSING',
      timestamp: new Date().toISOString()
    });
  }

  // Edge case: Token too short or too long
  if (token.length < 10) {
    logValidation('TOKEN_VALIDATION_TOKEN_TOO_SHORT', {
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
    logValidation('TOKEN_VALIDATION_TOKEN_TOO_LONG', {
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

  logValidation('TOKEN_VALIDATION_SUCCESS', {
    tokenLength: token.length,
    requestId
  }, requestId);

  // Add token to request for use in auth middleware
  req.token = token;
  next();
};

// Validation for empty payload (for testing edge cases)
const emptyPayloadValidation = (req, res, next) => {
  const requestId = req.requestId;
  logValidation('EMPTY_PAYLOAD_VALIDATION_START', {
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    requestId
  }, requestId);

  const { error, value } = emptyPayloadSchema.validate(req.body);

  if (error) {
    logValidation('EMPTY_PAYLOAD_VALIDATION_ERROR', {
      error: error.message,
      requestId
    }, requestId);
    return res.status(400).json({
      success: false,
      error: 'Payload should be empty',
      code: 'PAYLOAD_NOT_EMPTY',
      timestamp: new Date().toISOString()
    });
  }

  logValidation('EMPTY_PAYLOAD_VALIDATION_SUCCESS', { requestId }, requestId);
  next();
};

module.exports = {
  loginValidation,
  tokenValidation,
  emptyPayloadValidation,
  emailSchema,
  passwordSchema,
  emptyPayloadSchema
};