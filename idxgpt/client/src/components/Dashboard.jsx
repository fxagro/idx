// client/src/components/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Link } from 'react-router-dom';
import StockWatchlist from './StockWatchlist';
import TopGainers from './TopGainers';
import IDXHeatmap from './IDXHeatmap';
import CandlestickChart from './CandlestickChart';

const Dashboard = () => {
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('gainers');
  const [selectedStock, setSelectedStock] = useState('BBCA');

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/users/profile');
        setProfile(response.data);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch profile');
        setLoading(false);
      }
    };

    const fetchTransactions = async () => {
      try {
        const response = await api.get('/me/transactions');
        setTransactions(response.data);
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
      }
    };

    fetchProfile();
    fetchTransactions();
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long');
      return;
    }

    setPasswordLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword
      });
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordModal(false);
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleStockSelect = (symbol, market) => {
    setSelectedStock(symbol);
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

        {/* Top Section - Profil, Status Langganan, Ganti Password, Riwayat Transaksi */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Profile Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">👤 Profil</h2>
            <div className="space-y-2">
              <p><strong>Nama:</strong> {profile.name || 'N/A'}</p>
              <p><strong>Email:</strong> {profile.email}</p>
              <p><strong>Telepon:</strong> {profile.phone || 'N/A'}</p>
            </div>
          </div>

          {/* Subscription Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">📊 Status Langganan</h2>
            <div className="space-y-2">
              <p><strong>Status:</strong>
                <span className={`ml-2 px-2 py-1 rounded text-sm ${
                  profile.subscription_status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {profile.subscription_status}
                </span>
              </p>
              {profile.subscription_status === 'Paid' && (
                <p><strong>Berakhir:</strong> {new Date(profile.subscription_expiry).toLocaleDateString('id-ID')}</p>
              )}
              <p><strong>Penggunaan API:</strong> {profile.api_usage} / {profile.api_limit}</p>
              {profile.is_admin && (
                <Link to="/admin" className="inline-block mt-2 text-blue-600 hover:text-blue-800">
                  🛠️ Panel Admin
                </Link>
              )}
            </div>
          </div>

          {/* Password Change */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">🔐 Ganti Password</h2>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Ubah Password
            </button>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">📋 Riwayat Transaksi</h2>
            <div className="max-h-40 overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-gray-500">Belum ada transaksi</p>
              ) : (
                <div className="space-y-2">
                  {transactions.slice(0, 5).map((transaction, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <p className="text-sm font-medium">{transaction.type}</p>
                        <p className="text-xs text-gray-500">{transaction.symbol}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">Rp {transaction.total_amount?.toLocaleString('id-ID')}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(transaction.timestamp).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {transactions.length > 5 && (
              <p className="text-sm text-gray-500 mt-2">+{transactions.length - 5} transaksi lainnya</p>
            )}
          </div>
        </div>

        {/* Bottom Section - Portfolio, Real-time Stock Analysis, Top Gainers & Losers, IDX Heatmap, Traditional Analysis Tools */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Portfolio Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">💼 Portfolio</h2>
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">Portfolio management system</p>
              <Link
                to="/portfolio"
                className="inline-block bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
              >
                Lihat Portfolio
              </Link>
            </div>
          </div>

          {/* Real-time Stock Analysis */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">📈 Real-time Stock Analysis</h2>
            <StockWatchlist onSelectStock={handleStockSelect} />
          </div>

          {/* Top Gainers & Losers */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">🏆 Top Gainers & Losers</h2>
            <TopGainers onSelectStock={handleStockSelect} />
          </div>

          {/* IDX Heatmap */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">🔥 IDX Heatmap</h2>
            <IDXHeatmap />
          </div>

          {/* Traditional Analysis Tools */}
          <div className="bg-white rounded-lg shadow p-6 xl:col-span-2">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">📊 Traditional Analysis Tools</h2>
            <div className="mb-4">
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => setActiveTab('gainers')}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    activeTab === 'gainers'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  📈 Top Gainers
                </button>
                <button
                  onClick={() => setActiveTab('losers')}
                  className={`px-4 py-2 rounded text-sm font-medium ${
                    activeTab === 'losers'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  📉 Top Losers
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Candlestick Chart</h3>
                <div className="h-64">
                  <CandlestickChart symbol={selectedStock} market="idx" days={30} />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">Market Overview</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Selected Stock:</span>
                    <span className="font-medium">{selectedStock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Market:</span>
                    <span className="font-medium">IDX</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Analysis Type:</span>
                    <span className="font-medium">Technical</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Analysis Link */}
        <div className="mt-8 text-center">
          <Link
            to="/ai"
            className="inline-block bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors text-lg font-medium"
          >
            🤖 AI Analysis
          </Link>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Ganti Password</h3>
            <form onSubmit={handlePasswordChange}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Password Saat Ini</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Password Baru</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Konfirmasi Password Baru</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              {passwordError && (
                <div className="mb-4 text-red-500 text-sm">{passwordError}</div>
              )}
              {passwordSuccess && (
                <div className="mb-4 text-green-500 text-sm">{passwordSuccess}</div>
              )}
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {passwordLoading ? 'Mengubah...' : 'Ubah Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;