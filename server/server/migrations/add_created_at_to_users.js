const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'openpg',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'stock',
  password: process.env.DB_PASS || 'openpgpwd',
  port: process.env.DB_PORT || 5432,
});

async function addCreatedAtColumn() {
  try {
    console.log('Adding created_at column to users table...');

    // Add the created_at column
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);

    // Create index for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_created_at
      ON users(created_at)
    `);

    console.log('✅ created_at column added successfully');

    // Verify the column exists
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'created_at'
    `);

    if (result.rows.length > 0) {
      console.log('✅ created_at column verified');
    } else {
      console.log('❌ created_at column not found');
    }

  } catch (error) {
    console.error('❌ Error adding created_at column:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  addCreatedAtColumn()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addCreatedAtColumn;