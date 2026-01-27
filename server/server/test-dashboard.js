// server/test-dashboard.js
// Simple test script to verify dashboard functionality
const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

async function testDashboardAPI() {
  console.log('🧪 Testing Dashboard API Endpoints...\n');

  try {
    // Test 1: Login to get token
    console.log('1. Testing login endpoint...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'testuser@example.com',
      password: 'password'
    });

    if (loginResponse.data.success) {
      console.log('✅ Login successful');
      const token = loginResponse.data.token;
      const headers = { Authorization: `Bearer ${token}` };

      // Test 2: Get user profile
      console.log('\n2. Testing profile endpoint...');
      const profileResponse = await axios.get(`${API_BASE_URL}/user/profile`, { headers });
      
      if (profileResponse.data.success) {
        console.log('✅ Profile fetched successfully');
        console.log('   User:', profileResponse.data.data.name || 'Unknown');
        console.log('   Email:', profileResponse.data.data.email);
        console.log('   Auth Method:', profileResponse.data.data.authMethod || 'N/A');
      }

      // Test 3: Update profile
      console.log('\n3. Testing profile update...');
      const updateResponse = await axios.patch(`${API_BASE_URL}/user/profile`, {
        name: 'Test User Updated'
      }, { headers });

      if (updateResponse.data.success) {
        console.log('✅ Profile updated successfully');
      }

      // Test 4: Get sessions
      console.log('\n4. Testing sessions endpoint...');
      const sessionsResponse = await axios.get(`${API_BASE_URL}/user/sessions`, { headers });
      
      if (sessionsResponse.data.success) {
        console.log('✅ Sessions fetched successfully');
        console.log(`   Found ${sessionsResponse.data.data.length} active session(s)`);
      }

      // Test 5: Change password (if password user)
      console.log('\n5. Testing password change...');
      try {
        const passwordResponse = await axios.post(`${API_BASE_URL}/user/change-password`, {
          currentPassword: 'password',
          newPassword: 'newpassword123'
        }, { headers });

        if (passwordResponse.data.success) {
          console.log('✅ Password changed successfully');
        }
      } catch (error) {
        if (error.response?.data?.message?.includes('Passwordless')) {
          console.log('ℹ️ Passwordless user - password change not applicable');
        } else {
          console.log('❌ Password change failed:', error.response?.data?.message);
        }
      }

    } else {
      console.log('❌ Login failed');
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Cannot connect to server. Please ensure the backend is running on port 5000.');
    } else {
      console.log('❌ API test failed:', error.response?.data?.message || error.message);
    }
  }
}

testDashboardAPI();