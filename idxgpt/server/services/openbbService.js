const axios = require('axios');
const logger = require('../utils/logger').console;
const inMemoryCache = require('../utils/cache');

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

// Redis client for caching (skip in development mode)
let redisClient = null;
if (process.env.NODE_ENV !== 'development') {
  try {
    const Redis = require('ioredis');
    redisClient = new Redis({ host: '127.0.0.1', port: 6379 });

    redisClient.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });
  } catch (error) {
    logger.warn('Redis not available, caching disabled:', error.message);
  }
} else {
  logger.info('🔧 Dev mode: Using in-memory cache for OpenBB data');
}

// Cache helper functions with fallback
async function getCachedData(key) {
  // Skip Redis in development mode
  if (process.env.NODE_ENV === 'development') {
    logger.info('🔧 Dev mode: Using in-memory cache for get:', key);
    return inMemoryCache.get(key);
  }

  // Try Redis first with ping test
  if (redisClient) {
    try {
      await redisClient.ping(); // Test connection
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logger.warn('Redis down, using in-memory cache for get:', key);
      } else {
        logger.error('Error getting cached data from Redis:', error.message);
      }
    }
  }

  // Fallback to in-memory cache
  logger.info('Using in-memory cache fallback for:', key);
  return inMemoryCache.get(key);
}

