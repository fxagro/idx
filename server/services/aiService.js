const OpenAI = require('openai');
const axios = require('axios');

// AI Service Configuration
const AI_CONFIG = {
  // Default timeout in milliseconds
  DEFAULT_TIMEOUT: parseInt(process.env.AI_TIMEOUT_MS) || 15000,
  // Default provider
  DEFAULT_PROVIDER: process.env.AI_PROVIDER || 'openrouter',
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // Base delay in ms for exponential backoff
  // Supported providers
  PROVIDERS: {
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      fallbackURL: 'https://104.18.2.115/api/v1',
      model: 'deepseek/deepseek-chat-v3.1:free'
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-3.5-turbo'
    }
  }
};

// Enhanced logging utility
const logger = {
  info: (message, data = {}) => {
    if (process.env.VITE_AI_DEBUG_MODE === 'true') {
      console.log(`[${new Date().toISOString()}] 🤖 ${message}`, data);
    }
  },
  error: (message, error = {}) => {
    console.error(`[${new Date().toISOString()}] ❌ ${message}`, error);
  },
  warn: (message, data = {}) => {
    if (process.env.VITE_AI_DEBUG_MODE === 'true') {
      console.warn(`[${new Date().toISOString()}] ⚠️ ${message}`, data);
    }
  }
};

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number (0-based)
 * @returns {number} - Delay in milliseconds
 */
function getRetryDelay(attempt) {
  return AI_CONFIG.RETRY_DELAY * Math.pow(2, attempt);
}

/**
 * Clean markdown text for safe rendering in web UI
 * @param {string} text - Raw markdown text from AI
 * @returns {string} - Cleaned markdown text
 */
