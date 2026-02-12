const express = require("express");
const pg = require("pg");
const router = express.Router();
const aiService = require("../services/aiService");
const { analyzeStock } = require("../services/openRouterService");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const yfinance = require("yfinance");
const axios = require("axios");

// Middleware imports
const { authenticateToken: authMiddleware } = require("../middleware/authMiddleware");
const { validateAIQuota } = require("../middleware/authMiddleware");
const apiUsage = require("../middleware/apiUsage");

// Database configuration for stock data
const { getDatabaseConfig } = require("../config/database");
const stockDbConfig = getDatabaseConfig().stockDb;

// Create connection pool for stock database
const stockPool = new pg.Pool(stockDbConfig);

// OpenBB API Configuration
const OPENBB_BASE_URL = 'http://127.0.0.1:6900/api/v1';

// Create axios instance for OpenBB API
const openbbClient = axios.create({
  baseURL: OPENBB_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Redis client for caching
let redisClient = null;
try {
  const redis = require('redis');
  redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  });

  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  redisClient.connect().catch(err => {
    console.warn('Failed to connect to Redis, caching disabled:', err.message);
  });
} catch (error) {
  console.warn('Redis not available, caching disabled:', error.message);
}

// Cache helper functions
async function getCachedData(key) {
  if (!redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting cached data:', error);
    return null;
  }
}

async function setCachedData(key, data, ttl = 30) {
  if (!redisClient) return;
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Error setting cached data:', error);
  }
}

// OpenBB Service Class
class OpenBBService {

  /**
   * Get stock price data from OpenBB API
   * @param {string} symbol - Stock symbol
   * @returns {Object} Stock price data
   */
  static async getStockPrice(symbol) {
    const cacheKey = `openbb:price:${symbol}`;

    try {
      // Check cache first
      const cachedData = await getCachedData(cacheKey);
      if (cachedData) {
        console.log(`Returning cached price data for ${symbol}`);
        return cachedData;
      }

      console.log(`Fetching price data for ${symbol} from OpenBB API`);

      // Call OpenBB API with correct parameters
      const response = await openbbClient.get(`/equity/price/historical`, {
        params: {
          symbol: symbol,
          interval: '1d',
          start_date: '2025-09-09',
          end_date: '2025-10-09'
        }
      });

      if (!response.data || !response.data.results) {
        throw new Error('Invalid response from OpenBB API');
      }

      const results = response.data.results;

      if (results.length === 0) {
        throw new Error(`No price data found for symbol: ${symbol}`);
      }

      // Get latest price data
      const latest = results[results.length - 1];

      const priceData = {
        symbol: symbol,
        price: parseFloat(latest.c) || 0, // Close price
        change: parseFloat(latest.c) - parseFloat(latest.o) || 0, // Close - Open
        changePercent: latest.o ? ((latest.c - latest.o) / latest.o) * 100 : 0,
        volume: parseInt(latest.v) || 0,
        high: parseFloat(latest.h) || 0,
        low: parseFloat(latest.l) || 0,
        open: parseFloat(latest.o) || 0,
        date: latest.t ? new Date(latest.t).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        source: 'openbb'
      };

      // Cache the data for 30 seconds
      await setCachedData(cacheKey, priceData, 30);

      console.log(`Successfully fetched price data for ${symbol}: $${priceData.price}`);
      return priceData;

    } catch (error) {
      console.error(`Error fetching price data for ${symbol}:`, error.message);

      // Return mock data for testing
      console.log(`Returning mock price data for ${symbol} due to API error`);
      return this.getMockPriceData(symbol);
    }
  }

  /**
   * Get fundamentals data from OpenBB API
   * @param {string} symbol - Stock symbol
   * @returns {Object} Fundamental data
   */
  static async getFundamentals(symbol) {
    const cacheKey = `openbb:fundamentals:${symbol}`;

    try {
      // Check cache first
      const cachedData = await getCachedData(cacheKey);
      if (cachedData) {
        console.log(`Returning cached fundamentals data for ${symbol}`);
        return cachedData;
      }

      console.log(`Fetching fundamentals data for ${symbol} from OpenBB API`);

      // Call OpenBB API
      const response = await openbbClient.get(`/equity/fundamental/metrics`, {
        params: { symbol: symbol }
      });

      if (!response.data) {
        throw new Error('Invalid response from OpenBB API');
      }

      const data = response.data;

      const fundamentalsData = {
        symbol: symbol,
        pe: parseFloat(data.pe_ratio) || null,
        pb: parseFloat(data.pb_ratio) || null,
        roe: parseFloat(data.roe) || null,
        revenue: parseFloat(data.revenue) || null,
        netIncome: parseFloat(data.net_income) || null,
        marketCap: parseFloat(data.market_cap) || null,
        dividendYield: parseFloat(data.dividend_yield) || null,
        debtToEquity: parseFloat(data.debt_to_equity) || null,
        source: 'openbb'
      };

      // Cache the data for 5 minutes
      await setCachedData(cacheKey, fundamentalsData, 300);

      console.log(`Successfully fetched fundamentals data for ${symbol}`);
      return fundamentalsData;

    } catch (error) {
      console.error(`Error fetching fundamentals data for ${symbol}:`, error.message);

      // Return mock data for testing
      console.log(`Returning mock fundamentals data for ${symbol} due to API error`);
      return this.getMockFundamentalsData(symbol);
    }
  }

  /**
   * Get market overview data from OpenBB API
   * @returns {Object} Market overview data
   */
  static async getMarketOverview() {
    const cacheKey = 'openbb:market-overview';

    try {
      // Check cache first
      const cachedData = await getCachedData(cacheKey);
      if (cachedData) {
        console.log('Returning cached market overview data');
        return cachedData;
      }

      console.log('Fetching market overview data from OpenBB API');

      // Call OpenBB API for IHSG data
      const response = await openbbClient.get(`/index/price/historical`, {
        params: {
          symbol: 'IHSG',
          interval: '1d'
        }
      });

      if (!response.data || !response.data.results) {
        throw new Error('Invalid response from OpenBB API');
      }

      const results = response.data.results;

      if (results.length === 0) {
        throw new Error('No market data found');
      }

      // Get latest data
      const latest = results[results.length - 1];
      const previous = results.length > 1 ? results[results.length - 2] : latest;

      const change = latest.c - previous.c;
      const changePercent = previous.c ? (change / previous.c) * 100 : 0;

      // Mock additional data since OpenBB might not have all Indonesian market data
      const marketData = {
        totalStocks: 750,
        gainers: Math.floor(Math.random() * 300) + 200,
        losers: Math.floor(Math.random() * 200) + 100,
        totalVolume: latest.v || 15000000000,
        ihsgIndex: {
          value: parseFloat(latest.c) || 7200,
          change: change,
          changePercent: changePercent,
          volume: parseInt(latest.v) || 15000000000
        },
        source: 'openbb'
      };

      // Cache the data for 30 seconds
      await setCachedData(cacheKey, marketData, 30);

      console.log('Successfully fetched market overview data');
      return marketData;

    } catch (error) {
      console.error('Error fetching market overview data:', error.message);

      // Return mock data for testing
      console.log('Returning mock market overview data due to API error');
      return this.getMockMarketOverviewData();
    }
  }

  /**
   * Get chart data from OpenBB API
   * @param {string} symbol - Stock symbol
   * @param {number} days - Number of days (default: 30)
   * @returns {Object} Chart data
   */
  static async getChartData(symbol, days = 30) {
    const cacheKey = `openbb:chart:${symbol}:${days}`;

    try {
      // Check cache first
      const cachedData = await getCachedData(cacheKey);
      if (cachedData) {
        console.log(`Returning cached chart data for ${symbol} (${days} days)`);
        return cachedData;
      }

      console.log(`Fetching chart data for ${symbol} (${days} days) from OpenBB API`);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Call OpenBB API
      const response = await openbbClient.get(`/equity/price/historical`, {
        params: {
          symbol: symbol,
          interval: '1d',
          start_date: startDateStr,
          end_date: endDateStr
        }
      });

      if (!response.data || !response.data.results) {
        throw new Error('Invalid response from OpenBB API');
      }

      const results = response.data.results;

      if (results.length === 0) {
        throw new Error(`No chart data found for symbol: ${symbol}`);
      }

      // Format data for Chart.js
      const chartData = {
        symbol: symbol,
        period: `${days}d`,
        data: results.map(item => ({
          date: new Date(item.t).toISOString().split('T')[0],
          open: parseFloat(item.o) || 0,
          high: parseFloat(item.h) || 0,
          low: parseFloat(item.l) || 0,
          close: parseFloat(item.c) || 0,
          volume: parseInt(item.v) || 0
        })),
        source: 'openbb'
      };

      // Cache the data for 5 minutes
      await setCachedData(cacheKey, chartData, 300);

      console.log(`Successfully fetched chart data for ${symbol}: ${chartData.data.length} data points`);
      return chartData;

    } catch (error) {
      console.error(`Error fetching chart data for ${symbol}:`, error.message);

      // Return mock data for testing
      console.log(`Returning mock chart data for ${symbol} due to API error`);
      return this.getMockChartData(symbol, days);
    }
  }

  /**
   * Get news data from OpenBB API
   * @param {string} symbol - Stock symbol
   * @param {number} limit - Number of articles (default: 5)
   * @returns {Object} News data
   */
  static async getNews(symbol, limit = 5) {
    const cacheKey = `openbb:news:${symbol}:${limit}`;

    try {
      // Check cache first
      const cachedData = await getCachedData(cacheKey);
      if (cachedData) {
        console.log(`Returning cached news data for ${symbol}`);
        return cachedData;
      }

      console.log(`Fetching news data for ${symbol} from OpenBB API`);

      // Call OpenBB API
      const response = await openbbClient.get(`/news/search`, {
        params: {
          symbol: symbol,
          limit: limit
        }
      });

      if (!response.data) {
        throw new Error('Invalid response from OpenBB API');
      }

      const articles = (response.data.articles || response.data.results || []).slice(0, limit).map(article => ({
        title: article.title || 'No Title',
        summary: article.description || article.summary || '',
        url: article.url || '',
        source: article.source || 'Unknown',
        publishedAt: article.published_at || article.publishedAt || new Date().toISOString(),
        sentiment: article.sentiment || 'neutral'
      }));

      const newsData = {
        symbol: symbol,
        articles: articles,
        totalArticles: articles.length,
        source: 'openbb'
      };

      // Cache the data for 10 minutes
      await setCachedData(cacheKey, newsData, 600);

      console.log(`Successfully fetched news data for ${symbol}: ${articles.length} articles`);
      return newsData;

    } catch (error) {
      console.error(`Error fetching news data for ${symbol}:`, error.message);

      // Return mock data for testing
      console.log(`Returning mock news data for ${symbol} due to API error`);
      return this.getMockNewsData(symbol, limit);
    }
  }

