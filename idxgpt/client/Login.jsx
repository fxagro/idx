import React, { useState, useEffect } from 'react';
import { authAPI, apiUtils } from './api.js';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'
  const [authMode, setAuthMode] = useState('development'); // 'development' or 'production'
  const [debugInfo, setDebugInfo] = useState(null); // For detailed error debugging
  const [requestLog, setRequestLog] = useState([]); // For logging requests

  // Check authentication requirements on component mount
  useEffect(() => {
    const checkAuthRequirements = async () => {
      try {
        const response = await authAPI.getRequirements();
        setAuthMode(response.data.environment);
      } catch (error) {
        console.error('Failed to check auth requirements:', error);
        setMessage('Failed to connect to server');
        setMessageType('error');
      }
    };

    checkAuthRequirements();
  }, []);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Enhanced logging function
  const logRequest = (type, details) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      details
    };
    setRequestLog(prev => [...prev.slice(-9), logEntry]); // Keep last 10 entries
    console.log(`[${logEntry.timestamp}] ${type}:`, details);
  };

  // Handle form submission with enhanced error handling and logging
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setDebugInfo(null);

    logRequest('LOGIN_ATTEMPT', {
      email: formData.email,
      hasPassword: !!formData.password,
      authMode
    });

    try {
      // Login with email only in development, email+password in production
      const response = await authAPI.login(formData.email, formData.password);

      if (response.success) {
        logRequest('LOGIN_SUCCESS', {
          userId: response.data.user.id,
          email: response.data.user.email,
          role: response.data.user.role,
          tokenLength: response.data.token.length
        });

        // Store token and user data
        apiUtils.setAuthToken(response.data.token);
        apiUtils.setUser(response.data.user);

        setMessage(response.message || 'Login successful!');
        setMessageType('success');

        // Optional: Force page reload to update app state
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      console.error('Login error:', error);

      logRequest('LOGIN_ERROR', {
        message: error.message,
        code: error.code,
        status: error.status,
        stack: error.stack
      });

      // Enhanced error handling with specific error types
      let errorMessage = 'Login failed';
      let debugDetails = null;

      if (error.message.includes('Invalid email format')) {
        errorMessage = 'Invalid email format - Please check your email address';
        debugDetails = { type: 'validation', field: 'email' };
      } else if (error.message.includes('Malformed request')) {
        errorMessage = 'Malformed request - Please check your input data';
        debugDetails = { type: 'malformed', suggestion: 'Ensure email is properly formatted' };
      } else if (error.message.includes('Missing headers')) {
        errorMessage = 'Missing headers - Please refresh and try again';
        debugDetails = { type: 'headers', suggestion: 'Check Content-Type header' };
      } else if (error.message.includes('Server error')) {
        errorMessage = 'Server error - Please try again later';
        debugDetails = { type: 'server', suggestion: 'Check server logs for details' };
      } else if (error.message.includes('Connection refused')) {
        errorMessage = 'Cannot connect to server - Please ensure server is running';
        debugDetails = { type: 'connection', suggestion: 'Start server on port 5000' };
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout - Server took too long to respond';
        debugDetails = { type: 'timeout', suggestion: 'Check server performance' };
      } else if (error.message.includes('User not found')) {
        errorMessage = 'User not found - Please check your email or register first';
        debugDetails = { type: 'user_not_found', suggestion: 'Use test@example.com for testing' };
      } else if (error.message.includes('Invalid credentials')) {
        errorMessage = 'Invalid credentials - Please check email and password';
        debugDetails = { type: 'credentials', suggestion: 'Use password123 for testing' };
      }

      setMessage(errorMessage);
      setMessageType('error');
      setDebugInfo(debugDetails);
    } finally {
      setLoading(false);
    }
  };

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div style={{
      maxWidth: '400px',
      margin: '50px auto',
      padding: '30px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
        IDXGPT Login System
      </h2>

      {/* Environment indicator */}
      <div style={{
        padding: '10px',
        marginBottom: '20px',
        backgroundColor: authMode === 'development' ? '#fff3cd' : '#d1ecf1',
        border: `1px solid ${authMode === 'development' ? '#ffeaa7' : '#bee5eb'}`,
        borderRadius: '4px',
        color: authMode === 'development' ? '#856404' : '#0c5460',
        textAlign: 'center'
      }}>
        {authMode === 'development' ? '🟡 Development Mode' : '🔴 Production Mode'}
        <br />
        <small>
          {authMode === 'development'
            ? 'Passwordless login enabled'
            : 'Email and password required'
          }
        </small>
      </div>

      {/* Success/Error message with enhanced error details */}
      {message && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          backgroundColor: messageType === 'success' ? '#d4edda' : '#f8d7da',
          border: `1px solid ${messageType === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          color: messageType === 'success' ? '#155724' : '#721c24'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            {messageType === 'success' ? '✅ Success' : '❌ Error'}
          </div>
          <div>{message}</div>

          {/* Enhanced error details */}
          {messageType === 'error' && debugInfo && (
            <div style={{
              marginTop: '10px',
              padding: '8px',
              backgroundColor: '#fff',
              border: '1px solid #f5c6cb',
              borderRadius: '3px',
              fontSize: '12px'
            }}>
              <div><strong>Debug Info:</strong></div>
              <div>Type: {debugInfo.type}</div>
              {debugInfo.field && <div>Field: {debugInfo.field}</div>}
              {debugInfo.suggestion && <div>Suggestion: {debugInfo.suggestion}</div>}
              <div>Timestamp: {new Date().toISOString()}</div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Email field */}
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="email" style={{
            display: 'block',
            marginBottom: '5px',
            fontWeight: 'bold',
            color: '#555'
          }}>
            Email Address *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            placeholder="Enter your email"
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '16px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Password field (only in production) */}
        {authMode === 'production' && (
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="password" style={{
              display: 'block',
              marginBottom: '5px',
              fontWeight: 'bold',
              color: '#555'
            }}>
              Password *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              placeholder="Enter your password"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
            <small style={{ color: '#666', fontSize: '12px' }}>
              Demo password: password123
            </small>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '20px'
          }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      {/* Test credentials */}
      <div style={{
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <strong>Test Credentials:</strong>
        <br />
        <strong>User:</strong> test@example.com
        {authMode === 'production' && (
          <>
            <br />
            <strong>Password:</strong> password123
          </>
        )}
        <br />
        <strong>Admin:</strong> admin@ai-saham.com
        {authMode === 'production' && (
          <>
            <br />
            <strong>Password:</strong> password123
          </>
        )}
      </div>

      {/* Debug Panel Toggle */}
      <div style={{ marginBottom: '15px' }}>
        <button
          type="button"
          onClick={() => setDebugInfo(debugInfo ? null : {})}
          style={{
            padding: '8px 12px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          {debugInfo ? 'Hide Debug Info' : 'Show Debug Info'}
        </button>
      </div>

      {/* Debug Information Panel */}
      {debugInfo && (
        <div style={{
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '4px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>🔍 Debug Information</div>

          {/* Request Log */}
          {requestLog.length > 0 && (
            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>📋 Recent Requests:</div>
              <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {requestLog.map((log, index) => (
                  <div key={index} style={{
                    padding: '3px 0',
                    borderBottom: index < requestLog.length - 1 ? '1px solid #eee' : 'none',
                    color: log.type.includes('ERROR') ? '#dc3545' : log.type.includes('SUCCESS') ? '#28a745' : '#333'
                  }}>
                    <span style={{ fontWeight: 'bold' }}>{log.type}:</span> {JSON.stringify(log.details)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Auth State */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>🔐 Auth State:</div>
            <div>Authenticated: {apiUtils.isAuthenticated() ? 'Yes' : 'No'}</div>
            <div>Token Length: {apiUtils.getAuthToken() ? apiUtils.getAuthToken().length : 0}</div>
            <div>User: {apiUtils.getUser() ? apiUtils.getUser().email : 'None'}</div>
          </div>

          {/* Environment Info */}
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>🌍 Environment:</div>
            <div>Mode: {authMode}</div>
            <div>API Base: http://localhost:5000/api</div>
            <div>Timestamp: {new Date().toISOString()}</div>
          </div>
        </div>
      )}

      {/* Current user info (if logged in) */}
      {apiUtils.isAuthenticated() && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#e7f3ff',
          borderRadius: '4px',
          border: '1px solid #b3d9ff'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>👤 Currently Logged In:</div>
          <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
            {JSON.stringify(apiUtils.getUser(), null, 2)}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;