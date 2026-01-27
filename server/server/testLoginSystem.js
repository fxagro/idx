const axios = require('axios');
const logger = require('./utils/logger');
const consoleLogger = require('./utils/logger').console;

const BASE_URL = 'http://localhost:3001';

// Pre-test validation function for mock database
async function validateMockDatabase() {
  consoleLogger.info('🔍 Validating mock database hashes...');

  try {
    // Import mock database to validate hashes
    const { mockDatabase } = require('./mockDatabase');
    const bcrypt = require('bcryptjs');

    const users = mockDatabase.users;
    let hashValidationPassed = true;

    for (const user of users) {
      consoleLogger.debug(`Validating hash for user: ${user.email}`, {
        email: user.email,
        hashPrefix: user.password.substring(0, 10) + '...',
        timestamp: new Date().toISOString()
      });

      // Check if hash format is valid bcrypt
      if (!user.password.startsWith('$2a$') && !user.password.startsWith('$2b$') && !user.password.startsWith('$2y$')) {
        consoleLogger.error(`Invalid hash format for ${user.email}`, {
          hash: user.password,
          timestamp: new Date().toISOString()
        });
        hashValidationPassed = false;
      }

      // Test hash against expected passwords
      let expectedPassword = '';
      if (user.email === 'test@example.com') {
        expectedPassword = 'Password123';
      } else if (user.email === 'admin@ai-saham.com') {
        expectedPassword = 'AdminPass123';
      }

      if (expectedPassword) {
        const isValid = await bcrypt.compare(expectedPassword, user.password);
        consoleLogger.debug(`Hash validation for ${user.email}`, {
          email: user.email,
          expectedPassword: expectedPassword,
          isValid: isValid,
          timestamp: new Date().toISOString()
        });

        if (!isValid) {
          consoleLogger.error(`Hash mismatch for ${user.email}`, {
            email: user.email,
            expectedPassword: expectedPassword,
            storedHash: user.password.substring(0, 20) + '...',
            timestamp: new Date().toISOString()
          });
          hashValidationPassed = false;
        }
      }
    }

    if (hashValidationPassed) {
      consoleLogger.success('✅ Mock database hash validation passed');
    } else {
      consoleLogger.error('❌ Mock database hash validation failed');
    }

    return hashValidationPassed;
  } catch (error) {
    consoleLogger.error('Error validating mock database', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return false;
  }
}

/**
 * Test case definitions
 */
const testCases = [
  {
    id: 1,
    name: 'Login with missing fields',
    method: 'POST',
    url: '/api/auth/login',
    data: {}, // Missing email and password
    expectedStatus: 400,
    expectedError: 'Email is required'
  },
  {
    id: 2,
    name: 'Login with password too short',
    method: 'POST',
    url: '/api/auth/login',
    data: {
      email: 'test@example.com',
      password: 'short' // Less than 8 characters
    },
    expectedStatus: 400,
    expectedError: 'Password must be at least 8 characters'
  },
  {
    id: 3,
    name: 'Login with valid credentials',
    method: 'POST',
    url: '/api/auth/login',
    data: {
      email: 'test@example.com',
      password: 'Password123' // Valid password for test user
    },
    expectedStatus: 200,
    shouldContainToken: true
  },
  {
    id: 4,
    name: 'Login with unregistered email',
    method: 'POST',
    url: '/api/auth/login',
    data: {
      email: 'nonexistent@example.com',
      password: 'WrongPassword123'
    },
    expectedStatus: 400,
    expectedError: 'Invalid credentials'
  },
  {
    id: 5,
    name: 'Login with wrong password',
    method: 'POST',
    url: '/api/auth/login',
    data: {
      email: 'test@example.com',
      password: 'WrongPassword123'
    },
    expectedStatus: 400,
    expectedError: 'Invalid credentials'
  },
  {
    id: 6,
    name: 'Access /api/me without token',
    method: 'GET',
    url: '/api/me',
    data: {},
    expectedStatus: 401,
    expectedError: 'No token provided'
  },
  {
    id: 7,
    name: 'Access /api/me with invalid token',
    method: 'GET',
    url: '/api/me',
    data: {},
    headers: {
      Authorization: 'Bearer invalid-token-here'
    },
    expectedStatus: 401,
    expectedError: 'Invalid token'
  }
];

/**
 * Execute a single test case
 */
async function executeTest(testCase) {
   const startTime = Date.now();

   try {
     consoleLogger.info(`🔄 Running test: ${testCase.name}`, {
       testId: testCase.id,
       method: testCase.method,
       url: testCase.url,
       data: testCase.data,
       timestamp: new Date().toISOString()
     });

     // Special debug logging for Test Case 3 (the problematic one)
     if (testCase.id === 3) {
       consoleLogger.debug(`🔍 Test Case 3 Debug Info`, {
         email: testCase.data.email,
         password: testCase.data.password,
         expectedPassword: 'Password123',
         timestamp: new Date().toISOString()
       });
     }

     const response = await axios({
       method: testCase.method,
       url: `${BASE_URL}${testCase.url}`,
       data: testCase.data,
       headers: testCase.headers || {}
     });

     const duration = Date.now() - startTime;

     consoleLogger.info(`✅ Test completed: ${testCase.name}`, {
       testId: testCase.id,
       status: response.status,
       duration: `${duration}ms`,
       hasToken: !!response.data?.data?.token,
       timestamp: new Date().toISOString()
     });

     // Special success logging for Test Case 3
     if (testCase.id === 3 && response.status === 200) {
       consoleLogger.success(`🎉 Test Case 3 PASSED! Valid credentials login successful`, {
         email: testCase.data.email,
         tokenLength: response.data?.data?.token?.length || 0,
         timestamp: new Date().toISOString()
       });
     }

     return {
       testId: testCase.id,
       name: testCase.name,
       status: response.status,
       data: response.data,
       duration,
       success: response.status === testCase.expectedStatus,
       error: null
     };

   } catch (error) {
     const duration = Date.now() - startTime;

     consoleLogger.error(`❌ Test failed: ${testCase.name}`, {
       testId: testCase.id,
       error: error.message,
       status: error.response?.status,
       responseData: error.response?.data,
       duration: `${duration}ms`,
       timestamp: new Date().toISOString()
     });

     // Special error logging for Test Case 3
     if (testCase.id === 3) {
       consoleLogger.error(`🚨 Test Case 3 FAILED! Hash mismatch detected`, {
         email: testCase.data.email,
         password: testCase.data.password,
         expectedError: 'Invalid credentials',
         actualError: error.response?.data?.error,
         timestamp: new Date().toISOString()
       });
     }

     return {
       testId: testCase.id,
       name: testCase.name,
       status: error.response?.status || 500,
       data: error.response?.data || null,
       duration,
       success: error.response?.status === testCase.expectedStatus,
       error: error.message
     };
   }
 }

/**
 * Validate test result against expected outcome
 */
function validateTestResult(testCase, result) {
  let isValid = result.status === testCase.expectedStatus;

  // Additional validation for specific test cases
  if (testCase.id === 3 && testCase.shouldContainToken) {
    isValid = isValid && result.data?.data?.token && result.data?.success === true;
  }

  if (testCase.expectedError && result.data?.error) {
    isValid = isValid && result.data.error.includes(testCase.expectedError);
  }

  return isValid;
}

/**
 * Display test result in a formatted way
 */
function displayTestResult(testCase, result) {
  const isValid = validateTestResult(testCase, result);
  const status = isValid ? '✅ PASS' : '❌ FAIL';

  console.log(`\n${status} Test ${testCase.id}: ${testCase.name}`);
  console.log(`   Expected: ${testCase.expectedStatus}, Got: ${result.status}`);
  console.log(`   Duration: ${result.duration}ms`);

  if (result.data) {
    console.log(`   Response:`, JSON.stringify(result.data, null, 2));
  }

  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }

  return isValid;
}

