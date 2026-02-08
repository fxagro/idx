import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import io from 'socket.io-client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale,
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import api from '../utils/api';
import TopGainers from './TopGainers';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale
);

const DashboardPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [realTimePrices, setRealTimePrices] = useState({});
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [portfolioPeriod, setPortfolioPeriod] = useState('1W');

  // Profile editing state
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({ email: '', username: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState('');

  // Subscription ordering state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);

  // Educational tips for the carousel
  const educationalTips = [
    {
      title: t('dashboard.tips.diversify', 'Diversifikasi Portofolio'),
      content: t('dashboard.tips.diversifyDesc', 'Sebarkan investasi Anda ke berbagai sektor untuk mengurangi risiko kerugian.')
    },
    {
      title: t('dashboard.tips.research', 'Lakukan Riset'),
      content: t('dashboard.tips.researchDesc', 'Selalu lakukan analisis fundamental dan teknikal sebelum berinvestasi.')
    },
    {
      title: t('dashboard.tips.patience', 'Bersabar'),
      content: t('dashboard.tips.patienceDesc', 'Investasi jangka panjang biasanya memberikan hasil yang lebih baik daripada trading harian.')
    },
    {
      title: t('dashboard.tips.stopLoss', 'Gunakan Stop Loss'),
      content: t('dashboard.tips.stopLossDesc', 'Tetapkan batas kerugian untuk melindungi modal Anda dari kerugian besar.')
    },
    {
      title: t('dashboard.tips.emotions', 'Kontrol Emosi'),
      content: t('dashboard.tips.emotionsDesc', 'Jangan biarkan emosi mempengaruhi keputusan investasi Anda.')
    }
  ];

  // Fetch dashboard summary data
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard
  } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: async () => {
      const response = await api.get('/dashboard/summary');
      return response.data.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
    meta: {
      onError: (error) => {
        console.error('[DashboardPage] Error fetching dashboard summary:', error);
      }
    }
  });

  // Fetch market overview data
  const {
    data: marketOverviewData,
    isLoading: marketOverviewLoading,
    error: marketOverviewError
  } = useQuery({
    queryKey: ['marketOverview'],
    queryFn: async () => {
      const response = await api.get('/stocks/market-overview');
      return response.data.data;
    },
    refetchInterval: 60000, // Refetch every minute
    retry: 3,
    meta: {
      onError: (error) => {
        console.error('[DashboardPage] Error fetching market overview:', error);
      }
    }
  });

  // Fetch stock transaction history
  const {
    data: transactionHistory,
    isLoading: transactionHistoryLoading
  } = useQuery({
    queryKey: ['transactionHistory'],
    queryFn: async () => {
      const response = await api.get('/stocks/virtual/history?limit=5');
      return response.data.transactions || [];
    },
    refetchInterval: 30000,
    retry: 3
  });

  // Fetch subscription plans
  const {
    data: subscriptionPlans,
    isLoading: plansLoading
  } = useQuery({
    queryKey: ['subscriptionPlans'],
    queryFn: async () => {
      const response = await api.get('/plans');
      return response.data.plans || [];
    },
    retry: 3
  });

  // Handle subscription order
  const handleSubscriptionOrder = useCallback(async (planId) => {
    try {
      setOrderLoading(true);
      const selectedPlan = subscriptionPlans?.find(plan => plan.id === planId);
      if (!selectedPlan) {
        throw new Error('Plan not found');
      }

      const response = await api.post('/plans/order', {
        planId: planId,
        amount: selectedPlan.price
      });

      if (response.data.success) {
        setShowSubscriptionModal(true);
        setSelectedPlan(selectedPlan);
        // Refetch dashboard data to update any changes
        refetchDashboard();

        // Show success toast notification
        if (typeof window !== 'undefined' && window.showToast) {
          window.showToast(t('dashboard.order.success', 'Pesanan berhasil dibuat!'), 'success');
        }
      }
    } catch (error) {
      console.error('[DashboardPage] Error creating subscription order:', error);

      // Enhanced error handling
      let errorMessage = t('dashboard.error.subscriptionOrder', 'Failed to create subscription order');
      if (error.response?.status === 401) {
        errorMessage = t('dashboard.error.unauthorized', 'Please log in to create subscription order');
        // Redirect to login page
        navigate('/login');
        return;
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || errorMessage;
      }

      // Show error toast notification
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast(errorMessage, 'error');
      } else {
        alert(errorMessage);
      }
    } finally {
      setOrderLoading(false);
    }
  }, [subscriptionPlans, refetchDashboard, t, navigate]);

  // Initialize WebSocket connection for real-time price updates
  useEffect(() => {
    console.log('[DashboardPage] Initializing WebSocket connection');

    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('price_update', (data) => {
      console.log('[DashboardPage] Received price update:', data);
      setRealTimePrices(prev => ({
        ...prev,
        [data.symbol]: {
          price: data.price,
          change: data.change,
          changePercent: data.changePercent
        }
      }));
    });

    newSocket.on('connect', () => {
      console.log('[DashboardPage] WebSocket connected');
    });

    newSocket.on('disconnect', () => {
      console.log('[DashboardPage] WebSocket disconnected');
    });

    return () => {
      console.log('[DashboardPage] Cleaning up WebSocket connection');
      newSocket.close();
    };
  }, []);

  // Auto-rotate educational tips
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % educationalTips.length);
    }, 5000);

    return () => clearInterval(tipInterval);
  }, [educationalTips.length]);

  // Get real-time price for a symbol
  const getRealTimePrice = useCallback((symbol) => {
    return realTimePrices[symbol] || null;
  }, [realTimePrices]);

  // Handle remove from watchlist
  const handleRemoveFromWatchlist = useCallback(async (symbol) => {
    try {
      await api.delete(`/stocks/watchlist/${symbol}`);
      // Refetch dashboard data to update watchlist
      refetchDashboard();
    } catch (error) {
      console.error('[DashboardPage] Error removing from watchlist:', error);
    }
  }, [refetchDashboard]);

  // Password strength calculation
  const calculatePasswordStrength = useCallback((password) => {
    if (!password) return '';

    let strength = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    strength = Object.values(checks).filter(Boolean).length;

    if (strength <= 2) return 'weak';
    if (strength <= 3) return 'medium';
    return 'strong';
  }, []);

  // Handle password input change
  const handlePasswordChange = useCallback((field, value) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
    if (field === 'newPassword') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  }, [calculatePasswordStrength]);

  // Handle profile form submit
  const handleProfileSubmit = useCallback(async (e) => {
    e.preventDefault();
    setProfileLoading(true);

    try {
      await api.post('/auth/update-profile', profileForm);
      setShowProfileEdit(false);
      // Refresh user data
      window.location.reload();
    } catch (error) {
      console.error('[DashboardPage] Error updating profile:', error);
      alert(t('dashboard.error.updateProfile', 'Failed to update profile'));
    } finally {
      setProfileLoading(false);
    }
  }, [profileForm, t]);

  // Handle password change submit
  const handlePasswordSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert(t('dashboard.error.passwordMismatch', 'New passwords do not match'));
      return;
    }

    if (passwordStrength === 'weak') {
      alert(t('dashboard.error.weakPassword', 'Please choose a stronger password'));
      return;
    }

    setPasswordLoading(true);

    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      setShowPasswordChange(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordStrength('');
      alert(t('dashboard.success.passwordChanged', 'Password changed successfully'));
    } catch (error) {
      console.error('[DashboardPage] Error changing password:', error);
      alert(t('dashboard.error.changePassword', 'Failed to change password'));
    } finally {
      setPasswordLoading(false);
    }
  }, [passwordForm, passwordStrength, t]);

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (percent) => {
    if (percent === null || percent === undefined || isNaN(percent)) {
      return {
        value: '0.00%',
        className: 'text-gray-600'
      };
    }
    const value = parseFloat(percent);
    return {
      value: `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`,
      className: value >= 0 ? 'text-green-600' : 'text-red-600'
    };
  };

  // Prepare IHSG chart data
  const ihsgChartData = dashboardData?.market_data?.ihsg_chart ? {
    labels: dashboardData.market_data.ihsg_chart.map(point => point.date),
    datasets: [
      {
        label: 'IHSG',
        data: dashboardData.market_data.ihsg_chart.map(point => point.price),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
        fill: true
      }
    ]
  } : null;

  // Prepare portfolio allocation chart data
  const portfolioChartData = dashboardData?.portfolio_allocation?.by_sector ? {
    labels: dashboardData.portfolio_allocation.by_sector.map(sector => sector.sector),
    datasets: [
      {
        data: dashboardData.portfolio_allocation.by_sector.map(sector => sector.value),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
          '#FF6384',
          '#C9CBCF'
        ],
        borderWidth: 2
      }
    ]
  } : null;

  // Generate portfolio performance data (simulated historical data)
  const generatePortfolioPerformanceData = (period) => {
    if (!dashboardData?.portfolio?.summary?.total_value) return null;

    const currentValue = dashboardData.portfolio.summary.total_value;
    const days = period === '1W' ? 7 : period === '1M' ? 30 : 7;
    const dataPoints = [];
    const now = new Date();

    // Generate historical data points with some realistic variation
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Create realistic portfolio value progression
      const progressRatio = i / (days - 1);
      const baseVariation = (Math.random() - 0.5) * 0.05; // ±2.5% random variation
      const trendVariation = progressRatio * (Math.random() - 0.3) * 0.1; // Slight upward/downward trend
      const totalVariation = baseVariation + trendVariation;

      const value = currentValue * (1 - progressRatio + totalVariation);

      dataPoints.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value * 100) / 100
      });
    }

    return dataPoints;
  };

  // Prepare portfolio performance chart data
  const portfolioPerformanceData = generatePortfolioPerformanceData(portfolioPeriod);
  const portfolioPerformanceChartData = portfolioPerformanceData ? {
    labels: portfolioPerformanceData.map(point => point.date),
    datasets: [
      {
        label: t('dashboard.portfolio.performance', 'Portfolio Value'),
        data: portfolioPerformanceData.map(point => point.value),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.1,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 6
      }
    ]
  } : null;

  if (dashboardLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t('dashboard.error.title', 'Failed to Load Dashboard')}
          </h2>
          <p className="text-gray-600 mb-4">
            {t('dashboard.error.description', 'Unable to fetch dashboard data. Please try again.')}
          </p>
          <button
            onClick={() => refetchDashboard()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {t('common.refresh', 'Refresh')}
          </button>
        </div>
      </div>
    );
  }

  const portfolio = dashboardData?.portfolio;
  const watchlist = dashboardData?.watchlist || [];
  const transactions = dashboardData?.transactions || [];
  const marketData = dashboardData?.market_data || {};
  const aiQuota = dashboardData?.ai_quota || { remaining: 0, used: 0 };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t('dashboard.title', 'Dashboard')}
              </h1>
              <p className="text-gray-600 mt-2">
                {t('dashboard.subtitle', 'Personalized overview of your investment portfolio and market insights')}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowProfileEdit(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                👤 {t('dashboard.profile.edit', 'Edit Profile')}
              </button>
              <button
                onClick={() => setShowPasswordChange(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                🔒 {t('dashboard.profile.changePassword', 'Change Password')}
              </button>
            </div>
          </div>
        </div>

        {/* Two Column Layout - Organized sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Profile Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  👤 {t('dashboard.profile.title', 'Profile')}
                </h2>
                <button
                  onClick={() => setShowProfileEdit(true)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {t('dashboard.profile.edit', 'Edit')}
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('dashboard.profile.email', 'Email')}:</span>
                  <span className="font-medium">{dashboardData?.user?.email || t('dashboard.profile.emailValue', 'user@example.com')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('dashboard.profile.username', 'Username')}:</span>
                  <span className="font-medium">{dashboardData?.user?.username || t('dashboard.profile.usernameValue', 'username')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('dashboard.profile.userId', 'User ID')}:</span>
                  <span className="font-medium">{dashboardData?.user?.id || t('dashboard.profile.userIdValue', '12345')}</span>
                </div>
              </div>
            </div>

            {/* Subscription Status & Ordering */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  💳 {t('dashboard.subscription.title', 'Subscription Status')}
                </h2>
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="text-green-600 hover:text-green-800 text-sm font-medium"
                >
                  {t('dashboard.profile.changePassword', 'Change Password')}
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('dashboard.subscription.status', 'Status')}:</span>
                  <span className="font-medium text-green-600">{dashboardData?.subscription?.status || t('dashboard.subscription.active', 'Active')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('dashboard.subscription.plan', 'Plan')}:</span>
                  <span className="font-medium">{dashboardData?.subscription?.plan_name || t('dashboard.subscription.premium', 'Premium')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('dashboard.subscription.aiQuota', 'AI Quota')}:</span>
                  <span className="font-medium">{dashboardData?.ai_quota?.remaining || t('dashboard.subscription.quotaValue', '5 remaining')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('dashboard.subscription.expiry', 'Expiry')}:</span>
                  <span className="font-medium">{dashboardData?.subscription?.expiry_date || t('dashboard.subscription.expiryValue', '2025-12-31')}</span>
                </div>
              </div>

              {/* Subscription Ordering Section */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-800 mb-3">
                  📦 {t('dashboard.subscription.order', 'Pemesanan Kuota')}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {t('dashboard.subscription.orderDesc', 'Pilih paket langganan untuk meningkatkan kuota AI Anda.')}
                </p>

                {subscriptionPlans && subscriptionPlans.length > 0 ? (
                  <div className="space-y-2">
                    {subscriptionPlans.map((plan) => (
                      <div key={plan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <span className="font-medium text-gray-800">{plan.name || 'Unnamed Plan'}</span>
                          <p className="text-sm text-gray-600">
                            {plan.benefits?.join(', ') || `Kuota AI ${plan.quota || 0}x/bulan`}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-gray-800">
                            Rp {plan.price != null ? plan.price.toLocaleString('id-ID') : '0'}
                          </span>
                          <br />
                          <button
                            onClick={() => handleSubscriptionOrder(plan.id)}
                            disabled={orderLoading}
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {orderLoading ? t('common.loading', 'Loading...') : t('dashboard.subscription.orderBtn', 'Pesan')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    {plansLoading ? t('common.loading', 'Loading...') : t('dashboard.error.noPlans', 'No plans available')}
                  </div>
                )}
              </div>
            </div>

            {/* Portfolio Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  💼 {t('dashboard.portfolio.title', 'Portfolio Snapshot')}
                </h2>
                <Link
                  to="/virtual-trading"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {t('dashboard.portfolio.viewAll', 'View Portfolio')}
                </Link>
              </div>

              {portfolio?.summary ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">{t('dashboard.portfolio.totalValue', 'Total Value')}</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(portfolio.summary.total_value)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('dashboard.portfolio.dailyChange', 'Daily Change')}</p>
                      <p className={`text-2xl font-bold ${portfolio.summary.total_gain_loss_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(portfolio.summary.total_gain_loss_percent).value}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">{t('dashboard.portfolio.totalInvestment', 'Total Investment')}</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(portfolio.summary.total_investment)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('dashboard.portfolio.gainLoss', 'Gain/Loss')}</p>
                      <p className={`text-lg font-semibold ${portfolio.summary.total_gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(portfolio.summary.total_gain_loss)}
                      </p>
                    </div>
                  </div>

                  {/* Top 3 Performers */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      {t('dashboard.portfolio.topPerformers', 'Top 3 Performers')}
                    </p>
                    <div className="space-y-2">
                      {portfolio.summary.top_performers?.map((stock, index) => (
                        <div key={stock.symbol} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              #{index + 1}
                            </span>
                            <span className="font-medium">{stock.symbol}</span>
                            <span className="text-sm text-gray-600">{stock.company_name}</span>
                          </div>
                          <span className={`text-sm font-medium ${stock.gain_loss_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercentage(stock.gain_loss_percent).value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">
                    {t('dashboard.portfolio.noData', 'No portfolio data available')}
                  </p>
                  <Link
                    to="/virtual-trading"
                    className="inline-block bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                  >
                    {t('dashboard.portfolio.startTrading', 'Start Virtual Trading')}
                  </Link>
                </div>
              )}
            </div>

            {/* Subscription Transactions */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  💳 {t('dashboard.subscription.transactions', 'Subscription Transactions')}
                </h2>
                <Link
                  to="/me/transactions"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {t('dashboard.transactions.viewAll', 'View All')}
                </Link>
              </div>

              <div className="space-y-3">
                {transactions && transactions.length > 0 ? (
                  transactions.slice(0, 3).map((transaction, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{transaction.plan_id}</span>
                          <span className={`text-xs px-2 py-1 rounded ${transaction.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {transaction.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{formatCurrency(transaction.amount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">
                          {new Date(transaction.created_at).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    {t('dashboard.transactions.noData', 'No subscription transactions yet')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Portfolio Performance Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  📈 {t('dashboard.portfolio.performance', 'Portfolio Performance')}
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPortfolioPeriod('1W')}
                    className={`px-3 py-1 text-sm rounded ${
                      portfolioPeriod === '1W'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {t('dashboard.portfolio.1w', '1W')}
                  </button>
                  <button
                    onClick={() => setPortfolioPeriod('1M')}
                    className={`px-3 py-1 text-sm rounded ${
                      portfolioPeriod === '1M'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {t('dashboard.portfolio.1m', '1M')}
                  </button>
                </div>
              </div>

              {portfolioPerformanceChartData && portfolioPerformanceChartData.datasets[0].data.length > 0 ? (
                <div className="h-64">
                  <Line
                    data={portfolioPerformanceChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false
                        },
                        tooltip: {
                          callbacks: {
                            label: (context) => {
                              return `${t('dashboard.portfolio.value', 'Value')}: ${formatCurrency(context.parsed.y)}`;
                            }
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: false,
                          ticks: {
                            callback: (value) => formatCurrency(value)
                          }
                        },
                        x: {
                          type: 'time',
                          time: {
                            unit: portfolioPeriod === '1W' ? 'day' : 'week',
                            displayFormats: {
                              day: 'MMM dd',
                              week: 'MMM dd'
                            }
                          }
                        }
                      },
                      elements: {
                        point: {
                          radius: 2
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  {t('dashboard.portfolio.noPerformance', 'No performance data available')}
                </div>
              )}
            </div>

            {/* Stock Transaction History */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  📋 {t('dashboard.transactions.title', 'Stock Transaction History')}
                </h2>
                <Link
                  to="/virtual-trading"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {t('dashboard.transactions.viewAll', 'View All')}
                </Link>
              </div>

              {transactionHistory && transactionHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('dashboard.transactions.date', 'Date')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('dashboard.transactions.symbol', 'Symbol')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('dashboard.transactions.type', 'Type')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('dashboard.transactions.quantity', 'Quantity')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('dashboard.transactions.price', 'Price')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('dashboard.transactions.total', 'Total')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactionHistory.map((transaction, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {transaction.date || transaction.transaction_date
                              ? new Date(transaction.date || transaction.transaction_date).toLocaleDateString('id-ID')
                              : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {transaction.symbol || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              transaction.type === 'BUY'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.type || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                            {transaction.quantity != null ? transaction.quantity.toLocaleString('id-ID') : '0'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(transaction.price)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            {formatCurrency(transaction.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">
                    {t('dashboard.transactions.noData', 'No transactions yet')}
                  </p>
                  <Link
                    to="/virtual-trading"
                    className="inline-block bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                  >
                    {t('dashboard.transactions.startTrading', 'Start Trading')}
                  </Link>
                </div>
              )}
            </div>

            {/* Watchlist */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  ⭐ {t('dashboard.watchlist.title', 'Watchlist')}
                </h2>
                <span className="text-sm text-gray-600">
                  {watchlist.length} {t('dashboard.watchlist.stocks', 'stocks')}
                </span>
              </div>

              {watchlist.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {watchlist.map((stock) => {
                    const realTimePrice = getRealTimePrice(stock.symbol);
                    const currentPrice = realTimePrice?.price || stock.current_price;
                    const changePercent = realTimePrice?.changePercent ?? stock.change_percent;

                    return (
                      <div key={stock.symbol} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{stock.symbol}</span>
                            <span className="text-sm text-gray-600">{stock.company_name}</span>
                          </div>
                          <p className="text-sm text-gray-600">{formatCurrency(currentPrice)}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatPercentage(changePercent).value}
                          </span>
                          <div className="flex space-x-1">
                            <Link
                              to={`/virtual-trading?symbol=${stock.symbol}`}
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                            >
                              {t('dashboard.watchlist.trade', 'Trade')}
                            </Link>
                            <button
                              onClick={() => handleRemoveFromWatchlist(stock.symbol)}
                              className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                            >
                              {t('dashboard.watchlist.remove', 'Remove')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">
                    {t('dashboard.watchlist.empty', 'Your watchlist is empty')}
                  </p>
                  <Link
                    to="/stocks"
                    className="inline-block bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                  >
                    {t('dashboard.watchlist.addStocks', 'Add Stocks')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Full Width Sections */}
        <div className="space-y-6">
          {/* Market Overview & Top Brokers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Market Overview Widget */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  🌍 {t('dashboard.market.overview', 'Market Overview')}
                </h2>
                <div className="text-sm text-gray-600">
                  {t('dashboard.market.lastUpdated', 'Last updated')}: {new Date().toLocaleTimeString('id-ID')}
                </div>
              </div>

              {/* Market Indices */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-700 mb-3">
                  📊 {t('dashboard.market.indices', 'Major Indices')}
                </h3>
                <div className="space-y-3">
                  {marketOverviewData?.indices?.map((index) => (
                    <div key={index.name} className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                      <div className="flex-1">
                        <span className="font-bold text-gray-800">{index.name}</span>
                        <p className="text-sm text-gray-600">{formatCurrency(index.value)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`font-bold ${index.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercentage(index.changePercent).value}
                        </span>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center py-4 text-gray-500">
                      {t('dashboard.error.noData', 'No market data available')}
                    </div>
                  )}
                </div>
              </div>

              {/* IHSG Chart */}
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-3">
                  📈 {t('dashboard.market.ihsgChart', 'IHSG Performance (30 Days)')}
                </h3>
                {marketOverviewLoading ? (
                  <div className="h-48 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : marketOverviewData?.ihsgChart && marketOverviewData.ihsgChart.length > 0 ? (
                  <div className="h-48">
                    <Line
                      data={{
                        labels: marketOverviewData.ihsgChart.map(point => new Date(point.date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })),
                        datasets: [
                          {
                            label: 'IHSG',
                            data: marketOverviewData.ihsgChart.map(point => point.value),
                            borderColor: 'rgb(59, 130, 246)',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            tension: 0.1,
                            fill: true
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false
                          },
                          tooltip: {
                            callbacks: {
                              label: (context) => {
                                return `IHSG: ${formatCurrency(context.parsed.y)}`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: false,
                            ticks: {
                              callback: (value) => formatCurrency(value)
                            }
                          },
                          x: {
                            display: true,
                            ticks: {
                              maxRotation: 45,
                              minRotation: 45
                            }
                          }
                        },
                        elements: {
                          point: {
                            radius: 0,
                            hoverRadius: 4
                          }
                        },
                        interaction: {
                          intersect: false,
                          mode: 'index'
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-500 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📊</div>
                      <p>{t('dashboard.market.noChartData', 'No chart data available')}</p>
                      <p className="text-sm text-gray-400 mt-1">Chart will appear when IHSG data is available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Top Brokers */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  🏢 {t('dashboard.market.topBrokers', 'Top Brokers')}
                </h2>
              </div>

              <div className="space-y-3">
                {marketOverviewData?.brokers?.map((broker, index) => (
                  <div key={broker.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                        #{index + 1}
                      </span>
                      <div>
                        <span className="font-medium text-gray-800">{broker.name}</span>
                        <p className="text-sm text-gray-600">
                          Share: {broker.marketShare ? `${broker.marketShare}%` : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-800">
                        {broker.volume ? new Intl.NumberFormat('id-ID').format(broker.volume) : 'N/A'}
                      </span>
                      <p className="text-sm text-gray-600">Volume</p>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-4 text-gray-500">
                    {t('dashboard.error.noData', 'No broker data available')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Gainers/Losers */}
          <div className="bg-white rounded-lg shadow p-6">
            <TopGainers onSelectStock={() => {}} />
          </div>

          {/* AI Recommendations */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                🤖 {t('dashboard.ai.title', 'AI Recommendations')}
              </h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {t('dashboard.ai.quota', 'Quota')}:
                </span>
                <span className={`text-sm font-medium ${aiQuota.remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {aiQuota.remaining} {t('dashboard.ai.remaining', 'remaining')}
                </span>
              </div>
            </div>

            {aiQuota.remaining > 0 ? (
              <div className="space-y-4">
                {/* Real-time Market Analysis */}
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-700 mb-3">
                    📊 {t('dashboard.ai.realtimeAnalysis', 'Real-time Market Analysis')}
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-green-800">
                          {t('dashboard.ai.bullishSignal', 'Bullish Signal Detected')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {t('dashboard.ai.bullishDesc', 'Market showing strong upward momentum with increasing volume across blue-chip stocks.')}
                      </p>
                    </div>
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium text-blue-800">
                          {t('dashboard.ai.volumeAlert', 'Volume Alert')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {t('dashboard.ai.volumeDesc', 'Above-average trading volume detected in banking sector. Monitor for continuation patterns.')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stock Recommendations */}
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-3">
                    💡 {t('dashboard.ai.stockRecommendations', 'Stock Recommendations')}
                  </h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">BBCA</span>
                        <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                          {t('dashboard.ai.strongBuy', 'Strong Buy')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {t('dashboard.ai.bbcaAnalysis', 'Strong bullish trend with RSI at 65. Good entry point around current levels with support at 9,200.')}
                      </p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">TLKM</span>
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {t('dashboard.ai.hold', 'Hold')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {t('dashboard.ai.tlkmAnalysis', 'Stable performance with good dividend yield. Monitor for breakout above resistance at 3,900.')}
                      </p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">ASII</span>
                        <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          {t('dashboard.ai.watch', 'Watch')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        {t('dashboard.ai.asiiAnalysis', 'Approaching support level at 5,000. Consider buying on dip if volume increases significantly.')}
                      </p>
                    </div>
                  </div>
                </div>

                <Link
                  to="/ai"
                  className="inline-block w-full text-center bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700"
                >
                  {t('dashboard.ai.getAnalysis', 'Get Full AI Analysis')}
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-yellow-600 text-4xl mb-4">⚠️</div>
                <p className="text-gray-600 mb-4">
                  {t('dashboard.ai.quotaExceeded', 'AI quota has been used up')}
                </p>
                <Link
                  to="/plans"
                  className="inline-block bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700"
                >
                  {t('dashboard.ai.upgrade', 'Upgrade Plan')}
                </Link>
              </div>
            )}
          </div>

          {/* Educational Tips Carousel */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              🎓 {t('dashboard.tips.title', 'Educational Tips')}
            </h2>

            <div className="relative h-32 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  {educationalTips[currentTipIndex].title}
                </h3>
                <p className="text-gray-700">
                  {educationalTips[currentTipIndex].content}
                </p>
              </div>

              {/* Carousel indicators */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                {educationalTips.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTipIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentTipIndex ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Edit Modal */}
      {showProfileEdit && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {t('dashboard.profile.edit', 'Edit Profile')}
              </h3>
              <button
                onClick={() => setShowProfileEdit(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProfileSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('dashboard.profile.email', 'Email')}
                </label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('dashboard.profile.username', 'Username')}
                </label>
                <input
                  type="text"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowProfileEdit(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {profileLoading ? t('common.loading', 'Loading...') : t('dashboard.profile.save', 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordChange && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {t('dashboard.profile.changePassword', 'Change Password')}
              </h3>
              <button
                onClick={() => setShowPasswordChange(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('dashboard.profile.currentPassword', 'Current Password')}
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('dashboard.profile.newPassword', 'New Password')}
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {passwordForm.newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${passwordStrength === 'weak' ? 'bg-red-500' : passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                      <span className={`text-xs ${passwordStrength === 'weak' ? 'text-red-600' : passwordStrength === 'medium' ? 'text-yellow-600' : 'text-green-600'}`}>
                        {t(`dashboard.passwordStrength.${passwordStrength}`, passwordStrength)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('dashboard.profile.confirmPassword', 'Confirm New Password')}
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {passwordLoading ? t('common.loading', 'Loading...') : t('dashboard.profile.updatePassword', 'Update Password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enhanced Subscription Modal */}
      {showSubscriptionModal && selectedPlan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                💳 {t('dashboard.subscription.orderSuccess', 'Order Successful')}
              </h3>
              <button
                onClick={() => setShowSubscriptionModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Order Summary */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                  <span className="mr-2">✅</span>
                  {t('dashboard.subscription.orderConfirmed', 'Order Confirmed')}
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('dashboard.subscription.plan', 'Plan')}:</span>
                    <span className="font-medium text-gray-800">{selectedPlan.name || 'Unnamed Plan'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('dashboard.subscription.amount', 'Amount')}:</span>
                    <span className="font-medium text-gray-800">Rp {selectedPlan.price != null ? selectedPlan.price.toLocaleString('id-ID') : '0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('dashboard.subscription.quota', 'AI Quota')}:</span>
                    <span className="font-medium text-gray-800">{selectedPlan.quota || 0}x</span>
                  </div>
                </div>
              </div>

              {/* Payment Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                  <span className="mr-2">🏦</span>
                  {t('dashboard.subscription.paymentInstructions', 'Payment Instructions')}
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="bg-white rounded border p-3">
                    <div className="font-medium text-gray-800 mb-2">
                      {t('dashboard.subscription.transferTo', 'Transfer to')}:
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t('dashboard.subscription.bank', 'Bank')}:</span>
                        <span className="font-medium">BCA</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t('dashboard.subscription.accountNumber', 'Account Number')}:</span>
                        <span className="font-mono font-medium">00132000048716</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t('dashboard.subscription.accountHolder', 'Account Holder')}:</span>
                        <span className="font-medium">Agus Rochman</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <div className="font-medium text-yellow-800 mb-2">
                      {t('dashboard.subscription.important', 'Important Notes')}:
                    </div>
                    <ul className="text-yellow-700 text-xs space-y-1">
                      <li>• {t('dashboard.subscription.note1', 'Transfer the exact amount according to your selected plan')}</li>
                      <li>• {t('dashboard.subscription.note2', 'Include your order ID in the transfer description')}</li>
                      <li>• {t('dashboard.subscription.note3', 'Upload payment proof after transfer completion')}</li>
                      <li>• {t('dashboard.subscription.note4', 'Send proof to support@ai-saham.com if needed')}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowSubscriptionModal(false);
                    navigate('/payments/upload-proof');
                  }}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium text-sm"
                >
                  📎 {t('dashboard.subscription.uploadProof', 'Upload Payment Proof')}
                </button>
                <button
                  onClick={() => setShowSubscriptionModal(false)}
                  className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  {t('common.close', 'Close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;