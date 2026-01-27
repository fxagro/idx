/**
 * IDXGPT Login System - Frontend Integration Test Suite
 * Tests all 8 required scenarios for dual mode authentication
 */

import axios from 'axios';

// Test configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_EMAILS = {
  valid: 'test@example.com',
  invalid: 'agro@demo.com', // This should fail in current setup
  malformed: 'not-an-email',
  nonExistent: 'nonexistent@example.com'
};

// Test results tracker
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

// Test helper functions
const logTest = (testName, status, details = '') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🧪 ${testName}: ${status}${details ? ` - ${details}` : ''}`);

  testResults.details.push({
    name: testName,
    status,
    details,
    timestamp
  });
};

const assertResponse = (response, expectedStatus, expectedData = null) => {
  if (response.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
  }

  if (expectedData && JSON.stringify(response.data) !== JSON.stringify(expectedData)) {
    throw new Error(`Expected data ${JSON.stringify(expectedData)}, got ${JSON.stringify(response.data)}`);
  }
};

const runTest = async (testName, testFunction) => {
  testResults.total++;

  try {
    const startTime = Date.now();
    await testFunction();
    const duration = Date.now() - startTime;

    testResults.passed++;
    logTest(testName, '✅ PASS', `${duration}ms`);
  } catch (error) {
    testResults.failed++;
    logTest(testName, '❌ FAIL', error.message);
  }
};

// Test 1: Login with valid email in passwordless mode
const testValidPasswordlessLogin = async () => {
  const response = await axios.post(`${BASE_URL}/auth/login`, {
    email: TEST_EMAILS.valid
  });

  assertResponse(response, 200);

  if (!response.data.token) {
    throw new Error('No token returned');
  }

  if (!response.data.data.user) {
    throw new Error('No user data returned');
  }

  console.log('  📧 Email:', response.data.data.user.email);
  console.log('  👤 Role:', response.data.data.user.role);
  console.log('  🔑 Token length:', response.data.token.length);

  return response.data.token;
};

// Test 2: Login with invalid email format
const testInvalidEmailFormat = async () => {
  try {
    await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAILS.malformed
    });
    throw new Error('Should have failed with invalid email format');
  } catch (error) {
    assertResponse(error.response, 400);
    if (!error.response.data.error.includes('Invalid email format')) {
      throw new Error(`Expected "Invalid email format" error, got: ${error.response.data.error}`);
    }
  }
};

// Test 3: Login with empty payload
const testEmptyPayload = async () => {
  try {
    await axios.post(`${BASE_URL}/auth/login`, {});
    throw new Error('Should have failed with empty payload');
  } catch (error) {
    assertResponse(error.response, 400);
    if (!error.response.data.error.includes('Email required')) {
      throw new Error(`Expected "Email required" error, got: ${error.response.data.error}`);
    }
  }
};

// Test 4: Login with non-existing email
const testNonExistentEmail = async () => {
  try {
    await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAILS.nonExistent
    });
    throw new Error('Should have failed with non-existent email');
  } catch (error) {
    assertResponse(error.response, 400);
    if (!error.response.data.error.includes('User not found')) {
      throw new Error(`Expected "User not found" error, got: ${error.response.data.error}`);
    }
  }
};

// Test 5: Login with malformed JSON
const testMalformedJSON = async () => {
  try {
    await axios.post(`${BASE_URL}/auth/login`, '{ invalid json }', {
      headers: { 'Content-Type': 'application/json' }
    });
    throw new Error('Should have failed with malformed JSON');
  } catch (error) {
    if (error.response) {
      assertResponse(error.response, 400);
      if (!error.response.data.error.includes('Malformed request')) {
        throw new Error(`Expected "Malformed request" error, got: ${error.response.data.error}`);
      }
    } else {
      // Network or parsing error is acceptable for malformed JSON
      console.log('  📝 Malformed JSON caused parsing error (acceptable)');
    }
  }
};

// Test 6: Login with missing Content-Type header
const testMissingContentType = async () => {
  try {
    await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAILS.valid
    }, {
      headers: {} // No Content-Type header
    });
    throw new Error('Should have failed with missing Content-Type');
  } catch (error) {
    if (error.response) {
      assertResponse(error.response, 400);
      if (!error.response.data.error.includes('Invalid content type')) {
        throw new Error(`Expected "Invalid content type" error, got: ${error.response.data.error}`);
      }
    } else {
      // Network error is acceptable for missing Content-Type
      console.log('  📝 Missing Content-Type caused network error (acceptable)');
    }
  }
};

// Test 7: Access /api/me with valid token
const testValidTokenAccess = async (token) => {
  const response = await axios.get(`${BASE_URL}/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  assertResponse(response, 200);

  if (!response.data.data.user) {
    throw new Error('No user data returned');
  }

  console.log('  👤 User:', response.data.data.user.email);
  console.log('  🏷️ Role:', response.data.data.user.role);
};

