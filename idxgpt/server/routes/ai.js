const express = require('express');
const router = express.Router();
const { analyzeStock } = require('../services/openRouterService');
const { sendAIRequest, getProviderStatus } = require('../services/aiService');
const authMiddleware = require('../middleware/auth');

// Middleware to check authentication
router.use(authMiddleware);

// POST /api/ai/openrouter - Handle AI analysis requests for AIPageV2
router.post('/openrouter', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    const { prompt, max_tokens = 1000, temperature = 0.3 } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: 'Prompt is required',
        timestamp: new Date().toISOString()
      });
    }

    // Estimate tokens (rough estimation: 1 token ≈ 4 characters)
    const estimatedTokens = Math.ceil(prompt.length / 4) + Math.ceil(max_tokens * 0.1);

    console.log(`[${requestId}] 🔄 AI request: ${prompt.substring(0, 50)}... (${estimatedTokens} estimated tokens)`);

    // Check and consume quota before processing AI request
    const userId = req.user.id;
    const { pool } = require('../db');

    // Fetch current quota
    const { rows } = await pool.query(
      'SELECT ai_usage, ai_limit FROM users WHERE id = $1',
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const user = rows[0];
    const currentUsage = user.ai_usage || 0;
    const limit = user.ai_limit || 1000;

    // Check if user would exceed quota
    if (currentUsage + estimatedTokens > limit) {
      const processingTime = Date.now() - startTime;
      console.log(`[${requestId}] ❌ Quota exceeded for user ${userId}: ${currentUsage} + ${estimatedTokens} > ${limit} (${processingTime}ms)`);
      return res.status(429).json({
        error: 'AI quota exceeded. Please upgrade your plan or wait for quota reset.',
        timestamp: new Date().toISOString(),
        quota: {
          used: currentUsage,
          limit: limit,
          remaining: 0,
          attempted: estimatedTokens
        }
      });
    }

    // Update quota in database (optimistic update)
    const newUsage = currentUsage + estimatedTokens;
    await pool.query(
      'UPDATE users SET ai_usage = $1 WHERE id = $2',
      [newUsage, userId]
    );

    console.log(`[${requestId}] ✅ Quota consumed: ${userId} (${currentUsage} → ${newUsage}/${limit})`);

    // Use the existing analyzeStock function with mock data for AIPageV2
    // Since AIPageV2 doesn't need specific stock analysis, we'll use a generic approach
    const mockSymbol = 'IDX';
    const mockMarket = 'idx';
    const mockQuestion = prompt;

    const result = await analyzeStock(mockSymbol, mockMarket, mockQuestion, {
      technical: [],
      fundamental: [],
      news: []
    });

    const processingTime = Date.now() - startTime;
    console.log(`[${requestId}] ✅ AI analysis completed in ${processingTime}ms`);

    res.json({
      result: result,
      timestamp: new Date().toISOString(),
      success: true,
      quota: {
        used: newUsage,
        limit: limit,
        remaining: Math.max(0, limit - newUsage)
      }
    });

  } catch (error) {
    console.error(`[${requestId}] AI analysis error:`, error);

    // Handle specific error types
    if (error.message.includes('quota exceeded')) {
      return res.status(429).json({
        error: 'AI quota exceeded. Please upgrade your plan or wait for quota reset.',
        timestamp: new Date().toISOString()
      });
    }

    if (error.message.includes('API key')) {
      return res.status(503).json({
        error: 'AI service temporarily unavailable',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Failed to process AI analysis',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/ai/query - Handle AI query requests
router.post('/query', async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    const { prompt, provider, options = {} } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[${requestId}] 🔄 AI query request: ${prompt.substring(0, 50)}...`);

    // Use the new sendAIRequest function
    const result = await sendAIRequest(prompt, provider, options);

    const processingTime = Date.now() - startTime;
    console.log(`[${requestId}] ✅ AI query completed in ${processingTime}ms`);

    // Return unified response format
    res.json({
      success: result.success,
      data: result.data,
      error: result.error,
      timestamp: new Date().toISOString(),
      requestId: result.requestId,
      provider: result.provider,
      duration: result.duration,
      ...(process.env.VITE_AI_DEBUG_MODE === 'true' && {
        debug: {
          tokensUsed: result.tokensUsed,
          model: result.model
        }
      })
    });

  } catch (error) {
    console.error(`[${requestId}] AI query error:`, error);

    const processingTime = Date.now() - startTime;
    res.status(500).json({
      success: false,
      error: 'Failed to process AI query',
      message: error.message,
      timestamp: new Date().toISOString(),
      requestId,
      duration: processingTime
    });
  }
});

// GET /api/ai/status - Get AI service status and provider information
router.get('/status', async (req, res) => {
  try {
    const providerStatus = getProviderStatus();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      ...providerStatus
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/ai/health - Check AI service health (legacy endpoint)
router.get('/health', async (req, res) => {
  try {
    const { testOpenRouterConnection } = require('../services/openRouterService');
    const isConnected = await testOpenRouterConnection();

    res.json({
      status: isConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      openrouter: isConnected
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;