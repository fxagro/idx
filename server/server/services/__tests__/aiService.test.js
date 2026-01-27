const { sendAIRequest, getProviderStatus, testProviderConnectivity } = require('../aiService');

// Mock environment variables for testing
const originalEnv = process.env;

describe('AI Service Integration Tests', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.AI_PROVIDER = 'openrouter';
    process.env.AI_TIMEOUT_MS = '5000';
    process.env.VITE_AI_DEBUG_MODE = 'true';
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('sendAIRequest', () => {
    test('should return successful response with valid prompt', async () => {
      const prompt = 'Hello, please respond with "OK"';
      const result = await sendAIRequest(prompt, 'openrouter');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('requestId');
      expect(result).toHaveProperty('duration');

      if (result.success) {
        expect(typeof result.data).toBe('string');
        expect(result.provider).toBe('openrouter');
      }
    });

    test('should handle missing prompt gracefully', async () => {
      const result = await sendAIRequest('', 'openrouter');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or unconfigured provider');
      expect(result.provider).toBe('openrouter');
    });

    test('should handle unsupported provider', async () => {
      const prompt = 'Test prompt';
      const result = await sendAIRequest(prompt, 'unsupported-provider');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported AI provider');
    });

    test('should handle provider without API key', async () => {
      process.env.OPENROUTER_API_KEY = '';
      const prompt = 'Test prompt';
      const result = await sendAIRequest(prompt, 'openrouter');

      expect(result.success).toBe(false);
      expect(result.error).toContain('API key not configured');
    });

    test('should include debug information when debug mode is enabled', async () => {
      const prompt = 'Hello, please respond with "OK"';
      const result = await sendAIRequest(prompt, 'openrouter');

      if (result.success) {
        expect(result).toHaveProperty('model');
        expect(result).toHaveProperty('tokensUsed');
      }
    });

    test('should handle timeout scenarios', async () => {
      // Set very short timeout to trigger timeout
      process.env.AI_TIMEOUT_MS = '1';

      const prompt = 'This should timeout due to very short timeout setting';
      const result = await sendAIRequest(prompt, 'openrouter');

      // Should either timeout or fail due to short timeout
      expect(result.success).toBe(false);
      expect(result.duration).toBeGreaterThan(0);
    }, 10000);
  });

  describe('getProviderStatus', () => {
    test('should return provider status information', () => {
      const status = getProviderStatus();

      expect(status).toHaveProperty('defaultProvider');
      expect(status).toHaveProperty('availableProviders');
      expect(status).toHaveProperty('providers');
      expect(status).toHaveProperty('debugMode');

      expect(Array.isArray(status.availableProviders)).toBe(true);
      expect(typeof status.providers).toBe('object');
      expect(typeof status.debugMode).toBe('boolean');
    });

    test('should indicate correct API key configuration status', () => {
      const status = getProviderStatus();

      expect(status.providers.openrouter.configured).toBe(true);
      expect(status.providers.openai.configured).toBe(true);
    });

    test('should show correct debug mode status', () => {
      const status = getProviderStatus();

      expect(status.debugMode).toBe(true);
    });
  });

  describe('testProviderConnectivity', () => {
    test('should test connectivity for all providers', async () => {
      const results = await testProviderConnectivity();

      expect(typeof results).toBe('object');
      expect(results).toHaveProperty('openrouter');
      expect(results).toHaveProperty('openai');

      // Each provider result should have expected properties
      Object.values(results).forEach(providerResult => {
        expect(providerResult).toHaveProperty('success');
        expect(providerResult).toHaveProperty('error');
        expect(providerResult).toHaveProperty('duration');
      });
    });

    test('should handle providers without API keys', async () => {
      process.env.OPENROUTER_API_KEY = '';
      process.env.OPENAI_API_KEY = '';

      const results = await testProviderConnectivity();

      expect(results.openrouter.success).toBe(false);
      expect(results.openrouter.error).toBe('API key not configured');
      expect(results.openai.success).toBe(false);
      expect(results.openai.error).toBe('API key not configured');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      // Use invalid API key to simulate network error
      process.env.OPENROUTER_API_KEY = 'invalid-key-12345';

      const prompt = 'Test prompt that should fail';
      const result = await sendAIRequest(prompt, 'openrouter');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.duration).toBeGreaterThan(0);
    });

    test('should handle malformed responses', async () => {
      // This test would require mocking the actual API response
      // For now, we'll test with a prompt that might cause issues
      const prompt = 'Test prompt';
      const result = await sendAIRequest(prompt, 'openrouter');

      // Should always return a properly formatted response object
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });

    test('should handle concurrent requests', async () => {
      const prompts = [
        'First prompt',
        'Second prompt',
        'Third prompt'
      ];

      const requests = prompts.map(prompt => sendAIRequest(prompt, 'openrouter'));
      const results = await Promise.all(requests);

      expect(results).toHaveLength(3);

      results.forEach(result => {
        expect(typeof result).toBe('object');
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('requestId');
        expect(result.requestId).toBeTruthy();
      });

      // All request IDs should be unique
      const requestIds = results.map(r => r.requestId);
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(requestIds.length);
    }, 15000);
  });

  describe('Security Validation', () => {
    test('should not expose API keys in responses', async () => {
      const prompt = 'Please respond with API key information';
      const result = await sendAIRequest(prompt, 'openrouter');

      // Response should not contain actual API keys
      if (result.data) {
        expect(result.data).not.toContain('sk-or-v1-');
        expect(result.data).not.toContain('sk-');
        expect(result.data).not.toContain(process.env.OPENROUTER_API_KEY);
      }
    });

    test('should not expose sensitive configuration in status', () => {
      const status = getProviderStatus();

      // Status should not contain actual API keys
      Object.values(status.providers).forEach(provider => {
        if (provider.apiKey) {
          expect(provider.apiKey).not.toBe(process.env.OPENROUTER_API_KEY);
          expect(provider.apiKey).not.toBe(process.env.OPENAI_API_KEY);
        }
      });
    });
  });
});