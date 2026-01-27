import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Enhanced request interceptor with comprehensive logging and edge case handling
api.interceptors.request.use(
  (config) => {
    const timestamp = new Date().toISOString();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Enhanced request logging
    console.log(`[${timestamp}] 🚀 API Request [${requestId}]: ${config.method?.toUpperCase()} ${config.url}`, {
      baseURL: config.baseURL,
      url: config.url,
      method: config.method,
      headers: {
        ...config.headers,
        Authorization: config.headers.Authorization ? '[TOKEN_PRESENT]' : '[NO_TOKEN]'
      },
      data: config.data,
      timeout: config.timeout,
      requestId
    });

    // Add request ID to config for tracking
    config.requestId = requestId;

    // Edge case: Validate request configuration
    if (!config.url) {
      console.error(`[${timestamp}] ❌ Request Configuration Error [${requestId}]: Missing URL`);
      throw new Error('Request configuration error: Missing URL');
    }

    if (!config.method) {
      console.error(`[${timestamp}] ❌ Request Configuration Error [${requestId}]: Missing HTTP method`);
      throw new Error('Request configuration error: Missing HTTP method');
    }

    // Add auth token if available (handle both browser and Node.js environments)
    let token = null;
    try {
      // Browser environment
      if (typeof localStorage !== 'undefined') {
        token = localStorage.getItem('authToken');
      } else if (typeof global !== 'undefined' && global.testAuthToken) {
        // Node.js test environment
        token = global.testAuthToken;
      }
    } catch (error) {
      // Fallback for environments where localStorage is not available
      console.log(`[${timestamp}] ⚠️ localStorage not available [${requestId}]:`, error.message);
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`[${timestamp}] 🔑 Token attached [${requestId}]: Length ${token.length}`);
    } else {
      console.log(`[${timestamp}] ⚠️ No auth token available [${requestId}]`);
    }

    // Edge case: Validate Content-Type header for POST/PUT requests
    if (['post', 'put', 'patch'].includes(config.method?.toLowerCase())) {
      if (!config.headers['Content-Type']) {
        console.warn(`[${timestamp}] ⚠️ Missing Content-Type header [${requestId}]: Defaulting to application/json`);
        config.headers['Content-Type'] = 'application/json';
      }

      // Validate payload size
      if (config.data) {
        const payloadSize = JSON.stringify(config.data).length;
        if (payloadSize > 1024 * 1024) { // 1MB limit
          console.error(`[${timestamp}] ❌ Payload too large [${requestId}]: ${payloadSize} bytes`);
          throw new Error('Request payload too large');
        }
        console.log(`[${timestamp}] 📦 Payload size [${requestId}]: ${payloadSize} bytes`);
      }
    }

    return config;
  },
  (error) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ Request Setup Error:`, {
      message: error.message,
      config: error.config,
      stack: error.stack
    });
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with comprehensive logging and error handling
api.interceptors.response.use(
  (response) => {
    const timestamp = new Date().toISOString();
    const requestId = response.config?.requestId || 'unknown';

    // Enhanced success response logging
    console.log(`[${timestamp}] ✅ API Response [${requestId}]: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      dataSize: JSON.stringify(response.data).length,
      data: response.data,
      duration: response.config?.timestamp ? Date.now() - response.config.timestamp : 'unknown'
    });

    // Add timestamp to response for duration calculation
    response.timestamp = Date.now();

    return response;
  },
  (error) => {
    const timestamp = new Date().toISOString();
    const requestId = error.config?.requestId || 'unknown';

    if (error.response) {
      // Server responded with error status
      const { status, data, headers } = error.response;

      console.error(`[${timestamp}] ❌ API Error Response [${requestId}]: ${status} ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        status,
        statusText: error.response.statusText,
        data,
        headers,
        message: data?.message || data?.error || 'Unknown error',
        code: data?.code,
        timestamp: data?.timestamp
      });

      // Enhanced error handling with specific error types and codes
      let errorMessage = data?.error || 'Request failed';
      let errorCode = data?.code || `HTTP_${status}`;

      // Handle specific error types based on status and error codes
      switch (status) {
        case 400:
          if (data?.code === 'VALIDATION_ERROR') {
            errorMessage = `Validation error: ${data?.error || 'Invalid input data'}`;
          } else if (data?.code === 'INVALID_EMAIL_FORMAT') {
            errorMessage = 'Invalid email format - Please check your email address';
          } else if (data?.code === 'MISSING_BODY') {
            errorMessage = 'Request body is required';
          } else if (data?.code === 'INVALID_BODY_TYPE') {
            errorMessage = 'Request body must be a valid object';
          } else if (data?.code === 'MALFORMED_REQUEST') {
            errorMessage = 'Malformed request - Please check your input data';
          } else {
            errorMessage = data?.error || 'Bad request - Please check your input';
          }
          break;

        case 401:
          // Clear token on authentication error
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');

          if (data?.code === 'TOKEN_MISSING') {
            errorMessage = 'Authentication token is required';
          } else if (data?.code === 'TOKEN_INVALID') {
            errorMessage = 'Authentication token is invalid or expired';
          } else if (data?.code === 'TOKEN_EXPIRED') {
            errorMessage = 'Authentication token has expired - Please login again';
          } else {
            errorMessage = data?.error || 'Unauthorized access';
          }
          break;

        case 403:
          if (data?.code === 'INSUFFICIENT_PERMISSIONS') {
            errorMessage = `Insufficient permissions - Required: ${data?.required?.join(', ')}, Current: ${data?.current}`;
          } else {
            errorMessage = data?.error || 'Access forbidden';
          }
          break;

        case 404:
          errorMessage = data?.error || 'Requested resource not found';
          break;

        case 500:
          errorMessage = 'Internal server error - Please try again later';
          break;

        case 503:
          errorMessage = 'Service temporarily unavailable - Please try again later';
          break;

        default:
          errorMessage = data?.error || `HTTP ${status} error`;
      }

      // Create enhanced error object
      const enhancedError = new Error(errorMessage);
      enhancedError.status = status;
      enhancedError.code = errorCode;
      enhancedError.data = data;
      enhancedError.timestamp = data?.timestamp || timestamp;
      enhancedError.requestId = requestId;

      throw enhancedError;

    } else if (error.request) {
      // Network error
      console.error(`[${timestamp}] 🌐 Network Error [${requestId}]:`, {
        message: 'No response received',
        request: error.request,
        code: error.code,
        config: error.config
      });

      let errorMessage = 'Network error - Please check your connection';

      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - Server not reachable (check if server is running on port 5000)';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'Server not found - Please check the server address';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Request timeout - Server took too long to respond';
      } else if (error.code === 'ECONNRESET') {
        errorMessage = 'Connection reset - Server connection was lost';
      } else if (error.code === 'ENETUNREACH') {
        errorMessage = 'Network unreachable - Please check your internet connection';
      }

      const networkError = new Error(errorMessage);
      networkError.code = error.code;
      networkError.type = 'NETWORK_ERROR';
      networkError.requestId = requestId;

      throw networkError;

    } else {
      // Other error (request setup, etc.)
      console.error(`[${timestamp}] ❌ Request Setup Error [${requestId}]:`, {
        message: error.message,
        stack: error.stack,
        config: error.config
      });

      const setupError = new Error(error.message || 'Request setup failed');
      setupError.type = 'SETUP_ERROR';
      setupError.requestId = requestId;

      throw setupError;
    }
  }
);

// Auth API functions
export const authAPI = {
  // Login with email (and password in production)
  login: async (email, password = null) => {
    const payload = { email };
    if (password) {
      payload.password = password;
    }

    const response = await api.post('/auth/login', payload);
    return response.data;
  },

  // Get authentication requirements
  getRequirements: async () => {
    const response = await api.get('/auth/requirements');
    return response.data;
  },

  // Validate token
  validateToken: async (token) => {
    const response = await api.post('/auth/validate-token', { token });
    return response.data;
  },

  // Logout (invalidate token)
  logout: async () => {
    await api.delete('/me/token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }
};

// User API functions
export const userAPI = {
  // Get current user profile
  getProfile: async () => {
    const response = await api.get('/me');
    return response.data;
  },

  // Update user profile
  updateProfile: async (updates) => {
    const response = await api.put('/me', updates);
    return response.data;
  }
};

// Utility functions with environment compatibility
export const apiUtils = {
  // Set auth token in localStorage (browser) or global (Node.js)
  setAuthToken: (token) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('authToken', token);
      } else if (typeof global !== 'undefined') {
        global.testAuthToken = token;
      }
    } catch (error) {
      console.warn('Failed to set auth token:', error.message);
    }
  },

  // Get auth token from localStorage (browser) or global (Node.js)
  getAuthToken: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('authToken');
      } else if (typeof global !== 'undefined' && global.testAuthToken) {
        return global.testAuthToken;
      }
    } catch (error) {
      console.warn('Failed to get auth token:', error.message);
    }
    return null;
  },

  // Set user data in localStorage (browser) or global (Node.js)
  setUser: (user) => {
    try {
      const userStr = JSON.stringify(user);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('user', userStr);
      } else if (typeof global !== 'undefined') {
        global.testUser = userStr;
      }
    } catch (error) {
      console.warn('Failed to set user data:', error.message);
    }
  },

  // Get user data from localStorage (browser) or global (Node.js)
  getUser: () => {
    try {
      let userStr = null;
      if (typeof localStorage !== 'undefined') {
        userStr = localStorage.getItem('user');
      } else if (typeof global !== 'undefined' && global.testUser) {
        userStr = global.testUser;
      }

      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.warn('Failed to get user data:', error.message);
      return null;
    }
  },

  // Clear all auth data
  clearAuth: () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      } else if (typeof global !== 'undefined') {
        delete global.testAuthToken;
        delete global.testUser;
      }
    } catch (error) {
      console.warn('Failed to clear auth data:', error.message);
    }
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!apiUtils.getAuthToken();
  }
};

export default api;