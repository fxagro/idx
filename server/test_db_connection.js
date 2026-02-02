// Test database connection and check tables
require('dotenv').config({ path: '.env' });
const { pool } = require('./config/db');

async function testDB() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    // Test connection
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0]);
    
    // Check if users table exists
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('📋 Tables in database:', tables.rows.map(row => row.table_name));
    
    const usersExists = tables.rows.some(row => row.table_name === 'users');
    const userSessionsExists = tables.rows.some(row => row.table_name === 'user_sessions');
    
    console.log('✅ users table exists:', usersExists);
    console.log('✅ user_sessions table exists:', userSessionsExists);
    
    // Check users table columns
    if (usersExists) {
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `);
      console.log('📋 users table columns:', columns.rows.map(row => `${row.column_name} (${row.data_type})`));
    }
    
    // Check if agro@demo.com user exists
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', ['agro@demo.com']);
    if (userResult.rows.length > 0) {
      console.log('✅ agro@demo.com user exists:', {
        id: userResult.rows[0].id,
        email: userResult.rows[0].email,
        role: userResult.rows[0].role,
        hasPassword: !!userResult.rows[0].password
      });
    } else {
      console.log('❌ agro@demo.com user does not exist');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Error details:', {
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    process.exit(1);
  }
}

testDB();
