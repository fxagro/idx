import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api.js';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      console.log('[AuthContext] Verifying token for user');

      // Use enhanced API with retry logic
      api.get('/me')
        .then((response) => {
          console.log('[AuthContext] Token verification successful', response.data);
          setUser(response.data.data.user);
          setConnectionError(null);
          setLoading(false);
        })
        .catch((error) => {
          console.error('[AuthContext] Token verification failed', error);

          // Handle connection refused errors specifically
          if (error.isConnectionError || error.message?.includes('Tidak bisa terhubung ke server')) {
            console.error('[AuthContext] Connection refused - server may be down');
            setConnectionError('Server tidak tersedia. Silakan coba lagi nanti.');
            setUser(null);
          } else if (error.response?.status === 401 || error.response?.status === 403) {
            console.log('[AuthContext] Token expired or invalid');
            localStorage.removeItem('token');
            setUser(null);
          } else {
            console.log('[AuthContext] Other error - clearing token');
            localStorage.removeItem('token');
            setUser(null);
          }

          setLoading(false);
        });
    } else {
      console.log('[AuthContext] No token found, user not authenticated');
      setLoading(false);
    }
  }, []);

  // Function to retry connection
  const retryConnection = () => {
    setLoading(true);
    setConnectionError(null);

    const token = localStorage.getItem('token');
    if (token) {
      api.get('/me')
        .then((response) => {
          console.log('[AuthContext] Retry successful', response.data);
          setUser(response.data.data.user);
          setConnectionError(null);
        })
        .catch((error) => {
          console.error('[AuthContext] Retry failed', error);
          if (error.isConnectionError) {
            setConnectionError('Server masih tidak tersedia. Pastikan backend berjalan.');
          }
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      loading,
      connectionError,
      retryConnection
    }}>
      {children}
    </AuthContext.Provider>
  );
};
