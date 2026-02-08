const { getPool } = require('../config/db');

// Helper function to safely query database with fallback
async function safeQuery(pool, query, params, fallback = []) {
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    // Check if error is due to missing table
    if (error.code === '42P01') { // undefined_table
      console.warn(`[Dashboard] Table not found for query, returning fallback data`);
      return { rows: fallback };
    }
    // Check if error is due to database not existing or connection issues
    if (error.code === '3D000' || error.code === 'ECONNREFUSED' || error.code === '28P01') {
      console.warn(`[Dashboard] Database connection error (${error.code}), returning fallback data`);
      return { rows: fallback };
    }
    throw error;
  }
}

// Fallback data when database is not available
const getFallbackDashboardData = (userId, userEmail = null) => {
  const email = userEmail || 'user@example.com';
  return {
    user: {
      id: userId || 1,
      email: email,
      username: email.split('@')[0]
    },
    portfolio: {
      stocks: [],
      summary: {
        total_value: 0,
        total_investment: 0,
        total_gain_loss: 0,
        total_gain_loss_percent: 0,
        top_performers: []
      }
    },
    watchlist: [],
    transactions: [],
    market_data: {
      indices: [
        { symbol: 'IHSG', price: 7200, change: 25, change_percent: 0.35 },
        { symbol: 'LQ45', price: 980, change: 5, change_percent: 0.51 }
      ],
      trending: [],
      ihsg_chart: []
    },
    ai_quota: {
      remaining: 10,
      used: 0
    }
  };
};

