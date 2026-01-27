const { Pool } = require("pg");

// Database configuration for stock data
const stockDbConfig = {
  user: 'openpg',
  host: 'localhost',
  database: 'stock',
  password: 'openpgpwd',
  port: 5432,
};

// Create connection pool for stock data
const stockPool = new Pool(stockDbConfig);

class PriceSimulator {
  constructor(io) {
    this.io = io;
    this.activeSymbols = new Set();
    this.priceCache = new Map();
    this.ohlcCache = new Map(); // Cache for OHLC data
    this.gapHistory = new Map(); // Track price gaps
    this.updateInterval = null;
    this.intradayPosition = new Map(); // Track intraday position for each symbol
    this.sessionStart = new Date();
  }

  start() {
    console.log("🚀 Price simulator started");
    
    // Update prices every 5 seconds for demo purposes
    this.updateInterval = setInterval(() => {
      this.updatePrices();
    }, 5000);
    
    // Initial load of some popular stocks
    this.loadInitialStocks();
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log("⏹️ Price simulator stopped");
  }

  async loadInitialStocks() {
    try {
      const client = await stockPool.connect();

      // Get some popular IDX stocks for simulation with available data
      const query = `
        WITH latest_date AS (
          SELECT MAX("Tanggal Perdagangan Terakhir") as max_date
          FROM saham_data
        )
        SELECT "Kode Saham" as symbol,
               "Penutupan" as price,
               "Volume" as volume,
               "Tanggal Perdagangan Terakhir" as date
        FROM saham_data, latest_date
        WHERE "Tanggal Perdagangan Terakhir" = latest_date.max_date
          AND "Volume" > 1000000
        ORDER BY "Volume" DESC
        LIMIT 20
      `;

      const result = await client.query(query);
      client.release();

      // Initialize price cache with real data and simulation data
      result.rows.forEach(row => {
        this.priceCache.set(row.symbol, {
          symbol: row.symbol,
          price: parseFloat(row.price) || 100,
          volume: parseInt(row.volume) || 0,
          change: 0,
          changePercent: 0,
          timestamp: new Date(),
          intradayPosition: 0, // Track position within daily range (0-1)
          sessionStartPrice: parseFloat(row.price) || 100,
          dailyHigh: parseFloat(row.price) * 1.02, // Default 2% above current
          dailyLow: parseFloat(row.price) * 0.98,  // Default 2% below current
          dailyOpen: parseFloat(row.price),
          volatility: 0.005 // Base volatility factor
        });

        this.activeSymbols.add(row.symbol);
      });

      console.log(`📊 Loaded ${result.rows.length} stocks for simulation`);
    } catch (error) {
      console.error("Error loading initial stocks:", error);
    }
  }

  // Get OHLC data for a specific symbol and date
  async getOHLCData(symbol, date = null) {
    try {
      const client = await stockPool.connect();

      let query;
      let params;

      if (date) {
        query = `
          SELECT "Kode Saham" as symbol,
                 "Penutupan" as close,
                 "Volume" as volume,
                 "Tanggal Perdagangan Terakhir" as date
          FROM saham_data
          WHERE "Kode Saham" = $1 AND "Tanggal Perdagangan Terakhir" = $2
        `;
        params = [symbol, date];
      } else {
        // Get latest available data
        query = `
          SELECT "Kode Saham" as symbol,
                 "Penutupan" as close,
                 "Volume" as volume,
                 "Tanggal Perdagangan Terakhir" as date
          FROM saham_data
          WHERE "Kode Saham" = $1
          ORDER BY "Tanggal Perdagangan Terakhir" DESC
          LIMIT 1
        `;
        params = [symbol];
      }

      const result = await client.query(query, params);
      client.release();

      if (result.rows.length > 0) {
        return {
          symbol: result.rows[0].symbol,
          close: parseFloat(result.rows[0].close) || 0,
          volume: parseInt(result.rows[0].volume) || 0,
          date: result.rows[0].date
        };
      }

      return null;
    } catch (error) {
      console.error(`Error getting OHLC data for ${symbol}:`, error);
      return null;
    }
  }

