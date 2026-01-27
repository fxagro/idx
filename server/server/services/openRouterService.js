// server/services/openRouterService.js
const axios = require('axios');
const { pool } = require('../config/db');

// Enhanced logging utility
const logger = {
  info: (message, data = {}) => {
    console.log(`[${new Date().toISOString()}] ℹ️ ${message}`, data);
  },
  error: (message, error = {}) => {
    console.error(`[${new Date().toISOString()}] ❌ ${message}`, error);
  },
  warn: (message, data = {}) => {
    console.warn(`[${new Date().toISOString()}] ⚠️ ${message}`, data);
  },
  debug: (message, data = {}) => {
    console.log(`[${new Date().toISOString()}] 🔍 ${message}`, data);
  }
};

const openRouterClient = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Test function to verify API key and connectivity
const testOpenRouterConnection = async () => {
  try {
    logger.info('Testing OpenRouter API connection...');
    const response = await openRouterClient.get('/models');
    logger.info('OpenRouter API connection successful', {
      modelsCount: response.data.data?.length || 0
    });
    return true;
  } catch (error) {
    logger.error('OpenRouter API connection failed', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      error: error.message
    });
    return false;
  }
};

const analyzeStock = async (symbol, market, question, additionalData = {}) => {
  const startTime = Date.now();
  logger.info('Starting enhanced AI analysis', { symbol, market, question, hasAdditionalData: !!additionalData });

  // Validate API key
  if (!process.env.OPENROUTER_API_KEY) {
    logger.error('OpenRouter API key not configured');
    throw new Error('OpenRouter API key not configured');
  }

  try {
    // Use provided data or fetch from database
    let technicalData = additionalData.technical || [];
    let fundamentalData = additionalData.fundamental || [];
    let newsData = additionalData.news || [];

    // If no additional data provided, fetch from database
    if (!additionalData.technical || additionalData.technical.length === 0) {
      logger.debug('Fetching technical data from database', { symbol });
      const technicalQuery = await pool.query(
        'SELECT * FROM saham_data WHERE "Kode Saham" = $1 ORDER BY "Tanggal Perdagangan Terakhir" DESC LIMIT 60',
        [symbol]
      );
      technicalData = technicalQuery.rows;
      logger.debug('Technical data fetched', {
        symbol,
        recordCount: technicalData.length
      });
    }

    // If no fundamental data provided, fetch from database
    if (!additionalData.fundamental || additionalData.fundamental.length === 0) {
      try {
        logger.debug('Fetching fundamental data from database', { symbol });
        const fundamentalQuery = await pool.query(
          'SELECT eps, per, pbv, roe, dividend_yield FROM fundamental_data WHERE symbol = $1 ORDER BY report_date DESC LIMIT 5',
          [symbol]
        );
        fundamentalData = fundamentalQuery.rows;
        logger.debug('Fundamental data fetched successfully', {
          symbol,
          recordCount: fundamentalData.length
        });
      } catch (dbError) {
        logger.warn('Fundamental data fetch failed, using fallback', {
          symbol,
          error: dbError.message
        });
        fundamentalData = [{ eps: 0, per: 0, pbv: 0, roe: 0, dividend_yield: 0 }];
      }
    }

    // If no news data provided, try to fetch from database
    if (!additionalData.news || additionalData.news.length === 0) {
      try {
        logger.debug('Fetching news data from database', { symbol });
        const newsQuery = await pool.query(
          'SELECT title, description, url, published_at, source, sentiment_score FROM news_data WHERE LOWER(title) LIKE LOWER($1) OR LOWER(description) LIKE LOWER($1) ORDER BY published_at DESC LIMIT 5',
          [`%${symbol}%`]
        );
        newsData = newsQuery.rows.map(row => ({
          title: row.title,
          description: row.description,
          url: row.url,
          published_at: row.published_at,
          source: row.source,
          sentiment_score: parseFloat(row.sentiment_score) || 0
        }));
        logger.debug('News data fetched successfully', {
          symbol,
          recordCount: newsData.length
        });
      } catch (dbError) {
        logger.warn('News data fetch failed, using empty array', {
          symbol,
          error: dbError.message
        });
        newsData = [];
      }
    }

    const latestFundamental = fundamentalData[0] || { eps: 0, per: 0, pbv: 0, roe: 0, dividend_yield: 0 };

    // Calculate technical indicators
    const recentData = technicalData.slice(0, 20); // Last 20 days for better analysis
    const recentPrices = recentData.map(d => parseFloat(d['Penutupan'] || d.close || 0)).filter(p => p > 0);

    let trend = 'neutral';
    let recommendation = 'Hold';
    if (recentPrices.length >= 2) {
      const avgRecent = recentPrices.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
      const avgOlder = recentPrices.slice(10).reduce((a, b) => a + b, 0) / (recentPrices.length - 10);
      if (avgRecent > avgOlder * 1.02) {
        trend = 'bullish';
        recommendation = 'Buy';
      } else if (avgRecent < avgOlder * 0.98) {
        trend = 'bearish';
        recommendation = 'Sell';
      }
    }

    // Generate price prediction based on recent trend
    const latestPrice = recentPrices[0] || 1000;
    const volatility = recentPrices.length > 1 ?
      Math.abs(recentPrices[0] - recentPrices[1]) / recentPrices[1] : 0.02;
    const predictedChange = (Math.random() - 0.5) * volatility * 2;
    const predictedPrice = Math.round((latestPrice * (1 + predictedChange)) * 100) / 100;

    // Calculate news sentiment
    const avgSentiment = newsData.length > 0 ?
      newsData.reduce((sum, news) => sum + (news.sentiment_score || 0), 0) / newsData.length : 0;
    const newsSentiment = avgSentiment > 0.1 ? 'positive' : avgSentiment < -0.1 ? 'negative' : 'neutral';

    // Calculate fundamental trends
    let fundamentalTrend = 'neutral';
    if (fundamentalData.length > 1) {
      const latest = fundamentalData[0];
      const previous = fundamentalData[1];
      const epsChange = previous.eps ? ((latest.eps - previous.eps) / previous.eps * 100) : 0;
      const roeChange = previous.roe ? ((latest.roe - previous.roe) / previous.roe * 100) : 0;

      if (epsChange > 10 && roeChange > 5) fundamentalTrend = 'improving';
      else if (epsChange < -10 || roeChange < -5) fundamentalTrend = 'declining';
    }

    // Prepare comprehensive data for AI analysis
    const analysisPrompt = `Analyze the following comprehensive stock data for ${symbol} (${market.toUpperCase()}):

TECHNICAL DATA (Last 20 days):
- Latest Price: Rp ${recentPrices[0]?.toLocaleString() || 'N/A'}
- Trend: ${trend}
- Data Points: ${recentPrices.length}
- Average Volume: ${recentData.length > 0 ? Math.round(recentData.reduce((sum, d) => sum + parseInt(d.Volume || d.volume || 0), 0) / recentData.length) : 0}
- Price Range: Rp ${Math.min(...recentPrices).toLocaleString()} - Rp ${Math.max(...recentPrices).toLocaleString()}

FUNDAMENTAL DATA:
- EPS: ${latestFundamental.eps || 0}
- PER: ${latestFundamental.per || 0}
- PBV: ${latestFundamental.pbv || 0}
- ROE: ${latestFundamental.roe || 0}%
- Dividend Yield: ${latestFundamental.dividend_yield || 0}%
- Market Cap: ${latestFundamental.market_cap ? latestFundamental.market_cap.toLocaleString() : 'N/A'}
- Total Equity: ${latestFundamental.total_equity ? latestFundamental.total_equity.toLocaleString() : 'N/A'}
- Total Debt: ${latestFundamental.total_debt ? latestFundamental.total_debt.toLocaleString() : 'N/A'}
- Revenue: ${latestFundamental.revenue ? latestFundamental.revenue.toLocaleString() : 'N/A'}
- Net Profit: ${latestFundamental.net_profit ? latestFundamental.net_profit.toLocaleString() : 'N/A'}
- Fundamental Trend: ${fundamentalTrend}

NEWS DATA (${newsData.length} articles):
${newsData.slice(0, 3).map((news, i) => `
${i + 1}. ${news.title}
   - Sentiment: ${news.sentiment_score > 0.1 ? 'Positive' : news.sentiment_score < -0.1 ? 'Negative' : 'Neutral'} (${news.sentiment_score})
   - Source: ${news.source}
   - Date: ${news.published_at}
   - ${news.description?.substring(0, 100)}...
`).join('\n')}

Overall News Sentiment: ${newsSentiment}

User Question: ${question || 'Provide comprehensive stock analysis with investment recommendation'}

IMPORTANT: You must respond with ONLY valid JSON. No markdown, no code blocks, no explanations. Just pure JSON.

Required JSON format:
{
  "technical": "Detailed technical analysis in markdown format with charts and indicators",
  "fundamental": "Comprehensive fundamental analysis with ratios and trends",
  "news": "News sentiment analysis and key headlines impact",
  "sentiment": "positive/neutral/negative",
  "recommendation": "Buy/Hold/Sell",
  "price_prediction": "Expected price range or target with timeframe",
  "confidence": "high/medium/low",
  "risk_level": "low/medium/high",
  "key_factors": "Array of key factors influencing the stock",
  "investment_thesis": "Brief investment rationale"
}`;

    logger.info('Calling OpenRouter AI service', {
      symbol,
      market,
      promptLength: analysisPrompt.length
    });

    // Call OpenRouter API
    const response = await openRouterClient.post('/chat/completions', {
      model: 'openai/gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a JSON API that returns only valid JSON. Never include markdown, explanations, or code blocks. Always respond with pure JSON matching the exact format specified.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    });

    const aiResponse = response.data.choices[0].message.content;

    logger.info('OpenRouter AI response received', {
      symbol,
      responseLength: aiResponse.length,
      usage: response.data.usage
    });

    // Parse the JSON response from AI
    let analysisResult;
    try {
      analysisResult = JSON.parse(aiResponse);
      logger.debug('AI response parsed successfully', {
        symbol,
        hasTechnical: !!analysisResult.technical,
        hasFundamental: !!analysisResult.fundamental,
        sentiment: analysisResult.sentiment,
        recommendation: analysisResult.recommendation
      });
    } catch (parseError) {
      logger.error('Failed to parse AI response as JSON', {
        symbol,
        error: parseError.message,
        responseLength: aiResponse.length
      });
      logger.debug('Raw AI response', { symbol, response: aiResponse.substring(0, 500) });

      // Don't use fallback - throw error for proper error handling
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }

    const result = {
      technical: analysisResult.technical || 'Analysis not available',
      fundamental: fundamentalData,
      news: newsData,
      sentiment: analysisResult.sentiment || 'neutral',
      recommendation: analysisResult.recommendation || recommendation,
      price_prediction: analysisResult.price_prediction || `Expected range: Rp ${(predictedPrice * 0.98).toLocaleString()} - Rp ${(predictedPrice * 1.02).toLocaleString()}`,
      confidence: analysisResult.confidence || 'medium',
      risk_level: analysisResult.risk_level || 'medium',
      key_factors: analysisResult.key_factors || [],
      investment_thesis: analysisResult.investment_thesis || 'Analysis based on technical and fundamental data',
      data_points: recentPrices.length,
      ai_analysis: true,
      processing_time: Date.now() - startTime,
      data_summary: {
        technical_points: technicalData.length,
        fundamental_points: fundamentalData.length,
        news_articles: newsData.length,
        overall_sentiment: newsSentiment,
        fundamental_trend: fundamentalTrend
      }
    };

    logger.info('AI analysis completed successfully', {
      symbol,
      processingTime: result.processing_time,
      hasError: !!analysisResult.error
    });

    return result;

  } catch (error) {
    logger.error('Error in AI analysis', {
      symbol,
      error: error.message,
      stack: error.stack,
      processingTime: Date.now() - startTime,
      errorType: error.constructor.name
    });

    // Don't return mock data - throw the error so the client gets a proper error response
    throw new Error(`AI analysis failed: ${error.message}`);
  }
};

module.exports = { analyzeStock, testOpenRouterConnection };