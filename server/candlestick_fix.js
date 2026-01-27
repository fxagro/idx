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
