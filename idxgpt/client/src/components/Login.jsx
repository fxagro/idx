import React, { useState, useEffect } from 'react';
import { authAPI } from '../../api.js';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [serverConfig, setServerConfig] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [isDevelopment, setIsDevelopment] = useState(false);
  const [authMode, setAuthMode] = useState('passwordless'); // 'passwordless' or 'production'

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear messages when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleModeToggle = () => {
    const newMode = authMode === 'passwordless' ? 'production' : 'passwordless';
    setAuthMode(newMode);
    setIsDevelopment(newMode === 'passwordless');

    // Clear form when switching modes
    setFormData({ email: '', password: '' });
    setError('');
    setSuccess('');

    console.log(`🔄 Auth mode switched to: ${newMode}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    console.log('🔄 Login form submitted:', {
      email: formData.email,
      hasPassword: !!formData.password,
      isDevelopment,
      timestamp: new Date().toISOString()
    });

    try {
      // Validate form data based on mode
      if (!formData.email.trim()) {
        throw new Error('Email is required');
      }

      // In production mode, password is required
      if (authMode === 'production' && !formData.password.trim()) {
        throw new Error('Password is required in production mode');
      }

      // Attempt login
      const response = await authAPI.login(formData.email.trim(), formData.password || null);

      console.log('🎉 Login successful:', {
        email: formData.email,
        hasToken: !!response.data?.token,
        userRole: response.data?.user?.role,
        authMode: isDevelopment ? 'passwordless' : 'password',
        timestamp: new Date().toISOString()
      });

      // Store token in localStorage
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token);
        setSuccess(`Login successful! Welcome ${response.data.user?.name || formData.email}`);

        // Simulate redirect to virtual trading page
        setTimeout(() => {
          console.log('🔀 Redirecting to /virtual-trading...');
          // In a real app, you would use React Router: navigate('/virtual-trading');
        }, 1500);
      } else {
        throw new Error('No token received from server');
      }

    } catch (error) {
      console.error('❌ Login failed:', {
        email: formData.email,
        error: error.message,
        code: error.code,
        isNetworkError: error.isNetworkError,
        isCorsError: error.isCorsError,
        isTimeoutError: error.isTimeoutError,
        response: error.response?.data,
        timestamp: new Date().toISOString()
      });

      // Handle different error types with specific messages
      if (error.isNetworkError || error.code === 'NETWORK_ERROR') {
        setError('Connection refused - Cannot connect to server. Please check if the server is running.');
      } else if (error.isCorsError || error.message.includes('CORS')) {
        setError('CORS policy blocked - Server is not allowing requests from this origin.');
      } else if (error.isTimeoutError || error.code === 'TIMEOUT_ERROR') {
        setError('Server not reachable - Request timed out. Server may be down or slow.');
      } else if (error.response?.status === 400) {
        if (error.response.data?.error === 'Validation failed') {
          const validationErrors = error.response.data.details;
          const firstError = validationErrors?.[0]?.message || 'Validation failed';
          setError(firstError);
        } else if (error.response.data?.code === 'USER_NOT_FOUND') {
          setError('User not found - Only existing users can login in this demo');
        } else if (error.response.data?.code === 'INVALID_EMAIL_FORMAT') {
          setError('Invalid email format - Please check your email address');
        } else if (error.response.data?.code === 'MISSING_BODY') {
          setError('Request body is required');
        } else if (error.response.data?.code === 'MALFORMED_REQUEST') {
          setError('Malformed request - Please check your input data');
        } else {
          setError(error.response.data?.error || 'Invalid credentials');
        }
      } else if (error.response?.status === 401) {
        setError('Invalid credentials - Please check your email and password.');
      } else if (error.response?.status === 403) {
        setError('Access forbidden - You do not have permission to access this resource.');
      } else if (error.response?.status === 404) {
        setError('Server endpoint not found - Please check the server configuration.');
      } else if (error.response?.status === 500) {
        setError('Internal server error - Please try again later.');
      } else if (error.response?.status === 503) {
        setError('Service unavailable - Server is temporarily down.');
      } else if (error.message === 'Email is required' || error.message === 'Password is required') {
        setError(error.message);
      } else if (error.message.includes('Network Error')) {
        setError('Network Error - Cannot connect to server. Please check your internet connection.');
      } else {
        setError(`Login failed: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestUserLogin = (email, password = '') => {
    setFormData({ email, password });
    console.log('🧪 Auto-filled test credentials:', { email, password: password || '(no password - development mode)' });
  };

  // Fetch server configuration and auth requirements
  const fetchServerConfig = async () => {
    try {
      console.log('🔍 Fetching server configuration...');
      const response = await fetch('http://localhost:5000/health');
      const config = await response.json();
      setServerConfig(config);

      // Fetch auth requirements to determine if we're in development mode
      try {
        const authResponse = await fetch('http://localhost:5000/api/auth/requirements');
        const authConfig = await authResponse.json();
        const passwordless = authConfig.data?.passwordless || false;
        setIsDevelopment(passwordless);
        setAuthMode(passwordless ? 'passwordless' : 'production');
        console.log('🔐 Auth mode:', passwordless ? 'passwordless' : 'production');
      } catch (authError) {
        console.error('❌ Failed to fetch auth requirements:', authError);
        // Default to passwordless mode if we can't fetch requirements
        setIsDevelopment(true);
        setAuthMode('passwordless');
      }

      console.log('✅ Server config fetched:', config);
    } catch (error) {
      console.error('❌ Failed to fetch server config:', error);
      setServerConfig({ error: error.message });
      // Default to passwordless mode if server is not reachable
      setIsDevelopment(true);
      setAuthMode('passwordless');
    }
  };

  // Run specific test scenarios
  const runTest = async (testName, testFunction) => {
    const startTime = Date.now();
    try {
      console.log(`🧪 Running test: ${testName}`);
      setTestResults(prev => [...prev, { test: testName, status: 'running', timestamp: new Date().toISOString() }]);

      await testFunction();

      const duration = Date.now() - startTime;
      setTestResults(prev => [...prev.slice(0, -1), {
        test: testName,
        status: 'pass',
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }]);
      console.log(`✅ Test passed: ${testName} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      setTestResults(prev => [...prev.slice(0, -1), {
        test: testName,
        status: 'fail',
        error: error.message,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }]);
      console.error(`❌ Test failed: ${testName} - ${error.message} (${duration}ms)`);
    }
  };

  // Test scenarios
  const testValidLogin = () => authAPI.login('test@example.com', 'Password123');
  const testServerDown = async () => {
    const response = await fetch('http://localhost:9999/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'Password123' })
    });
    return response;
  };
  const testCorsError = async () => {
    const response = await fetch('http://localhost:3001/api/test/cors-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (!response.ok) throw new Error('CORS policy blocked');
    return response;
  };
  const testNetworkError = async () => {
    const response = await fetch('http://localhost:3001/api/test/network-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    return response;
  };

  // Load server config on component mount
  useEffect(() => {
    fetchServerConfig();
  }, []);

  return (
    <div style={{
      maxWidth: '400px',
      margin: '50px auto',
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>
        IDXGPT Login Simulation
      </h2>

      {/* Mode Toggle */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Authentication Mode:</p>
        <div style={{ display: 'inline-flex', borderRadius: '20px', overflow: 'hidden', border: '2px solid #007bff' }}>
          <button
            type="button"
            onClick={handleModeToggle}
            style={{
              padding: '8px 16px',
              backgroundColor: authMode === 'passwordless' ? '#007bff' : '#f8f9fa',
              color: authMode === 'passwordless' ? 'white' : '#007bff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
          >
            🔓 Passwordless
          </button>
          <button
            type="button"
            onClick={handleModeToggle}
            style={{
              padding: '8px 16px',
              backgroundColor: authMode === 'production' ? '#007bff' : '#f8f9fa',
              color: authMode === 'production' ? 'white' : '#007bff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
          >
            🔒 Production
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
          {authMode === 'passwordless'
            ? 'Only email required for existing users'
            : 'Email and password required'}
        </p>
      </div>

      {/* Test User Buttons */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>Test Users:</p>
        <button
          type="button"
          onClick={() => handleTestUserLogin('test@example.com')}
          style={{
            margin: '2px',
            padding: '5px 10px',
            fontSize: '12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test User {authMode === 'passwordless' && '(Passwordless)'}
        </button>
        <button
          type="button"
          onClick={() => handleTestUserLogin('admin@ai-saham.com')}
          style={{
            margin: '2px',
            padding: '5px 10px',
            fontSize: '12px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Admin User {authMode === 'passwordless' && '(Passwordless)'}
        </button>
        <button
          type="button"
          onClick={() => handleTestUserLogin('agro@demo.com')}
          style={{
            margin: '2px',
            padding: '5px 10px',
            fontSize: '12px',
            backgroundColor: '#ffc107',
            color: 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Agro Demo {authMode === 'passwordless' && '(Passwordless)'}
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Email Field */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Email:
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter your email"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Password Field - Only show in production mode */}
        {authMode === 'production' && (
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Password *:
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              🔒 Production mode: Password required
            </small>
          </div>
        )}

        {authMode === 'passwordless' && (
          <div style={{ marginBottom: '15px' }}>
            <small style={{ color: '#666', fontSize: '12px', backgroundColor: '#e7f3ff', padding: '8px', borderRadius: '4px', display: 'block' }}>
              🔓 Passwordless mode: Only email required for existing users
            </small>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '15px',
            border: '1px solid #f5c6cb'
          }}>
            ❌ {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div style={{
            backgroundColor: '#d4edda',
            color: '#155724',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '15px',
            border: '1px solid #c3e6cb'
          }}>
            ✅ {success}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: loading ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '🔄 Logging in...' : '🔐 Login'}
        </button>
      </form>

      {/* Debug Info */}
      <div style={{
        marginTop: '20px',
        padding: '10px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666'
      }}>
        <strong>Debug Info:</strong><br />
        Mode: {authMode === 'passwordless' ? '🔓 Passwordless' : '🔒 Production'}<br />
        Authenticated: {localStorage.getItem('token') ? '✅ Yes' : '❌ No'}<br />
        Token: {localStorage.getItem('token') ? '✅ Stored' : '❌ None'}
      </div>

      {/* Configuration Panel Toggle */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => setShowConfig(!showConfig)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          {showConfig ? '🔽 Hide' : '🔼 Show'} Test Panel
        </button>
      </div>

      {/* Configuration and Test Panel */}
      {showConfig && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{ marginTop: 0, color: '#495057' }}>🧪 Test Scenarios</h3>

          {/* Server Configuration Display */}
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ marginBottom: '8px', color: '#495057' }}>Server Configuration:</h4>
            <button
              type="button"
              onClick={fetchServerConfig}
              style={{
                padding: '4px 8px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px',
                marginBottom: '8px'
              }}
            >
              🔄 Refresh Config
            </button>
            <pre style={{
              backgroundColor: '#fff',
              padding: '8px',
              borderRadius: '4px',
              fontSize: '11px',
              overflow: 'auto',
              maxHeight: '150px'
            }}>
              {serverConfig ? JSON.stringify(serverConfig, null, 2) : 'Loading...'}
            </pre>
          </div>

          {/* Test Buttons */}
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ marginBottom: '8px', color: '#495057' }}>Test Scenarios:</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              <button
                type="button"
                onClick={() => runTest('Valid Login', testValidLogin)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                ✅ Valid Login
              </button>
              <button
                type="button"
                onClick={() => runTest('Server Down', testServerDown)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                🔌 Server Down
              </button>
              <button
                type="button"
                onClick={() => runTest('CORS Error', testCorsError)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#ffc107',
                  color: 'black',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                🚫 CORS Error
              </button>
              <button
                type="button"
                onClick={() => runTest('Network Error', testNetworkError)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#fd7e14',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                🌐 Network Error
              </button>
            </div>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div>
              <h4 style={{ marginBottom: '8px', color: '#495057' }}>Test Results:</h4>
              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: '#fff',
                border: '1px solid #dee2e6',
                borderRadius: '4px'
              }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e9ecef' }}>
                      <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Test</th>
                      <th style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Status</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Duration</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((result, index) => (
                      <tr key={index}>
                        <td style={{ padding: '6px', borderBottom: '1px solid #dee2e6' }}>{result.test}</td>
                        <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>
                          {result.status === 'pass' && '✅'}
                          {result.status === 'fail' && '❌'}
                          {result.status === 'running' && '🔄'}
                        </td>
                        <td style={{ padding: '6px', borderBottom: '1px solid #dee2e6' }}>{result.duration || '-'}</td>
                        <td style={{
                          padding: '6px',
                          borderBottom: '1px solid #dee2e6',
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {result.error || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Login;