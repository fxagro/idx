const { up } = require('./migrations/create_payments_table');

async function runPaymentsMigration() {
  try {
    console.log('🔄 Running payments table migration...');
    await up();
    console.log('✅ Payments migration completed successfully!');
  } catch (error) {
    console.error('❌ Payments migration failed:', error);
    process.exit(1);
  }
}

runPaymentsMigration();