  // Enhanced gap detection using Open Price and Penutupan (Close) from saham_data
  async detectPriceGaps(symbol) {
    try {
      const client = await stockPool.connect();

      const query = `
        SELECT "Kode Saham" as symbol,
               "Open Price" as open,
               "Penutupan" as close,
               "Tanggal Perdagangan Terakhir" as date
        FROM saham_data
        WHERE "Kode Saham" = $1
        ORDER BY "Tanggal Perdagangan Terakhir" DESC
        LIMIT 2
      `;

      const result = await client.query(query, [symbol]);
      client.release();

      if (result.rows.length >= 2) {
        const current = result.rows[0]; // Today's data
        const previous = result.rows[1]; // Yesterday's data

        const currentOpen = parseFloat(current.open) || 0;
        const previousClose = parseFloat(previous.close) || 0;

        if (previousClose > 0 && currentOpen > 0) {
          // Calculate gap between previous close and current open
          const gapPercent = ((currentOpen - previousClose) / previousClose) * 100;

          // If gap is greater than 2%, it's significant
          if (Math.abs(gapPercent) > 2) {
            const gapData = {
              symbol,
              gapPercent,
              currentOpen,
              previousClose,
              date: current.date,
              type: gapPercent > 0 ? 'gap_up' : 'gap_down',
              severity: Math.abs(gapPercent) > 5 ? 'high' : 'medium'
            };

            // Log gap detection with Winston
            global.logger.info(`[GapDetector] Gap detected for ${symbol}: ${gapPercent.toFixed(2)}% (${gapData.type}, ${gapData.severity} severity)`);

            return gapData;
          }
        }
      }

      return null;
    } catch (error) {
      global.logger.error(`[GapDetector] Error detecting gap for ${symbol}:`, error);
      return null;
    }
  }

  // Enhanced gap impact analysis with limit order management
  async analyzeGapImpact(symbol, gapData) {
    try {
      const impact = {
        symbol,
        gapSize: gapData.gapPercent,
        affectedOrders: [],
        suggestedActions: [],
        orderCancellations: []
      };

      // Analyze impact on limit orders based on gap direction and size
      if (gapData.type === 'gap_up' && gapData.gapPercent > 2) {
        // Gap up affects buy limit orders - they may become unexecutable
        impact.suggestedActions.push('review_buy_limit_orders');
        impact.suggestedActions.push('consider_gap_fill_reversal');

        // If gap is very large (>5%), suggest canceling unexecutable buy orders
        if (gapData.gapPercent > 5) {
          impact.orderCancellations.push({
            type: 'buy_limit',
            reason: 'Gap up makes limit price unexecutable',
            threshold: gapData.gapPercent
          });
        }
      } else if (gapData.type === 'gap_down' && gapData.gapPercent < -2) {
        // Gap down affects sell limit orders - they may become unexecutable
        impact.suggestedActions.push('review_sell_limit_orders');
        impact.suggestedActions.push('consider_gap_fill_reversal');

        // If gap is very large (<-5%), suggest canceling unexecutable sell orders
        if (gapData.gapPercent < -5) {
          impact.orderCancellations.push({
            type: 'sell_limit',
            reason: 'Gap down makes limit price unexecutable',
            threshold: gapData.gapPercent
          });
        }
      }

      // Log educational information about gap trading
      if (Math.abs(gapData.gapPercent) > 3) {
        impact.educationalNote = `Large ${gapData.type.replace('_', ' ')} detected. Gaps often fill within the first 30 minutes of trading.`;
      }

      global.logger.info(`[GapDetector] Impact analysis for ${symbol}:`, impact);
      return impact;
    } catch (error) {
      global.logger.error(`[GapDetector] Error analyzing gap impact for ${symbol}:`, error);
      return null;
    }
  }

  addSymbol(symbol) {
    if (!this.activeSymbols.has(symbol)) {
      this.activeSymbols.add(symbol);
      
      // Initialize with some base data if not exists
      if (!this.priceCache.has(symbol)) {
        this.priceCache.set(symbol, {
          symbol,
          price: 1000 + Math.random() * 4000, // Random price between 1000-5000
          volume: Math.floor(Math.random() * 10000000),
          change: 0,
          changePercent: 0,
          timestamp: new Date()
        });
      }
    }
  }

  removeSymbol(symbol) {
    this.activeSymbols.delete(symbol);
  }

