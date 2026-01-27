import api from './api';

/**
 * Enhanced API client with retry mechanism and error handling
 * @param {string} url - API endpoint URL
 * @param {object} options - Request options (method, data, etc.)
 * @param {number} retries - Number of retry attempts (default: 2)
 * @returns {Promise} Response data
 */
export async function apiClient(url, options = {}, retries = 2) {
  try {
    // Clean the URL to avoid double /api/ prefix
    // Since baseURL already includes /api, we should not add it again
    let cleanUrl = url;
    if (url.startsWith('/api/')) {
      // Remove the /api/ prefix since baseURL already includes it
      cleanUrl = url.substring(4); // Remove '/api' from the beginning
    } else if (!url.startsWith('/')) {
      // Add leading slash if missing
      cleanUrl = `/${url}`;
    }

    const response = await api.request({
      url: cleanUrl,
      ...options,
      // Add timeout to detect network issues
      timeout: 10000
    });

    return response.data;
  } catch (error) {
    // Check if we should retry (network errors or timeouts)
    const shouldRetry = retries > 0 && (
      !error.response || // Network error
      error.code === 'ECONNABORTED' || // Timeout
      error.code === 'ENOTFOUND' || // DNS resolution failed
      error.code === 'ECONNREFUSED' // Connection refused
    );

    if (shouldRetry) {
      console.warn(`API request failed, retrying... (${retries} attempts left)`, {
        url,
        error: error.message
      });

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, 3 - retries) * 1000));

      return apiClient(url, options, retries - 1);
    }

    // No more retries, throw the error
    throw error;
  }
}

/**
 * Convenience methods for common HTTP operations
 */
export const apiClientGet = (url, retries = 2) =>
  apiClient(url, { method: 'GET' }, retries);

export const apiClientPost = (url, data, retries = 2) =>
  apiClient(url, { method: 'POST', data }, retries);

export const apiClientPut = (url, data, retries = 2) =>
  apiClient(url, { method: 'PUT', data }, retries);

export const apiClientDelete = (url, retries = 2) =>
  apiClient(url, { method: 'DELETE' }, retries);