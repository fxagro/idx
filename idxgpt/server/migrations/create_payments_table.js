// server/migrations/create_payments_table.js
const db = require('../db');

async function up() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id VARCHAR(50) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for faster queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)
    `);

    console.log('✅ Payments table created successfully');
  } catch (error) {
    console.error('❌ Error creating payments table:', error);
    throw error;
  }
}

async function down() {
  try {
    await db.query('DROP TABLE IF EXISTS payments');
    console.log('✅ Payments table dropped successfully');
  } catch (error) {
    console.error('❌ Error dropping payments table:', error);
    throw error;
  }
}

module.exports = { up, down };