const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

console.log('Testing PostgreSQL connection...');
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 2000,
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Connection successful:', result.rows[0]);
    
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('✅ Tables in database:', tablesResult.rows.map(row => row.table_name));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error details:', {
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    process.exit(1);
  }
}

testConnection();
