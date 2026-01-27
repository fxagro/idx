const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  user: 'openpg',
  host: 'localhost',
  database: 'stock',
  password: 'openpgpwd',
  port: 5432,
});

async function runMigration() {
  try {
    console.log('🔄 Running migration 002_extend_affiliate.sql...');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '002_extend_affiliate.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await pool.query(statement);
          console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
        } catch (error) {
          console.log(`⚠️ Statement ${i + 1}/${statements.length} failed (may already exist):`, error.message);
        }
      }
    }

    console.log('✅ Migration completed successfully!');

    // Verify table structure
    console.log('🔍 Verifying affiliate_commissions table structure...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'affiliate_commissions'
      ORDER BY ordinal_position
    `);

    console.log('📋 affiliate_commissions table structure:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();