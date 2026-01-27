const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger').console;
const inMemoryCache = require('../utils/cache');

// ML Forecast Service Class
class MLForecastService {

  /**
   * Get volatility forecast for a symbol using ML model
   * @param {string} symbol - Stock symbol
   * @param {number} days - Number of days to forecast (default: 7)
   * @returns {Object} Forecast data with volatility predictions
   */
  static async getForecast(symbol, days = 7) {
    const cacheKey = `ml_forecast:${symbol}:${days}`;

    try {
      // Check cache first (skip in development mode)
      if (process.env.NODE_ENV !== 'development') {
        const cachedData = inMemoryCache.get(cacheKey);
        if (cachedData) {
          logger.info(`Returning cached forecast data for ${symbol}`);
          return cachedData;
        }
      }

      logger.info(`Generating ML forecast for ${symbol} (${days} days)`);

      // Spawn Python ML script
      const pythonScript = path.join(__dirname, '..', 'scripts', 'ml_forecast.py');
      const pythonProcess = spawn('python', [pythonScript, symbol, days.toString()]);

      // Handle stdout data
      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      // Wait for process to complete
      const exitCode = await new Promise((resolve) => {
        pythonProcess.on('close', resolve);
      });

      if (exitCode !== 0) {
        logger.error(`Python ML script failed for ${symbol}:`, stderrData);
        throw new Error(`ML script failed: ${stderrData}`);
      }

      // Parse JSON response from Python script
      const forecastData = JSON.parse(stdoutData);

      // Cache the result for 5 minutes (skip in development mode)
      if (process.env.NODE_ENV !== 'development') {
        inMemoryCache.set(cacheKey, forecastData, 300);
      }

      logger.info(`Successfully generated ML forecast for ${symbol}`);
      return forecastData;

    } catch (error) {
      logger.error(`Error generating ML forecast for ${symbol}:`, error.message);

      // Return mock forecast data for testing/fallback
      logger.info(`Returning mock forecast data for ${symbol} due to ML error`);
      return this.getMockForecastData(symbol, days);
    }
  }

  /**
   * Get mock forecast data for testing
   * @param {string} symbol - Stock symbol
   * @param {number} days - Number of days
   * @returns {Object} Mock forecast data
   */
  static getMockForecastData(symbol, days) {
    const baseVolatility = 0.02 + Math.random() * 0.03; // 2-5% base volatility
    const forecastVol = [];

    for (let i = 0; i < days; i++) {
      // Generate slightly increasing/decreasing volatility trend
      const trend = (Math.random() - 0.5) * 0.001;
      const volatility = Math.max(0.01, Math.min(0.08, baseVolatility + trend * i));
      forecastVol.push(Math.round(volatility * 10000) / 10000); // Round to 4 decimal places
    }

    const avgVol = forecastVol.reduce((sum, vol) => sum + vol, 0) / forecastVol.length;
    const confidence = 0.75 + Math.random() * 0.2; // 75-95% confidence

    return {
      symbol: symbol,
      forecast_vol: forecastVol,
      confidence: Math.round(confidence * 100) / 100,
      signal: avgVol < 0.025 ? 'BUY' : avgVol < 0.035 ? 'HOLD' : 'SELL',
      avg_volatility: Math.round(avgVol * 10000) / 10000,
      source: 'mock'
    };
  }
}

module.exports = MLForecastService;