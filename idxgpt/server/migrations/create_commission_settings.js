const pool = require('../db');

async function createCommissionSettings() {
  try {
    console.log('Creating commission_settings table...');

    // Create commission_settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS commission_settings (
        id SERIAL PRIMARY KEY,
        l0_commission DECIMAL(5,4) DEFAULT 0.40,
        l1_commission DECIMAL(5,4) DEFAULT 0.40,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id)
      );
    `);

    // Insert default settings if table is empty
    const existing = await pool.query('SELECT id FROM commission_settings LIMIT 1');
    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO commission_settings (l0_commission, l1_commission) VALUES (0.40, 0.40)',
        []
      );
      console.log('✅ Default commission settings inserted (L0: 40%, L1: 40%)');
    }

    console.log('✅ Commission settings table created successfully');

    // Verify the settings
    const result = await pool.query('SELECT * FROM commission_settings ORDER BY id DESC LIMIT 1');
    console.log('Current commission settings:');
    result.rows.forEach(setting => {
      console.log(`  - L0 Commission: ${setting.l0_commission * 100}%`);
      console.log(`  - L1 Commission: ${setting.l1_commission * 100}%`);
    });

  } catch (error) {
    console.error('❌ Error creating commission settings:', error);
    throw error;
  }
}

if (require.main === module) {
  createCommissionSettings()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = createCommissionSettings;