// Get comprehensive dashboard summary for a user
const getDashboardSummary = async (userId, tokenEmail = null) => {
  console.log(`[Dashboard] Fetching dashboard summary for user ${userId}`);
  let pool;
  let userData = null;
  let aiQuota = 10;

  try {
    pool = getPool();
  } catch (dbError) {
    console.warn(`[Dashboard] Failed to get database pool: ${dbError.message}`);
    pool = null;
  }

  // Try to fetch user data from database first
  if (pool) {
    try {
      const userQuery = 'SELECT id, email FROM users WHERE id = $1';
      const userResult = await safeQuery(pool, userQuery, [userId]);
      if (userResult.rows[0]) {
        userData = {
          id: userResult.rows[0].id,
          email: userResult.rows[0].email,
          username: userResult.rows[0].email.split('@')[0]
        };
        console.log(`[Dashboard] User data fetched from database:`, userData);
      } else {
        console.warn(`[Dashboard] User not found in database for ID: ${userId}`);
      }

      const quotaQuery = 'SELECT ai_quota FROM users WHERE id = $1';
      const quotaResult = await safeQuery(pool, quotaQuery, [userId]);
      aiQuota = quotaResult.rows[0]?.ai_quota || 10;
    } catch (userError) {
      console.warn(`[Dashboard] Failed to fetch user data: ${userError.message}`);
      // Continue without database - we'll use token data or fallback
    }
  }

  // If userData is still null, try to use token email if provided
  if (!userData && tokenEmail) {
    userData = {
      id: userId,
      email: tokenEmail,
      username: tokenEmail.split('@')[0]
    };
    console.log(`[Dashboard] Using user data from token:`, userData);
  } else if (!userData) {
    // Last resort fallback - should rarely happen
    userData = {
      id: userId,
      email: 'user@example.com',
      username: 'username'
    };
    console.warn(`[Dashboard] Using hardcoded fallback user data`);
  }

  try {
    // Get portfolio data with current prices
    const portfolioQuery = `
      SELECT
        vp.symbol,
        vp.qty,
        vp.avg_price,
        sd."Penutupan" AS current_price,
        sd."Selisih" AS change,
        sd."Sebelumnya" AS previous_price,
        si.name as company_name,
        si.sector
      FROM virtual_portfolio vp
      JOIN saham_data sd ON vp.symbol = sd."Kode Saham"
      LEFT JOIN stocks_info si ON vp.symbol = si.symbol
      WHERE vp.user_id = $1
        AND sd."Tanggal Perdagangan Terakhir" = CURRENT_DATE
      ORDER BY vp.updated_at DESC
    `;

    const portfolioResult = await safeQuery(pool, portfolioQuery, [userId]);
    const portfolio = portfolioResult.rows;

    // Calculate portfolio metrics
    let totalValue = 0;
    let totalInvestment = 0;
    let topPerformers = [];

    portfolio.forEach(stock => {
      const currentPrice = parseFloat(stock.current_price) || 0;
      const quantity = parseInt(stock.qty) || 0;
      const avgPrice = parseFloat(stock.avg_price) || 0;

      const currentValue = currentPrice * quantity;
      const investment = avgPrice * quantity;
      const gainLoss = currentValue - investment;
      const gainLossPercent = investment > 0 ? (gainLoss / investment) * 100 : 0;

      totalValue += currentValue;
      totalInvestment += investment;

      topPerformers.push({
        symbol: stock.symbol,
        company_name: stock.company_name || stock.symbol,
        current_price: currentPrice,
        change_percent: stock.previous_price > 0 ?
          ((currentPrice - parseFloat(stock.previous_price)) / parseFloat(stock.previous_price)) * 100 : 0,
        gain_loss: gainLoss,
        gain_loss_percent: gainLossPercent,
        quantity: quantity,
        sector: stock.sector || 'Unknown'
      });
    });

    // Sort by gain/loss percentage and get top 3
    topPerformers.sort((a, b) => b.gain_loss_percent - a.gain_loss_percent);
    const top3Performers = topPerformers.slice(0, 3);

    const totalGainLoss = totalValue - totalInvestment;
    const totalGainLossPercent = totalInvestment > 0 ? (totalGainLoss / totalInvestment) * 100 : 0;

    // Get watchlist data
    const watchlistQuery = `
      SELECT
        uw.symbol,
        sd."Penutupan" AS current_price,
        sd."Selisih" AS change,
        sd."Sebelumnya" AS previous_price,
        si.name as company_name
      FROM user_watchlist uw
      JOIN saham_data sd ON uw.symbol = sd."Kode Saham"
      LEFT JOIN stocks_info si ON uw.symbol = si.symbol
      WHERE uw.user_id = $1
        AND sd."Tanggal Perdagangan Terakhir" = CURRENT_DATE
      ORDER BY uw.added_at DESC
    `;

    const watchlistResult = await safeQuery(pool, watchlistQuery, [userId]);
    const watchlist = watchlistResult.rows.map(stock => ({
      symbol: stock.symbol,
      company_name: stock.company_name || stock.symbol,
      current_price: parseFloat(stock.current_price) || 0,
      change: parseFloat(stock.change) || 0,
      change_percent: stock.previous_price > 0 ?
        ((parseFloat(stock.current_price) - parseFloat(stock.previous_price)) / parseFloat(stock.previous_price)) * 100 : 0
    }));

    // Get recent transactions (last 5)
    const transactionsQuery = `
      SELECT
        created_at,
        symbol,
        type,
        qty,
        price,
        total_amount
      FROM virtual_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `;

    const transactionsResult = await safeQuery(pool, transactionsQuery, [userId]);
    const transactions = transactionsResult.rows.map(transaction => ({
      date: transaction.created_at,
      symbol: transaction.symbol,
      type: transaction.type,
      quantity: parseInt(transaction.qty),
      price: parseFloat(transaction.price),
      total_amount: parseFloat(transaction.total_amount)
    }));

    // Get market indices (IHSG and LQ45)
    const indicesQuery = `
      SELECT
        "Kode Indeks" as symbol,
        "Penutupan" as price,
        "Selisih" as change,
        "Sebelumnya" as previous_price
      FROM index_data
      WHERE "Kode Indeks" IN ('IHSG', 'LQ45')
        AND "Tanggal Perdagangan Terakhir" = CURRENT_DATE
      ORDER BY "Kode Indeks"
    `;

    const indicesResult = await safeQuery(pool, indicesQuery, []);
    const indices = indicesResult.rows.map(index => ({
      symbol: index.symbol,
      price: parseFloat(index.price) || 0,
      change: parseFloat(index.change) || 0,
      change_percent: index.previous_price > 0 ?
        ((parseFloat(index.price) - parseFloat(index.previous_price)) / parseFloat(index.previous_price)) * 100 : 0
    }));

    // Get trending stocks (top 5 by volume)
    const trendingQuery = `
      SELECT
        "Kode Saham" as symbol,
        "Nama Perusahaan" as company_name,
        "Penutupan" as price,
        "Volume" as volume,
        "Selisih" as change,
        "Sebelumnya" as previous_price
      FROM saham_data
      WHERE "Tanggal Perdagangan Terakhir" = CURRENT_DATE
        AND "Volume" > 0
      ORDER BY "Volume" DESC
      LIMIT 5
    `;

    const trendingResult = await safeQuery(pool, trendingQuery, []);
    const trending = trendingResult.rows.map(stock => ({
      symbol: stock.symbol,
      company_name: stock.company_name || stock.symbol,
      price: parseFloat(stock.price) || 0,
      volume: parseInt(stock.volume) || 0,
      change: parseFloat(stock.change) || 0,
      change_percent: stock.previous_price > 0 ?
        ((parseFloat(stock.price) - parseFloat(stock.previous_price)) / parseFloat(stock.previous_price)) * 100 : 0
    }));

     // Get IHSG historical data for chart (last 30 days)
     const ihsgChartQuery = `
       SELECT
         "Tanggal Perdagangan Terakhir" as date,
         "Penutupan" as price
       FROM index_data
       WHERE "Kode Indeks" = 'IHSG'
         AND "Tanggal Perdagangan Terakhir" >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY "Tanggal Perdagangan Terakhir"
     `;

     const ihsgChartResult = await safeQuery(pool, ihsgChartQuery, []);
     const ihsgChartData = ihsgChartResult.rows.map(row => ({
       date: row.date,
       price: parseFloat(row.price) || 0
     }));

     console.log(`[Dashboard] Successfully fetched dashboard data for user ${userId}`);

     return {
       user: {
         id: userData?.id || userId,
         email: userData?.email || 'user@example.com',
         username: userData?.username || 'username'
       },
       portfolio: {
         stocks: portfolio,
         summary: {
           total_value: Math.round(totalValue * 100) / 100,
           total_investment: Math.round(totalInvestment * 100) / 100,
           total_gain_loss: Math.round(totalGainLoss * 100) / 100,
           total_gain_loss_percent: Math.round(totalGainLossPercent * 100) / 100,
           top_performers: top3Performers
         }
       },
       watchlist: watchlist,
       transactions: transactions,
       market_data: {
         indices: indices,
         trending: trending,
         ihsg_chart: ihsgChartData
       },
       ai_quota: {
         remaining: aiQuota,
         used: 10 - aiQuota // Assuming default quota of 10
       }
     };

  } catch (error) {
    console.error(`[Dashboard] Error fetching dashboard summary for user ${userId}:`, error);
    // Return fallback data instead of throwing error to prevent dashboard from crashing
    console.warn(`[Dashboard] Returning fallback data due to error`);
    return getFallbackDashboardData(userId, tokenEmail);
  }
};

