const pool = require('../db');

const createSubscriptionsTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        plan_id VARCHAR(50),
        amount DECIMAL(10,2),
        status VARCHAR(20) DEFAULT 'pending',
        proof_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await pool.query(query);
    console.log('✅ Subscriptions table created successfully');
  } catch (error) {
    console.error('❌ Error creating subscriptions table:', error);
    throw error;
  }
};

module.exports = createSubscriptionsTable;