  updatePrices() {
    const updates = [];

    this.activeSymbols.forEach(async symbol => {
      const currentData = this.priceCache.get(symbol);
      if (!currentData) return;

      try {
        // Enhanced realistic price simulation
        const simulatedData = await this.simulateRealisticPrice(symbol, currentData);

        if (simulatedData) {
          this.priceCache.set(symbol, simulatedData);
          updates.push(simulatedData);

          // Broadcast to clients subscribed to this symbol
          this.io.to(`${symbol}_idx`).emit("price_update", simulatedData);

          // Check for price gaps periodically
          if (Math.random() < 0.15) { // 15% chance each update for better detection
            const gap = await this.detectPriceGaps(symbol);
            if (gap) {
              // Analyze gap impact on potential orders
              const impact = await this.analyzeGapImpact(symbol, gap);

              // Send enhanced notification with localized message
              this.io.emit("notification", {
                type: "gap_detected",
                symbol: gap.symbol,
                message: `Price gap detected for ${gap.symbol}: ${gap.gapPercent > 0 ? '+' : ''}${gap.gapPercent.toFixed(2)}% (${gap.severity} severity)`,
                data: { ...gap, impact },
                timestamp: new Date(),
                localizedMessage: {
                  en: `Price gap detected for ${gap.symbol}: ${gap.gapPercent > 0 ? '+' : ''}${gap.gapPercent.toFixed(2)}% (${gap.severity} severity)`,
                  id: `Gap harga terdeteksi untuk ${gap.symbol}: ${gap.gapPercent > 0 ? '+' : ''}${gap.gapPercent.toFixed(2)}% (keparahan ${gap.severity})`
                }
              });

              // Log to gap-specific log file
              const fs = require('fs');
              const path = require('path');
              const gapLogPath = path.join(process.cwd(), 'logs', 'gap.log');
              const gapLog = `[${new Date().toISOString()}] Gap detected for ${gap.symbol}: ${gap.gapPercent.toFixed(2)}% (${gap.type}, ${gap.severity})\n`;
              fs.appendFile(gapLogPath, gapLog, (err) => {
                if (err) global.logger.error('[GapDetector] Error writing to gap log:', err);
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error updating price for ${symbol}:`, error);
      }
    });

    if (updates.length > 0) {
      console.log(`📈 Updated ${updates.length} stock prices`);

      // Broadcast market summary to all clients
      const marketSummary = {
        totalStocks: updates.length,
        gainers: updates.filter(s => s.change > 0).length,
        losers: updates.filter(s => s.change < 0).length,
        timestamp: new Date()
      };

      this.io.emit("market_summary", marketSummary);
    }
  }

  // Enhanced price simulation using OHLC data for realistic intraday movements
  async simulateRealisticPrice(symbol, currentData) {
    try {
      // Get latest OHLC data for realistic simulation within daily range
      const latestOHLC = await this.getOHLCData(symbol);

      if (latestOHLC) {
        // Update daily range based on latest OHLC data
        currentData.dailyHigh = Math.max(currentData.dailyHigh, latestOHLC.close * 1.02);
        currentData.dailyLow = Math.min(currentData.dailyLow, latestOHLC.close * 0.98);
        currentData.dailyOpen = latestOHLC.close;
      }

      // Enhanced dynamic volatility based on volume from OHLC data
      const baseVolume = latestOHLC ? latestOHLC.volume : (currentData.volume || 1000000);
      let volatilityMultiplier;

      if (baseVolume > 1000000) {
        volatilityMultiplier = 0.007; // High volume: ±0.7% volatility
      } else {
        volatilityMultiplier = 0.003; // Lower volume: ±0.3% volatility
      }

      // Simulate intraday movement within daily OHLC range
      const dailyRange = currentData.dailyHigh - currentData.dailyLow;
      const maxIntradayVolatility = dailyRange * 0.3; // Max 30% of daily range for intraday moves

      // Enhanced random walk with momentum and trend
      const momentum = (Math.random() - 0.5) * 0.02; // -1% to +1% momentum
      const trendBias = currentData.price * 0.0001 * (Math.random() - 0.45); // Slight trend bias
      const randomVolatility = (Math.random() - 0.5) * maxIntradayVolatility;
      const priceChange = (momentum + trendBias + randomVolatility);

      // Ensure price stays within reasonable bounds and OHLC range
      const maxChangePercent = volatilityMultiplier;
      const clampedChange = Math.max(-currentData.price * maxChangePercent,
                                   Math.min(currentData.price * maxChangePercent, priceChange));

      const newPrice = Math.max(currentData.dailyLow * 0.9, // Don't go below 90% of daily low
                               Math.min(currentData.dailyHigh * 1.1, // Don't go above 110% of daily high
                               currentData.price + clampedChange));

      // Realistic volume simulation based on price movement and OHLC data
      const volumeIntensity = Math.abs(clampedChange / currentData.price); // Higher movement = higher volume
      const volumeMultiplier = 0.9 + (volumeIntensity * 2) + (Math.random() * 0.2); // 0.9x to 2.2x
      const newVolume = Math.max(100000, baseVolume * volumeMultiplier);

      // Enhanced bid-ask spread simulation (0.1% of current price)
      const spreadPercent = 0.001; // 0.1% spread
      const spread = newPrice * spreadPercent;

      const change = newPrice - currentData.price;
      const changePercent = (change / currentData.price) * 100;

      return {
        symbol,
        price: Math.round(newPrice * 100) / 100,
        bid: Math.round((newPrice - spread) * 100) / 100,
        ask: Math.round((newPrice + spread) * 100) / 100,
        volume: Math.floor(newVolume),
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 10000) / 10000,
        timestamp: new Date(),
        dailyHigh: currentData.dailyHigh,
        dailyLow: currentData.dailyLow,
        dailyOpen: currentData.dailyOpen,
        spread: Math.round(spread * 100) / 100
      };
    } catch (error) {
      console.error(`[PriceSimulator] Error simulating price for ${symbol}:`, error);
      return null;
    }
  }

  getCurrentPrice(symbol) {
    return this.priceCache.get(symbol) || null;
  }

  getAllPrices() {
    return Array.from(this.priceCache.values());
  }
}

module.exports = PriceSimulator;