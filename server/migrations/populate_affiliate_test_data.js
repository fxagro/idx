// server/migrations/populate_affiliate_test_data.js
const pool = require('../db');

async function populateAffiliateTestData() {
  try {
    console.log('🧪 Populating affiliate test data...');

    // Get admin user ID
    const adminResult = await pool.query('SELECT id FROM users WHERE email = $1', ['agro@demo.com']);
    if (adminResult.rows.length === 0) {
      console.log('❌ Admin user not found. Please run create_users_table.js first.');
      return;
    }
    const adminId = adminResult.rows[0].id;

    // Get or create test users
    const testUsers = [
      { email: 'testuser1@demo.com', name: 'Test User 1' },
      { email: 'testuser2@demo.com', name: 'Test User 2' },
      { email: 'testuser3@demo.com', name: 'Test User 3' }
    ];

    const userIds = {};
    for (const user of testUsers) {
      let userResult = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
      if (userResult.rows.length === 0) {
        // Create test user
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('password123', 10);
        const insertResult = await pool.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [user.email, hashedPassword, user.name]
        );
        userIds[user.email] = insertResult.rows[0].id;
        console.log(`✅ Created test user: ${user.email}`);
      } else {
        userIds[user.email] = userResult.rows[0].id;
        console.log(`✅ Found existing test user: ${user.email}`);
      }
    }

    // Insert affiliate settings (if not exists)
    const settingsExist = await pool.query('SELECT id FROM affiliate_settings LIMIT 1');
    if (settingsExist.rows.length === 0) {
      await pool.query(
        'INSERT INTO affiliate_settings (level_1_commission_rate, updated_by) VALUES ($1, $2)',
        [40.00, adminId]
      );
      console.log('✅ Inserted default affiliate settings: Level 1 = 40%, Level 2 = 20%');
    } else {
      console.log('✅ Affiliate settings already exist');
    }

    // Insert affiliate referrals
    const referrals = [
      // Admin refers testuser1 (Level 1)
      { referrer_id: adminId, referred_id: userIds['testuser1@demo.com'], level: 1, referral_link: 'ADMINREF001' },
      // testuser1 refers testuser2 (Level 2 for admin, Level 1 for testuser1)
      { referrer_id: userIds['testuser1@demo.com'], referred_id: userIds['testuser2@demo.com'], level: 1, referral_link: 'USER1REF001' },
      // testuser2 refers testuser3 (Level 2 for testuser1, Level 2 for admin)
      { referrer_id: userIds['testuser1@demo.com'], referred_id: userIds['testuser3@demo.com'], level: 2, referral_link: 'USER1REF002' },
      // Admin refers testuser3 directly (Level 1)
      { referrer_id: adminId, referred_id: userIds['testuser3@demo.com'], level: 1, referral_link: 'ADMINREF002' }
    ];

    for (const referral of referrals) {
      const existing = await pool.query(
        'SELECT id FROM affiliate_referrals WHERE referrer_user_id = $1 AND referred_user_id = $2',
        [referral.referrer_id, referral.referred_id]
      );

      if (existing.rows.length === 0) {
        await pool.query(
          'INSERT INTO affiliate_referrals (referrer_user_id, referred_user_id, level, referral_link) VALUES ($1, $2, $3, $4)',
          [referral.referrer_id, referral.referred_id, referral.level, referral.referral_link]
        );
        console.log(`✅ Created referral: ${referral.referral_link} (Level ${referral.level})`);
      } else {
        console.log(`✅ Referral already exists: ${referral.referral_link}`);
      }
    }

    // Insert sample commissions
    const commissions = [
      // Admin gets Level 1 commission from testuser1 ($100 sale * 40% = $40)
      { user_id: adminId, referral_id: 1, amount: 40.00, level: 1, sale_id: 1 },
      // testuser1 gets Level 1 commission from testuser2 ($100 sale * 40% = $40)
      { user_id: userIds['testuser1@demo.com'], referral_id: 2, amount: 40.00, level: 1, sale_id: 2 },
      // Admin gets Level 2 commission from testuser2 ($100 sale * 20% = $20)
      { user_id: adminId, referral_id: 2, amount: 20.00, level: 2, sale_id: 2 },
      // testuser1 gets Level 2 commission from testuser3 ($100 sale * 20% = $20)
      { user_id: userIds['testuser1@demo.com'], referral_id: 3, amount: 20.00, level: 2, sale_id: 3 },
      // Admin gets Level 1 commission from testuser3 ($100 sale * 40% = $40)
      { user_id: adminId, referral_id: 4, amount: 40.00, level: 1, sale_id: 4 }
    ];

    for (const commission of commissions) {
      const existing = await pool.query(
        'SELECT id FROM affiliate_commissions WHERE user_id = $1 AND referral_id = $2 AND sale_id = $3',
        [commission.user_id, commission.referral_id, commission.sale_id]
      );

      if (existing.rows.length === 0) {
        await pool.query(
          'INSERT INTO affiliate_commissions (user_id, referral_id, amount, level, sale_id) VALUES ($1, $2, $3, $4, $5)',
          [commission.user_id, commission.referral_id, commission.amount, commission.level, commission.sale_id]
        );
        console.log(`✅ Created commission: $${commission.amount} (Level ${commission.level})`);
      } else {
        console.log(`✅ Commission already exists: $${commission.amount}`);
      }
    }

    // Insert audit logs
    const auditLogs = [
      { user_id: adminId, action: 'generate_link', details: { referral_code: 'ADMINREF001' } },
      { user_id: userIds['testuser1@demo.com'], action: 'generate_link', details: { referral_code: 'USER1REF001' } },
      { user_id: adminId, action: 'commission_paid', details: { sale_id: 1, amount: 40.00, level: 1 } },
      { user_id: userIds['testuser1@demo.com'], action: 'commission_paid', details: { sale_id: 2, amount: 40.00, level: 1 } }
    ];

    for (const log of auditLogs) {
      await pool.query(
        'INSERT INTO affiliate_audit_log (user_id, action, details) VALUES ($1, $2, $3)',
        [log.user_id, log.action, JSON.stringify(log.details)]
      );
    }
    console.log('✅ Created audit logs');

    console.log('\n🎯 Test Data Summary:');
    console.log(`- Admin user: agro@demo.com (ID: ${adminId})`);
    console.log(`- Test users: ${Object.keys(userIds).length} created`);
    console.log(`- Referrals: ${referrals.length} created`);
    console.log(`- Commissions: ${commissions.length} created`);
    console.log(`- Audit logs: ${auditLogs.length} created`);

    console.log('\n📊 Expected Results:');
    console.log('- Admin should have 2 Level 1 referrals, 1 Level 2 referral');
    console.log('- Admin should have earned: $40 (L1) + $20 (L2) + $40 (L1) = $100 total');
    console.log('- testuser1 should have 1 Level 1 referral, 1 Level 2 referral');
    console.log('- testuser1 should have earned: $40 (L1) + $20 (L2) = $60 total');

  } catch (error) {
    console.error('❌ Error populating test data:', error);
  } finally {
    await pool.end();
  }
}

populateAffiliateTestData();