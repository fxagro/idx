// client/src/components/AdminPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useNavigate, Link } from 'react-router-dom';
import AdminNavbar from './AdminNavbar';

const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/admin/users');
        setUsers(response.data);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch users');
        setLoading(false);
        if (err.response?.status === 403) {
          navigate('/dashboard');
        }
      }
    };
    fetchUsers();
  }, [navigate]);

  const handleEdit = async (userId, api_limit, subscription_expiry) => {
    try {
      const response = await api.put(`/admin/users/${userId}`, {
        api_limit,
        subscription_expiry,
      });
      setUsers(users.map((user) => (user.id === userId ? response.data : user)));
      setEditUser(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto sm:p-6">
      <AdminNavbar />

      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4 sm:text-3xl">Admin Panel</h1>
        <p className="text-gray-600 mb-6">
          Manage users, affiliate settings, and other administrative functions.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr>
              <th className="p-2 border">ID</th>
              <th className="p-2 border">Email</th>
              <th className="p-2 border">Name</th>
              <th className="p-2 border">API Usage</th>
              <th className="p-2 border">API Limit</th>
              <th className="p-2 border">Subscription Expiry</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="p-2 border">{user.id}</td>
                <td className="p-2 border">{user.email}</td>
                <td className="p-2 border">{user.name || 'N/A'}</td>
                <td className="p-2 border">{user.api_usage}</td>
                <td className="p-2 border">{user.api_limit}</td>
                <td className="p-2 border">
                  {user.subscription_expiry
                    ? new Date(user.subscription_expiry).toLocaleDateString()
                    : 'Free'}
                </td>
                <td className="p-2 border">
                  <button
                    onClick={() => setEditUser(user)}
                    className="text-blue-500 hover:underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editUser && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h2 className="text-xl font-semibold mb-2">Edit User: {editUser.email}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleEdit(
                editUser.id,
                parseInt(e.target.api_limit.value),
                e.target.subscription_expiry.value || null
              );
            }}
            className="grid gap-4"
          >
            <div>
              <label className="block">API Limit</label>
              <input
                type="number"
                name="api_limit"
                defaultValue={editUser.api_limit}
                className="border p-2 rounded w-full"
                min="0"
              />
            </div>
            <div>
              <label className="block">Subscription Expiry</label>
              <input
                type="date"
                name="subscription_expiry"
                defaultValue={editUser.subscription_expiry?.split('T')[0]}
                className="border p-2 rounded w-full"
              />
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
              >
                Save
              </button>
              <button
                onClick={() => setEditUser(null)}
                className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminPage;