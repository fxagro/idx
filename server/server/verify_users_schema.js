require("dotenv").config({ path: './.env' });
const pool = require('./db');

async function verifyUsersSchema() {
  try {
    console.log('🔍 Verifying users table schema...');

    // Check if users table exists and get its structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);

    console.log('📋 Current users table structure:');
    result.rows.forEach(column => {
      console.log(`  - ${column.column_name}: ${column.data_type} ${column.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${column.column_default ? `DEFAULT ${column.column_default}` : ''}`);
    });

    // Check required columns
    const requiredColumns = ['id', 'email', 'password', 'name', 'role', 'subscription_expiry', 'api_limit', 'api_usage', 'ai_quota'];
    const existingColumns = result.rows.map(col => col.column_name);

    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log(`❌ Missing columns: ${missingColumns.join(', ')}`);
      console.log('🔧 Please run the existing migrations to add these columns');
    } else {
      console.log('✅ All required columns exist');

      // Verify some sample data
      const sampleData = await pool.query('SELECT id, email, name, role, api_limit, api_usage, ai_quota FROM users LIMIT 3');
      console.log('👥 Sample user data:');
      sampleData.rows.forEach(user => {
        console.log(`  - ${user.email}: role=${user.role}, api=${user.api_usage}/${user.api_limit}, ai=${user.ai_quota}`);
      });
    }

  } catch (error) {
    console.error('❌ Error verifying schema:', error);
  } finally {
    await pool.end();
  }
}

verifyUsersSchema();