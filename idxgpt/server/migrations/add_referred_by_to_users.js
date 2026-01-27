const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'stock',
  password: process.env.DB_PASS || '',
  port: process.env.DB_PORT || 5432,
});

async function addReferredByColumn() {
  try {
    console.log('Adding referred_by column to users table...');

    // Add the referred_by column
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    `);

    // Create index for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_referred_by
      ON users(referred_by)
    `);

    console.log('✅ referred_by column added successfully');

    // Verify the column exists
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'referred_by'
    `);

    if (result.rows.length > 0) {
      console.log('✅ referred_by column verified');
    } else {
      console.log('❌ referred_by column not found');
    }

  } catch (error) {
    console.error('❌ Error adding referred_by column:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  addReferredByColumn()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addReferredByColumn;