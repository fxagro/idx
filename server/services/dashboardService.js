const { getPool } = require('../config/db');

// Get comprehensive dashboard summary for a user
const getDashboardSummary = async (userId) => {
  try {
    console.log(`[Dashboard] Fetching dashboard summary for user ${userId}`);
    const pool = getPool();

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

    const portfolioResult = await pool.query(portfolioQuery, [userId]);
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

    const watchlistResult = await pool.query(watchlistQuery, [userId]);
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

    const transactionsResult = await pool.query(transactionsQuery, [userId]);
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

    const indicesResult = await pool.query(indicesQuery);
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

    const trendingResult = await pool.query(trendingQuery);
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

    const ihsgChartResult = await pool.query(ihsgChartQuery);
    const ihsgChartData = ihsgChartResult.rows.map(row => ({
      date: row.date,
      price: parseFloat(row.price) || 0
    }));

    // Get user's AI quota
    const quotaQuery = 'SELECT ai_quota FROM users WHERE id = $1';
    const quotaResult = await pool.query(quotaQuery, [userId]);
    const aiQuota = quotaResult.rows[0]?.ai_quota || 10;

    console.log(`[Dashboard] Successfully fetched dashboard data for user ${userId}`);

    return {
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
    throw new Error('Failed to fetch dashboard data');
  }
};

// Get portfolio allocation data for pie chart
const getPortfolioAllocation = async (userId) => {
  try {
    console.log(`[Dashboard] Fetching portfolio allocation for user ${userId}`);

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

    const allocationResult = await pool.query(allocationQuery, [userId]);
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
    throw new Error('Failed to fetch portfolio allocation');
  }
};

module.exports = {
  getDashboardSummary,
  getPortfolioAllocation
};