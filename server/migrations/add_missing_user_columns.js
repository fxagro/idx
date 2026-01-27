// Migration to add missing columns to users table
const { pool } = require('../config/db');

async function addMissingColumns() {
  try {
    console.log('🔄 Adding missing columns to users table...');

    // Add auth_method column
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'password'
    `);
    console.log('✅ Added auth_method column');

    // Add role column if missing
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'
    `);
    console.log('✅ Added role column');

    // Add ai_quota column if missing
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS ai_quota INTEGER DEFAULT 10
    `);
    console.log('✅ Added ai_quota column');

    // Add updated_at column if missing
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    console.log('✅ Added updated_at column');

    // Update existing users with default values
    await pool.query(`
      UPDATE users 
      SET 
        role = 'user',
        ai_quota = 10,
        auth_method = 'password'
      WHERE role IS NULL OR ai_quota IS NULL OR auth_method IS NULL
    `);
    console.log('✅ Updated existing users with default values');

    console.log('✅ Missing columns migration completed successfully');
  } catch (error) {
    console.error('❌ Error adding missing columns:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  addMissingColumns()
    .then(() => {
      console.log('🎉 Migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addMissingColumns };