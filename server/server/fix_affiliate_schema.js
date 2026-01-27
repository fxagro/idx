const { Pool } = require('pg');
const pool = new Pool({
  user: 'openpg',
  host: 'localhost',
  database: 'stock',
  password: 'openpgpwd',
  port: 5432
});

async function fixAffiliateSchema() {
  try {
    // Add the missing 'type' column to affiliate_commissions
    await pool.query(`
      ALTER TABLE affiliate_commissions
      ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'subscription'
    `);

    // Add the missing 'description' column
    await pool.query(`
      ALTER TABLE affiliate_commissions
      ADD COLUMN IF NOT EXISTS description TEXT
    `);

    console.log('✅ Fixed affiliate_commissions table schema');

    // Verify the table structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'affiliate_commissions'
      ORDER BY ordinal_position
    `);

    console.log('✅ Updated affiliate_commissions table structure:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

  } catch (error) {
    console.error('❌ Error fixing affiliate schema:', error.message);
  } finally {
    await pool.end();
  }
}

fixAffiliateSchema();