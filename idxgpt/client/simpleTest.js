import axios from 'axios';

// Simple test to verify login system functionality
const BASE_URL = 'http://localhost:5000/api';

async function runSimpleTests() {
  console.log('🧪 Running Simple IDXGPT Login System Tests');
  console.log('==========================================');

  try {
    // Test 1: Check server health
    console.log('\n1. Testing server health...');
    const healthResponse = await axios.get(`${BASE_URL.replace('/api', '')}/health`);
    console.log('✅ Server health:', healthResponse.data);

    // Test 2: Check auth requirements
    console.log('\n2. Testing auth requirements...');
    const requirementsResponse = await axios.get(`${BASE_URL}/auth/requirements`);
    console.log('✅ Auth requirements:', requirementsResponse.data);

    // Test 3: Try login with valid email (development mode)
    console.log('\n3. Testing development login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'test@example.com'
    });
    console.log('✅ Login response:', loginResponse.data);

    if (loginResponse.data.success) {
      const token = loginResponse.data.data.token;
      console.log('✅ Token received successfully');

      // Test 4: Test protected route with token
      console.log('\n4. Testing protected route...');
      const profileResponse = await axios.get(`${BASE_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Profile response:', profileResponse.data);
    }

    console.log('\n🎉 All tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

runSimpleTests();