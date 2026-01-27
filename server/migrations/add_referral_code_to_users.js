const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'openpg',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'stock',
  password: process.env.DB_PASS || 'openpgpwd',
  port: process.env.DB_PORT || 5432,
});

async function addReferralCodeColumn() {
  try {
    console.log('Adding referral_code column to users table...');

    // Add the referral_code column
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE
    `);

    // Create index for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_referral_code
      ON users(referral_code)
    `);

    console.log('✅ referral_code column added successfully');

    // Verify the column exists
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'referral_code'
    `);

    if (result.rows.length > 0) {
      console.log('✅ referral_code column verified');
    } else {
      console.log('❌ referral_code column not found');
    }

  } catch (error) {
    console.error('❌ Error adding referral_code column:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  addReferralCodeColumn()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addReferralCodeColumn;