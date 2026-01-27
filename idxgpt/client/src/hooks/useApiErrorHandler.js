import { useCallback } from 'react';

export function useApiErrorHandler(t) {
  const handleError = useCallback((error) => {
    // Log error for debugging/monitoring (can integrate with Sentry later)
    console.error('API Error:', error);

    // Handle network errors (no response)
    if (!error.response) {
      return {
        message: t('bandarmologi.errors.networkError'),
        type: 'network'
      };
    }

    // Handle different HTTP status codes
    switch (error.response.status) {
      case 400:
        return {
          message: t('bandarmologi.errors.invalidBrokerCode'),
          type: 'validation'
        };
      case 404:
        return {
          message: t('bandarmologi.errors.noDataAvailable'),
          type: 'not_found'
        };
      case 500:
        return {
          message: t('bandarmologi.errors.serverError'),
          type: 'server'
        };
      default:
        return {
          message: t('bandarmologi.errors.serverError'),
          type: 'server'
        };
    }
  }, [t]);

  return { handleError };
}