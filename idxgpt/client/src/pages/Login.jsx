import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState(null); // 'passwordless' or 'password'
  const [isDevelopment, setIsDevelopment] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  // Fetch authentication requirements on component mount
  useEffect(() => {
    const fetchAuthRequirements = async () => {
      try {
        console.log('[Login] Fetching auth requirements...');
        const response = await api.get('/auth/requirements');
        const { passwordless, environment } = response.data.data;

        console.log('[Login] Auth requirements received:', {
          passwordless,
          environment,
          timestamp: new Date().toISOString()
        });

        setAuthMode(passwordless ? 'passwordless' : 'password');
        setIsDevelopment(passwordless);
      } catch (err) {
        console.error('[Login] Failed to fetch auth requirements:', err);
        // Fallback to development mode if we can't fetch requirements
        setAuthMode('passwordless');
        setIsDevelopment(true);
      }
    };

    fetchAuthRequirements();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log(`[Login] Attempting login in ${authMode} mode`, {
        email,
        hasPassword: !!password,
        isDevelopment,
        timestamp: new Date().toISOString()
      });

      // Prepare payload based on auth mode
      const payload = isDevelopment ? { email } : { email, password };

      console.log('[Login] Sending payload:', {
        ...payload,
        password: payload.password ? '[PRESENT]' : '[NOT_SENT]'
      });

      // Login
      const response = await api.post("/auth/login", payload);
      console.log('[Login] Login response received:', {
        status: response.status,
        hasToken: !!response.data.token,
        authMode: response.data.authMode,
        timestamp: new Date().toISOString()
      });

      localStorage.setItem('token', response.data.token);

      // Fetch user profile
      console.log('[Login] Fetching user profile...');
      const userResponse = await api.get("/me");
      console.log('[Login] User profile received:', {
        userId: userResponse.data.data.user.id,
        email: userResponse.data.data.user.email,
        role: userResponse.data.data.user.role
      });

      setUser(userResponse.data.data.user);

      setLoading(false);
      navigate("/dashboard");
    } catch (err) {
      console.error('[Login] Login error:', {
        message: err.message,
        status: err.response?.status,
        error: err.response?.data?.error,
        code: err.response?.data?.code,
        timestamp: new Date().toISOString()
      });

      // Handle specific error cases
      let errorMessage = "Login failed";

      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.status === 400) {
        if (err.response.data?.code === 'USER_NOT_FOUND') {
          errorMessage = "User not found";
        } else if (err.response.data?.code === 'INVALID_EMAIL') {
          errorMessage = "Invalid email format";
        } else if (err.response.data?.code === 'PASSWORD_REQUIRED') {
          errorMessage = "Password required";
        }
      } else if (err.response?.status === 401) {
        errorMessage = "Invalid credentials";
      }

      setError(errorMessage);
      setLoading(false);
    }
  };

  // Show loading state while fetching auth requirements
  if (authMode === null) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h2 className="text-2xl font-bold mb-4" data-testid="login-title">
        Login {isDevelopment ? '(Passwordless Mode)' : '(Production Mode)'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3 bg-white p-4 rounded-lg shadow">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full border p-2 rounded"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="email-input"
            required
          />
        </div>

        {/* Show password field only in production mode */}
        {!isDevelopment && (
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full border p-2 rounded"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="password-input"
              required
            />
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm" data-testid="error-message">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded w-full disabled:opacity-50"
          data-testid="login-button"
        >
          {loading ? "Loading..." : "Login"}
        </button>

        {/* Show auth mode info */}
        <div className="text-xs text-gray-500 text-center mt-2">
          Mode: {authMode} | Environment: {isDevelopment ? 'Development' : 'Production'}
        </div>
      </form>
    </div>
  );
}