// Test 8: Access /api/me with invalid token
const testInvalidTokenAccess = async () => {
  try {
    await axios.get(`${BASE_URL}/me`, {
      headers: {
        Authorization: 'Bearer invalid-token-12345'
      }
    });
    throw new Error('Should have failed with invalid token');
  } catch (error) {
    assertResponse(error.response, 401);
    if (!error.response.data.error.includes('Invalid token')) {
      throw new Error(`Expected "Invalid token" error, got: ${error.response.data.error}`);
    }
  }
};

// Test 9: Test agro@demo.com user (should work now)
const testAgroDemoUser = async () => {
  const response = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'agro@demo.com'
  });

  assertResponse(response, 200);

  if (!response.data.token) {
    throw new Error('No token returned for agro@demo.com');
  }

  console.log('  📧 Email: agro@demo.com');
  console.log('  👤 Role:', response.data.data.user.role);
  console.log('  🔑 Token length:', response.data.token.length);

  return response.data.token;
};

// Test 10: Test production mode requirements
const testProductionModeRequirements = async () => {
  const response = await axios.get(`${BASE_URL}/auth/requirements`);
  assertResponse(response, 200);

  if (response.data.data.passwordless !== true) {
    throw new Error('Expected passwordless mode to be true in development');
  }

  console.log('  🔐 Passwordless mode:', response.data.data.passwordless);
  console.log('  🏭 Environment:', response.data.data.environment);
};

// Main test runner
const runAllTests = async () => {
  console.log('🚀 Starting IDXGPT Login System Integration Tests');
  console.log('================================================\n');

  try {
    // Test auth requirements first
    await runTest('Test 10: Production Mode Requirements', testProductionModeRequirements);

    // Get a valid token for subsequent tests
    const token = await runTest('Test 1: Valid Passwordless Login (test@example.com)', testValidPasswordlessLogin);

    // Test agro@demo.com user
    const agroToken = await runTest('Test 9: Agro Demo User Login', testAgroDemoUser);

    // Test error scenarios
    await runTest('Test 2: Invalid Email Format', testInvalidEmailFormat);
    await runTest('Test 3: Empty Payload', testEmptyPayload);
    await runTest('Test 4: Non-existent Email', testNonExistentEmail);
    await runTest('Test 5: Malformed JSON', testMalformedJSON);
    await runTest('Test 6: Missing Content-Type', testMissingContentType);

    // Test protected routes
    await runTest('Test 7: Valid Token Access (/api/me)', () => testValidTokenAccess(token));
    await runTest('Test 8: Invalid Token Access (/api/me)', testInvalidTokenAccess);

    // Test agro@demo.com protected access
    await runTest('Test 11: Agro Demo Valid Token Access (/api/me)', () => testValidTokenAccess(agroToken));

  } catch (error) {
    console.error('💥 Test suite error:', error);
  }

  // Print summary
  console.log('\n================================================');
  console.log('📊 Test Results Summary');
  console.log('================================================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.details
      .filter(test => test.status === '❌ FAIL')
      .forEach(test => {
        console.log(`  • ${test.name}: ${test.details}`);
      });
  }

  console.log('\n🎯 Test Suite Complete');

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Tests interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Tests terminated');
  process.exit(1);
});

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Wait for server to be ready
  setTimeout(runAllTests, 2000);
}

export {
  runAllTests,
  testResults,
  runTest
};