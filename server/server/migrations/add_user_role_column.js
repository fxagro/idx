const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function addUserRoleColumn() {
  try {
    console.log('Adding role column to users table...');

    // Add role column to users table
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN role VARCHAR(50) DEFAULT 'user'
    `);

    console.log('✅ Role column added successfully');

    // Update admin user
    await pool.query(`
      UPDATE users
      SET role = 'admin'
      WHERE email = 'agro@demo.com'
    `);

    console.log('✅ Admin user role updated');

    // Verify the changes
    const result = await pool.query(`
      SELECT email, role
      FROM users
      WHERE email IN ('agro@demo.com', 'testuser1@demo.com')
    `);

    console.log('✅ Current user roles:');
    result.rows.forEach(row => {
      console.log(`   ${row.email}: ${row.role}`);
    });

    console.log('✅ Migration completed successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

addUserRoleColumn();