import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log('🚀 API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      hasToken: !!token,
      timestamp: new Date().toISOString()
    });

    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for logging and error handling
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data,
      timestamp: new Date().toISOString()
    });
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', {
      status: error.response?.status,
      url: error.config?.url,
      data: error.response?.data,
      message: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });

    // Enhanced error handling for CORS and network issues
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      console.error('🌐 Network Error detected:', {
        message: error.message,
        config: error.config,
        timestamp: new Date().toISOString()
      });

      // Create enhanced error with specific network error details
      const networkError = new Error('Network Error: Cannot connect to server');
      networkError.code = 'NETWORK_ERROR';
      networkError.originalError = error;
      networkError.isNetworkError = true;

      return Promise.reject(networkError);
    }

    if (error.response?.status === 0 || error.message.includes('CORS')) {
      console.error('🚫 CORS Error detected:', {
        message: error.message,
        response: error.response,
        timestamp: new Date().toISOString()
      });

      // Create enhanced error with specific CORS error details
      const corsError = new Error('CORS policy blocked');
      corsError.code = 'CORS_ERROR';
      corsError.originalError = error;
      corsError.isCorsError = true;

      return Promise.reject(corsError);
    }

    if (error.message.includes('timeout')) {
      console.error('⏱️ Timeout Error detected:', {
        message: error.message,
        config: error.config,
        timestamp: new Date().toISOString()
      });

      const timeoutError = new Error('Request timeout - server not responding');
      timeoutError.code = 'TIMEOUT_ERROR';
      timeoutError.originalError = error;
      timeoutError.isTimeoutError = true;

      return Promise.reject(timeoutError);
    }

    // Handle specific error cases
    if (error.response?.status === 400) {
      console.warn('⚠️ Bad Request (400):', error.response.data);
    } else if (error.response?.status === 401) {
      console.warn('🚫 Unauthorized (401):', error.response.data);
      // Clear invalid token
      localStorage.removeItem('jwt_token');
    }

    return Promise.reject(error);
  }
);

// Auth API functions
export const authAPI = {
  // Login user
  login: async (email, password) => {
    console.log('🔐 Attempting login:', { email, hasPassword: !!password });
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  // Get current user info
  getMe: async () => {
    console.log('👤 Getting user info...');
    const response = await api.get('/me');
    return response.data;
  },

  // Logout user
  logout: () => {
    console.log('🚪 Logging out user...');
    localStorage.removeItem('jwt_token');
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    const token = localStorage.getItem('jwt_token');
    console.log('🔍 Checking authentication:', { hasToken: !!token });
    return !!token;
  },

  // Get stored token
  getToken: () => {
    return localStorage.getItem('jwt_token');
  }
};

export default api;