// server/migrations/run_user_sessions_migration.js
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function runUserSessionsMigration() {
  try {
    console.log('🔄 Starting user sessions migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'create_user_sessions_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    console.log('📊 Executing database migration...');
    await pool.query(migrationSQL);
    
    console.log('✅ User sessions table migration completed successfully');
    console.log('✅ Avatar and auth_method columns added to users table');
    
  } catch (error) {
    console.error('❌ Error running user sessions migration:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  runUserSessionsMigration()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = runUserSessionsMigration;