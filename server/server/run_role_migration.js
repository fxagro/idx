const { up } = require('./migrations/add_role_to_users_table');

async function runRoleMigration() {
  try {
    console.log('🔄 Running role migration...');
    await up();
    console.log('✅ Role migration completed successfully!');
  } catch (error) {
    console.error('❌ Role migration failed:', error);
    process.exit(1);
  }
}

runRoleMigration();