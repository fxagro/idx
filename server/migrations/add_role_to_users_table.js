// server/migrations/add_role_to_users_table.js
const db = require('../db');

async function up() {
  try {
    // Add role column to users table
    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'USER'
    `);

    // Update existing users to have USER role (in case they don't have one)
    await db.query(`
      UPDATE users SET role = 'USER' WHERE role IS NULL OR role = ''
    `);

    // Create index for faster role-based queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)
    `);

    console.log('✅ Role column added to users table successfully');
  } catch (error) {
    console.error('❌ Error adding role column to users table:', error);
    throw error;
  }
}

async function down() {
  try {
    await db.query('ALTER TABLE users DROP COLUMN IF EXISTS role');
    console.log('✅ Role column dropped from users table successfully');
  } catch (error) {
    console.error('❌ Error dropping role column from users table:', error);
    throw error;
  }
}

module.exports = { up, down };