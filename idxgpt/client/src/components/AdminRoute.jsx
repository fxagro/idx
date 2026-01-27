import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking admin access...</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated and has admin role
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  console.log('AdminRoute check:', {
    hasToken: !!token,
    userRole,
    user: user?.role
  });

  if (!token) {
    // User is not authenticated, redirect to login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (userRole !== 'admin' && user?.role !== 'admin') {
    // User is authenticated but not an admin, redirect to dashboard
    console.warn('Access denied: User is not admin');
    return <Navigate to="/dashboard" replace />;
  }

  // User is authenticated and is an admin, render the protected component
  return children;
};

export default AdminRoute;