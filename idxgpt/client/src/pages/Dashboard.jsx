import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../utils/api";
import {
  safeArray,
  safeNumber,
  safeDate,
  safeLocaleString,
  safeDateString,
  safeLength,
  safeMap,
  safeGet
} from "../utils/safeData";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import CandlestickChart from "../components/CandlestickChart";
import SimpleCandlestickChart from "../components/SimpleCandlestickChart";
import IDXCandlestickDashboard from "../components/IDXCandlestickDashboard";
import IDXHeatmap from "../components/IDXHeatmap";
import StockWatchlist from "../components/StockWatchlist";
import TopGainers from "../components/TopGainers";
import socketService from "../utils/socket";
import MarketOverview from "../components/MarketOverview";
import PaymentInstructions from "../components/PaymentInstructions";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [me, setMe] = useState(null);
  const [tx, setTx] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [command, setCommand] = useState("fundamental");
  const [kode, setKode] = useState("");
  const [market, setMarket] = useState("idx");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedStock, setSelectedStock] = useState("BBCA");
  const [selectedMarket, setSelectedMarket] = useState("idx");
  const [showRealTimeChart, setShowRealTimeChart] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [affiliateData, setAffiliateData] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [affiliateLoading, setAffiliateLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planRequestLoading, setPlanRequestLoading] = useState(false);
  const [planRequestSuccess, setPlanRequestSuccess] = useState('');
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentStatusLoading, setPaymentStatusLoading] = useState(false);

  // Helper function - must be declared before useEffect that calls it
  const checkPaymentStatus = async () => {
    if (!me?.id) return;

    setPaymentStatusLoading(true);
    try {
      const response = await api.get('/payments/status');
      setPaymentStatus(response.data);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setPaymentStatus(null);
    } finally {
      setPaymentStatusLoading(false);
    }
  };

  // Helper function - handles payment upload callback
  const handlePaymentUploaded = () => {
    // Refresh payment status after successful upload
    checkPaymentStatus();
    setPlanRequestSuccess('Bukti transfer berhasil diupload! Menunggu verifikasi admin.');
  };

  useEffect(() => {
    setProfileLoading(true);
    setTxLoading(true);
    setPortfolioLoading(true);
    setAffiliateLoading(true);

    // Load user data
    api.get("/me").then((r) => setMe(r.data)).catch(() => setMe({})).finally(() => setProfileLoading(false));
    api.get("/me/transactions").then((r) => setTx(r.data)).catch(() => {}).finally(() => setTxLoading(false));
    api.get("/portfolio/holdings").then((r) => setPortfolio(r.data)).catch(() => {}).finally(() => setPortfolioLoading(false));

    // Load affiliate data
    api.get("/affiliate/dashboard").then((r) => setAffiliateData(r.data.data)).catch(() => {}).finally(() => setAffiliateLoading(false));
    api.get("/affiliate/commissions").then((r) => setCommissions(r.data.commissions || [])).catch(() => {}).finally(() => setAffiliateLoading(false));

    socketService.connect();
    return () => socketService.disconnect();
  }, []);

  // Check payment status when plan is selected
  useEffect(() => {
    if (selectedPlanId) {
      checkPaymentStatus();
    }
  }, [selectedPlanId]);

  // Check for planId from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const planIdFromUrl = urlParams.get('planId');
    if (planIdFromUrl) {
      setSelectedPlanId(planIdFromUrl);
    }
  }, [location.search]);

  if (!me || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const sub = me.subscription || {};


  // Helper function - executes stock analysis commands
  const runCommand = async () => {
    if (!kode) return alert(t('dashboard.alerts.enterStockCode', 'Please enter a stock code'));
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post("/run-command", { command, kode, market });
      setResult(res.data);
    } catch (err) {
      setResult({ error: err.response?.data?.error || err.message });
    }
    setLoading(false);
  };

  // Helper function - handles stock selection from watchlist
  const handleSelectStock = (symbol, market) => {
    setSelectedStock(symbol);
    setSelectedMarket(market);
    setKode(symbol);
  };

  // Helper function - toggles real-time chart visibility
  const toggleRealTimeView = () => {
    setShowRealTimeChart(!showRealTimeChart);
  };

  // Helper function - handles password change form submission
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError(t('dashboard.validation.passwordMismatch', 'Passwords do not match'));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t('dashboard.validation.passwordMinLength', 'Password must be at least 8 characters'));
      return;
    }
    setPasswordLoading(true);
    setPasswordError("");
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      alert(t('dashboard.alerts.passwordChanged', 'Password changed successfully'));
    } catch (err) {
      setPasswordError(err.response?.data?.error || t('dashboard.alerts.passwordChangeFailed', 'Failed to change password'));
    }
    setPasswordLoading(false);
  };

  // Helper function - handles plan request submission
  const handlePlanRequest = async () => {
    if (!selectedPlanId) {
      alert('Silakan pilih paket terlebih dahulu');
      return;
    }

    setPlanRequestLoading(true);
    setPlanRequestSuccess('');

    try {
      await api.post('/plans/request', {
        planId: selectedPlanId,
        userId: me.id
      });

      setPlanRequestSuccess('Permintaan paket berhasil dikirim! Tim kami akan segera menghubungi Anda.');
      setSelectedPlanId('');
    } catch (error) {
      alert('Gagal mengirim permintaan paket: ' + (error.response?.data?.error || error.message));
    }

    setPlanRequestLoading(false);
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('dashboard.title', 'Dashboard')}</h1>
          <p className="text-gray-600">{t('dashboard.welcome', 'Welcome')}, {me.username || me.email}!</p>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* AI Quota Card */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-200 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('dashboard.cards.aiQuota.title', 'AI Quota')}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {me.ai_quota !== undefined ? me.ai_quota : '0'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {me.role === 'admin' ? '∞' :
                   me.role === 'premium' ? '100' :
                   me.role === 'user' ? '10' : 'N/A'} {t('dashboard.cards.aiQuota.limit', 'queries per month')}
                </p>
              </div>
              <div className="text-blue-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
            {me.ai_quota !== undefined && me.ai_quota <= 2 && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
                <div className="flex items-center space-x-2">
                  <span className="text-orange-600">⚠️</span>
                  <span className="text-sm font-medium text-orange-800">
                    {t('dashboard.cards.aiQuota.lowQuota', 'AI quota is running low')}
                  </span>
                </div>
                <button
                  onClick={() => navigate('/plans')}
                  className="mt-2 px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 transition-colors"
                >
                  {t('dashboard.cards.aiQuota.upgradePlan', 'Upgrade Plan')}
                </button>
              </div>
            )}
          </div>

          {/* Total Referrals Card */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-200 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('dashboard.cards.referrals.title', 'Total Referrals')}</p>
                <p className="text-2xl font-bold text-green-600">
                  {affiliateData ? affiliateData.totalReferrals || 0 : '0'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {affiliateData ? `${affiliateData.l1Count || 0} L1, ${affiliateData.l2Count || 0} L2` : t('dashboard.cards.referrals.loading', 'Loading...')}
                </p>
              </div>
              <div className="text-green-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Recent Commissions Card */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-200 hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{t('dashboard.cards.commissions.title', 'Recent Commissions')}</p>
                <p className="text-2xl font-bold text-purple-600">
                  Rp {safeLocaleString(safeGet(commissions, '[0].total_earned'))}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {safeGet(commissions, '[0].month') ? safeDateString(commissions[0].month + '-01', { month: 'short', year: 'numeric' }) : t('dashboard.cards.commissions.noData', 'No commissions yet')}
                </p>
              </div>
              <div className="text-purple-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Request Paket Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">📦 Request Paket</h2>

          {selectedPlanId && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                🎯 Paket yang dipilih: <span className="font-semibold">{selectedPlanId}</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pilih Paket
              </label>
              <select
                className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
              >
                <option value="">-- Pilih Paket --</option>
                <option value="basic">Basic - Rp 50,000/bulan</option>
                <option value="advance">Advance - Rp 300,000/bulan</option>
                <option value="plan_1m">1 Bulan - Rp 50,000</option>
                <option value="plan_3m">3 Bulan - Rp 135,000 (Diskon 10%)</option>
                <option value="plan_6m">6 Bulan - Rp 240,000 (Diskon 20%)</option>
                <option value="plan_12m">12 Bulan - Rp 420,000 (Diskon 30%)</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handlePlanRequest}
                disabled={planRequestLoading || !selectedPlanId}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors duration-200 flex items-center justify-center"
              >
                {planRequestLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Mengirim...
                  </>
                ) : (
                  'Kirim Request'
                )}
              </button>
            </div>
          </div>

          {planRequestSuccess && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">{planRequestSuccess}</p>
            </div>
          )}

          {!selectedPlanId && (
            <div className="mt-4 text-center">
              <button
                onClick={() => navigate('/plans')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Lihat Paket Tersedia
              </button>
            </div>
          )}

          {/* Show Payment Instructions if plan is selected but no payment uploaded */}
          {selectedPlanId && (!paymentStatus || paymentStatus.status === 'PENDING') && (
            <div className="mt-6">
              <PaymentInstructions
                planId={selectedPlanId}
                userId={me.id}
                onPaymentUploaded={handlePaymentUploaded}
              />
            </div>
          )}

          {/* Show Payment Status if payment is uploaded */}
          {paymentStatus && paymentStatus.status && paymentStatus.status !== 'PENDING' && (
            <div className="mt-6 bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
              <h3 className="text-xl font-semibold mb-4 text-green-800">✅ Status Pembayaran</h3>
              <div className="space-y-2">
                <p className="text-gray-700">
                  <span className="font-medium">Paket:</span> {paymentStatus.planId}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Status:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-sm font-medium ${
                    paymentStatus.status === 'APPROVED'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {paymentStatus.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                  </span>
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Tanggal Upload:</span>{' '}
                  {safeDateString(safeGet(paymentStatus, 'createdAt'))}
                </p>
                {paymentStatus.notes && (
                  <p className="text-gray-700">
                    <span className="font-medium">Catatan:</span> {paymentStatus.notes}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">{t('dashboard.sections.quickActions', 'Quick Actions')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/ai')}
                className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 hover:scale-105"
              >
                <span className="mr-2">🤖</span>
                {t('dashboard.buttons.aiAnalysis', 'AI Analysis')}
              </button>
              <button
                onClick={() => navigate('/network')}
                className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 hover:scale-105"
              >
                <span className="mr-2">👥</span>
                {t('dashboard.buttons.myNetwork', 'My Network')}
              </button>
              {me.role === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 hover:scale-105"
                >
                  <span className="mr-2">⚙️</span>
                  {t('dashboard.buttons.adminPanel', 'Admin Panel')}
                </button>
              )}
              <button
                onClick={() => navigate('/virtual-trading/portfolio')}
                className="flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 hover:scale-105"
              >
                <span className="mr-2">💼</span>
                {t('dashboard.buttons.portfolio', 'Portfolio')}
              </button>
            </div>
          </div>

          {/* Recent Commissions Table */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">{t('dashboard.sections.recentCommissions', 'Recent Commissions')}</h3>
            {affiliateLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : commissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>{t('dashboard.tables.commissions.noData', 'No commission data available')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-600">{t('dashboard.tables.commissions.month', 'Month')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">{t('dashboard.tables.commissions.amount', 'Amount')}</th>
                      <th className="text-left py-2 px-2 font-medium text-gray-600">{t('dashboard.tables.commissions.count', 'Count')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.slice(0, 5).map((commission, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2">
                          {safeGet(commission, 'month') ? safeDateString(commission.month + '-01', { month: 'short', year: 'numeric' }) : 'N/A'}
                        </td>
                        <td className="py-2 px-2 font-medium text-green-600">
                          Rp {safeLocaleString(safeGet(commission, 'total_earned'))}
                        </td>
                        <td className="py-2 px-2 text-gray-600">
                          {commission.commission_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{t('dashboard.sections.portfolioSummary', 'Portfolio Summary')}</h2>
            <button
              onClick={() => navigate('/portfolio')}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-200 text-sm"
            >
              {t('dashboard.buttons.viewFullPortfolio', 'View Full Portfolio')}
            </button>
          </div>
          {portfolioLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : portfolio ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">Rp {safeLocaleString(safeGet(portfolio, 'balance'))}</div>
                <div className="text-sm text-gray-600">{t('dashboard.portfolio.cash', 'Cash Balance')}</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">Rp {safeLocaleString(safeGet(portfolio, 'totalHoldingsValue'))}</div>
                <div className="text-sm text-gray-600">{t('dashboard.portfolio.holdings', 'Holdings Value')}</div>
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-lg">
                <div className="text-2xl font-bold text-indigo-600">Rp {safeLocaleString(safeGet(portfolio, 'portfolioValue'))}</div>
                <div className="text-sm text-gray-600">{t('dashboard.portfolio.totalValue', 'Total Portfolio Value')}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">{t('dashboard.portfolio.notAvailable', 'Portfolio data not available')}</div>
          )}
        </div>

        {/* Real-time Stock Analysis */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{t('dashboard.sections.realTimeAnalysis', 'Real-time Stock Analysis')}</h2>
            <button
              onClick={toggleRealTimeView}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                showRealTimeChart ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {showRealTimeChart ? t('dashboard.buttons.hideChart', 'Hide Chart') : t('dashboard.buttons.showChart', 'Show Chart')}
            </button>
          </div>
          <div className={`grid gap-6 ${showRealTimeChart ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
            <div className="lg:col-span-1">
              <StockWatchlist onSelectStock={handleSelectStock} />
            </div>
            {showRealTimeChart && (
              <div className="lg:col-span-2">
                <CandlestickChart symbol={selectedStock} market={selectedMarket} data={null} />
                <SimpleCandlestickChart symbol={selectedStock} market={selectedMarket} data={null} />
              </div>
            )}
          </div>
        </div>

        {/* Top Gainers & Losers */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('dashboard.sections.topGainersLosers', 'Top Gainers & Losers')}</h2>
          <TopGainers onSelectStock={handleSelectStock} />
        </div>

        {/* Market Overview - Index & Broker Data */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('dashboard.sections.marketOverview', 'Market Overview')}</h2>
          <MarketOverview />
        </div>

        {/* Traditional Analysis Tools */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">{t('dashboard.sections.traditionalAnalysis', 'Traditional Analysis Tools')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
            <select
              className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            >
              <option value="fundamental">/fundamental</option>
              <option value="analisa">/analisa</option>
              <option value="teknikal">/teknikal</option>
              <option value="berita">/berita</option>
            </select>
            <input
              type="text"
              placeholder={t('dashboard.placeholders.stockCode', 'Stock Code')}
              className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={kode}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
            />
            <select
              className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
            >
              <option value="idx">IDX</option>
              <option value="us">US</option>
            </select>
            <button
              onClick={runCommand}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors duration-200"
            >
              {loading ? t('dashboard.buttons.loading', 'Loading...') : t('dashboard.buttons.runAnalysis', 'Run Analysis')}
            </button>
          </div>

          {result?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mt-4">
              {result.error}
            </div>
          )}

          {command === "fundamental" && result?.data && (
            <div className="overflow-x-auto mt-4">
              <table className="min-w-full text-sm bg-white border border-gray-200 rounded-lg">
                <thead className="bg-indigo-600 text-white">
                  <tr>
                    {safeMap(Object.keys(result.data), (h, i) => (
                      <th key={i} className="px-4 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200">
                    {safeMap(Object.values(result.data), (v, i) => (
                      <td key={i} className="px-4 py-3">{v}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {command === "analisa" && result?.summary && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm mt-4 border border-gray-200">
              <pre className="whitespace-pre-wrap text-left">{result.summary}</pre>
            </div>
          )}

          {command === "teknikal" && result?.labels && result?.prices && (
            <div className="mt-6">
              <div className="font-semibold mb-2">{result.output}</div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={safeMap(result.labels, (d, i) => ({ date: d, price: safeGet(result.prices, `[${i}]`) }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="price" stroke="#4f46e5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {command === "berita" && result?.items && (
            <div className="mt-4 space-y-3">
              {safeMap(result.items, (b, i) => (
                <div key={i} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="font-medium text-gray-900">{b.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{b.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}