/**
 * Display summary table
 */
function displaySummary(results) {
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`${'='.repeat(60)}`);

  if (failed > 0) {
    console.log(`\n❌ FAILED TESTS:`);
    results.filter(r => !r.success).forEach(result => {
      console.log(`   ${result.testId}. ${result.name}`);
    });
  }

  console.log(`\n✅ PASSED TESTS:`);
  results.filter(r => r.success).forEach(result => {
    console.log(`   ${result.testId}. ${result.name}`);
  });
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log(`🚀 Starting IDXGPT Login System Tests`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Total Tests: ${testCases.length}`);
  console.log(`${'='.repeat(60)}`);

  const results = [];

  for (const testCase of testCases) {
    const result = await executeTest(testCase);
    results.push(result);

    displayTestResult(testCase, result);
  }

  displaySummary(results);

  return results;
}

/**
 * Main execution function
 */
async function main() {
   try {
     // Check if server is running
     await axios.get(`${BASE_URL}/health`);
     console.log(`✅ Server is running at ${BASE_URL}`);

     // Pre-test validation of mock database
     console.log(`\n${'='.repeat(60)}`);
     console.log(`PRE-TEST VALIDATION`);
     console.log(`${'='.repeat(60)}`);

     const hashValidationPassed = await validateMockDatabase();

     if (!hashValidationPassed) {
       console.error(`❌ Pre-test validation failed. Please fix hash issues before running tests.`);
       process.exit(1);
     }

     console.log(`\n${'='.repeat(60)}`);
     console.log(`RUNNING TESTS`);
     console.log(`${'='.repeat(60)}`);

     // Run all tests
     const results = await runAllTests();

     // Exit with appropriate code
     const failedTests = results.filter(r => !r.success).length;
     process.exit(failedTests > 0 ? 1 : 0);

   } catch (error) {
     console.error(`❌ Server is not running at ${BASE_URL}`);
     console.error(`   Please start the server first:`);
     console.error(`   cd server && node loginSystemServer.js`);
     console.error(`   Error: ${error.message}`);
     process.exit(1);
   }
 }

// Handle process termination
process.on('SIGINT', () => {
  console.log(`\n🛑 Tests interrupted by user`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`\n🛑 Tests terminated`);
  process.exit(0);
});

// Run tests if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  testCases,
  executeTest,
  runAllTests,
  validateTestResult
};