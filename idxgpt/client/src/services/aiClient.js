/**
 * AI Client Service for OpenBB Dashboard
 * Handles communication with backend AI endpoints securely
 */

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const AI_ENDPOINT = `${API_BASE_URL}/api/ai/query`;
const DEBUG_MODE = import.meta.env.VITE_AI_DEBUG_MODE === 'true';

/**
 * Get JWT token from localStorage
 * @returns {string|null} JWT token or null if not found
 */
function getAuthToken() {
  try {
    return localStorage.getItem('token');
  } catch (error) {
    console.warn('Failed to get auth token from localStorage:', error);
    return null;
  }
}

/**
 * Create headers for API requests
 * @returns {Object} Headers object with auth token
 */
function createHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Handle API response
 * @param {Response} response - Fetch response object
 * @returns {Object} Parsed response data
 */
async function handleResponse(response) {
  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      }
    } catch (parseError) {
      console.warn('Failed to parse error response:', parseError);
    }

    throw new Error(errorMessage);
  }

  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }

  throw new Error('Unexpected response format from server');
}

/**
 * Query AI service with prompt and context
 * @param {string} prompt - The prompt to send to AI
 * @param {Object} context - Additional context for the AI query
 * @param {Object} options - Request options (timeout, provider, etc.)
 * @returns {Promise<Object>} Unified response: {success, data, error}
 */
export async function queryAI(prompt, context = {}, options = {}) {
  // Validate input
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return {
      success: false,
      data: null,
      error: 'Prompt is required and cannot be empty'
    };
  }

  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  if (DEBUG_MODE) {
    console.log(`🤖 AI Query [${requestId}]:`, {
      promptLength: prompt.length,
      context: Object.keys(context),
      options
    });
  }

  try {
    // Prepare request body
    const requestBody = {
      prompt: prompt.trim(),
      context,
      ...options
    };

    if (DEBUG_MODE) {
      console.log(`🚀 Sending AI request [${requestId}] to:`, AI_ENDPOINT);
    }

    // Make API request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);

    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Handle response
    const result = await handleResponse(response);
    const duration = Date.now() - startTime;

    if (DEBUG_MODE) {
      console.log(`✅ AI Query [${requestId}] completed:`, {
        success: result.success,
        duration,
        hasData: !!result.data,
        provider: result.provider
      });
    }

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      requestId: result.requestId || requestId,
      duration,
      provider: result.provider,
      ...(DEBUG_MODE && {
        debug: {
          tokensUsed: result.debug?.tokensUsed,
          model: result.debug?.model,
          serverDuration: result.duration
        }
      })
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    // Handle specific error types
    let friendlyError = 'Failed to process AI query';

    if (error.name === 'AbortError') {
      friendlyError = 'Request timed out. Please try again.';
    } else if (error.message.includes('401')) {
      friendlyError = 'Authentication required. Please log in again.';
    } else if (error.message.includes('403')) {
      friendlyError = 'Access denied. You may have exceeded your AI quota.';
    } else if (error.message.includes('429')) {
      friendlyError = 'Too many requests. Please wait a moment and try again.';
    } else if (error.message.includes('500')) {
      friendlyError = 'Server error. Please try again later.';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      friendlyError = 'Network error. Please check your connection and try again.';
    } else {
      friendlyError = error.message;
    }

    if (DEBUG_MODE) {
      console.error(`❌ AI Query [${requestId}] failed:`, {
        error: error.message,
        duration,
        type: error.name
      });
    }

    return {
      success: false,
      data: null,
      error: friendlyError,
      requestId,
      duration
    };
  }
}

/**
 * Get AI service status
 * @returns {Promise<Object>} Service status information
 */
export async function getAIStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/status`, {
      method: 'GET',
      headers: createHeaders()
    });

    return await handleResponse(response);
  } catch (error) {
    console.warn('Failed to get AI status:', error.message);
    return {
      status: 'unknown',
      error: error.message
    };
  }
}

/**
 * Test AI connectivity
 * @returns {Promise<Object>} Test results
 */
export async function testAIConnection() {
  const testPrompt = 'Hello, please respond with "OK" to confirm connectivity.';
  return await queryAI(testPrompt, {}, { maxTokens: 10, timeout: 5000 });
}

/**
 * AI Client utility functions
 */
export const AIUtils = {
  /**
   * Check if user is authenticated
   * @returns {boolean} True if user has valid token
   */
  isAuthenticated() {
    return !!getAuthToken();
  },

  /**
   * Get debug mode status
   * @returns {boolean} True if debug mode is enabled
   */
  isDebugMode() {
    return DEBUG_MODE;
  },

  /**
   * Format AI response for display
   * @param {string} response - Raw AI response
   * @returns {string} Formatted response
   */
  formatResponse(response) {
    if (!response) return '';

    // Basic formatting for markdown-like content
    return response
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  },

  /**
   * Truncate text for display
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
};

export default {
  queryAI,
  getAIStatus,
  testAIConnection,
  AIUtils
};