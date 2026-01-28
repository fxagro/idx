const express = require("express");
const router = express.Router();
const { getPool } = require("../config/db");
const { authenticateToken } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authenticateToken);

// Helper function to get current price (simplified from stocks.js logic)
async function getCurrentPrice(symbol, market = 'idx') {
  const pool = getPool();
  const originalSymbol = symbol.toUpperCase();
  const symbolVariations = [originalSymbol, `${originalSymbol}.JK`, originalSymbol.replace('.JK', '')];

  for (const searchSymbol of symbolVariations) {
    try {
      const result = await pool.query(`
        SELECT "Penutupan" as close,
               "Tanggal Perdagangan Terakhir" as date
        FROM saham_data
        WHERE "Kode Saham" = $1
        ORDER BY "Tanggal Perdagangan Terakhir" DESC
        LIMIT 1
      `, [searchSymbol]);

      if (result.rows.length > 0) {
        return {
          symbol: searchSymbol,
          price: parseFloat(result.rows[0].close),
          date: result.rows[0].date
        };
      }
    } catch (err) {
      console.error(`Error fetching price for ${searchSymbol}:`, err);
    }
  }

  // Try database fallback for popular stocks
  try {
    console.log(`📊 Trying database fallback for ${originalSymbol}`);
    const dbResult = await pool.query(`
      SELECT "Penutupan" as close, "Tanggal Perdagangan Terakhir" as date
      FROM saham_data
      WHERE "Kode Saham" = $1
      ORDER BY "Tanggal Perdagangan Terakhir" DESC
      LIMIT 1
    `, [originalSymbol]);

    if (dbResult.rows.length > 0) {
      console.log(`✅ Found database price for ${originalSymbol}: ${dbResult.rows[0].close}`);
      return {
        symbol: originalSymbol,
        price: parseFloat(dbResult.rows[0].close),
        date: dbResult.rows[0].date
      };
    }
  } catch (dbError) {
    console.error(`❌ Database fallback failed for ${originalSymbol}:`, dbError.message);
  }

  // Final fallback simulated price
  const basePrice = 1000 + Math.random() * 4000;
  console.log(`📊 Using simulated price for ${originalSymbol}: ${basePrice}`);
  return { symbol: originalSymbol, price: basePrice, date: new Date().toISOString() };
}

