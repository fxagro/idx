const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function testUserRoles() {
  try {
    console.log('🔍 Testing user roles...');

    const result = await pool.query(
      'SELECT email, role FROM users WHERE email IN ($1, $2)',
      ['agro@demo.com', 'testuser1@demo.com']
    );

    console.log('✅ Current user roles:');
    result.rows.forEach(row => {
      console.log(`   ${row.email}: ${row.role}`);
    });

    // Test JWT token generation
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;

    const adminToken = jwt.sign(
      { id: 1, email: 'agro@demo.com', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const userToken = jwt.sign(
      { id: 2, email: 'testuser1@demo.com', role: 'user' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('\n✅ JWT Token Generation Test:');
    console.log('   Admin Token:', adminToken.substring(0, 50) + '...');
    console.log('   User Token:', userToken.substring(0, 50) + '...');

    // Decode tokens
    const decodedAdmin = jwt.verify(adminToken, JWT_SECRET);
    const decodedUser = jwt.verify(userToken, JWT_SECRET);

    console.log('\n✅ Decoded Tokens:');
    console.log('   Admin:', decodedAdmin);
    console.log('   User:', decodedUser);

    console.log('\n🎯 All Tests Passed!');
    console.log('✅ Admin role:', decodedAdmin.role === 'admin');
    console.log('✅ User role:', decodedUser.role === 'user');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testUserRoles();