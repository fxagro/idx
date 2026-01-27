// server/test_affiliate_api.js
const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Create test tokens
const createTestToken = (user) => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
};

// Test data
const adminToken = createTestToken({ id: 12, email: 'agro@demo.com' });
const user1Token = createTestToken({ id: 13, email: 'testuser1@demo.com' });
const user2Token = createTestToken({ id: 14, email: 'testuser2@demo.com' });

const baseURL = 'http://localhost:5000/api';

async function testAffiliateAPI() {
  console.log('🧪 Testing Affiliate API Endpoints...\n');

  // Test 1: Admin gets affiliate settings
  try {
    console.log('1. Testing admin access to affiliate settings...');
    const settingsResponse = await axios.get(`${baseURL}/affiliate/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✅ Admin can access settings:', settingsResponse.data);
  } catch (error) {
    console.log('❌ Admin settings access failed:', error.response?.data || error.message);
  }

  // Test 2: Regular user tries to access admin settings (should fail)
  try {
    console.log('\n2. Testing regular user access to admin settings (should fail)...');
    const settingsResponse = await axios.get(`${baseURL}/affiliate/settings`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    console.log('❌ Regular user should not access settings:', settingsResponse.data);
  } catch (error) {
    console.log('✅ Regular user correctly denied access:', error.response?.status, error.response?.data?.error);
  }

  // Test 3: Admin gets affiliate stats
  try {
    console.log('\n3. Testing admin access to affiliate stats...');
    const statsResponse = await axios.get(`${baseURL}/affiliate/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✅ Admin can access stats:', JSON.stringify(statsResponse.data.data.overview, null, 2));
  } catch (error) {
    console.log('❌ Admin stats access failed:', error.response?.data || error.message);
  }

  // Test 4: Regular user tries to access admin stats (should fail)
  try {
    console.log('\n4. Testing regular user access to admin stats (should fail)...');
    const statsResponse = await axios.get(`${baseURL}/affiliate/stats`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    console.log('❌ Regular user should not access stats:', statsResponse.data);
  } catch (error) {
    console.log('✅ Regular user correctly denied access:', error.response?.status, error.response?.data?.error);
  }

  // Test 5: User gets affiliate dashboard
  try {
    console.log('\n5. Testing user affiliate dashboard access...');
    const dashboardResponse = await axios.get(`${baseURL}/affiliate/dashboard`, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    console.log('✅ User can access dashboard:', JSON.stringify({
      referral_link: dashboardResponse.data.data.referral_link ? 'Present' : 'Missing',
      total_referrals: dashboardResponse.data.data.total_referrals,
      total_commissions: dashboardResponse.data.data.total_commissions
    }, null, 2));
  } catch (error) {
    console.log('❌ User dashboard access failed:', error.response?.data || error.message);
  }

  // Test 6: User generates referral link
  try {
    console.log('\n6. Testing user referral link generation...');
    const generateResponse = await axios.post(`${baseURL}/affiliate/generate-link`, {}, {
      headers: { Authorization: `Bearer ${user1Token}` }
    });
    console.log('✅ User can generate referral link:', generateResponse.data.referral_code);
  } catch (error) {
    console.log('❌ User referral link generation failed:', error.response?.data || error.message);
  }

  // Test 7: Validate referral code
  try {
    console.log('\n7. Testing referral code validation...');
    const validateResponse = await axios.post(`${baseURL}/affiliate/signup/ADMINREF001`);
    console.log('✅ Referral code validation:', validateResponse.data);
  } catch (error) {
    console.log('❌ Referral code validation failed:', error.response?.data || error.message);
  }

  // Test 8: Invalid referral code
  try {
    console.log('\n8. Testing invalid referral code...');
    const validateResponse = await axios.post(`${baseURL}/affiliate/signup/INVALIDCODE`);
    console.log('❌ Invalid code should fail:', validateResponse.data);
  } catch (error) {
    console.log('✅ Invalid referral code correctly rejected:', error.response?.status, error.response?.data?.error);
  }

  console.log('\n🎯 Affiliate API Testing Complete!');
}

// Run tests
testAffiliateAPI().catch(console.error);