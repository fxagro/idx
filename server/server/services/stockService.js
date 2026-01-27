/**
 * Stock Service - Backend service for stock data operations
 * Created: 2025-10-06 10:50 AM WIB
 * Purpose: Handle stock list fetching, filtering, and watchlist operations
 */

const { pool } = require('../config/db');

/**
 * Get comprehensive stock list with filtering and sorting
 * @param {Object} options - Query options
 * @param {string} options.sortBy - Column to sort by (symbol, name, price, change_percent, volume, market_cap)
 * @param {string} options.sortOrder - Sort order (asc, desc)
 * @param {string} options.search - Search term for symbol or name
 * @param {number} options.limit - Number of results to return
 * @param {number} options.offset - Number of results to skip
 * @returns {Promise<Array>} Array of stock objects
 */
const getStockList = async (options = {}) => {
  try {
    const { sortBy = 'symbol', sortOrder = 'asc', search = '', limit = 50, offset = 0 } = options;

    // Validate sortBy parameter
    const validSortColumns = ['symbol', 'name', 'price', 'change_percent', 'volume', 'market_cap'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'symbol';

    // Validate sortOrder parameter
    const order = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Add search condition if provided
    if (search && search.trim()) {
      whereConditions.push(`("Kode Saham" ILIKE $${paramIndex} OR "Nama Perusahaan" ILIKE $${paramIndex})`);
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Add date condition for latest data
    whereConditions.push(`"Tanggal Perdagangan Terakhir" = CURRENT_DATE`);

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Map frontend column names to database column names
    const columnMapping = {
      'symbol': '"Kode Saham"',
      'name': '"Nama Perusahaan"',
      'price': '"Penutupan"',
      'change_percent': '(CASE WHEN "Sebelumnya" > 0 THEN (("Penutupan" - "Sebelumnya") / "Sebelumnya" * 100) ELSE 0 END)',
      'volume': '"Volume"',
      'market_cap': '"Kapitalisasi Pasar"'
    };

    const dbSortColumn = columnMapping[sortColumn] || '"Kode Saham"';

    const query = `
      SELECT
        "Kode Saham" as symbol,
        "Nama Perusahaan" as name,
        "Penutupan" as price,
        "Open Price" as open_price,
        "Tertinggi" as high,
        "Terendah" as low,
        "Volume" as volume,
        "Selisih" as change_amount,
        "Sebelumnya" as previous_price,
        "Kapitalisasi Pasar" as market_cap,
        CASE
          WHEN "Sebelumnya" > 0 THEN (("Penutupan" - "Sebelumnya") / "Sebelumnya" * 100)
          ELSE 0
        END as change_percent,
        "Tanggal Perdagangan Terakhir" as trade_date
      FROM saham_data
      ${whereClause}
      ORDER BY ${dbSortColumn} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    console.log('[StockService] Executing stock list query:', query);
    console.log('[StockService] Query parameters:', queryParams);

    const result = await stockPool.query(query, queryParams);

    console.log(`[StockService] Retrieved ${result.rows.length} stocks`);

    return result.rows.map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      price: parseFloat(stock.price) || 0,
      openPrice: parseFloat(stock.open_price) || 0,
      high: parseFloat(stock.high) || 0,
      low: parseFloat(stock.low) || 0,
      volume: parseInt(stock.volume) || 0,
      changeAmount: parseFloat(stock.change_amount) || 0,
      previousPrice: parseFloat(stock.previous_price) || 0,
      marketCap: parseFloat(stock.market_cap) || 0,
      changePercent: parseFloat(stock.change_percent) || 0,
      tradeDate: stock.trade_date
    }));
  } catch (error) {
    console.error('[StockService] Error fetching stock list:', error);
    throw new Error(`Failed to fetch stock list: ${error.message}`);
  }
};

/**
 * Get stock indices data (IHSG, LQ45, etc.)
 * @returns {Promise<Array>} Array of index objects
 */
const getStockIndices = async () => {
  try {
    const query = `
      SELECT
        "Kode Indeks" as code,
        "Penutupan" as close,
        "Sebelumnya" as previous,
        "Selisih" as change_amount,
        CASE
          WHEN "Sebelumnya" > 0 THEN (("Penutupan" - "Sebelumnya") / "Sebelumnya" * 100)
          ELSE 0
        END as change_percent,
        "Volume" as volume,
        "Nilai" as value,
        "Tanggal Perdagangan Terakhir" as trade_date
      FROM index_data
      WHERE "Tanggal Perdagangan Terakhir" = CURRENT_DATE
      ORDER BY "Kode Indeks"
    `;

    console.log('[StockService] Fetching stock indices');
    const result = await stockPool.query(query);

    return result.rows.map(index => ({
      code: index.code,
      close: parseFloat(index.close) || 0,
      previous: parseFloat(index.previous) || 0,
      changeAmount: parseFloat(index.change_amount) || 0,
      changePercent: parseFloat(index.change_percent) || 0,
      volume: parseInt(index.volume) || 0,
      value: parseFloat(index.value) || 0,
      tradeDate: index.trade_date
    }));
  } catch (error) {
    console.error('[StockService] Error fetching stock indices:', error);
    throw new Error(`Failed to fetch stock indices: ${error.message}`);
  }
};

/**
 * Get detailed stock information for modal
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Detailed stock object
 */
const getStockDetails = async (symbol) => {
  try {
    if (!symbol) {
      throw new Error('Stock symbol is required');
    }

    // Get current stock data
    const currentQuery = `
      SELECT
        "Kode Saham" as symbol,
        "Nama Perusahaan" as name,
        "Penutupan" as price,
        "Open Price" as open_price,
        "Tertinggi" as high,
        "Terendah" as low,
        "Volume" as volume,
        "Selisih" as change_amount,
        "Sebelumnya" as previous_price,
        "Kapitalisasi Pasar" as market_cap,
        CASE
          WHEN "Sebelumnya" > 0 THEN (("Penutupan" - "Sebelumnya") / "Sebelumnya" * 100)
          ELSE 0
        END as change_percent,
        "Tanggal Perdagangan Terakhir" as trade_date
      FROM saham_data
      WHERE "Kode Saham" = $1 AND "Tanggal Perdagangan Terakhir" = CURRENT_DATE
    `;

    const currentResult = await stockPool.query(currentQuery, [symbol]);

    if (currentResult.rows.length === 0) {
      throw new Error(`Stock ${symbol} not found`);
    }

    const stock = currentResult.rows[0];

    // Get 52-week high/low if available
    const statsQuery = `
      SELECT
        MAX("Tertinggi") as year_high,
        MIN("Terendah") as year_low,
        AVG("Volume") as avg_volume
      FROM saham_data
      WHERE "Kode Saham" = $1
        AND "Tanggal Perdagangan Terakhir" >= CURRENT_DATE - INTERVAL '52 weeks'
    `;

    const statsResult = await stockPool.query(statsQuery, [symbol]);

    const stats = statsResult.rows[0];

    return {
      symbol: stock.symbol,
      name: stock.name,
      price: parseFloat(stock.price) || 0,
      openPrice: parseFloat(stock.open_price) || 0,
      high: parseFloat(stock.high) || 0,
      low: parseFloat(stock.low) || 0,
      volume: parseInt(stock.volume) || 0,
      changeAmount: parseFloat(stock.change_amount) || 0,
      previousPrice: parseFloat(stock.previous_price) || 0,
      marketCap: parseFloat(stock.market_cap) || 0,
      changePercent: parseFloat(stock.change_percent) || 0,
      tradeDate: stock.trade_date,
      yearHigh: parseFloat(stats.year_high) || 0,
      yearLow: parseFloat(stats.year_low) || 0,
      avgVolume: parseInt(stats.avg_volume) || 0
    };
  } catch (error) {
    console.error(`[StockService] Error fetching stock details for ${symbol}:`, error);
    throw error;
  }
};

/**
 * Search stocks by symbol or name
 * @param {string} query - Search query
 * @param {number} limit - Maximum results to return
 * @returns {Promise<Array>} Array of matching stocks
 */
const searchStocks = async (query, limit = 20) => {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchQuery = `
      SELECT
        "Kode Saham" as symbol,
        "Nama Perusahaan" as name,
        "Penutupan" as price,
        CASE
          WHEN "Sebelumnya" > 0 THEN (("Penutupan" - "Sebelumnya") / "Sebelumnya" * 100)
          ELSE 0
        END as change_percent,
        "Volume" as volume
      FROM saham_data
      WHERE "Tanggal Perdagangan Terakhir" = CURRENT_DATE
        AND ("Kode Saham" ILIKE $1 OR "Nama Perusahaan" ILIKE $1)
      ORDER BY
        CASE
          WHEN "Kode Saham" ILIKE $1 THEN 1
          ELSE 2
        END,
        "Kode Saham"
      LIMIT $2
    `;

    const result = await stockPool.query(searchQuery, [`%${query.trim()}%`, limit]);

    return result.rows.map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      price: parseFloat(stock.price) || 0,
      changePercent: parseFloat(stock.change_percent) || 0,
      volume: parseInt(stock.volume) || 0
    }));
  } catch (error) {
    console.error('[StockService] Error searching stocks:', error);
    throw new Error(`Failed to search stocks: ${error.message}`);
  }
};

/**
 * Get trending stocks based on volume and price movement
 * @param {number} limit - Number of trending stocks to return
 * @returns {Promise<Array>} Array of trending stocks
 */
const getTrendingStocks = async (limit = 10) => {
  try {
    const query = `
      SELECT
        "Kode Saham" as symbol,
        "Nama Perusahaan" as name,
        "Penutupan" as price,
        "Volume" as volume,
        CASE
          WHEN "Sebelumnya" > 0 THEN (("Penutupan" - "Sebelumnya") / "Sebelumnya" * 100)
          ELSE 0
        END as change_percent,
        ("Volume" * "Penutupan") as value_traded
      FROM saham_data
      WHERE "Tanggal Perdagangan Terakhir" = CURRENT_DATE
        AND "Volume" > 0
      ORDER BY ("Volume" * "Penutupan") DESC, ABS((("Penutupan" - "Sebelumnya") / "Sebelumnya" * 100)) DESC
      LIMIT $1
    `;

    const result = await stockPool.query(query, [limit]);

    return result.rows.map(stock => ({
      symbol: stock.symbol,
      name: stock.name,
      price: parseFloat(stock.price) || 0,
      volume: parseInt(stock.volume) || 0,
      changePercent: parseFloat(stock.change_percent) || 0,
      valueTraded: parseFloat(stock.value_traded) || 0
    }));
  } catch (error) {
    console.error('[StockService] Error fetching trending stocks:', error);
    throw new Error(`Failed to fetch trending stocks: ${error.message}`);
  }
};

module.exports = {
  getStockList,
  getStockIndices,
  getStockDetails,
  searchStocks,
  getTrendingStocks
};