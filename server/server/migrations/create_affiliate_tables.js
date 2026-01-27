// server/migrations/create_affiliate_tables.js
const pool = require('../db');

async function createAffiliateTables() {
  try {
    // Create affiliate_referrals table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS affiliate_referrals (
        id SERIAL PRIMARY KEY,
        referrer_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        referred_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        level INTEGER CHECK (level IN (1, 2)),
        referral_link VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create affiliate_commissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS affiliate_commissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        referral_id INTEGER REFERENCES affiliate_referrals(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        level INTEGER CHECK (level IN (1, 2)),
        sale_id INTEGER, -- Reference to sale or subscription
        type VARCHAR(50) DEFAULT 'subscription', -- Type of commission (subscription, sale, etc.)
        description TEXT,
        month VARCHAR(7), -- YYYY-MM format for monthly grouping
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create affiliate_settings table (admin-configurable)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS affiliate_settings (
        id SERIAL PRIMARY KEY,
        level_1_commission_rate DECIMAL(5,2) DEFAULT 40.00, -- Percentage (e.g., 40.00%)
        level_2_commission_rate DECIMAL(5,2) GENERATED ALWAYS AS (level_1_commission_rate / 2) STORED,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER REFERENCES users(id) -- Admin who updated settings
      );
    `);

    // Create affiliate_audit_log table for security
    await pool.query(`
      CREATE TABLE IF NOT EXISTS affiliate_audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL, -- 'generate_link', 'commission_paid', 'settings_updated'
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referrer
      ON affiliate_referrals(referrer_user_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred
      ON affiliate_referrals(referred_user_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_user
      ON affiliate_commissions(user_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referral
      ON affiliate_commissions(referral_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_affiliate_audit_log_user
      ON affiliate_audit_log(user_id);
    `);

    // Insert default affiliate settings if not exists
    const settingsExist = await pool.query('SELECT id FROM affiliate_settings LIMIT 1');
    if (settingsExist.rows.length === 0) {
      await pool.query(`
        INSERT INTO affiliate_settings (level_1_commission_rate, updated_by)
        VALUES ($1, $2)
      `, [40.00, 1]); // Assuming admin user has ID 1
    }

    console.log('✅ Affiliate tables created successfully');
    console.log('✅ Default affiliate settings: Level 1 = 40%, Level 2 = 20%');
  } catch (error) {
    console.error('❌ Error creating affiliate tables:', error);
  } finally {
    await pool.end();
  }
}

createAffiliateTables();