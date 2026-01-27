const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Helper function to get current price (simplified from stocks.js logic)
async function getCurrentPrice(symbol, market = 'idx') {
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

  // Fallback simulated price
  const basePrice = 1000 + Math.random() * 4000;
  return { symbol: originalSymbol, price: basePrice, date: new Date().toISOString() };
}

// GET /api/portfolio/balance - Get user's virtual balance
router.get("/balance", async (req, res) => {
  try {
    const userId = req.user.id;

    // First try to get existing balance
    let result = await pool.query(
      "SELECT balance, updated_at FROM user_balance WHERE user_id = $1",
      [userId]
    );

    // If no balance exists, create one with default value
    if (result.rows.length === 0) {
      await pool.query(
        "INSERT INTO user_balance (user_id, balance) VALUES ($1, $2)",
        [userId, 10000000.00] // Default 10 million
      );

      // Fetch the newly created balance
      result = await pool.query(
        "SELECT balance, updated_at FROM user_balance WHERE user_id = $1",
        [userId]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching balance:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/portfolio/buy - Buy shares
router.post("/buy", async (req, res) => {
  const { symbol, market = 'idx', quantity } = req.body;
  const userId = req.user.id;
  const feeRate = 0.001; // 0.1% fee

  if (!symbol || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "Invalid symbol or quantity" });
  }

  try {
    // Get current price
    const priceData = await getCurrentPrice(symbol, market);
    const price = priceData.price;
    const totalCost = quantity * price * (1 + feeRate);
    const fee = quantity * price * feeRate;

    // Check balance
    const balanceResult = await pool.query(
      "SELECT balance FROM user_balance WHERE user_id = $1",
      [userId]
    );

    if (balanceResult.rows.length === 0 || balanceResult.rows[0].balance < totalCost) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Begin transaction
    await pool.query("BEGIN");

    // Deduct from balance
    await pool.query(
      "UPDATE user_balance SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2",
      [totalCost, userId]
    );

    // Upsert holdings
    await pool.query(`
      INSERT INTO user_holdings (user_id, symbol, market, quantity, avg_price)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, symbol, market)
      DO UPDATE SET quantity = user_holdings.quantity + $4,
                    avg_price = ((user_holdings.quantity * user_holdings.avg_price) + ($4 * $5)) / (user_holdings.quantity + $4),
                    updated_at = CURRENT_TIMESTAMP
    `, [userId, symbol.toUpperCase(), market, quantity, price]);

    // Record transaction
    await pool.query(
      "INSERT INTO user_transactions (user_id, symbol, market, type, quantity, price, total_amount, fee) VALUES ($1, $2, $3, 'buy', $4, $5, $6, $7)",
      [userId, symbol.toUpperCase(), market, quantity, price, totalCost, fee]
    );

    await pool.query("COMMIT");

    res.json({ success: true, totalCost, fee, newPrice: price });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error buying shares:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/portfolio/sell - Sell shares
router.post("/sell", async (req, res) => {
  const { symbol, market = 'idx', quantity } = req.body;
  const userId = req.user.id;
  const feeRate = 0.001; // 0.1% fee

  if (!symbol || !quantity || quantity <= 0) {
    return res.status(400).json({ error: "Invalid symbol or quantity" });
  }

  try {
    // Get current price and holdings
    const priceData = await getCurrentPrice(symbol, market);
    const price = priceData.price;
    const totalProceeds = quantity * price * (1 - feeRate);
    const fee = quantity * price * feeRate;

    const holdingsResult = await pool.query(
      "SELECT quantity, avg_price FROM user_holdings WHERE user_id = $1 AND symbol = $2 AND market = $3",
      [userId, symbol.toUpperCase(), market]
    );

    if (holdingsResult.rows.length === 0 || holdingsResult.rows[0].quantity < quantity) {
      return res.status(400).json({ error: "Insufficient holdings" });
    }

    // Begin transaction
    await pool.query("BEGIN");

    // Add to balance
    await pool.query(
      "UPDATE user_balance SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2",
      [totalProceeds, userId]
    );

    // Update holdings
    const newQuantity = holdingsResult.rows[0].quantity - quantity;
    if (newQuantity > 0) {
      await pool.query(
        "UPDATE user_holdings SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND symbol = $3 AND market = $4",
        [newQuantity, userId, symbol.toUpperCase(), market]
      );
    } else {
      await pool.query(
        "DELETE FROM user_holdings WHERE user_id = $1 AND symbol = $2 AND market = $3",
        [userId, symbol.toUpperCase(), market]
      );
    }

    // Record transaction
    await pool.query(
      "INSERT INTO user_transactions (user_id, symbol, market, type, quantity, price, total_amount, fee) VALUES ($1, $2, $3, 'sell', $4, $5, $6, $7)",
      [userId, symbol.toUpperCase(), market, quantity, price, totalProceeds, fee]
    );

    await pool.query("COMMIT");

    res.json({ success: true, totalProceeds, fee, newPrice: price });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Error selling shares:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/portfolio/holdings - Get user's holdings with current values
router.get("/holdings", async (req, res) => {
  const userId = req.user.id;

  try {
    const holdingsResult = await pool.query(`
      SELECT uh.symbol, uh.market, uh.quantity, uh.avg_price, uh.created_at, uh.updated_at,
             si.sector, si.name as company_name
      FROM user_holdings uh
      LEFT JOIN stocks_info si ON uh.symbol = si.symbol AND uh.market = si.market
      WHERE uh.user_id = $1
    `, [userId]);

    const holdings = holdingsResult.rows;
    let totalValue = 0;

    // Fetch current prices for each holding
    for (let holding of holdings) {
      const priceData = await getCurrentPrice(holding.symbol, holding.market);
      holding.currentPrice = priceData.price;
      holding.currentValue = holding.quantity * priceData.price;
      holding.unrealizedPnl = holding.currentValue - (holding.quantity * holding.avg_price);
      holding.unrealizedPnlPercent = holding.avg_price > 0 ? (holding.unrealizedPnl / (holding.quantity * holding.avg_price)) * 100 : 0;
      totalValue += holding.currentValue;
      // Sector from join
      holding.sector = holding.sector || 'Unknown';
      holding.companyName = holding.company_name || holding.symbol;
    }

    // Get balance
    const balanceResult = await pool.query(
      "SELECT balance FROM user_balance WHERE user_id = $1",
      [userId]
    );
    const balance = balanceResult.rows[0]?.balance || 0;
    const portfolioValue = balance + totalValue;

    res.json({
      holdings,
      balance,
      totalHoldingsValue: totalValue,
      portfolioValue,
      cashPercentage: (balance / portfolioValue) * 100,
      holdingsPercentage: (totalValue / portfolioValue) * 100
    });
  } catch (err) {
    console.error("Error fetching holdings:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/portfolio/history - Get transaction history
router.get("/history", async (req, res) => {
  const userId = req.user.id;
  const { limit = 50, offset = 0 } = req.query;

  try {
    const result = await pool.query(
      `SELECT * FROM user_transactions 
       WHERE user_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    // Add current price for reference
    for (let tx of result.rows) {
      const priceData = await getCurrentPrice(tx.symbol, tx.market);
      tx.currentPrice = priceData.price;
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching history:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/portfolio/leaderboard - Get top users by portfolio value
router.get("/leaderboard", async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    // Get all users with balance
    const usersResult = await pool.query(`
      SELECT u.id, u.email, ub.balance 
      FROM users u 
      JOIN user_balance ub ON u.id = ub.user_id
    `);

    let leaderboard = [];
    for (let user of usersResult.rows) {
      // Get holdings value
      const holdingsResult = await pool.query(
        "SELECT symbol, market, quantity FROM user_holdings WHERE user_id = $1",
        [user.id]
      );

      let holdingsValue = 0;
      for (let holding of holdingsResult.rows) {
        const priceData = await getCurrentPrice(holding.symbol, holding.market);
        holdingsValue += holding.quantity * priceData.price;
      }

      const portfolioValue = user.balance + holdingsValue;
      leaderboard.push({
        id: user.id,
        email: user.email.split('@')[0], // Anonymize
        portfolioValue: Math.round(portfolioValue),
        balance: Math.round(user.balance),
        holdingsValue: Math.round(holdingsValue),
        rank: 0 // To be assigned
      });
    }

    // Sort and assign ranks
    leaderboard.sort((a, b) => b.portfolioValue - a.portfolioValue);
    leaderboard.slice(0, parseInt(limit)).forEach((user, index) => {
      user.rank = index + 1;
    });

    res.json({ leaderboard: leaderboard.slice(0, parseInt(limit)) });
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;