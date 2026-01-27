const { pool } = require('../db');

async function up() {
  try {
    // Add ai_usage and ai_limit columns to users table
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS ai_usage INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ai_limit INTEGER DEFAULT 1000;
    `);

    console.log('✅ Added ai_usage and ai_limit columns to users table');

    // Create index for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_ai_usage ON users(ai_usage);
      CREATE INDEX IF NOT EXISTS idx_users_ai_limit ON users(ai_limit);
    `);

    console.log('✅ Created indexes for AI quota columns');

    // Create audit table for tracking AI quota operations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_quota_audit (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL, -- 'quota_consumption_attempt', 'ml_forecast_success', 'quota_rollback', etc.
        tokens_used INTEGER NOT NULL,
        current_usage INTEGER NOT NULL,
        quota_limit INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        request_id VARCHAR(20),
        operation_type VARCHAR(50), -- 'ml_forecast', 'ai_analysis', etc.
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Created ai_quota_audit table');

    // Create indexes for audit table
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_quota_audit_user_id ON ai_quota_audit(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_quota_audit_created_at ON ai_quota_audit(created_at);
      CREATE INDEX IF NOT EXISTS idx_ai_quota_audit_request_id ON ai_quota_audit(request_id);
      CREATE INDEX IF NOT EXISTS idx_ai_quota_audit_success ON ai_quota_audit(success);
    `);

    console.log('✅ Created indexes for ai_quota_audit table');

  } catch (error) {
    console.error('❌ Error in AI quota migration:', error);
    throw error;
  }
}

async function down() {
  try {
    // Drop audit table
    await pool.query('DROP TABLE IF EXISTS ai_quota_audit;');
    console.log('✅ Dropped ai_quota_audit table');

    // Remove the columns (be careful with this in production)
    await pool.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS ai_usage,
      DROP COLUMN IF EXISTS ai_limit;
    `);

    console.log('✅ Removed ai_usage and ai_limit columns from users table');

  } catch (error) {
    console.error('❌ Error in AI quota migration rollback:', error);
    throw error;
  }
}

module.exports = { up, down };