function cleanMarkdown(text) {
  if (!text) return '';

  // Replace double/triple backticks with single backticks
  text = text.replace(/`{2,}/g, '`');

  // Ensure backticks are balanced
  text = text.replace(/`([^`]*)`/g, '`$1`');

  // Replace problematic characters
  text = text.replace(/\r/g, '').replace(/\t/g, ' ');

  // Remove unclosed markdown
  text = text.replace(/(\*|_)([^\*_]*)$/g, '$2');

  return text.trim();
}

/**
 * Validate provider configuration
 * @param {string} provider - Provider name
 * @returns {boolean} - True if provider is valid and configured
 */
function validateProvider(provider) {
  const config = AI_CONFIG.PROVIDERS[provider];
  if (!config) {
    logger.error(`Unsupported AI provider: ${provider}`);
    return false;
  }

  if (!config.apiKey) {
    logger.error(`API key not configured for provider: ${provider}`);
    return false;
  }

  return true;
}

/**
 * Create provider client based on provider type
 * @param {string} provider - Provider name
 * @param {boolean} useFallback - Whether to use fallback URL for OpenRouter
 * @returns {OpenAI|AxiosInstance|null} - Configured client or null if failed
 */
function createProviderClient(provider, useFallback = false) {
  const config = AI_CONFIG.PROVIDERS[provider];
  if (!config) return null;

  try {
    if (provider === 'openrouter' && useFallback) {
      return new OpenAI({
        baseURL: config.fallbackURL,
        apiKey: config.apiKey,
      });
    }

    return new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
  } catch (error) {
    logger.error(`Failed to create ${provider} client:`, error.message);
    return null;
  }
}

/**
 * Send request to AI provider with retry logic
 * @param {string} prompt - The prompt to send to AI
 * @param {string} provider - AI provider to use (default: openrouter)
 * @param {Object} options - Additional options for the request
 * @returns {Promise<Object>} - Unified response format: { success, data, error }
 */
async function sendAIRequest(prompt, provider = AI_CONFIG.DEFAULT_PROVIDER, options = {}) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  logger.info(`AI Request started: ${requestId}`, {
    provider,
    promptLength: prompt.length,
    options
  });

  // Validate provider
  if (!validateProvider(provider)) {
    const error = `Invalid or unconfigured provider: ${provider}`;
    logger.error(`AI Request failed: ${requestId}`, { error });
    return {
      success: false,
      data: null,
      error,
      provider,
      requestId,
      duration: Date.now() - startTime
    };
  }

  const config = AI_CONFIG.PROVIDERS[provider];
  let client = null;
  let lastError = null;

  // Try main provider first, then fallback for OpenRouter
  const attempts = provider === 'openrouter' ? [
    { client: () => createProviderClient(provider, false), name: 'main' },
    { client: () => createProviderClient(provider, true), name: 'fallback' }
  ] : [
    { client: () => createProviderClient(provider, false), name: 'main' }
  ];

  for (let attempt = 0; attempt < attempts.length; attempt++) {
    const { client: createClient, name } = attempts[attempt];

    try {
      client = createClient();
      if (!client) {
        throw new Error(`Failed to create ${provider} ${name} client`);
      }

      logger.info(`AI Request attempt ${attempt + 1}: ${requestId}`, {
        provider,
        attempt: name,
        model: config.model
      });

      // Prepare request options
      const requestOptions = {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        timeout: options.timeout || AI_CONFIG.DEFAULT_TIMEOUT,
        ...options
      };

      // Execute request with timeout
      const response = await Promise.race([
        client.chat.completions.create(requestOptions),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), requestOptions.timeout)
        )
      ]);

      const result = response.choices[0].message.content;
      const duration = Date.now() - startTime;

      logger.info(`AI Request successful: ${requestId}`, {
        provider,
        attempt: name,
        duration,
        tokensUsed: response.usage?.total_tokens
      });

      return {
        success: true,
        data: cleanMarkdown(result),
        error: null,
        provider,
        requestId,
        duration,
        tokensUsed: response.usage?.total_tokens,
        model: config.model
      };

    } catch (error) {
      lastError = error;
      logger.warn(`AI Request attempt ${attempt + 1} failed: ${requestId}`, {
        provider,
        attempt: name,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      // If this isn't the last attempt, wait before retrying
      if (attempt < attempts.length - 1) {
        const delay = getRetryDelay(attempt);
        logger.info(`Retrying in ${delay}ms: ${requestId}`);
        await sleep(delay);
      }
    }
  }

  // All attempts failed
  const duration = Date.now() - startTime;
  const errorMessage = `All ${provider} attempts failed. Last error: ${lastError.message}`;

  logger.error(`AI Request failed after all attempts: ${requestId}`, {
    provider,
    duration,
    lastError: lastError.message
  });

  return {
    success: false,
    data: null,
    error: errorMessage,
    provider,
    requestId,
    duration,
    lastError: lastError.message
  };
}

/**
 * Get available AI providers and their status
 * @returns {Object} - Provider status information
 */
function getProviderStatus() {
  const providers = {};

  for (const [name, config] of Object.entries(AI_CONFIG.PROVIDERS)) {
    providers[name] = {
      configured: !!config.apiKey,
      hasFallback: !!config.fallbackURL,
      model: config.model,
      timeout: AI_CONFIG.DEFAULT_TIMEOUT
    };
  }

  return {
    defaultProvider: AI_CONFIG.DEFAULT_PROVIDER,
    availableProviders: Object.keys(AI_CONFIG.PROVIDERS),
    providers,
    debugMode: process.env.VITE_AI_DEBUG_MODE === 'true'
  };
}

/**
 * Test connectivity to all configured providers
 * @returns {Promise<Object>} - Test results for each provider
 */
async function testProviderConnectivity() {
  const results = {};

  for (const [provider, config] of Object.entries(AI_CONFIG.PROVIDERS)) {
    if (!config.apiKey) {
      results[provider] = {
        success: false,
        error: 'API key not configured',
        duration: 0
      };
      continue;
    }

    const startTime = Date.now();
    try {
      const response = await sendAIRequest(
        'Hello, please respond with just "OK" to confirm connectivity.',
        provider,
        { maxTokens: 10, timeout: 5000 }
      );

      results[provider] = {
        success: response.success,
        error: response.error,
        duration: response.duration,
        model: response.model
      };
    } catch (error) {
      results[provider] = {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  return results;
}

module.exports = {
  sendAIRequest,
  getProviderStatus,
  testProviderConnectivity,
  cleanMarkdown,
  sleep,
  getRetryDelay
};