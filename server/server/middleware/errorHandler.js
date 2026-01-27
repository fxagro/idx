// Global error handler middleware
// Must be placed LAST in the middleware chain

module.exports = (err, req, res, next) => {
  // Log the error with full details
  console.error('❌ Global Error Handler:', {
    message: err.message,
    stack: err.stack,
    status: err.status,
    code: err.code,
    timestamp: new Date().toISOString(),
    url: req?.url,
    method: req?.method,
    ip: req?.ip,
    userAgent: req?.get('User-Agent')
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      message: 'Validation Error',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      details: 'Token verification failed',
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      details: 'Please login again',
      timestamp: new Date().toISOString()
    });
  }

  // Database errors
  if (err.code === '23505') { // Unique constraint violation
    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
      details: err.detail || 'Duplicate entry',
      timestamp: new Date().toISOString()
    });
  }

  if (err.code === '23503') { // Foreign key constraint violation
    return res.status(400).json({
      success: false,
      message: 'Invalid reference',
      details: err.detail || 'Referenced resource does not exist',
      timestamp: new Date().toISOString()
    });
  }

  // Default server error
  const statusCode = err.status || err.statusCode || 500;
  const message = err.status === 500 ? 'Internal Server Error' : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      details: err.message,
      stack: err.stack
    }),
    timestamp: new Date().toISOString()
  });
};