// GET /api/stocks/virtual/portfolio - Get user's virtual portfolio
router.get("/portfolio", async (req, res) => {
  const pool = getPool();
  const userId = req.user.id;

  try {
    const portfolioResult = await pool.query(`
      SELECT vp.symbol, vp.qty, vp.avg_price,
             si.sector, si.name as company_name
      FROM virtual_portfolio vp
      LEFT JOIN stocks_info si ON vp.symbol = si.symbol
      WHERE vp.user_id = $1
    `, [userId]);

    const portfolio = portfolioResult.rows;
    let totalValue = 0;

    // Fetch current prices for each holding
    for (let item of portfolio) {
      const priceData = await getCurrentPrice(item.symbol);
      item.current_price = priceData.price;
      item.current_value = item.qty * priceData.price;
      item.gain_loss = item.current_value - (item.qty * item.avg_price);
      item.gain_loss_percent = item.avg_price > 0 ? (item.gain_loss / (item.qty * item.avg_price)) * 100 : 0;
      totalValue += item.current_value;
      item.sector = item.sector || 'Unknown';
      item.company_name = item.company_name || item.symbol;
    }

    res.json({ portfolio });
  } catch (err) {
    console.error("Error fetching virtual portfolio:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/stocks/virtual/history - Get virtual transaction history
router.get("/history", async (req, res) => {
  const pool = getPool();
  const userId = req.user.id;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const result = await pool.query(
      `SELECT * FROM virtual_transactions
       WHERE user_id = $1
       ORDER BY transaction_date DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    res.json({ transactions: result.rows });
  } catch (err) {
    console.error("Error fetching virtual history:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/stocks/virtual/buy - Enhanced buy orders with realistic execution and slippage
router.post("/buy", async (req, res) => {
  const pool = getPool();
  const { symbol, quantity, orderType = 'market', limitPrice } = req.body;
  const userId = req.user.id;

  if (!symbol || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "Invalid symbol or quantity" });
  }

  // Validate lot size (100 shares per lot for IDX)
  if (quantity % 100 !== 0) {
    return res.status(400).json({
      error: `Quantity must be in multiples of 100 (1 lot). Received: ${quantity}`
    });
  }

  try {
    // Get current market data with enhanced price simulation
    const priceData = await getCurrentPrice(symbol);
    const marketPrice = priceData.price;
    const bidPrice = priceData.bid || (marketPrice * 0.999); // 0.1% spread if not available
    const askPrice = priceData.ask || (marketPrice * 1.001);

    let executionPrice = marketPrice;
    let totalCost;
    let slippageInfo = {};

    if (orderType === 'limit' && limitPrice) {
      // Enhanced limit order validation using OHLC data
      const ohlcQuery = `
        SELECT "Open Price" as open, "Tertinggi" as high, "Terendah" as low, "Penutupan" as close
        FROM saham_data
        WHERE "Kode Saham" = $1 AND "Tanggal Perdagangan Terakhir" = CURRENT_DATE
        LIMIT 1
      `;

      const ohlcResult = await pool.query(ohlcQuery, [symbol.toUpperCase()]);
      const dailyRange = ohlcResult.rows[0];

      if (dailyRange) {
        // Check if limit price is within daily range
        if (limitPrice < dailyRange.low * 0.95 || limitPrice > dailyRange.high * 1.05) {
          return res.status(400).json({
            error: `Limit price (${limitPrice}) is outside reasonable daily range (${dailyRange.low} - ${dailyRange.high})`
          });
        }
      }

      // For limit orders, check if market price meets limit price
      if (marketPrice > limitPrice) {
        return res.status(400).json({
          error: `Limit price (${limitPrice}) is below current market price (${marketPrice}). Limit orders must be at or above market price for buy orders.`
        });
      }
      executionPrice = limitPrice;
    } else if (orderType === 'market') {
      // Enhanced market order execution with slippage simulation
      executionPrice = askPrice;

      // Simulate slippage for large orders (0.1-0.3% additional slippage)
      const slippagePercent = quantity > 1000 ? 0.002 + (Math.random() * 0.001) : 0.001 + (Math.random() * 0.001);
      const slippageAmount = executionPrice * slippagePercent;
      executionPrice += slippageAmount;

      slippageInfo = {
        slippagePercent: Math.round(slippagePercent * 10000) / 100,
        slippageAmount: Math.round(slippageAmount * 100) / 100
      };
    }

    // Calculate transaction fees (IDX standard: 0.19% buy, 0.29% sell)
    const baseCost = quantity * executionPrice;
    const fee = baseCost * 0.0019; // 0.19% buy fee
    totalCost = baseCost + fee;

    // Check virtual balance
    const balanceResult = await pool.query(
      "SELECT virtual_saldo FROM users WHERE id = $1",
      [userId]
    );

    if (balanceResult.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    if (balanceResult.rows[0].virtual_saldo < totalCost) {
      return res.status(400).json({
        error: `Insufficient virtual balance. Required: ${totalCost.toFixed(2)} IDR, Available: ${balanceResult.rows[0].virtual_saldo.toFixed(2)} IDR`
      });
    }

    // Begin transaction
    await pool.query("BEGIN");

    // Deduct from virtual balance (including fees)
    await pool.query(
      "UPDATE users SET virtual_saldo = virtual_saldo - $1 WHERE id = $2",
      [totalCost, userId]
    );

    // Enhanced portfolio upsert with average price calculations
    await pool.query(`
      INSERT INTO virtual_portfolio (user_id, symbol, qty, avg_price)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, symbol)
      DO UPDATE SET qty = virtual_portfolio.qty + $3,
                     avg_price = ((virtual_portfolio.qty * virtual_portfolio.avg_price) + ($3 * $4)) / (virtual_portfolio.qty + $3)
    `, [userId, symbol.toUpperCase(), quantity, executionPrice]);

    // Record enhanced virtual transaction
    await pool.query(
      "INSERT INTO virtual_transactions (user_id, symbol, type, qty, price, total_amount, fees, order_type) VALUES ($1, $2, 'BUY', $3, $4, $5, $6, $7)",
      [userId, symbol.toUpperCase(), quantity, executionPrice, baseCost, fee, orderType]
    );

    await pool.query("COMMIT");

    // Enhanced logging with Winston
    global.logger.info(`[VirtualTrading] User ${userId} executed ${orderType} BUY order: ${quantity} shares of ${symbol} at ${executionPrice} (fee: ${fee.toFixed(2)}, total: ${totalCost.toFixed(2)})`);

    res.json({
      success: true,
      orderType,
      symbol: symbol.toUpperCase(),
      quantity,
      executionPrice: Math.round(executionPrice * 100) / 100,
      marketPrice: Math.round(marketPrice * 100) / 100,
      bidPrice: Math.round(bidPrice * 100) / 100,
      askPrice: Math.round(askPrice * 100) / 100,
      fee: Math.round(fee * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      remainingBalance: Math.round((balanceResult.rows[0].virtual_saldo - totalCost) * 100) / 100,
      slippageInfo: orderType === 'market' ? slippageInfo : null
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    global.logger.error(`[VirtualTrading] Error executing buy order for user ${userId}, symbol ${symbol}:`, err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/stocks/virtual/sell - Enhanced sell orders with realistic execution and slippage
router.post("/sell", async (req, res) => {
  const pool = getPool();
  const { symbol, quantity, orderType = 'market', limitPrice } = req.body;
  const userId = req.user.id;

  if (!symbol || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "Invalid symbol or quantity" });
  }

  // Validate lot size (100 shares per lot for IDX)
  if (quantity % 100 !== 0) {
    return res.status(400).json({ error: "Quantity must be in multiples of 100 (1 lot)" });
  }

  try {
    // Get current market data with bid-ask spread
    const priceData = await getCurrentPrice(symbol);
    const marketPrice = priceData.price;
    const bidPrice = priceData.bid || (marketPrice * 0.999);
    const askPrice = priceData.ask || (marketPrice * 1.001);

    let executionPrice = marketPrice;
    let totalProceeds;
    let slippageInfo = {};

    if (orderType === 'limit' && limitPrice) {
      // Enhanced limit order validation using OHLC data
      const ohlcQuery = `
        SELECT "Open Price" as open, "Tertinggi" as high, "Terendah" as low, "Penutupan" as close
        FROM saham_data
        WHERE "Kode Saham" = $1 AND "Tanggal Perdagangan Terakhir" = CURRENT_DATE
        LIMIT 1
      `;

      const ohlcResult = await pool.query(ohlcQuery, [symbol.toUpperCase()]);
      const dailyRange = ohlcResult.rows[0];

      if (dailyRange) {
        // Check if limit price is within daily range
        if (limitPrice < dailyRange.low * 0.95 || limitPrice > dailyRange.high * 1.05) {
          return res.status(400).json({
            error: `Limit price (${limitPrice}) is outside reasonable daily range (${dailyRange.low} - ${dailyRange.high})`
          });
        }
      }

      // For limit orders, check if market price meets limit price
      if (marketPrice < limitPrice) {
        return res.status(400).json({
          error: `Limit price (${limitPrice}) is above current market price (${marketPrice}). Limit orders must be at or below market price for sell orders.`
        });
      }
      executionPrice = limitPrice;
    } else if (orderType === 'market') {
      // Enhanced market order execution with slippage simulation
      executionPrice = bidPrice; // Use bid price for market sell orders

      // Simulate slippage for large orders (0.1-0.3% additional slippage)
      const slippagePercent = quantity > 1000 ? 0.002 + (Math.random() * 0.001) : 0.001 + (Math.random() * 0.001);
      const slippageAmount = executionPrice * slippagePercent;
      executionPrice -= slippageAmount; // Slippage reduces sell price

      slippageInfo = {
        slippagePercent: Math.round(slippagePercent * 10000) / 100,
        slippageAmount: Math.round(slippageAmount * 100) / 100
      };
    }

    // Check virtual holdings first
    const holdingsResult = await pool.query(
      "SELECT qty, avg_price FROM virtual_portfolio WHERE user_id = $1 AND symbol = $2",
      [userId, symbol.toUpperCase()]
    );

    if (holdingsResult.rows.length === 0 || holdingsResult.rows[0].qty < quantity) {
      return res.status(400).json({
        error: `Insufficient virtual holdings. Available: ${holdingsResult.rows[0]?.qty || 0} shares`
      });
    }

    // Calculate transaction fees (IDX standard: 0.19% buy, 0.29% sell)
    const baseProceeds = quantity * executionPrice;
    const fee = baseProceeds * 0.0029; // 0.29% sell fee
    totalProceeds = baseProceeds - fee;

    // Begin transaction
    await pool.query("BEGIN");

    // Add net proceeds to virtual balance (after fees)
    await pool.query(
      "UPDATE users SET virtual_saldo = virtual_saldo + $1 WHERE id = $2",
      [totalProceeds, userId]
    );

    // Update virtual portfolio
    const currentHoldings = holdingsResult.rows[0];
    const newQuantity = currentHoldings.qty - quantity;

    if (newQuantity > 0) {
      await pool.query(
        "UPDATE virtual_portfolio SET qty = $1 WHERE user_id = $2 AND symbol = $3",
        [newQuantity, userId, symbol.toUpperCase()]
      );
    } else {
      await pool.query(
        "DELETE FROM virtual_portfolio WHERE user_id = $1 AND symbol = $2",
        [userId, symbol.toUpperCase()]
      );
    }

    // Record enhanced virtual transaction with fees
    await pool.query(
      "INSERT INTO virtual_transactions (user_id, symbol, type, qty, price, total_amount, fees, order_type) VALUES ($1, $2, 'SELL', $3, $4, $5, $6, $7)",
      [userId, symbol.toUpperCase(), quantity, executionPrice, baseProceeds, fee, orderType]
    );

    await pool.query("COMMIT");

    // Enhanced logging with Winston
    global.logger.info(`[VirtualTrading] User ${userId} executed ${orderType} SELL order: ${quantity} shares of ${symbol} at ${executionPrice} (fee: ${fee.toFixed(2)}, proceeds: ${totalProceeds.toFixed(2)})`);

    res.json({
      success: true,
      orderType,
      symbol: symbol.toUpperCase(),
      quantity,
      executionPrice: Math.round(executionPrice * 100) / 100,
      marketPrice: Math.round(marketPrice * 100) / 100,
      bidPrice: Math.round(bidPrice * 100) / 100,
      askPrice: Math.round(askPrice * 100) / 100,
      fee: Math.round(fee * 100) / 100,
      totalProceeds: Math.round(totalProceeds * 100) / 100,
      realizedPnL: Math.round((executionPrice - currentHoldings.avg_price) * quantity * 100) / 100,
      remainingHoldings: newQuantity,
      slippageInfo: orderType === 'market' ? slippageInfo : null
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    global.logger.error(`[VirtualTrading] Error executing sell order for user ${userId}, symbol ${symbol}:`, err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;