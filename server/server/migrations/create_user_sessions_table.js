// Migration to create user_sessions table
const { pool } = require('../config/db');

async function createUserSessionsTable() {
  try {
    console.log('🔄 Creating user_sessions table...');

    // Create user_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_jti VARCHAR(64) UNIQUE NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        location VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_revoked BOOLEAN DEFAULT false,
        expires_at TIMESTAMP NOT NULL
      )
    `);
    
    // Create index for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id 
      ON user_sessions(user_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token_jti 
      ON user_sessions(token_jti)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at 
      ON user_sessions(expires_at)
    `);

    console.log('✅ User sessions table created successfully');
    console.log('✅ Indexes created for performance optimization');
  } catch (error) {
    console.error('❌ Error creating user sessions table:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  createUserSessionsTable()
    .then(() => {
      console.log('🎉 Migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createUserSessionsTable };