import { useState, useCallback, useRef } from 'react';
import { queryAI, getAIStatus, testAIConnection, AIUtils } from '../services/aiClient';

/**
 * Custom hook for AI functionality
 * Provides state management and functions for AI interactions
 */
export const useAI = () => {
  // Core state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [responses, setResponses] = useState([]);
  const [currentRequestId, setCurrentRequestId] = useState(null);

  // AI Console state
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consolePrompt, setConsolePrompt] = useState('');
  const [consoleHistory, setConsoleHistory] = useState([]);
  const [showDebugLogs, setShowDebugLogs] = useState(AIUtils.isDebugMode());

  // Refs for managing state
  const abortControllerRef = useRef(null);

  /**
   * Send AI query with prompt and context
   * @param {string} prompt - The prompt to send
   * @param {Object} context - Additional context
   * @param {Object} options - Request options
   * @returns {Promise<Object>} AI response
   */
  const sendQuery = useCallback(async (prompt, context = {}, options = {}) => {
    if (!prompt || prompt.trim().length === 0) {
      setError('Prompt cannot be empty');
      return { success: false, error: 'Prompt cannot be empty' };
    }

    setIsLoading(true);
    setError(null);
    setCurrentRequestId(null);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const result = await queryAI(prompt, context, {
        timeout: 30000,
        signal: abortControllerRef.current.signal,
        ...options
      });

      setCurrentRequestId(result.requestId);

      if (result.success) {
        // Add to responses history
        const responseItem = {
          id: result.requestId,
          prompt,
          response: result.data,
          timestamp: new Date().toISOString(),
          provider: result.provider,
          duration: result.duration,
          context
        };

        setResponses(prev => [responseItem, ...prev]);

        // Add to console history if console is being used
        if (isConsoleOpen) {
          setConsoleHistory(prev => [...prev, {
            type: 'response',
            content: result.data,
            timestamp: new Date().toISOString(),
            requestId: result.requestId,
            success: true
          }]);
        }

        return result;
      } else {
        // Handle error response
        setError(result.error);

        if (isConsoleOpen) {
          setConsoleHistory(prev => [...prev, {
            type: 'error',
            content: result.error,
            timestamp: new Date().toISOString(),
            requestId: result.requestId,
            success: false
          }]);
        }

        return result;
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to process AI request';
      setError(errorMessage);

      if (isConsoleOpen) {
        setConsoleHistory(prev => [...prev, {
          type: 'error',
          content: errorMessage,
          timestamp: new Date().toISOString(),
          requestId: currentRequestId,
          success: false
        }]);
      }

      return {
        success: false,
        error: errorMessage,
        requestId: currentRequestId
      };
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isConsoleOpen, currentRequestId]);

  /**
   * Send prompt from AI console
   * @param {string} prompt - The prompt to send
   * @param {Object} context - Additional context
   */
  const sendConsoleQuery = useCallback(async (prompt, context = {}) => {
    if (!prompt || prompt.trim().length === 0) return;

    // Add user prompt to console history
    setConsoleHistory(prev => [...prev, {
      type: 'prompt',
      content: prompt,
      timestamp: new Date().toISOString()
    }]);

    setConsolePrompt('');

    // Send the query
    await sendQuery(prompt, context);
  }, [sendQuery]);

  /**
   * Cancel current AI request
   */
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setError('Request cancelled by user');

      if (isConsoleOpen) {
        setConsoleHistory(prev => [...prev, {
          type: 'error',
          content: 'Request cancelled by user',
          timestamp: new Date().toISOString(),
          success: false
        }]);
      }
    }
  }, [isConsoleOpen]);

  /**
   * Clear responses history
   */
  const clearResponses = useCallback(() => {
    setResponses([]);
    setError(null);
  }, []);

  /**
   * Clear console history
   */
  const clearConsoleHistory = useCallback(() => {
    setConsoleHistory([]);
  }, []);

  /**
   * Toggle AI console visibility
   */
  const toggleConsole = useCallback(() => {
    setIsConsoleOpen(prev => !prev);
  }, []);

  /**
   * Get AI service status
   */
  const checkStatus = useCallback(async () => {
    try {
      return await getAIStatus();
    } catch (err) {
      console.warn('Failed to get AI status:', err);
      return { status: 'unknown', error: err.message };
    }
  }, []);

  /**
   * Test AI connection
   */
  const testConnection = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await testAIConnection();

      if (isConsoleOpen) {
        setConsoleHistory(prev => [...prev, {
          type: result.success ? 'response' : 'error',
          content: result.success
            ? '✅ AI connection test successful'
            : `❌ AI connection test failed: ${result.error}`,
          timestamp: new Date().toISOString(),
          success: result.success
        }]);
      }

      return result;
    } catch (err) {
      const errorMessage = err.message || 'Connection test failed';
      setError(errorMessage);

      if (isConsoleOpen) {
        setConsoleHistory(prev => [...prev, {
          type: 'error',
          content: `❌ Connection test failed: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          success: false
        }]);
      }

      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [isConsoleOpen]);

  /**
   * Get debug information for current session
   */
  const getDebugInfo = useCallback(() => {
    if (!AIUtils.isDebugMode()) return null;

    return {
      isLoading,
      error,
      currentRequestId,
      responsesCount: responses.length,
      isConsoleOpen,
      consoleHistoryCount: consoleHistory.length,
      showDebugLogs,
      lastResponse: responses[0] || null,
      isAuthenticated: AIUtils.isAuthenticated()
    };
  }, [isLoading, error, currentRequestId, responses, isConsoleOpen, consoleHistory, showDebugLogs]);

  /**
   * Handle keyboard shortcuts for AI console
   */
  const handleKeyDown = useCallback((event) => {
    if (!isConsoleOpen) return;

    // Ctrl+Enter to send prompt
    if (event.ctrlKey && event.key === 'Enter' && consolePrompt.trim()) {
      event.preventDefault();
      sendConsoleQuery(consolePrompt.trim());
    }

    // Escape to close console
    if (event.key === 'Escape') {
      setIsConsoleOpen(false);
    }
  }, [isConsoleOpen, consolePrompt, sendConsoleQuery]);

  return {
    // Core state
    isLoading,
    error,
    responses,
    currentRequestId,

    // Console state
    isConsoleOpen,
    consolePrompt,
    setConsolePrompt,
    consoleHistory,
    showDebugLogs,
    setShowDebugLogs,

    // Actions
    sendQuery,
    sendConsoleQuery,
    cancelRequest,
    clearResponses,
    clearConsoleHistory,
    toggleConsole,
    checkStatus,
    testConnection,
    handleKeyDown,

    // Utilities
    getDebugInfo,
    isDebugMode: AIUtils.isDebugMode(),
    isAuthenticated: AIUtils.isAuthenticated(),
    formatResponse: AIUtils.formatResponse,
    truncateText: AIUtils.truncateText
  };
};

export default useAI;