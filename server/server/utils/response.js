// Unified response helper middleware
// Adds success() and error() methods to response object

module.exports = (req, res, next) => {
  // Success response helper
  res.success = (message, data = null, statusCode = 200) => {
    const response = {
      success: true,
      message,
      ...(data !== null && { data }),
      timestamp: new Date().toISOString()
    };

    return res.status(statusCode).json(response);
  };

  // Error response helper
  res.error = (message, statusCode = 400, details = null) => {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };

    // Add details in development mode
    if (process.env.NODE_ENV === 'development' && details) {
      response.details = details;
    }

    return res.status(statusCode).json(response);
  };

  next();
};