  /**
   * Get mock price data for testing
   * @param {string} symbol - Stock symbol
   * @returns {Object} Mock price data
   */
  static getMockPriceData(symbol) {
    const basePrice = symbol === 'BBCA' ? 8500 :
                     symbol === 'TLKM' ? 3800 :
                     symbol === 'ASII' ? 5200 :
                     symbol === 'AAPL' ? 150 : 1000;

    return {
      symbol: symbol,
      price: basePrice,
      change: (Math.random() - 0.5) * 200,
      changePercent: (Math.random() - 0.5) * 10,
      volume: Math.floor(1000000 + Math.random() * 10000000),
      source: 'mock'
    };
  }

  /**
   * Get mock fundamentals data for testing
   * @param {string} symbol - Stock symbol
   * @returns {Object} Mock fundamentals data
   */
  static getMockFundamentalsData(symbol) {
    return {
      symbol: symbol,
      pe: 15 + Math.random() * 20,
      pb: 1 + Math.random() * 3,
      roe: 8 + Math.random() * 15,
      revenue: 1000000000 + Math.random() * 5000000000,
      netIncome: 100000000 + Math.random() * 1000000000,
      marketCap: 5000000000 + Math.random() * 20000000000,
      dividendYield: Math.random() * 5,
      debtToEquity: 0.2 + Math.random() * 0.8,
      source: 'mock'
    };
  }

  /**
   * Get mock market overview data for testing
   * @returns {Object} Mock market overview data
   */
  static getMockMarketOverviewData() {
    return {
      totalStocks: 750,
      gainers: 245,
      losers: 187,
      totalVolume: 15250000000,
      ihsgIndex: {
        value: 7150 + Math.random() * 100,
        change: -25 + Math.random() * 50,
        changePercent: -1 + Math.random() * 2,
        volume: 15000000000
      },
      source: 'mock'
    };
  }

  /**
   * Get mock chart data for testing
   * @param {string} symbol - Stock symbol
   * @param {number} days - Number of days
   * @returns {Object} Mock chart data
   */
  static getMockChartData(symbol, days) {
    const data = [];
    const basePrice = symbol === 'BBCA' ? 8500 :
                     symbol === 'TLKM' ? 3800 :
                     symbol === 'ASII' ? 5200 :
                     symbol === 'AAPL' ? 150 : 1000;

    for (let i = 0; i < days; i++) {
      const priceVariation = (Math.random() - 0.5) * 0.02;
      const dayPrice = basePrice * (1 + priceVariation * i / days);

      data.push({
        date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        open: Math.round(dayPrice * 0.98 * 100) / 100,
        high: Math.round(dayPrice * 1.03 * 100) / 100,
        low: Math.round(dayPrice * 0.97 * 100) / 100,
        close: Math.round(dayPrice * 100) / 100,
        volume: Math.floor(1000000 + Math.random() * 10000000)
      });
    }

    return {
      symbol: symbol,
      period: `${days}d`,
      data: data,
      source: 'mock'
    };
  }

  /**
   * Get mock news data for testing
   * @param {string} symbol - Stock symbol
   * @param {number} limit - Number of articles
   * @returns {Object} Mock news data
   */
  static getMockNewsData(symbol, limit) {
    const mockArticles = [
      {
        title: `${symbol} Reports Strong Quarterly Earnings`,
        summary: `Positive earnings report drives ${symbol} stock higher in after-hours trading.`,
        url: `https://example.com/news/${symbol}-earnings`,
        source: 'Financial News',
        publishedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        sentiment: 'positive'
      },
      {
        title: `Market Analysis: ${symbol} Technical Indicators`,
        summary: `Technical analysis suggests ${symbol} may face resistance at current levels.`,
        url: `https://example.com/analysis/${symbol}-technical`,
        source: 'Trading View',
        publishedAt: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString(),
        sentiment: 'neutral'
      },
      {
        title: `${symbol} Faces Regulatory Challenges`,
        summary: `Recent regulatory developments may impact ${symbol}'s future performance.`,
        url: `https://example.com/news/${symbol}-regulatory`,
        source: 'Market Watch',
        publishedAt: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(),
        sentiment: 'negative'
      }
    ];

    return {
      symbol: symbol,
      articles: mockArticles.slice(0, limit),
      totalArticles: limit,
      source: 'mock'
    };
  }
}

// GET /api/stocks/price/:symbol - Get current and historical prices
router.get("/price/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const { market = 'idx', days = 30 } = req.query;

  const originalSymbol = symbol.toUpperCase();
  console.log(`🔍 Searching for stock: ${originalSymbol} in market: ${market}`);

  try {
    const client = await stockPool.connect();

    // Try multiple variations of the symbol
    const symbolVariations = [
      originalSymbol,                    // BBCA
      `${originalSymbol}.JK`,           // BBCA.JK
      originalSymbol.replace('.JK', '') // Remove .JK if present
    ];

    let result = null;
    let foundSymbol = null;

    for (const searchSymbol of symbolVariations) {
      console.log(`🔍 Trying symbol variation: ${searchSymbol}`);

      const query = `
        SELECT "Tanggal Perdagangan Terakhir" as date,
               "Penutupan" as close,
               "Tertinggi" as high,
               "Terendah" as low,
               "Open Price" as open,
               "Volume" as volume,
               "Kode Saham" as actual_symbol
        FROM saham_data
        WHERE "Kode Saham" = $1
        ORDER BY "Tanggal Perdagangan Terakhir" DESC
        LIMIT $2
      `;

      result = await client.query(query, [searchSymbol, parseInt(days)]);

      if (result.rows.length > 0) {
        foundSymbol = searchSymbol;
        console.log(`✅ Found data for ${foundSymbol}: ${result.rows.length} records`);
        break;
      }
    }

    client.release();

    // If no data found in database, return simulated data for popular stocks
    if (!result || result.rows.length === 0) {
      console.log(`❌ No data found in database for ${originalSymbol}, generating simulated data`);

      const simulatedData = generateSimulatedStockData(originalSymbol, parseInt(days));
      return res.json(simulatedData);
    }

    // Process real data from database
    const prices = result.rows.reverse();

    // Apply fallback logic for missing close prices and zero open prices
    let fallbackCount = 0;
    let openFallbackCount = 0;

    for (let i = 0; i < prices.length; i++) {
      const current = prices[i];

      // Fallback logic for missing close price
      if (!current.close || current.close === null || current.close === 0) {
        fallbackCount++;
        if (i > 0) {
          // Use previous close price as fallback
          current.close = prices[i - 1].close;
          console.log(`📊 Applied close fallback for ${foundSymbol} on ${current.date}: used previous close ${current.close}`);
        } else {
          // For first record, use average of high and low
          current.close = (parseFloat(current.high) + parseFloat(current.low)) / 2;
          console.log(`📊 Applied close fallback for ${foundSymbol} on ${current.date}: used average of high/low ${(current.close).toFixed(2)}`);
        }
      }

      // Fallback logic for zero or missing open price
      if (!current.open || current.open === 0) {
        openFallbackCount++;
        if (i > 0) {
          // Use previous close price as open price
          current.open = prices[i - 1].close;
          console.log(`📊 Applied open fallback for ${foundSymbol} on ${current.date}: used previous close ${current.open}`);
        } else {
          // For first record, use close price as open price
          current.open = current.close;
          console.log(`📊 Applied open fallback for ${foundSymbol} on ${current.date}: used close price ${current.open}`);
        }
      }

      // Ensure all OHLC values are valid numbers
      current.open = parseFloat(current.open) || current.close;
      current.high = parseFloat(current.high) || current.close;
      current.low = parseFloat(current.low) || current.close;
      current.close = parseFloat(current.close);
      current.volume = parseInt(current.volume) || 0;
    }

    // Calculate technical indicators with fallback data
    for (let i = 0; i < prices.length; i++) {
      prices[i].sma20 = calculateSMA(prices.slice(0, i + 1).map(p => p.close), 20);
      prices[i].rsi14 = calculateRSI(prices.slice(0, i + 1).map(p => p.close), 14);
    }

    console.log(`📊 Applied ${fallbackCount} close fallback(s) and ${openFallbackCount} open fallback(s) for ${foundSymbol}`);

    const currentPrice = prices[prices.length - 1];

    res.json({
      symbol: foundSymbol,
      market: market.toUpperCase(),
      current: {
        price: parseFloat(currentPrice.close) || 0,
        date: currentPrice.date,
        volume: parseInt(currentPrice.volume) || 0,
        high: parseFloat(currentPrice.high) || currentPrice.open || 0,
        low: parseFloat(currentPrice.low) || currentPrice.open || 0,
        open: parseFloat(currentPrice.open) || 0,
        sma20: currentPrice.sma20,
        rsi14: currentPrice.rsi14
      },
      history: prices.map(price => ({
        date: price.date,
        open: parseFloat(price.open) || 0,
        high: parseFloat(price.high) || price.open || 0,
        low: parseFloat(price.low) || price.open || 0,
        close: parseFloat(price.close) || 0,
        volume: parseInt(price.volume) || 0,
        sma20: price.sma20,
        rsi14: price.rsi14
      }))
    });

  } catch (error) {
    console.error("Error fetching stock price:", error);

    // Fallback to simulated data on database error
    console.log(`⚠️ Database error for ${originalSymbol}, generating simulated data`);
    const simulatedData = generateSimulatedStockData(originalSymbol, parseInt(days));
    return res.json(simulatedData);
  }
});