async function setCachedData(key, data, ttl = 30) {
  // Skip Redis in development mode
  if (process.env.NODE_ENV === 'development') {
    logger.info('🔧 Dev mode: Using in-memory cache for set:', key);
    inMemoryCache.set(key, data, ttl);
    return;
  }

  // Try Redis first with ping test
  if (redisClient) {
    try {
      await redisClient.ping(); // Test connection
      await redisClient.setEx(key, ttl, JSON.stringify(data));
      return;
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logger.warn('Redis down, using in-memory cache for set:', key);
      } else {
        logger.error('Error setting cached data to Redis:', error.message);
      }
    }
  }

  // Fallback to in-memory cache
  logger.info('Using in-memory cache fallback for:', key);
  inMemoryCache.set(key, data, ttl);
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
        logger.info(`Returning cached price data for ${symbol}`);
        return cachedData;
      }

      logger.info(`Fetching price data for ${symbol} from OpenBB API`);

      // Calculate date range for 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const endDateStr = endDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Call OpenBB API with correct parameters
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

      logger.info(`Successfully fetched price data for ${symbol}: $${priceData.price}`);
      return priceData;

    } catch (error) {
      logger.error(`Error fetching price data for ${symbol}:`, error.message);

      // Fallback to local database if OpenBB API fails
      try {
        logger.info(`Attempting fallback to local database for ${symbol}`);
        const fallbackData = await this.getStockPriceFromLocalDB(symbol);
        if (fallbackData) {
          logger.info(`Successfully fetched fallback price data for ${symbol}`);
          return fallbackData;
        }
      } catch (fallbackError) {
        logger.error(`Fallback also failed for ${symbol}:`, fallbackError.message);
      }

      throw new Error(`Failed to fetch price data for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Get fundamental data from OpenBB API
   * @param {string} symbol - Stock symbol
   * @returns {Object} Fundamental data
   */
  static async getFundamentals(symbol) {
    const cacheKey = `openbb:fundamentals:${symbol}`;

    try {
      // Check cache first
      const cachedData = await getCachedData(cacheKey);
      if (cachedData) {
        logger.info(`Returning cached fundamentals data for ${symbol}`);
        return cachedData;
      }

      logger.info(`Fetching fundamentals data for ${symbol} from OpenBB API`);

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
        pe: parseFloat(data.pe) || null,
        pb: parseFloat(data.pb) || null,
        roe: parseFloat(data.roe) || null,
        revenue: parseFloat(data.revenue) || null,
        netIncome: parseFloat(data.net_income) || null,
        marketCap: parseFloat(data.market_cap) || null,
        dividendYield: parseFloat(data.dividend_yield) || null,
        debtToEquity: parseFloat(data.debt_to_equity) || null,
        eps: parseFloat(data.eps) || null,
        source: 'openbb'
      };

      // Cache the data for 5 minutes (fundamentals don't change often)
      await setCachedData(cacheKey, fundamentalsData, 300);

      logger.info(`Successfully fetched fundamentals data for ${symbol}`);
      return fundamentalsData;

    } catch (error) {
      logger.error(`Error fetching fundamentals data for ${symbol}:`, error.message);

      // Return mock data for testing if API fails
      logger.info(`Returning mock fundamentals data for ${symbol} due to API error`);
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
        logger.info('Returning cached market overview data');
        return cachedData;
      }

      logger.info('Fetching market overview data from OpenBB API');

      // Call OpenBB API for IHSG data (Indonesian Stock Exchange)
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
        totalStocks: 750, // Approximate number of IDX stocks
        gainers: Math.floor(Math.random() * 300) + 200, // Mock data
        losers: Math.floor(Math.random() * 200) + 100,  // Mock data
        totalVolume: latest.v || 15000000000, // Mock volume
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

      logger.info('Successfully fetched market overview data');
      return marketData;

    } catch (error) {
      logger.error('Error fetching market overview data:', error.message);

      // Return mock data for testing
      logger.info('Returning mock market overview data due to API error');
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
        logger.info(`Returning cached chart data for ${symbol} (${days} days)`);
        return cachedData;
      }

      logger.info(`Fetching chart data for ${symbol} (${days} days) from OpenBB API`);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const endDateStr = endDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Call OpenBB API with correct parameters
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

      logger.info(`Successfully fetched chart data for ${symbol}: ${chartData.data.length} data points`);
      return chartData;

    } catch (error) {
      logger.error(`Error fetching chart data for ${symbol}:`, error.message);

      // Return mock data for testing
      logger.info(`Returning mock chart data for ${symbol} due to API error`);
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
        logger.info(`Returning cached news data for ${symbol}`);
        return cachedData;
      }

      logger.info(`Fetching news data for ${symbol} from OpenBB API`);

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

      // Cache the data for 10 minutes (news doesn't change as frequently)
      await setCachedData(cacheKey, newsData, 600);

      logger.info(`Successfully fetched news data for ${symbol}: ${articles.length} articles`);
      return newsData;

    } catch (error) {
      logger.error(`Error fetching news data for ${symbol}:`, error.message);

      // Return mock data for testing
      logger.info(`Returning mock news data for ${symbol} due to API error`);
      return this.getMockNewsData(symbol, limit);
    }
  }

  /**
   * Fallback method to get stock price from local database
   * @param {string} symbol - Stock symbol
   * @returns {Object|null} Stock price data or null
   */
  static async getStockPriceFromLocalDB(symbol) {
    try {
      const pg = require('pg');
      const dbConfig = {
        user: 'openpg',
        host: 'localhost',
        database: 'stock',
        password: 'openpgpwd',
        port: 5432,
      };

      const pool = new pg.Pool(dbConfig);
      const client = await pool.connect();

      const query = `
        SELECT "Penutupan" as close, "Volume" as volume, "Selisih" as change, "Sebelumnya" as previous
        FROM saham_data
        WHERE "Kode Saham" = $1
        ORDER BY "Tanggal Perdagangan Terakhir" DESC
        LIMIT 1
      `;

      const result = await client.query(query, [symbol.toUpperCase()]);
      client.release();
      await pool.end();

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const currentPrice = parseFloat(row.close) || 0;
      const previousPrice = parseFloat(row.previous) || 0;
      const change = parseFloat(row.change) || 0;
      const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;

      return {
        symbol: symbol,
        price: currentPrice,
        change: change,
        changePercent: changePercent,
        volume: parseInt(row.volume) || 0,
        source: 'local_db'
      };

    } catch (error) {
      logger.error(`Error fetching price from local DB for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get mock fundamentals data for testing
   * @param {string} symbol - Stock symbol
   * @returns {Object} Mock fundamentals data
   */
  static getMockFundamentalsData(symbol) {
    return {
      symbol: symbol,
      pe: 15 + Math.random() * 20, // Random P/E between 15-35
      pb: 1 + Math.random() * 3,   // Random P/B between 1-4
      roe: 8 + Math.random() * 15, // Random ROE between 8-23%
      revenue: 1000000000 + Math.random() * 5000000000, // Random revenue
      netIncome: 100000000 + Math.random() * 1000000000, // Random net income
      marketCap: 5000000000 + Math.random() * 20000000000, // Random market cap
      dividendYield: Math.random() * 5, // Random dividend yield 0-5%
      debtToEquity: 0.2 + Math.random() * 0.8, // Random D/E ratio
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
    const basePrice = 1000 + Math.random() * 4000;
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (days - 1 - i));

      const priceVariation = (Math.random() - 0.5) * 0.02;
      const dayPrice = basePrice * (1 + priceVariation * i / days);

      data.push({
        date: date.toISOString().split('T')[0],
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

module.exports = OpenBBService;