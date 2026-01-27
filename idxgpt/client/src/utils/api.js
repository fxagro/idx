import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api', // ✅ selalu ambil dari env dengan fallback
  withCredentials: true,
  timeout: 10000,
});

// Enhanced request logging
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Detailed request logging
  console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
    baseURL: config.baseURL,
    url: config.url,
    method: config.method,
    headers: {
      ...config.headers,
      Authorization: token ? '[TOKEN_PRESENT]' : '[NO_TOKEN]'
    },
    data: config.data,
    timestamp: new Date().toISOString()
  });

  return config;
});

// Enhanced response logging
api.interceptors.response.use(
  (response) => {
    // Detailed response logging for successful requests
    console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      dataSize: JSON.stringify(response.data).length,
      timestamp: new Date().toISOString(),
      // Don't log full response data to avoid cluttering console
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : []
    });

    return response;
  },
  (error) => {
    // Enhanced error logging
    console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method,
      errorMessage: error.message,
      responseData: error.response?.data,
      timestamp: new Date().toISOString()
    });

    // Deteksi CORS/Network Error
    const isCORSError = !error.response &&
      (error.code === 'NETWORK_ERROR' ||
       error.message?.includes('Network Error') ||
       error.message?.includes('CORS') ||
       error.message?.includes('cross-origin') ||
       error.request?.status === 0);

    if (isCORSError) {
      console.warn('[API] CORS/Network Error detected:', {
        url: error.config?.url,
        method: error.config?.method,
        message: error.message,
        timestamp: new Date().toISOString()
      });

      // Buat custom error object untuk CORS
      const corsError = new Error('CORS/Network Error: Tidak bisa terhubung ke server AI (ngrok). Coba lagi nanti.');
      corsError.isCORSError = true;
      corsError.originalError = error;
      throw corsError;
    }

    return Promise.reject(error);
  }
);

// Affiliate API endpoints
export const affiliateAPI = {
  // Get affiliate dashboard data
  getDashboard: () => api.get('/affiliate/dashboard'),

  // Generate new referral link
  generateLink: () => api.post('/affiliate/generate-link'),

  // Admin: Get affiliate settings
  getSettings: () => api.get('/affiliate/settings'),

  // Admin: Update affiliate settings
  updateSettings: (settings) => api.put('/affiliate/settings', settings),

  // Validate referral code
  validateReferralCode: (referralCode) => api.post(`/affiliate/signup/${referralCode}`),

  // Admin: Get affiliate statistics
  getStats: () => api.get('/affiliate/stats'),
};

export default api;