// ===== OPENBB API ROUTES =====

// GET /api/stocks/openbb/stocks - Get list of stocks for data explorer
router.get("/openbb/stocks", authMiddleware, async (req, res) => {
  console.log('🚀 Route hit: /openbb/stocks');

  try {
    // Return a curated list of popular stocks for the data explorer
    const stocksData = [
      {
        symbol: 'BBCA',
        name: 'Bank Central Asia Tbk.',
        price: 8500,
        changePercent: 1.23,
        volume: 12500000,
        sector: 'Financial Services',
        market: 'IDX'
      },
      {
        symbol: 'TLKM',
        name: 'Telkom Indonesia Tbk.',
        price: 3800,
        changePercent: -0.87,
        volume: 8900000,
        sector: 'Telecommunications',
        market: 'IDX'
      },
      {
        symbol: 'ASII',
        name: 'Astra International Tbk.',
        price: 5200,
        changePercent: 2.45,
        volume: 15600000,
        sector: 'Consumer Cyclical',
        market: 'IDX'
      },
      {
        symbol: 'BMRI',
        name: 'Bank Mandiri Tbk.',
        price: 6200,
        changePercent: 0.67,
        volume: 9800000,
        sector: 'Financial Services',
        market: 'IDX'
      },
      {
        symbol: 'BBNI',
        name: 'Bank Negara Indonesia Tbk.',
        price: 5800,
        changePercent: -1.23,
        volume: 11200000,
        sector: 'Financial Services',
        market: 'IDX'
      },
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 175.50,
        changePercent: 2.34,
        volume: 45670000,
        sector: 'Technology',
        market: 'NASDAQ'
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        price: 335.67,
        changePercent: -0.89,
        volume: 23450000,
        sector: 'Technology',
        market: 'NASDAQ'
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        price: 138.42,
        changePercent: 1.56,
        volume: 18900000,
        sector: 'Technology',
        market: 'NASDAQ'
      },
      {
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        price: 245.89,
        changePercent: -3.45,
        volume: 67890000,
        sector: 'Consumer Cyclical',
        market: 'NASDAQ'
      },
      {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        price: 485.23,
        changePercent: 4.56,
        volume: 34560000,
        sector: 'Technology',
        market: 'NASDAQ'
      }
    ];

    res.json({ success: true, data: stocksData });
  } catch (error) {
    console.error('❌ Stocks list error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/stocks/openbb/price/:symbol - Get stock price from OpenBB API
router.get("/openbb/price/:symbol", authMiddleware, async (req, res) => {
  const { symbol } = req.params;

  console.log('🚀 Route hit: /openbb/price/' + symbol);

  if (!symbol) {
    return res.status(400).json({ error: "Symbol is required" });
  }

  try {
    const data = await OpenBBService.getStockPrice(symbol.toUpperCase());
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ OpenBB route error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/stocks/openbb/fundamentals/:symbol - Get fundamentals data from OpenBB API
router.get("/openbb/fundamentals/:symbol", authMiddleware, async (req, res) => {
  const { symbol } = req.params;

  console.log('🚀 Route hit: /openbb/fundamentals/' + symbol);

  if (!symbol) {
    return res.status(400).json({ error: "Symbol is required" });
  }

  try {
    const data = await OpenBBService.getFundamentals(symbol.toUpperCase());
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ OpenBB route error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/stocks/openbb/market - Get market overview from OpenBB API
router.get("/openbb/market", authMiddleware, async (req, res) => {
  console.log('🚀 Route hit: /openbb/market');

  try {
    const data = await OpenBBService.getMarketOverview();
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ OpenBB route error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/stocks/market-overview - Alias for backward compatibility
router.get("/market-overview", authMiddleware, async (req, res) => {
  console.log('🚀 Route hit: /market-overview');

  try {
    const data = await OpenBBService.getMarketOverview();
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Market overview route error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/stocks/openbb/chart/:symbol - Get chart data from OpenBB API
router.get("/openbb/chart/:symbol", authMiddleware, async (req, res) => {
  const { symbol } = req.params;
  const days = parseInt(req.query.days || 30);

  console.log('🚀 Route hit: /openbb/chart/' + symbol + '?days=' + days);

  if (!symbol) {
    return res.status(400).json({ error: "Symbol is required" });
  }

  try {
    const data = await OpenBBService.getChartData(symbol.toUpperCase(), days);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ OpenBB route error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/stocks/openbb/news/:symbol - Get news data from OpenBB API
router.get("/openbb/news/:symbol", authMiddleware, async (req, res) => {
  const { symbol } = req.params;
  const limit = parseInt(req.query.limit || 5);

  console.log('🚀 Route hit: /openbb/news/' + symbol + '?limit=' + limit);

  if (!symbol) {
    return res.status(400).json({ error: "Symbol is required" });
  }

  try {
    const data = await OpenBBService.getNews(symbol.toUpperCase(), limit);
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ OpenBB route error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ===== ADDITIONAL DATA EXPLORER ENDPOINTS =====

// GET /api/stocks/openbb/etf - Get ETF data (mock for now)
router.get("/openbb/etf", authMiddleware, async (req, res) => {
  console.log('🚀 Route hit: /openbb/etf');

  try {
    // Mock ETF data for demonstration
    const mockETFData = [
      {
        symbol: 'QQQ',
        name: 'Invesco QQQ Trust',
        price: 385.42,
        changePercent: 1.23,
        volume: 45230000,
        expenseRatio: 0.20,
        assets: 245000000000,
        category: 'Technology'
      },
      {
        symbol: 'SPY',
        name: 'SPDR S&P 500 ETF Trust',
        price: 445.67,
        changePercent: 0.87,
        volume: 67890000,
        expenseRatio: 0.09,
        assets: 450000000000,
        category: 'Large Cap'
      },
      {
        symbol: 'VTI',
        name: 'Vanguard Total Stock Market ETF',
        price: 235.89,
        changePercent: -0.45,
        volume: 2340000,
        expenseRatio: 0.03,
        assets: 320000000000,
        category: 'Large Cap'
      },
      {
        symbol: 'VEA',
        name: 'Vanguard FTSE Developed Markets ETF',
        price: 45.23,
        changePercent: 0.67,
        volume: 8900000,
        expenseRatio: 0.05,
        assets: 120000000000,
        category: 'International'
      },
      {
        symbol: 'VWO',
        name: 'Vanguard FTSE Emerging Markets ETF',
        price: 38.76,
        changePercent: -1.23,
        volume: 12300000,
        expenseRatio: 0.08,
        assets: 85000000000,
        category: 'Emerging Markets'
      }
    ];

    res.json({ success: true, data: mockETFData });
  } catch (error) {
    console.error('❌ ETF data error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/stocks/openbb/crypto - Get cryptocurrency data (mock for now)
router.get("/openbb/crypto", authMiddleware, async (req, res) => {
  console.log('🚀 Route hit: /openbb/crypto');

  try {
    // Mock crypto data for demonstration
    const mockCryptoData = [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        price: 43250.67,
        changePercent: 2.45,
        volume: 23400000000,
        marketCap: 850000000000,
        rank: 1
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        price: 2650.89,
        changePercent: -1.23,
        volume: 12300000000,
        marketCap: 320000000000,
        rank: 2
      },
      {
        symbol: 'BNB',
        name: 'Binance Coin',
        price: 245.67,
        changePercent: 0.89,
        volume: 1800000000,
        marketCap: 38000000000,
        rank: 3
      },
      {
        symbol: 'ADA',
        name: 'Cardano',
        price: 0.3456,
        changePercent: -2.34,
        volume: 890000000,
        marketCap: 12000000000,
        rank: 8
      },
      {
        symbol: 'SOL',
        name: 'Solana',
        price: 98.76,
        changePercent: 3.45,
        volume: 2100000000,
        marketCap: 45000000000,
        rank: 5
      }
    ];

    res.json({ success: true, data: mockCryptoData });
  } catch (error) {
    console.error('❌ Crypto data error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/stocks/openbb/forex - Get forex data (mock for now)
router.get("/openbb/forex", authMiddleware, async (req, res) => {
  console.log('🚀 Route hit: /openbb/forex');

  try {
    // Mock forex data for demonstration
    const mockForexData = [
      {
        symbol: 'EUR/USD',
        name: 'Euro / US Dollar',
        rate: 1.0876,
        changePercent: 0.23,
        bid: 1.0874,
        ask: 1.0878,
        volume: 125000000000
      },
      {
        symbol: 'GBP/USD',
        name: 'British Pound / US Dollar',
        rate: 1.2654,
        changePercent: -0.45,
        bid: 1.2652,
        ask: 1.2656,
        volume: 89000000000
      },
      {
        symbol: 'USD/JPY',
        name: 'US Dollar / Japanese Yen',
        rate: 149.23,
        changePercent: 0.67,
        bid: 149.21,
        ask: 149.25,
        volume: 145000000000
      },
      {
        symbol: 'USD/CHF',
        name: 'US Dollar / Swiss Franc',
        rate: 0.8765,
        changePercent: -0.12,
        bid: 0.8763,
        ask: 0.8767,
        volume: 45000000000
      },
      {
        symbol: 'AUD/USD',
        name: 'Australian Dollar / US Dollar',
        rate: 0.6543,
        changePercent: 0.89,
        bid: 0.6541,
        ask: 0.6545,
        volume: 67000000000
      }
    ];

    res.json({ success: true, data: mockForexData });
  } catch (error) {
    console.error('❌ Forex data error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/stocks/openbb/commodities - Get commodities data (mock for now)
router.get("/openbb/commodities", authMiddleware, async (req, res) => {
  console.log('🚀 Route hit: /openbb/commodities');

  try {
    // Mock commodities data for demonstration
    const mockCommoditiesData = [
      {
        symbol: 'GC',
        name: 'Gold',
        price: 1987.65,
        changePercent: 1.23,
        volume: 234000,
        unit: 'oz',
        category: 'Precious Metals'
      },
      {
        symbol: 'SI',
        name: 'Silver',
        price: 23.45,
        changePercent: -0.67,
        volume: 89000,
        unit: 'oz',
        category: 'Precious Metals'
      },
      {
        symbol: 'CL',
        name: 'Crude Oil WTI',
        price: 78.92,
        changePercent: -1.45,
        volume: 345000,
        unit: 'barrel',
        category: 'Energy'
      },
      {
        symbol: 'NG',
        name: 'Natural Gas',
        price: 2.34,
        changePercent: 2.89,
        volume: 156000,
        unit: 'MMBtu',
        category: 'Energy'
      },
      {
        symbol: 'HG',
        name: 'Copper',
        price: 3.67,
        changePercent: 0.45,
        volume: 123000,
        unit: 'lb',
        category: 'Industrial Metals'
      }
    ];

    res.json({ success: true, data: mockCommoditiesData });
  } catch (error) {
    console.error('❌ Commodities data error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/stocks/openbb/economy - Get economic indicators (mock for now)
router.get("/openbb/economy", authMiddleware, async (req, res) => {
  console.log('🚀 Route hit: /openbb/economy');

  try {
    // Mock economic data for demonstration
    const mockEconomyData = [
      {
        symbol: 'GDP',
        name: 'Gross Domestic Product',
        value: 26.85,
        changePercent: 2.1,
        unit: 'Trillion USD',
        frequency: 'Quarterly'
      },
      {
        symbol: 'CPI',
        name: 'Consumer Price Index',
        value: 306.27,
        changePercent: 3.2,
        unit: 'Index',
        frequency: 'Monthly'
      },
      {
        symbol: 'UNRATE',
        name: 'Unemployment Rate',
        value: 3.8,
        changePercent: -0.2,
        unit: 'Percent',
        frequency: 'Monthly'
      },
      {
        symbol: 'FEDFUNDS',
        name: 'Federal Funds Rate',
        value: 5.25,
        changePercent: 0.0,
        unit: 'Percent',
        frequency: 'Monthly'
      },
      {
        symbol: 'DGS10',
        name: '10-Year Treasury Rate',
        value: 4.25,
        changePercent: 0.15,
        unit: 'Percent',
        frequency: 'Daily'
      }
    ];

    res.json({ success: true, data: mockEconomyData });
  } catch (error) {
    console.error('❌ Economy data error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/portfolio - Get portfolio data (mock for now)
router.get("/portfolio", authMiddleware, async (req, res) => {
  console.log('🚀 Route hit: /portfolio');

  try {
    // Mock portfolio data for demonstration
    const mockPortfolioData = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        shares: 100,
        value: 17500.00,
        changePercent: 2.34,
        weight: 25.5,
        sector: 'Technology'
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        shares: 50,
        value: 16800.00,
        changePercent: -1.23,
        weight: 24.5,
        sector: 'Technology'
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        shares: 25,
        value: 3450.00,
        changePercent: 0.89,
        weight: 5.0,
        sector: 'Technology'
      },
      {
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        shares: 75,
        value: 18750.00,
        changePercent: -3.45,
        weight: 27.3,
        sector: 'Consumer Discretionary'
      },
      {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        shares: 30,
        value: 12150.00,
        changePercent: 4.56,
        weight: 17.7,
        sector: 'Technology'
      }
    ];

    res.json({ success: true, data: mockPortfolioData });
  } catch (error) {
    console.error('❌ Portfolio data error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/stocks/openbb/forecast/:symbol - Get ML volatility forecast with quota management
router.get("/openbb/forecast/:symbol", authMiddleware, async (req, res) => {
  const startTime = Date.now();
  const requestId = req.quotaInfo.requestId;
  const { symbol } = req.params;
  const days = parseInt(req.query.days || 7);
  const userId = req.user.id;
  const { currentUsage, limit, estimatedTokens } = req.quotaInfo;

  console.log(`[${requestId}] 🚀 ML forecast request: ${symbol} (${days} days, ${estimatedTokens} tokens)`);

  if (!symbol) {
    return res.status(400).json({
      error: "Symbol is required",
      timestamp: new Date().toISOString()
    });
  }

  let newUsage = currentUsage;

  try {
    // Log quota consumption attempt
    await stockPool.query(
      'INSERT INTO ai_quota_audit (user_id, action, tokens_used, current_usage, quota_limit, success, request_id, operation_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [userId, 'quota_consumption_attempt', estimatedTokens, currentUsage, limit, true, requestId, 'ml_forecast']
    );

    // Update quota in database (optimistic)
    newUsage = currentUsage + estimatedTokens;
    await stockPool.query(
      'UPDATE users SET ai_usage = $1 WHERE id = $2',
      [newUsage, userId]
    );

    console.log(`[${requestId}] ✅ Quota consumed: ${userId} (${currentUsage} → ${newUsage}/${limit})`);

    // Get forecast from ML service
    const MLForecastService = require('../services/mlForecastService');
    const data = await MLForecastService.getForecast(symbol.toUpperCase(), days);

    const processingTime = Date.now() - startTime;
    console.log(`[${requestId}] ✅ ML forecast completed in ${processingTime}ms`);

    // Log successful operation
    await stockPool.query(
      'INSERT INTO ai_quota_audit (user_id, action, tokens_used, current_usage, quota_limit, success, request_id, operation_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [userId, 'ml_forecast_success', estimatedTokens, newUsage, limit, true, requestId, 'ml_forecast']
    );

    res.json({
      success: true,
      data,
      quota: {
        used: newUsage,
        limit: limit,
        remaining: Math.max(0, limit - newUsage)
      },
      requestId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[${requestId}] ❌ ML forecast error (${processingTime}ms):`, error);

    // Rollback quota on failure
    try {
      await stockPool.query(
        'UPDATE users SET ai_usage = $1 WHERE id = $2',
        [currentUsage, userId] // Rollback to original usage
      );

      // Log rollback
      await stockPool.query(
        'INSERT INTO ai_quota_audit (user_id, action, tokens_used, current_usage, quota_limit, success, request_id, operation_type, error_message) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [userId, 'quota_rollback', estimatedTokens, currentUsage, limit, false, requestId, 'ml_forecast', error.message]
      );

      console.log(`[${requestId}] 🔄 Quota rolled back: ${userId} (${newUsage} → ${currentUsage}/${limit})`);
    } catch (rollbackError) {
      console.error(`[${requestId}] 💥 Rollback failed:`, rollbackError);
    }

    // Log the original error
    await stockPool.query(
      'INSERT INTO ai_quota_audit (user_id, action, tokens_used, current_usage, quota_limit, success, request_id, operation_type, error_message) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [userId, 'ml_forecast_failed', estimatedTokens, currentUsage, limit, false, requestId, 'ml_forecast', error.message]
    );

    res.status(500).json({
      error: 'Forecast generation failed',
      message: error.message,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/health/openbb - Test OpenBB connectivity
router.get("/health/openbb", async (req, res) => {
  try {
    console.log('🔍 Testing OpenBB connectivity...');

    const response = await openbbClient.get('/', { timeout: 5000 });

    if (response.status === 200) {
      res.json({
        ok: true,
        message: 'OpenBB API is reachable',
        baseURL: OPENBB_BASE_URL,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        ok: false,
        message: 'OpenBB API responded with non-200 status',
        status: response.status,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ OpenBB connectivity test failed:', error.message);
    res.json({
      ok: false,
      error: 'OpenBB API is not reachable',
      message: error.message,
      baseURL: OPENBB_BASE_URL,
      timestamp: new Date().toISOString()
    });
  }
});

// Generate simulated stock data as fallback
function generateSimulatedStockData(symbol, days) {
  const basePrice = 1000 + Math.random() * 4000; // Random base price 1000-5000
  const history = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - 1 - i));

    const priceVariation = (Math.random() - 0.5) * 0.02; // ±1% daily variation
    const dayPrice = basePrice * (1 + priceVariation * i / days);
    const volume = Math.floor(1000000 + Math.random() * 10000000); // 1M-11M volume

    history.push({
      date: date.toISOString().split('T')[0],
      open: Math.round(dayPrice * 0.98 * 100) / 100,
      high: Math.round(dayPrice * 1.03 * 100) / 100,
      low: Math.round(dayPrice * 0.97 * 100) / 100,
      close: Math.round(dayPrice * 100) / 100,
      volume: volume
    });
  }

  // Calculate technical indicators for simulated data
  for (let i = 0; i < history.length; i++) {
    history[i].sma20 = calculateSMA(history.slice(0, i + 1).map(h => h.close), 20);
    history[i].rsi14 = calculateRSI(history.slice(0, i + 1).map(h => h.close), 14);
  }

  const currentPrice = history[history.length - 1];

  console.log(`📊 Generated ${history.length} simulated data points for ${symbol}`);

  return {
    symbol: symbol,
    market: 'IDX',
    current: {
      price: currentPrice.close,
      date: currentPrice.date,
      volume: currentPrice.volume,
      high: currentPrice.high,
      low: currentPrice.low,
      open: currentPrice.open,
      sma20: currentPrice.sma20,
      rsi14: currentPrice.rsi14
    },
    history: history
  };
}

// Generate mock fundamental data for testing
function generateMockFundamentalData(symbol) {
  const symbolUpper = symbol.toUpperCase();
  
  // Base values for popular stocks
  const baseValues = {
    'BBCA': { eps: 850, per: 18.5, pbv: 3.2, roe: 18.5, dividendYield: 2.8 },
    'TLKM': { eps: 380, per: 15.2, pbv: 2.1, roe: 14.2, dividendYield: 4.5 },
    'ASII': { eps: 520, per: 12.8, pbv: 1.8, roe: 16.5, dividendYield: 3.2 },
    'BMRI': { eps: 620, per: 14.5, pbv: 2.4, roe: 15.8, dividendYield: 3.8 },
    'BBNI': { eps: 580, per: 13.2, pbv: 2.2, roe: 17.2, dividendYield: 4.1 },
    'AAPL': { eps: 6.11, per: 28.5, pbv: 45.2, roe: 147.5, dividendYield: 0.5 },
    'MSFT': { eps: 10.25, per: 32.8, pbv: 12.1, roe: 38.5, dividendYield: 0.8 },
    'GOOGL': { eps: 5.52, per: 25.1, pbv: 6.2, roe: 25.8, dividendYield: 0.0 },
    'AMZN': { eps: 3.15, per: 62.5, pbv: 8.5, roe: 14.2, dividendYield: 0.0 },
    'TSLA': { eps: 4.05, per: 75.2, pbv: 12.5, roe: 22.5, dividendYield: 0.0 },
    'NVDA': { eps: 18.45, per: 65.2, pbv: 42.5, roe: 122.5, dividendYield: 0.0 }
  };
  
  const base = baseValues[symbolUpper] || {
    eps: 100 + Math.random() * 500,
    per: 10 + Math.random() * 20,
    pbv: 1 + Math.random() * 3,
    roe: 10 + Math.random() * 15,
    dividendYield: Math.random() * 5
  };
  
  return {
    symbol: symbolUpper,
    market: symbolUpper.length <= 4 ? 'IDX' : 'USA',
    reportDate: new Date().toISOString().split('T')[0],
    eps: parseFloat(base.eps.toFixed(2)),
    per: parseFloat(base.per.toFixed(2)),
    pbv: parseFloat(base.pbv.toFixed(2)),
    roe: parseFloat(base.roe.toFixed(2)),
    dividendYield: parseFloat(base.dividendYield.toFixed(2))
  };
}

// Technical indicators functions
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((sum, price) => sum + price, 0) / period;
}

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) return 100;
    rs = avgGain / avgLoss;
    rsi = 100 - (100 / (1 + rs));
  }

  return Math.round(rsi * 100) / 100;
}

// POST /api/stocks/ai/consume - Consume AI quota for authenticated user
router.post("/ai/consume", authMiddleware, async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    const userId = req.user.id; // provided by authMiddleware
    const { tokens_used } = req.body;

    // Input validation
    if (!tokens_used || !Number.isInteger(tokens_used) || tokens_used <= 0) {
      const processingTime = Date.now() - startTime;
      console.log(`[${requestId}] ❌ Invalid tokens_used: ${tokens_used} (${processingTime}ms)`);
      return res.status(400).json({
        success: false,
        message: 'tokens_used must be a positive integer',
      });
    }

    console.log(`[${requestId}] 🔄 Consuming ${tokens_used} AI tokens for user ${userId}`);

    // Fetch current quota
    const { rows } = await stockPool.query(
      'SELECT ai_usage, ai_limit FROM users WHERE id = $1',
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = rows[0];
    const currentUsage = user.ai_usage || 0;
    const limit = user.ai_limit || 1000;

    // Check if user would exceed quota
    if (currentUsage + tokens_used > limit) {
      const processingTime = Date.now() - startTime;
      console.log(`[${requestId}] ❌ Quota exceeded for user ${userId}: ${currentUsage} + ${tokens_used} > ${limit} (${processingTime}ms)`);
      return res.status(429).json({
        success: false,
        message: 'AI quota exceeded',
        data: {
          used: currentUsage,
          limit: limit,
          remaining: 0,
          attempted: tokens_used
        }
      });
    }

    // Update quota in database
    const newUsage = currentUsage + tokens_used;
    const remaining = Math.max(0, limit - newUsage);

    await stockPool.query(
      'UPDATE users SET ai_usage = $1 WHERE id = $2',
      [newUsage, userId]
    );

    const processingTime = Date.now() - startTime;
    console.log(`[${requestId}] ✅ AI quota consumed successfully: ${userId} (${currentUsage} → ${newUsage}/${limit}) in ${processingTime}ms`);

    return res.status(200).json({
      success: true,
      message: 'AI usage updated successfully',
      data: {
        used: newUsage,
        limit: limit,
        remaining: remaining
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[${requestId}] 💥 Error consuming AI quota (${processingTime}ms):`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

// GET /api/stocks/ai/quota - Get AI quota information for authenticated user
router.get("/ai/quota", authMiddleware, async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    const userId = req.user.id; // provided by authMiddleware

    const { rows } = await stockPool.query(
      'SELECT ai_usage, ai_limit FROM users WHERE id = $1',
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = rows[0];
    const remaining = Math.max(0, (user.ai_limit || 0) - (user.ai_usage || 0));

    const quota = {
      used: user.ai_usage || 0,
      limit: user.ai_limit || 1000,
      remaining,
    };

    const processingTime = Date.now() - startTime;
    console.log(`[${requestId}] ✅ AI Quota fetched successfully in ${processingTime}ms`);

    return res.status(200).json({
      success: true,
      message: 'AI quota retrieved successfully',
      data: quota,
    });
  } catch (error) {
    console.error(`[${requestId}] 💥 Error fetching AI quota:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

// GET /api/stocks/ai/audit - Get AI quota audit log for admin debugging
router.get("/ai/audit", authMiddleware, async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    const limit = parseInt(req.query.limit || 50);
    const userId = req.query.user_id; // Optional filter by user

    console.log(`[${requestId}] 🔍 Fetching AI quota audit log (limit: ${limit}, user: ${userId || 'all'})`);

    let query, params;

    if (userId) {
      query = `
        SELECT id, user_id, action, tokens_used, current_usage, quota_limit, success, request_id, operation_type, error_message, created_at
        FROM ai_quota_audit
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;
      params = [userId, limit];
    } else {
      query = `
        SELECT a.id, a.user_id, u.email, a.action, a.tokens_used, a.current_usage, a.quota_limit, a.success, a.request_id, a.operation_type, a.error_message, a.created_at
        FROM ai_quota_audit a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT $1
      `;
      params = [limit];
    }

    const { rows } = await stockPool.query(query, params);

    const processingTime = Date.now() - startTime;
    console.log(`[${requestId}] ✅ AI audit log fetched: ${rows.length} records in ${processingTime}ms`);

    return res.status(200).json({
      success: true,
      message: 'AI quota audit log retrieved successfully',
      data: {
        total: rows.length,
        records: rows
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[${requestId}] 💥 Error fetching AI audit log (${processingTime}ms):`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  }
});

// GET /api/stocks/ai/integrity - Check AI quota integrity for admin
router.get("/ai/integrity", authMiddleware, async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    console.log(`[${requestId}] 🔍 Running AI quota integrity checks`);

    // Check for negative usage
    const { rows: negativeUsage } = await stockPool.query(
      'SELECT id, email, ai_usage, ai_limit FROM users WHERE ai_usage < 0'
    );

    // Check for usage exceeding limit
    const { rows: exceededLimit } = await stockPool.query(
      'SELECT id, email, ai_usage, ai_limit FROM users WHERE ai_usage > ai_limit'
    );

    // Check for invalid limits
    const { rows: invalidLimits } = await stockPool.query(
      'SELECT id, email, ai_usage, ai_limit FROM users WHERE ai_limit <= 0'
    );

    // Get recent audit summary
    const { rows: auditSummary } = await stockPool.query(`
      SELECT
        COUNT(*) as total_operations,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_operations,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_operations,
        COUNT(CASE WHEN action = 'quota_rollback' THEN 1 END) as rollback_operations
      FROM ai_quota_audit
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    const integrityReport = {
      negativeUsage: {
        count: negativeUsage.length,
        users: negativeUsage
      },
      exceededLimit: {
        count: exceededLimit.length,
        users: exceededLimit
      },
      invalidLimits: {
        count: invalidLimits.length,
        users: invalidLimits
      },
      auditSummary: auditSummary[0],
      timestamp: new Date().toISOString()
    };

    const processingTime = Date.now() - startTime;
    console.log(`[${requestId}] ✅ Integrity check completed in ${processingTime}ms`);

    return res.status(200).json({
      success: true,
      message: 'AI quota integrity check completed',
      data: integrityReport
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[${requestId}] 💥 Error running integrity check (${processingTime}ms):`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during integrity check',
      error: error.message,
    });
  }
});

// GET /api/stocks/search/:query - Search for stocks
router.get("/search/:query", async (req, res) => {
  const { query } = req.params;
  const { market = 'idx', limit = 10 } = req.query;

  try {
    const client = await stockPool.connect();

    const searchQuery = `
      SELECT DISTINCT "Kode Saham" as symbol, "Nama Perusahaan" as name
      FROM saham_data
      WHERE ("Kode Saham" ILIKE $1 OR "Nama Perusahaan" ILIKE $1)
      ORDER BY "Kode Saham"
      LIMIT $2
    `;

    const result = await client.query(searchQuery, [`%${query}%`, parseInt(limit)]);
    client.release();

    res.json({
      query,
      market: market.toUpperCase(),
      results: result.rows.map(row => ({
        symbol: row.symbol,
        name: row.name
      }))
    });

  } catch (error) {
    console.error("Error searching stocks:", error);
    res.status(500).json({ error: "Failed to search stocks" });
  }
});

// GET /api/stocks/symbols - Get list of all stock symbols
router.get("/symbols", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] 📊 Fetching stock symbols from database...`);

  try {
    const client = await stockPool.connect();
    console.log(`[${requestId}] ✅ Database connected successfully`);

    const query = `
      SELECT DISTINCT "Kode Saham" as symbol, "Nama Perusahaan" as name
      FROM saham_data
      ORDER BY "Kode Saham"
      LIMIT 1000
    `;

    console.log(`[${requestId}] 🔍 Executing query...`);
    const result = await client.query(query);
    console.log(`[${requestId}] ✅ Query executed successfully, found ${result.rows.length} symbols`);
    client.release();

    const symbols = result.rows.map(row => ({
      symbol: row.symbol,
      name: row.name
    }));

    console.log(`[${requestId}] 📤 Returning ${symbols.length} stock symbols to client`);

    res.json({
      success: true,
      source: 'PostgreSQL Database',
      total: symbols.length,
      symbols: symbols,
      companies: symbols.reduce((acc, stock) => {
        acc[stock.symbol] = stock.name;
        return acc;
      }, {})
    });

  } catch (error) {
    console.error(`[${requestId}] ❌ Error fetching stock symbols:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: "Failed to fetch stock symbols",
      message: error.message,
      requestId: requestId
    });
  }
});

// GET /api/stocks/candlestick - Get candlestick chart data for a stock
// FIXED VERSION - Uses actual database date range instead of relative dates

router.get("/candlestick", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const { symbol, timeframe = '1M' } = req.query;
  
  console.log(`[${requestId}] 📊 Fetching candlestick data for ${symbol} (${timeframe})...`);
  
  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: "Symbol is required",
      requestId: requestId
    });
  }
  
  try {
    const client = await stockPool.connect();
    console.log(`[${requestId}] ✅ Database connected successfully`);
    
    // First, get actual date range from database for this symbol
    const dateRangeQuery = `
      SELECT 
        MIN("Tanggal Perdagangan Terakhir") as min_date,
        MAX("Tanggal Perdagangan Terakhir") as max_date,
        COUNT(*) as total_points
      FROM saham_data
      WHERE "Kode Saham" = $1
    `;
    
    const dateRangeResult = await client.query(dateRangeQuery, [symbol.toUpperCase()]);
    console.log(`[${requestId}] 📅 Database date range for ${symbol}:`, dateRangeResult.rows[0]);
    
    // Calculate date range based on timeframe, but use database's actual date range
    const dbDateRange = dateRangeResult.rows[0];
    const dbMinDate = new Date(dbDateRange.min_date);
    const dbMaxDate = new Date(dbDateRange.max_date);
    
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '1M':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        startDate.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'YTD':
        startDate = new Date(now.getFullYear(), 0, 1); // January 1st of current year
        break;
      case 'ALL':
        startDate = new Date('2020-01-01'); // Go back to 2020
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }
    
    // Adjust start date to be within database range
    if (startDate < dbMinDate) {
      startDate = dbMinDate;
      console.log(`[${requestId}] ⚠️ Adjusted start date to database min: ${startDate.toISOString().split('T')[0]}`);
    }
    
    // Adjust end date to be within database range
    let endDate = now;
    if (endDate > dbMaxDate) {
      endDate = dbMaxDate;
      console.log(`[${requestId}] ⚠️ Adjusted end date to database max: ${endDate.toISOString().split('T')[0]}`);
    }
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`[${requestId}] 📅 Date range: ${startDateStr} to ${endDateStr}`);
    
    const query = `
      SELECT
        "Tanggal Perdagangan Terakhir" as trade_date,
        "Open Price" as open,
        "Tertinggi" as high,
        "Terendah" as low,
        "Penutupan" as close,
        "Volume" as volume,
        "Kode Saham" as symbol,
        "Nama Perusahaan" as company_name
      FROM saham_data
      WHERE "Kode Saham" = $1
        AND "Tanggal Perdagangan Terakhir" >= $2
        AND "Tanggal Perdagangan Terakhir" <= $3
      ORDER BY "Tanggal Perdagangan Terakhir" ASC
    `;
    
    console.log(`[${requestId}] 🔍 Executing query...`);
    const result = await client.query(query, [symbol.toUpperCase(), startDateStr, endDateStr]);
    console.log(`[${requestId}] ✅ Query executed successfully, found ${result.rows.length} data points`);
    client.release();
    
    if (result.rows.length === 0) {
      console.log(`[${requestId}] ⚠️ No data found for ${symbol}`);
      return res.json({
        success: true,
        data: [],
        company_name: `${symbol} - No Data`,
        data_points: 0,
        symbol: symbol.toUpperCase(),
        timeframe: timeframe,
        source: 'PostgreSQL Database'
      });
    }
    
    const data = result.rows.map(row => ({
      trade_date: row.trade_date,
      open: parseFloat(row.open) || 0,
      high: parseFloat(row.high) || 0,
      low: parseFloat(row.low) || 0,
      close: parseFloat(row.close) || 0,
      volume: parseInt(row.volume) || 0
    }));
    
    const companyName = result.rows[0].company_name || symbol;
    
    console.log(`[${requestId}] 📤 Returning ${data.length} data points for ${companyName}`);
    
    res.json({
      success: true,
      data: data,
      company_name: companyName,
      data_points: data.length,
      symbol: symbol.toUpperCase(),
      timeframe: timeframe,
      date_range: {
        start: startDateStr,
        end: endDateStr
      },
      source: 'PostgreSQL Database'
    });
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error fetching candlestick data:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to fetch candlestick data",
      message: error.message,
      requestId: requestId
    });
  }
});
// GET /api/stocks/bandar - Get bandarmologi data for a stock
router.get("/bandar", async (req, res) => {
  const { symbol, days = 30 } = req.query;

  if (!symbol) {
    return res.status(400).json({ success: false, error: "Symbol is required" });
  }

  try {
    const client = await stockPool.connect();

    const query = `
      SELECT
        "Kode Saham" as symbol,
        "Tanggal Perdagangan Terakhir" as date,
        "Penutupan" as close,
        "Tertinggi" as high,
        "Terendah" as low,
        "Open Price" as open,
        "Volume" as volume,
        "Frekuensi" as frequency
      FROM saham_data
      WHERE "Kode Saham" = $1
      ORDER BY "Tanggal Perdagangan Terakhir" DESC
      LIMIT $2
    `;

    const result = await client.query(query, [symbol.toUpperCase(), parseInt(days)]);
    client.release();

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          message: "No data found for this symbol",
          history: []
        }
      });
    }

    // Calculate bandarmologi metrics
    const history = result.rows.reverse();
    const buyVolume = history.reduce((sum, row) => sum + (row.close > row.open ? row.volume : 0), 0);
    const sellVolume = history.reduce((sum, row) => sum + (row.close < row.open ? row.volume : 0), 0);
    const totalVolume = history.reduce((sum, row) => sum + row.volume, 0);
    const avgVolume = totalVolume / history.length;

    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        period: `${days} days`,
        metrics: {
          totalVolume,
          avgVolume: Math.round(avgVolume),
          buyVolume,
          sellVolume,
          buyRatio: totalVolume > 0 ? ((buyVolume / totalVolume) * 100).toFixed(2) : 0,
          sellRatio: totalVolume > 0 ? ((sellVolume / totalVolume) * 100).toFixed(2) : 0
        },
        history: history.map(row => ({
          date: row.date,
          open: parseFloat(row.open) || 0,
          high: parseFloat(row.high) || 0,
          low: parseFloat(row.low) || 0,
          close: parseFloat(row.close) || 0,
          volume: parseInt(row.volume) || 0,
          frequency: row.frequency
        }))
      }
    });

  } catch (error) {
    console.error("Error fetching bandarmologi data:", error);
    res.status(500).json({ success: false, error: "Failed to fetch bandarmologi data" });
  }
});

// GET /api/stocks/top-gainers - Get top gainers from database
router.get("/top-gainers", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const { limit = 15, date } = req.query;
  
  console.log(`[${requestId}] 📊 Fetching top gainers from database...`);
  
  try {
    const client = await stockPool.connect();
    console.log(`[${requestId}] ✅ Database connected successfully`);
    
    // Get the latest trading date if not specified
    let targetDate = date;
    if (!targetDate) {
      const dateQuery = `
        SELECT MAX("Tanggal Perdagangan Terakhir") as latest_date
        FROM saham_data
      `;
      const dateResult = await client.query(dateQuery);
      targetDate = dateResult.rows[0].latest_date;
      console.log(`[${requestId}] 📅 Using latest trading date: ${targetDate}`);
    }
    
    // Query to get top gainers for the specified date
    const query = `
      WITH latest_data AS (
        SELECT
          "Kode Saham" as symbol,
          "Nama Perusahaan" as company_name,
          "Tanggal Perdagangan Terakhir" as trade_date,
          "Open Price" as open_price,
          "Penutupan" as close_price,
          "Tertinggi" as high_price,
          "Terendah" as low_price,
          "Volume" as volume,
          ROW_NUMBER() OVER (PARTITION BY "Kode Saham" ORDER BY "Tanggal Perdagangan Terakhir" DESC) as row_num
        FROM saham_data
        WHERE "Tanggal Perdagangan Terakhir" <= $1
      ),
      current_data AS (
        SELECT * FROM latest_data WHERE row_num = 1
      ),
      previous_data AS (
        SELECT * FROM latest_data WHERE row_num = 2
      )
      SELECT
        c.symbol,
        c.company_name,
        c.trade_date,
        c.open_price,
        c.close_price as current_price,
        c.high_price,
        c.low_price,
        c.volume,
        p.close_price as previous_close,
        CASE 
          WHEN p.close_price IS NULL OR p.close_price = 0 THEN 0
          ELSE ((c.close_price - p.close_price) / p.close_price) * 100 
        END as change_percent,
        CASE 
          WHEN p.close_price IS NULL OR p.close_price = 0 THEN 0
          ELSE c.close_price - p.close_price 
        END as price_change
      FROM current_data c
      LEFT JOIN previous_data p ON c.symbol = p.symbol
      WHERE c.close_price > 0
        AND c.open_price > 0
        AND p.close_price IS NOT NULL
        AND p.close_price > 0
      ORDER BY change_percent DESC
      LIMIT $2
    `;
    
    console.log(`[${requestId}] 🔍 Executing query for top gainers...`);
    const result = await client.query(query, [targetDate, parseInt(limit)]);
    console.log(`[${requestId}] ✅ Query executed successfully, found ${result.rows.length} top gainers`);
    client.release();
    
    const gainers = result.rows.map(row => ({
      symbol: row.symbol,
      company_name: row.company_name,
      currentPrice: parseFloat(row.current_price),
      openPrice: parseFloat(row.open_price),
      highPrice: parseFloat(row.high_price),
      lowPrice: parseFloat(row.low_price),
      previousClose: parseFloat(row.previous_close),
      change: parseFloat(row.price_change),
      changePercent: parseFloat(row.change_percent),
      volume: parseInt(row.volume) || 0,
      tradeDate: row.trade_date
    }));
    
    console.log(`[${requestId}] 📤 Returning ${gainers.length} top gainers to client`);
    
    res.json({
      success: true,
      source: 'PostgreSQL Database',
      date: targetDate,
      total: gainers.length,
      gainers: gainers
    });
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error fetching top gainers:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to fetch top gainers",
      message: error.message,
      requestId: requestId
    });
  }
});

// GET /api/stocks/top-losers - Get top losers from database
router.get("/top-losers", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const { limit = 15, date } = req.query;
  
  console.log(`[${requestId}] 📊 Fetching top losers from database...`);
  
  try {
    const client = await stockPool.connect();
    console.log(`[${requestId}] ✅ Database connected successfully`);
    
    // Get the latest trading date if not specified
    let targetDate = date;
    if (!targetDate) {
      const dateQuery = `
        SELECT MAX("Tanggal Perdagangan Terakhir") as latest_date
        FROM saham_data
      `;
      const dateResult = await client.query(dateQuery);
      targetDate = dateResult.rows[0].latest_date;
      console.log(`[${requestId}] 📅 Using latest trading date: ${targetDate}`);
    }
    
    // Query to get top losers for the specified date
    const query = `
      WITH latest_data AS (
        SELECT
          "Kode Saham" as symbol,
          "Nama Perusahaan" as company_name,
          "Tanggal Perdagangan Terakhir" as trade_date,
          "Open Price" as open_price,
          "Penutupan" as close_price,
          "Tertinggi" as high_price,
          "Terendah" as low_price,
          "Volume" as volume,
          ROW_NUMBER() OVER (PARTITION BY "Kode Saham" ORDER BY "Tanggal Perdagangan Terakhir" DESC) as row_num
        FROM saham_data
        WHERE "Tanggal Perdagangan Terakhir" <= $1
      ),
      current_data AS (
        SELECT * FROM latest_data WHERE row_num = 1
      ),
      previous_data AS (
        SELECT * FROM latest_data WHERE row_num = 2
      )
      SELECT
        c.symbol,
        c.company_name,
        c.trade_date,
        c.open_price,
        c.close_price as current_price,
        c.high_price,
        c.low_price,
        c.volume,
        p.close_price as previous_close,
        CASE 
          WHEN p.close_price IS NULL OR p.close_price = 0 THEN 0
          ELSE ((c.close_price - p.close_price) / p.close_price) * 100 
        END as change_percent,
        CASE 
          WHEN p.close_price IS NULL OR p.close_price = 0 THEN 0
          ELSE c.close_price - p.close_price 
        END as price_change
      FROM current_data c
      LEFT JOIN previous_data p ON c.symbol = p.symbol
      WHERE c.close_price > 0
        AND c.open_price > 0
        AND p.close_price IS NOT NULL
        AND p.close_price > 0
      ORDER BY change_percent ASC
      LIMIT $2
    `;
    
    console.log(`[${requestId}] 🔍 Executing query for top losers...`);
    const result = await client.query(query, [targetDate, parseInt(limit)]);
    console.log(`[${requestId}] ✅ Query executed successfully, found ${result.rows.length} top losers`);
    client.release();
    
    const losers = result.rows.map(row => ({
      symbol: row.symbol,
      company_name: row.company_name,
      currentPrice: parseFloat(row.current_price),
      openPrice: parseFloat(row.open_price),
      highPrice: parseFloat(row.high_price),
      lowPrice: parseFloat(row.low_price),
      previousClose: parseFloat(row.previous_close),
      change: parseFloat(row.price_change),
      changePercent: parseFloat(row.change_percent),
      volume: parseInt(row.volume) || 0,
      tradeDate: row.trade_date
    }));
    
    console.log(`[${requestId}] 📤 Returning ${losers.length} top losers to client`);
    
    res.json({
      success: true,
      source: 'PostgreSQL Database',
      date: targetDate,
      total: losers.length,
      losers: losers
    });
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error fetching top losers:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to fetch top losers",
      message: error.message,
      requestId: requestId
    });
  }
});

// GET /api/stocks/idx/top-gainers - Get top gainers from database (IDX market)
router.get("/idx/top-gainers", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const { limit = 15, date } = req.query;
  
  console.log(`[${requestId}] 📊 Fetching IDX top gainers from database...`);
  
  try {
    const client = await stockPool.connect();
    console.log(`[${requestId}] ✅ Database connected successfully`);
    
    // Get the latest trading date if not specified
    let targetDate = date;
    if (!targetDate) {
      const dateQuery = `
        SELECT MAX("Tanggal Perdagangan Terakhir") as latest_date
        FROM saham_data
      `;
      const dateResult = await client.query(dateQuery);
      targetDate = dateResult.rows[0].latest_date;
      console.log(`[${requestId}] 📅 Using latest trading date: ${targetDate}`);
    }
    
    // Query to get top gainers for specified date
    const query = `
      WITH latest_data AS (
        SELECT
          "Kode Saham" as symbol,
          "Nama Perusahaan" as company_name,
          "Tanggal Perdagangan Terakhir" as trade_date,
          "Open Price" as open_price,
          "Penutupan" as close_price,
          "Tertinggi" as high_price,
          "Terendah" as low_price,
          "Volume" as volume,
          ROW_NUMBER() OVER (PARTITION BY "Kode Saham" ORDER BY "Tanggal Perdagangan Terakhir" DESC) as row_num
        FROM saham_data
        WHERE "Tanggal Perdagangan Terakhir" <= $1
      ),
      current_data AS (
        SELECT * FROM latest_data WHERE row_num = 1
      ),
      previous_data AS (
        SELECT * FROM latest_data WHERE row_num = 2
      )
      SELECT
        c.symbol,
        c.company_name,
        c.trade_date,
        c.open_price,
        c.close_price as current_price,
        c.high_price,
        c.low_price,
        c.volume,
        p.close_price as previous_close,
        CASE 
          WHEN p.close_price IS NULL OR p.close_price = 0 THEN 0
          ELSE ((c.close_price - p.close_price) / p.close_price) * 100 
        END as change_percent,
        CASE 
          WHEN p.close_price IS NULL OR p.close_price = 0 THEN 0
          ELSE c.close_price - p.close_price 
        END as price_change
      FROM current_data c
      LEFT JOIN previous_data p ON c.symbol = p.symbol
      WHERE c.close_price > 0
        AND c.open_price > 0
        AND p.close_price IS NOT NULL
        AND p.close_price > 0
      ORDER BY change_percent DESC
      LIMIT $2
    `;
    
    console.log(`[${requestId}] 🔍 Executing query for IDX top gainers...`);
    const result = await client.query(query, [targetDate, parseInt(limit)]);
    console.log(`[${requestId}] ✅ Query executed successfully, found ${result.rows.length} top gainers`);
    client.release();
    
    const gainers = result.rows.map(row => ({
      symbol: row.symbol,
      company_name: row.company_name,
      currentPrice: parseFloat(row.current_price),
      openPrice: parseFloat(row.open_price),
      highPrice: parseFloat(row.high_price),
      lowPrice: parseFloat(row.low_price),
      previousClose: parseFloat(row.previous_close),
      change: parseFloat(row.price_change),
      changePercent: parseFloat(row.change_percent),
      volume: parseInt(row.volume) || 0,
      tradeDate: row.trade_date
    }));
    
    console.log(`[${requestId}] 📤 Returning ${gainers.length} IDX top gainers to client`);
    
    res.json({
      success: true,
      source: 'PostgreSQL Database',
      date: targetDate,
      total: gainers.length,
      gainers: gainers
    });
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error fetching IDX top gainers:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to fetch IDX top gainers",
      message: error.message,
      requestId: requestId
    });
  }
});

// GET /api/stocks/idx/top-losers - Get top losers from database (IDX market)
router.get("/idx/top-losers", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const { limit = 15, date } = req.query;
  
  console.log(`[${requestId}] 📊 Fetching IDX top losers from database...`);
  
  try {
    const client = await stockPool.connect();
    console.log(`[${requestId}] ✅ Database connected successfully`);
    
    // Get the latest trading date if not specified
    let targetDate = date;
    if (!targetDate) {
      const dateQuery = `
        SELECT MAX("Tanggal Perdagangan Terakhir") as latest_date
        FROM saham_data
      `;
      const dateResult = await client.query(dateQuery);
      targetDate = dateResult.rows[0].latest_date;
      console.log(`[${requestId}] 📅 Using latest trading date: ${targetDate}`);
    }
    
    // Query to get top losers for specified date
    const query = `
      WITH latest_data AS (
        SELECT
          "Kode Saham" as symbol,
          "Nama Perusahaan" as company_name,
          "Tanggal Perdagangan Terakhir" as trade_date,
          "Open Price" as open_price,
          "Penutupan" as close_price,
          "Tertinggi" as high_price,
          "Terendah" as low_price,
          "Volume" as volume,
          ROW_NUMBER() OVER (PARTITION BY "Kode Saham" ORDER BY "Tanggal Perdagangan Terakhir" DESC) as row_num
        FROM saham_data
        WHERE "Tanggal Perdagangan Terakhir" <= $1
      ),
      current_data AS (
        SELECT * FROM latest_data WHERE row_num = 1
      ),
      previous_data AS (
        SELECT * FROM latest_data WHERE row_num = 2
      )
      SELECT
        c.symbol,
        c.company_name,
        c.trade_date,
        c.open_price,
        c.close_price as current_price,
        c.high_price,
        c.low_price,
        c.volume,
        p.close_price as previous_close,
        CASE 
          WHEN p.close_price IS NULL OR p.close_price = 0 THEN 0
          ELSE ((c.close_price - p.close_price) / p.close_price) * 100 
        END as change_percent,
        CASE 
          WHEN p.close_price IS NULL OR p.close_price = 0 THEN 0
          ELSE c.close_price - p.close_price 
        END as price_change
      FROM current_data c
      LEFT JOIN previous_data p ON c.symbol = p.symbol
      WHERE c.close_price > 0
        AND c.open_price > 0
        AND p.close_price IS NOT NULL
        AND p.close_price > 0
      ORDER BY change_percent ASC
      LIMIT $2
    `;
    
    console.log(`[${requestId}] 🔍 Executing query for IDX top losers...`);
    const result = await client.query(query, [targetDate, parseInt(limit)]);
    console.log(`[${requestId}] ✅ Query executed successfully, found ${result.rows.length} top losers`);
    client.release();
    
    const losers = result.rows.map(row => ({
      symbol: row.symbol,
      company_name: row.company_name,
      currentPrice: parseFloat(row.current_price),
      openPrice: parseFloat(row.open_price),
      highPrice: parseFloat(row.high_price),
      lowPrice: parseFloat(row.low_price),
      previousClose: parseFloat(row.previous_close),
      change: parseFloat(row.price_change),
      changePercent: parseFloat(row.change_percent),
      volume: parseInt(row.volume) || 0,
      tradeDate: row.trade_date
    }));
    
    console.log(`[${requestId}] 📤 Returning ${losers.length} IDX top losers to client`);
    
    res.json({
      success: true,
      source: 'PostgreSQL Database',
      date: targetDate,
      total: losers.length,
      losers: losers
    });
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error fetching IDX top losers:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to fetch IDX top losers",
      message: error.message,
      requestId: requestId
    });
  }
});

// GET /api/stocks/idx/dates - Get available trading dates
router.get("/idx/dates", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const { limit = 30 } = req.query;
  
  console.log(`[${requestId}] 📊 Fetching available trading dates...`);
  
  try {
    const client = await stockPool.connect();
    
    const query = `
      SELECT DISTINCT "Tanggal Perdagangan Terakhir" as date
      FROM saham_data
      ORDER BY "Tanggal Perdagangan Terakhir" DESC
      LIMIT $1
    `;
    
    const result = await client.query(query, [parseInt(limit)]);
    client.release();
    
    const dates = result.rows.map(row => {
      const date = new Date(row.date);
      return {
        date: row.date,
        formatted: date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      };
    });
    
    console.log(`[${requestId}] 📤 Returning ${dates.length} trading dates`);
    
    res.json({
      success: true,
      dates: dates
    });
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error fetching trading dates:`, error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch trading dates",
      message: error.message
    });
  }
});

// GET /api/stocks/fundamental/:symbol - Get fundamental data for a stock
router.get("/fundamental/:symbol", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const { symbol } = req.params;
  
  console.log(`[${requestId}] 📊 Fetching fundamental data for ${symbol}...`);
  
  try {
    const client = await stockPool.connect();
    console.log(`[${requestId}] ✅ Database connected successfully`);
    
    const query = `
      SELECT
        symbol,
        market,
        report_date,
        eps,
        per,
        pbv,
        roe,
        dividend_yield
      FROM fundamental_data
      WHERE symbol = $1
      ORDER BY report_date DESC
      LIMIT 1
    `;
    
    console.log(`[${requestId}] 🔍 Executing query...`);
    const result = await client.query(query, [symbol.toUpperCase()]);
    console.log(`[${requestId}] ✅ Query executed successfully, found ${result.rows.length} records`);
    client.release();
    
    if (result.rows.length === 0) {
      console.log(`[${requestId}] ⚠️ No fundamental data found for ${symbol}, returning mock data`);
      
      // Generate mock fundamental data as fallback
      const mockData = generateMockFundamentalData(symbol.toUpperCase());
      
      return res.json({
        success: true,
        source: 'Mock Data (Database fallback)',
        symbol: symbol.toUpperCase(),
        warning: 'No fundamental data in database, using mock data',
        data: mockData
      });
    }
    
    const fundamental = result.rows[0];
    
    console.log(`[${requestId}] 📤 Returning fundamental data for ${symbol}`);
    
    res.json({
      success: true,
      source: 'PostgreSQL Database',
      symbol: symbol.toUpperCase(),
      data: {
        symbol: fundamental.symbol,
        market: fundamental.market,
        reportDate: fundamental.report_date,
        eps: parseFloat(fundamental.eps) || null,
        per: parseFloat(fundamental.per) || null,
        pbv: parseFloat(fundamental.pbv) || null,
        roe: parseFloat(fundamental.roe) || null,
        dividendYield: parseFloat(fundamental.dividend_yield) || null
      }
    });
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error fetching fundamental data:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to fetch fundamental data",
      message: error.message,
      requestId: requestId
    });
  }
});

// GET /api/stocks/top-stocks - Get top stocks by bandarmologi (net buy)
router.get("/top-stocks", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const { limit = 10, days = 30 } = req.query;
  
  console.log(`[${requestId}] 📊 Fetching top stocks by bandarmologi...`);
  
  try {
    const client = await stockPool.connect();
    console.log(`[${requestId}] ✅ Database connected successfully`);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Query to get top stocks by net buy volume
    const query = `
      WITH stock_data AS (
        SELECT
          "Kode Saham" as symbol,
          "Nama Perusahaan" as company_name,
          "Tanggal Perdagangan Terakhir" as trade_date,
          "Penutupan" as close_price,
          "Volume" as volume,
          "Foreign Buy" as foreign_buy,
          "Foreign Sell" as foreign_sell,
          ROW_NUMBER() OVER (PARTITION BY "Kode Saham" ORDER BY "Tanggal Perdagangan Terakhir" DESC) as row_num
        FROM saham_data
        WHERE "Tanggal Perdagangan Terakhir" >= $1
          AND "Tanggal Perdagangan Terakhir" <= $2
      ),
      latest_data AS (
        SELECT * FROM stock_data WHERE row_num = 1
      )
      SELECT
        symbol,
        company_name,
        trade_date,
        close_price,
        volume,
        foreign_buy,
        foreign_sell,
        (foreign_buy - foreign_sell) as net_foreign,
        CASE 
          WHEN foreign_buy > 0 THEN ((foreign_buy - foreign_sell) / foreign_buy) * 100 
          ELSE 0 
        END as net_buy_percent
      FROM latest_data
      ORDER BY net_foreign DESC
      LIMIT $3
    `;
    
    console.log(`[${requestId}] 🔍 Executing query for top stocks...`);
    const result = await client.query(query, [startDateStr, endDateStr, parseInt(limit)]);
    console.log(`[${requestId}] ✅ Query executed successfully, found ${result.rows.length} top stocks`);
    client.release();
    
    const topStocks = result.rows.map(row => ({
      symbol: row.symbol,
      companyName: row.company_name,
      tradeDate: row.trade_date,
      closePrice: parseFloat(row.close_price),
      volume: parseInt(row.volume) || 0,
      foreignBuy: parseInt(row.foreign_buy) || 0,
      foreignSell: parseInt(row.foreign_sell) || 0,
      netForeign: parseInt(row.net_foreign) || 0,
      netBuyPercent: parseFloat(row.net_buy_percent) || 0
    }));
    
    console.log(`[${requestId}] 📤 Returning ${topStocks.length} top stocks to client`);
    
    res.json({
      success: true,
      source: 'PostgreSQL Database',
      period: `${days} days`,
      total: topStocks.length,
      stocks: topStocks
    });
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error fetching top stocks:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to fetch top stocks",
      message: error.message,
      requestId: requestId
    });
  }
});

// GET /api/stocks/top-brokers - Get top brokers by bandarmologi
router.get("/top-brokers", async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const { limit = 10, days = 30 } = req.query;
  
  console.log(`[${requestId}] 📊 Fetching top brokers by bandarmologi...`);
  
  try {
    const client = await stockPool.connect();
    console.log(`[${requestId}] ✅ Database connected successfully`);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    // Query to get top brokers by net buy volume
    const query = `
      WITH broker_data AS (
        SELECT
          "Kode Saham" as symbol,
          "Nama Perusahaan" as company_name,
          "Tanggal Perdagangan Terakhir" as trade_date,
          "Volume" as volume,
          "Foreign Buy" as foreign_buy,
          "Foreign Sell" as foreign_sell
        FROM saham_data
        WHERE "Tanggal Perdagangan Terakhir" >= $1
          AND "Tanggal Perdagangan Terakhir" <= $2
      ),
      broker_summary AS (
        SELECT
          'Foreign' as broker_code,
          'Foreign Investors' as broker_name,
          'asing' as broker_type,
          SUM(foreign_buy) as total_buy,
          SUM(foreign_sell) as total_sell,
          SUM(foreign_buy - foreign_sell) as net_volume,
          SUM(volume) as total_volume,
          COUNT(DISTINCT symbol) as stocks_count
        FROM broker_data
        GROUP BY 'Foreign', 'Foreign Investors', 'asing'
      )
      SELECT
        broker_code,
        broker_name,
        broker_type,
        total_buy,
        total_sell,
        net_volume,
        total_volume,
        stocks_count,
        CASE 
          WHEN total_buy > 0 THEN ((net_volume) / total_buy) * 100 
          ELSE 0 
        END as net_percent
      FROM broker_summary
      ORDER BY net_volume DESC
      LIMIT $3
    `;
    
    console.log(`[${requestId}] 🔍 Executing query for top brokers...`);
    const result = await client.query(query, [startDateStr, endDateStr, parseInt(limit)]);
    console.log(`[${requestId}] ✅ Query executed successfully, found ${result.rows.length} top brokers`);
    client.release();
    
    const topBrokers = result.rows.map(row => ({
      brokerCode: row.broker_code,
      brokerName: row.broker_name,
      brokerType: row.broker_type,
      totalBuy: parseInt(row.total_buy) || 0,
      totalSell: parseInt(row.total_sell) || 0,
      netVolume: parseInt(row.net_volume) || 0,
      totalVolume: parseInt(row.total_volume) || 0,
      stocksCount: parseInt(row.stocks_count) || 0,
      netPercent: parseFloat(row.net_percent) || 0
    }));
    
    console.log(`[${requestId}] 📤 Returning ${topBrokers.length} top brokers to client`);
    
    res.json({
      success: true,
      source: 'PostgreSQL Database',
      period: `${days} days`,
      total: topBrokers.length,
      brokers: topBrokers
    });
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Error fetching top brokers:`, {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to fetch top brokers",
      message: error.message,
      requestId: requestId
    });
  }
});

module.exports = router;