// Get portfolio allocation data for pie chart
const getPortfolioAllocation = async (userId) => {
  try {
    console.log(`[Dashboard] Fetching portfolio allocation for user ${userId}`);
    const pool = getPool();

    const allocationQuery = `
      SELECT
        vp.symbol,
        vp.qty,
        sd."Penutupan" AS current_price,
        si.sector,
        si.name as company_name
      FROM virtual_portfolio vp
      JOIN saham_data sd ON vp.symbol = sd."Kode Saham"
      LEFT JOIN stocks_info si ON vp.symbol = si.symbol
      WHERE vp.user_id = $1
        AND sd."Tanggal Perdagangan Terakhir" = CURRENT_DATE
    `;

    const allocationResult = await safeQuery(pool, allocationQuery, [userId]);
    const allocations = allocationResult.rows;

    // Group by sector for allocation chart
    const sectorAllocation = {};
    let totalValue = 0;

    allocations.forEach(stock => {
      const currentPrice = parseFloat(stock.current_price) || 0;
      const quantity = parseInt(stock.qty) || 0;
      const value = currentPrice * quantity;
      const sector = stock.sector || 'Others';

      sectorAllocation[sector] = (sectorAllocation[sector] || 0) + value;
      totalValue += value;
    });

    // Convert to chart data format
    const chartData = Object.entries(sectorAllocation).map(([sector, value]) => ({
      sector: sector,
      value: Math.round(value * 100) / 100,
      percentage: totalValue > 0 ? Math.round((value / totalValue) * 100 * 100) / 100 : 0
    }));

    // Sort by value descending
    chartData.sort((a, b) => b.value - a.value);

    console.log(`[Dashboard] Portfolio allocation calculated for user ${userId}`);

    return {
      by_sector: chartData,
      total_value: Math.round(totalValue * 100) / 100
    };

  } catch (error) {
    console.error(`[Dashboard] Error fetching portfolio allocation for user ${userId}:`, error);
    // Return fallback data instead of throwing error
    return {
      by_sector: [],
      total_value: 0
    };
  }
};

module.exports = {
  getDashboardSummary,
  getPortfolioAllocation
};