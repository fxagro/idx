/**
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { queryAI, getAIStatus, testAIConnection, AIUtils } from '../aiClient';

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_API_URL: 'http://localhost:3001',
    VITE_AI_DEBUG_MODE: 'true'
  },
  writable: true
});

describe('AI Client Service', () => {
  beforeEach(() => {
    fetch.mockClear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryAI', () => {
    it('should return error for empty prompt', async () => {
      const result = await queryAI('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Prompt is required and cannot be empty');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should return error for whitespace-only prompt', async () => {
      const result = await queryAI('   ');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Prompt is required and cannot be empty');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should make successful API call with valid prompt', async () => {
      const mockResponse = {
        success: true,
        data: 'AI response content',
        error: null,
        requestId: 'test123',
        provider: 'openrouter',
        duration: 1500
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse
      });

      localStorageMock.getItem.mockReturnValue('fake-jwt-token');

      const result = await queryAI('Test prompt');

      expect(result.success).toBe(true);
      expect(result.data).toBe('AI response content');
      expect(result.error).toBe(null);
      expect(result.provider).toBe('openrouter');
      expect(result.duration).toBeGreaterThan(0);

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/ai/query',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer fake-jwt-token'
          },
          body: JSON.stringify({
            prompt: 'Test prompt',
            context: {},
            timeout: 30000
          })
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ error: 'Authentication required' })
      });

      const result = await queryAI('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication required. Please log in again.');
      expect(result.data).toBe(null);
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await queryAI('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error. Please check your connection and try again.');
    });

    it('should handle timeout errors', async () => {
      // Mock AbortController
      global.AbortController = jest.fn(() => ({
        signal: {},
        abort: jest.fn()
      }));

      fetch.mockRejectedValueOnce(new Error('The operation was aborted'));

      const result = await queryAI('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timed out. Please try again.');
    });

    it('should include context in request', async () => {
      const mockResponse = {
        success: true,
        data: 'Response with context',
        error: null
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse
      });

      const context = { symbol: 'BBCA', market: 'idx' };
      await queryAI('Analyze stock', context);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            prompt: 'Analyze stock',
            context: context
          })
        })
      );
    });
  });

  describe('getAIStatus', () => {
    it('should fetch AI service status', async () => {
      const mockStatus = {
        status: 'healthy',
        providers: ['openrouter', 'openai']
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockStatus
      });

      const result = await getAIStatus();

      expect(result).toEqual(mockStatus);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/ai/status',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should handle status fetch errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getAIStatus();

      expect(result.status).toBe('unknown');
      expect(result.error).toBe('Network error');
    });
  });

  describe('testAIConnection', () => {
    it('should test connection with simple prompt', async () => {
      const mockResponse = {
        success: true,
        data: 'OK',
        error: null
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse
      });

      const result = await testAIConnection();

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            prompt: 'Hello, please respond with "OK" to confirm connectivity.',
            context: {},
            maxTokens: 10,
            timeout: 5000
          })
        })
      );
    });
  });

  describe('AIUtils', () => {
    describe('isAuthenticated', () => {
      it('should return true when token exists', () => {
        localStorageMock.getItem.mockReturnValue('valid-token');
        expect(AIUtils.isAuthenticated()).toBe(true);
      });

      it('should return false when no token', () => {
        localStorageMock.getItem.mockReturnValue(null);
        expect(AIUtils.isAuthenticated()).toBe(false);
      });
    });

    describe('isDebugMode', () => {
      it('should return debug mode status', () => {
        expect(AIUtils.isDebugMode()).toBe(true);
      });
    });

    describe('formatResponse', () => {
      it('should format markdown-like content', () => {
        const response = '**Bold text** and *italic text*';
        const formatted = AIUtils.formatResponse(response);
        expect(formatted).toContain('<strong>Bold text</strong>');
        expect(formatted).toContain('<em>italic text</em>');
      });

      it('should handle empty response', () => {
        expect(AIUtils.formatResponse('')).toBe('');
        expect(AIUtils.formatResponse(null)).toBe('');
      });
    });

    describe('truncateText', () => {
      it('should truncate long text', () => {
        const longText = 'A'.repeat(150);
        const truncated = AIUtils.truncateText(longText, 100);
        expect(truncated).toHaveLength(103); // 100 + '...'
        expect(truncated).toEndWith('...');
      });

      it('should not truncate short text', () => {
        const shortText = 'Short text';
        const truncated = AIUtils.truncateText(shortText, 100);
        expect(truncated).toBe(shortText);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      const result = await queryAI('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response format from server');
    });

    it('should handle missing content-type header', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
        json: async () => ({ success: true })
      });

      const result = await queryAI('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response format from server');
    });

    it('should handle non-JSON response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'text/plain']]),
        text: async () => 'Plain text response'
      });

      const result = await queryAI('Test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected response format from server');
    });
  });

  describe('Security', () => {
    it('should not expose API keys in requests', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ success: true, data: 'OK' })
      });

      await queryAI('Test prompt');

      const requestBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(requestBody.prompt).toBe('Test prompt');
      expect(requestBody).not.toHaveProperty('apiKey');
      expect(requestBody).not.toHaveProperty('OPENROUTER_API_KEY');
      expect(requestBody).not.toHaveProperty('OPENAI_API_KEY');
    });

    it('should handle missing auth token gracefully', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ success: true, data: 'OK' })
      });

      const result = await queryAI('Test prompt');

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json'
            // No Authorization header when no token
          }
        })
      );
    });
  });
});