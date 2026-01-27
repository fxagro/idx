const pool = require('../db');

async function addRoleColumn() {
  try {
    console.log('Adding role column to users table...');

    // Add role column with default value 'user'
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'
    `);

    console.log('✅ Role column added successfully');

    // Update existing users to have proper roles (if any)
    await pool.query(`
      UPDATE users
      SET role = 'admin'
      WHERE email = 'agro@demo.com'
    `);

    console.log('✅ Admin user role set');

    // Verify the changes
    const result = await pool.query('SELECT id, email, role FROM users ORDER BY id');
    console.log('Current users with roles:');
    result.rows.forEach(user => {
      console.log(`  - ${user.email}: ${user.role}`);
    });

  } catch (error) {
    console.error('❌ Error adding role column:', error);
    throw error;
  }
}

if (require.main === module) {
  addRoleColumn()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addRoleColumn;