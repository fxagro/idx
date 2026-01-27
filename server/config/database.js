/**
 * Database Configuration
 * Centralized configuration for database connections
 */

const getDatabaseConfig = () => {
  // Stock database configuration
  const stockDbConfig = {
    user: process.env.STOCK_DB_USER || 'openpg',
    host: process.env.STOCK_DB_HOST || 'localhost',
    database: process.env.STOCK_DB_NAME || 'stock',
    password: process.env.STOCK_DB_PASSWORD || 'openpgpwd',
    port: parseInt(process.env.STOCK_DB_PORT) || 5432,
  };

  // Main application database configuration
  const mainDbConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'idxgpt',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT) || 5432,
  };

  return {
    stockDb: stockDbConfig,
    mainDb: mainDbConfig,
  };
};

module.exports = {
  getDatabaseConfig,
};
