import axios from 'axios';

// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for authentication
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Enhanced logging for debugging
  console.log(`[API Request Debug] ${config.method?.toUpperCase()} ${config.url}`, {
    hasToken: !!token,
    tokenLength: token ? token.length : 0,
    headers: {
      ...config.headers,
      Authorization: token ? '[TOKEN_PRESENT]' : '[NO_TOKEN]'
    },
    timestamp: new Date().toISOString()
  });

  return config;
});

// Response interceptor for error handling with port fallback
api.interceptors.response.use(
  (response) => {
    // Enhanced response logging for debugging
    console.log(`[API Response Debug] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      statusText: response.statusText,
      hasData: !!response.data,
      dataSize: JSON.stringify(response.data).length,
      headers: response.headers,
      timestamp: new Date().toISOString()
    });

    return response;
  },
  async (error) => {
    if (error.code === 'ECONNREFUSED' || error.message?.includes('net::ERR_CONNECTION_REFUSED')) {
      // Fallback port logic
      const originalUrl = error.config.url;
      error.config.baseURL = error.config.baseURL.replace(':5000', ':5001');

      try {
        return await axios.request(error.config);
      } catch (fallbackError) {
        throw new Error('Tidak bisa terhubung ke server. Pastikan backend jalan di port 5000.');
      }
    }

    // Enhanced error logging for debugging
    console.error(`[API Error Debug] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorMessage: error.message,
      responseData: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        data: error.config?.data
      },
      timestamp: new Date().toISOString()
    });

    if (error.response?.status === 401) {
      console.warn('[API] 401 Unauthorized - removing token and redirecting to login');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }

    throw error;
  }
);

// Retry helper function
const withRetry = (fn, maxRetries = 3) => async (...args) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn(...args);
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

// Enhanced API functions with retry logic for critical endpoints
export const authAPI = {
  login: withRetry((email, password = null) => {
    const payload = password ? { email, password } : { email };
    return api.post('/auth/login', payload);
  }),
  me: withRetry(() => api.get('/me')),
  refreshToken: withRetry(() => api.post('/auth/refresh')),
  isAuthenticated: () => !!localStorage.getItem('token'),
  getToken: () => localStorage.getItem('token')
};

// Utility function for server health check
export async function pingServer() {
  try {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) {
      throw new Error(`Server responded with status: ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    if (error.code === 'ECONNREFUSED' ||
        error.message?.includes('net::ERR_CONNECTION_REFUSED') ||
        error.message?.includes('Network Error') ||
        error.message?.includes('Failed to fetch')) {
      throw new Error('Tidak bisa terhubung ke server. Pastikan backend jalan di port 5000.');
    }
    throw error;
  }
}

export default api;
