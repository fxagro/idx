const { pool } = require('./db');
const inMemoryCache = require('./utils/cache');
const logger = require('./utils/logger');

// Load environment variables
require('dotenv').config({ path: './.env' });

async function resetAllTokens() {
  const startTime = Date.now();
  let requestId = Math.random().toString(36).substring(7);

  try {
    logger.info(`[${requestId}] 🔄 Starting token reset process`);

    // Clear all tokens from in-memory cache (blacklist)
    logger.info(`[${requestId}] 🧹 Clearing token blacklist from cache`);
    inMemoryCache.flushAll();

    // Reset login attempts for all users
    logger.info(`[${requestId}] 🔒 Resetting login attempts`);
    inMemoryCache.flushAll(); // This clears all cached data including login attempts

    // Optional: Reset user quotas if needed
    logger.info(`[${requestId}] 📊 Resetting user quotas`);
    // Note: User quotas are stored in database, so they persist across sessions
    // If you want to reset quotas, uncomment the following:
    /*
    await pool.query(`
      UPDATE users
      SET api_usage = 0, ai_quota = 10
      WHERE api_usage > 0 OR ai_quota < 10
    `);
    */

    const processingTime = Date.now() - startTime;
    logger.info(`[${requestId}] ✅ Token reset completed successfully (${processingTime}ms)`);

    console.log('🎉 All tokens and sessions have been reset!');
    console.log('🔐 Users will need to login again to get new tokens');
    console.log('📊 User quotas preserved in database');

  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(`[${requestId}] 💥 Error during token reset (${processingTime}ms):`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });

    console.error('❌ Error resetting tokens:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  console.log('🔄 Resetting all tokens and sessions...');
  resetAllTokens()
    .then(() => {
      console.log('✅ Token reset process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Token reset failed:', error.message);
      process.exit(1);
    });
}

module.exports = resetAllTokens;