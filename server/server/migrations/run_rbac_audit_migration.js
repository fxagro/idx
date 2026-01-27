// server/migrations/run_rbac_audit_migration.js
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');
const bcrypt = require('bcrypt');

async function runRBACAuditMigration() {
  try {
    console.log('🔄 Starting RBAC and Audit Logging migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'create_rbac_and_audit_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    console.log('📊 Executing database migration...');
    await pool.query(migrationSQL);
    
    console.log('✅ RBAC and audit logging tables created successfully');
    
    // Seed initial admin user
    console.log('👤 Creating initial admin user...');
    const adminEmail = 'admin@example.com';
    const adminPassword = 'Admin123!';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // Check if admin already exists
    const { rows: existingUsers } = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [adminEmail]
    );
    
    if (existingUsers.length === 0) {
      // First check what columns exist in users table
      // Let's try a simpler approach - just insert with basic fields that should exist
      await pool.query(
        'INSERT INTO users (email, password, role, status) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET role = $3, status = $4',
        [adminEmail, hashedPassword, 'admin', 'active']
      );
      
      console.log(`✅ Admin user created: ${adminEmail} / ${adminPassword}`);
    } else {
      console.log('Admin user already exists:', adminEmail);
    }
    
    console.log('🎉 RBAC and Audit migration completed successfully');
    
  } catch (error) {
    console.error('❌ Error running RBAC audit migration:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  runRBACAuditMigration()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error.message);
      process.exit(1);
    });
}

module.exports = runRBACAuditMigration;