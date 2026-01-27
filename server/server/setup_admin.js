// server/setup_admin.js
const bcrypt = require('bcrypt');
const pool = require('./db');

async function setupAdminUser() {
  try {
    // Check if admin user exists
    const adminExists = await pool.query('SELECT id FROM users WHERE email = $1', ['agro@demo.com']);

    if (adminExists.rows.length > 0) {
      // Update existing admin user's password
      const hashedPassword = await bcrypt.hash('password123', 10);
      await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, 'agro@demo.com']);
      console.log('✅ Admin user password updated to: password123');
    } else {
      // Create new admin user
      const hashedPassword = await bcrypt.hash('password123', 10);
      await pool.query(`
        INSERT INTO users (email, password, role, name, api_limit, subscription_expiry, ai_quota)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['agro@demo.com', hashedPassword, 'admin', 'Admin User', 1000, new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 100]);

      // Get the inserted user ID
      const adminUser = await pool.query('SELECT id FROM users WHERE email = $1', ['agro@demo.com']);
      const adminId = adminUser.rows[0].id;

      // Insert initial balance for admin
      await pool.query('INSERT INTO user_balance (user_id) VALUES ($1)', [adminId]);

      console.log('✅ Admin user created: agro@demo.com / password123');
    }

    console.log('✅ Admin user setup completed successfully');
  } catch (error) {
    console.error('❌ Error setting up admin user:', error);
  } finally {
    await pool.end();
  }
}

setupAdminUser();