import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

export default function useQuota() {
  const [data, setData] = useState({
    used: 0,
    limit: 1000,
    remaining: 1000
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isConsuming, setIsConsuming] = useState(false);

  const fetchQuota = useCallback(async (retryCount = 0) => {
    try {
      setIsLoading(true);
      setIsError(false);

      console.log('[useQuota] Fetching quota...');

      const response = await api.get('/stocks/ai/quota');

      if (response.data && response.data.data) {
        const quotaData = response.data.data;
        const quotaInfo = {
          used: quotaData.used || 0,
          limit: quotaData.limit || 1000,
          remaining: quotaData.remaining || 1000
        };

        setData(quotaInfo);
        console.log('[useQuota] Fetched quota:', quotaInfo);
        console.log('[OpenBB] Quota display updated successfully');
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('[useQuota] Quota fetch error:', error);

      // Handle 401 errors specifically
      if (error.response?.status === 401) {
        console.log('Session expired – please re-login');
        setIsError(true);
      }
      // Handle network/CORS errors
      else if (error.isCORSError || error.message?.includes('CORS') || error.message?.includes('Network Error')) {
        console.warn('[useQuota] CORS/Network Error detected, using fallback data');
        setData({
          used: 0,
          limit: 0,
          remaining: 0
        });
      }
      // Retry logic for other errors
      else if (retryCount < 1) {
        console.log(`[useQuota] Retrying quota fetch (attempt ${retryCount + 1})...`);
        setTimeout(() => fetchQuota(retryCount + 1), 1000);
        return;
      }
      // Final fallback after retry
      else {
        setIsError(true);
        setData({
          used: 0,
          limit: 0,
          remaining: 0
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const consumeQuota = useCallback(async (tokens) => {
    if (!tokens || tokens <= 0) {
      console.error('[useQuota] Invalid tokens amount:', tokens);
      return { success: false, message: 'Invalid tokens amount' };
    }

    // Optimistic update - temporarily decrement quota locally
    const optimisticData = {
      ...data,
      used: data.used + tokens,
      remaining: Math.max(0, data.remaining - tokens)
    };

    setData(optimisticData);
    setIsConsuming(true);

    try {
      console.log('[useQuota] Consuming quota:', tokens);

      const response = await api.post('/stocks/ai/consume', {
        tokens_used: tokens
      });

      if (response.data && response.data.success) {
        const newData = response.data.data;
        setData({
          used: newData.used,
          limit: newData.limit,
          remaining: newData.remaining
        });

        console.log('[useQuota] Quota consumed successfully:', newData);

        // Auto-refresh after 3 seconds to ensure consistency
        setTimeout(() => {
          fetchQuota();
        }, 3000);

        return {
          success: true,
          data: newData
        };
      } else {
        throw new Error(response.data?.message || 'Failed to consume quota');
      }
    } catch (error) {
      console.error('[useQuota] Quota consumption error:', error);

      // Rollback optimistic update on error
      setData(data);

      // Handle quota exceeded error
      if (error.response?.status === 429) {
        return {
          success: false,
          message: 'AI quota exceeded',
          data: error.response.data?.data
        };
      }

      // Handle network errors
      if (error.isCORSError || error.message?.includes('CORS') || error.message?.includes('Network Error')) {
        return {
          success: false,
          message: 'Network error - unable to update quota'
        };
      }

      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to consume quota'
      };
    } finally {
      setIsConsuming(false);
    }
  }, [data, fetchQuota]);

  const consumeQuotaSafe = useCallback(async (tokens, maxRetries = 1) => {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[useQuota] Safe consumption attempt ${attempt + 1}/${maxRetries + 1} for ${tokens} tokens`);

        const result = await consumeQuota(tokens);

        if (result.success) {
          console.log('[useQuota] Safe consumption successful');
          return result;
        }

        lastError = result;

        // If it's a 5xx error and we have retries left, wait and retry
        if (attempt < maxRetries && result.message.includes('Network error')) {
          console.log(`[useQuota] Retrying after network error (attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
          continue;
        }

        break; // Exit retry loop for non-retryable errors

      } catch (error) {
        console.error(`[useQuota] Safe consumption attempt ${attempt + 1} failed:`, error);
        lastError = {
          success: false,
          message: error.message || 'Unexpected error during quota consumption'
        };

        // Retry on network errors
        if (attempt < maxRetries && (error.message?.includes('Network') || error.message?.includes('fetch'))) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }

        break;
      }
    }

    console.error('[useQuota] Safe consumption failed after all retries:', lastError);
    return lastError;
  }, [consumeQuota]);

  useEffect(() => {
    // Initial fetch
    fetchQuota();

    // Set up auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchQuota();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchQuota]);

  return {
    ...data,
    isLoading,
    isError,
    isConsuming,
    refetch: fetchQuota,
    consumeQuota,
    consumeQuotaSafe
  };
}