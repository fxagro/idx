import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import useQuota from '../hooks/useQuota';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  Decimation,
  TimeScale,
} from 'chart.js';
import {
  CandlestickController,
  CandlestickElement,
} from 'chartjs-chart-financial';
import { Line, Bar, Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

// Skeleton Loading Component
const SkeletonLoader = ({ className }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

// Skeleton for Balance Card
const BalanceCardSkeleton = () => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-6">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <SkeletonLoader className="h-5 w-32" />
        <SkeletonLoader className="h-8 w-48" />
      </div>
      <div className="text-right space-y-2">
        <SkeletonLoader className="h-4 w-24 ml-auto" />
        <SkeletonLoader className="h-4 w-32 ml-auto" />
      </div>
    </div>
  </div>
);

// Skeleton for Portfolio Table
const PortfolioTableSkeleton = () => (
  <div className="bg-white rounded-lg shadow-md">
    <div className="p-6 border-b border-gray-200">
      <SkeletonLoader className="h-6 w-40" />
    </div>
    <div className="p-6">
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex space-x-4">
            <SkeletonLoader className="h-4 w-16" />
            <SkeletonLoader className="h-4 w-20" />
            <SkeletonLoader className="h-4 w-24" />
            <SkeletonLoader className="h-4 w-24" />
            <SkeletonLoader className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Skeleton for Chart
const ChartSkeleton = () => (
  <div className="bg-white rounded-lg shadow-md">
    <div className="p-6 border-b border-gray-200">
      <SkeletonLoader className="h-6 w-40" />
    </div>
    <div className="p-6">
      <SkeletonLoader className="h-64 w-full" />
    </div>
  </div>
);

// Reusable Alert Component
const Alert = ({ type, message, onClose }) => {
  if (!message) return null;

  const alertStyles = {
    error: 'bg-red-100 border-red-400 text-red-700',
    success: 'bg-green-100 border-green-400 text-green-700'
  };

  return (
    <div className={`mt-4 p-4 border rounded-md ${alertStyles[type]} flex justify-between items-center`}>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-4 text-gray-400 hover:text-gray-600"
        aria-label="Close alert"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  Decimation,
  TimeScale,
  CandlestickController,
  CandlestickElement
);

const VirtualTradingPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(100000000);
  const [portfolio, setPortfolio] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [buyQuantity, setBeliQuantity] = useState('');
  const [sellQuantity, setSellQuantity] = useState('');
  const [buyOrderType, setBuyOrderType] = useState('market');
  const [sellOrderType, setSellOrderType] = useState('market');
  const [buyLimitPrice, setBuyLimitPrice] = useState('');
  const [sellLimitPrice, setSellLimitPrice] = useState('');
  const [currentPrices, setCurrentPrices] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [portfolioChartData, setPortfolioChartData] = useState(null);
  const [candlestickData, setCandlestickData] = useState(null);
  const [activeTab, setActiveTab] = useState('portfolio');
  const [initialLoading, setInitialLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [showEducationalTips, setShowEducationalTips] = useState(false);
  const [orderStatus, setOrderStatus] = useState({});

  // Add quota handling for any potential AI features
  const { quota, loading: quotaLoading, error: quotaError } = useQuota();

  // Set active tab based on current route
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/portfolio')) {
      setActiveTab('portfolio');
    } else if (path.includes('/history')) {
      setActiveTab('history');
    } else {
      setActiveTab('portfolio'); // Default to portfolio for main virtual-trading route
    }
  }, [location.pathname]);

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');
    setSocket(newSocket);

    // Subscribe to price updates for active symbols
    newSocket.on('price_update', (data) => {
      console.log('[VirtualTradingPage] Price update received:', data);
      setCurrentPrices(prev => ({
        ...prev,
        [data.symbol]: data
      }));
    });

    // Handle gap notifications
    newSocket.on('notification', (notification) => {
      console.log('[VirtualTradingPage] Notification received:', notification);
      if (notification.type === 'gap_detected') {
        setNotifications(prev => [
          {
            id: Date.now(),
            type: 'gap',
            message: notification.message,
            data: notification.data,
            timestamp: new Date()
          },
          ...prev.slice(0, 4) // Keep only last 5 notifications
        ]);
      }
    });

    // Handle market summary updates
    newSocket.on('market_summary', (summary) => {
      console.log('[VirtualTradingPage] Market summary:', summary);
    });

    // Subscribe to selected stock if available
    if (selectedStock) {
      newSocket.emit('subscribe_stock', {
        symbol: selectedStock.symbol,
        market: 'idx'
      });
    }

    return () => {
      newSocket.close();
    };
  }, []);

  // Subscribe/unsubscribe when selected stock changes
  useEffect(() => {
    if (socket && selectedStock) {
      socket.emit('subscribe_stock', {
        symbol: selectedStock.symbol,
        market: 'idx'
      });

      // Fetch candlestick data for chart
      fetchCandlestickData(selectedStock.symbol);
    }
  }, [selectedStock, socket]);

  // Fetch initial data
  useEffect(() => {
    fetchBalance();
    fetchPortfolio();
    fetchTransactions();
  }, []);

  // Update portfolio chart data when portfolio changes
  useEffect(() => {
    if (portfolio.length > 0) {
      updatePortfolioChart();
    }
  }, [portfolio]);

  // Handle quota errors
  useEffect(() => {
    if (quotaError) {
      console.error('[VirtualTradingPage] Quota error:', quotaError);
      setError(t('aiPage.errors.fetchQuota', 'Failed to fetch AI quota'));
    }
  }, [quotaError, t]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      console.log('[VirtualTradingPage] Component unmounting, cleaning up...');
      setSearchResults([]);
      setError('');
      setSuccess('');
    };
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && typeof data.virtual_saldo === 'number') {
        setBalance(data.virtual_saldo);
      }
    } catch (error) {
      console.error('[VirtualTradingPage] Error fetching balance:', error);
      setError(t('virtualTrading.error.fetchBalance', 'Failed to fetch balance'));
    } finally {
      setInitialLoading(false);
    }
  }, [navigate, t]);

  const fetchPortfolio = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('/api/stocks/virtual/portfolio', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data.portfolio)) {
        setPortfolio(data.portfolio);
      }
    } catch (error) {
      console.error('[VirtualTradingPage] Error fetching portfolio:', error);
      setError(t('virtualTrading.error.fetchPortfolio', 'Failed to fetch portfolio'));
    }
  }, [navigate, t]);

  const fetchTransactions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('/api/stocks/virtual/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('[VirtualTradingPage] Error fetching transactions:', error);
      setError(t('virtualTrading.error.fetchTransactions', 'Failed to fetch transactions'));
    }
  }, [navigate, t]);

  const searchStocks = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/stocks/search/${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data.results)) {
        setSearchResults(data.results);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('[VirtualTradingPage] Error searching stocks:', error);
      setSearchResults([]);
      setError(t('virtualTrading.error.searchStocks', 'Failed to search stocks'));
    }
  }, [t]);

  const fetchCandlestickData = useCallback(async (symbol) => {
    try {
      const response = await fetch(`/api/stocks/candlestick?symbol=${symbol}&timeframe=1D&limit=30`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.data) {
        // Transform data for Chart.js candlestick format
        const candlestickChartData = {
          datasets: [{
            label: `${symbol} Candlestick`,
            data: data.data.map(item => ({
              x: new Date(item.date),
              o: item.open,
              h: item.high,
              l: item.low,
              c: item.close
            })),
            color: {
              up: '#26C6DA',
              down: '#EF5350',
              unchanged: '#FFF'
            }
          }]
        };
        setCandlestickData(candlestickChartData);
      }
    } catch (error) {
      console.error('[VirtualTradingPage] Error fetching candlestick data:', error);
    }
  }, []);

  const handleTrade = useCallback(async (type) => {
    const quantity = type === 'buy' ? buyQuantity : sellQuantity;
    const orderType = type === 'buy' ? buyOrderType : sellOrderType;
    const limitPrice = type === 'buy' ? buyLimitPrice : sellLimitPrice;

    if (!selectedStock || !quantity) return;

    // Validate lot size (100 shares per lot)
    if (parseInt(quantity) % 100 !== 0) {
      setError(t('virtualTrading.error.invalidLotSize', 'Quantity must be in multiples of 100 (1 lot)'));
      return;
    }

    // Validate limit price for limit orders
    if (orderType === 'limit' && !limitPrice) {
      setError(t('virtualTrading.error.limitPriceRequired', 'Limit price is required for limit orders'));
      return;
    }

    // Check quota before making API calls
    if (quota?.current_quota <= 0) {
      console.log('[VirtualTradingPage] Trade blocked: Quota exhausted');
      setError(t('aiPage.quotaExceeded', 'AI quota exceeded. Please upgrade your plan or wait for quota reset.'));
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const endpoint = type === 'buy' ? '/api/stocks/virtual/buy' : '/api/stocks/virtual/sell';
      const requestBody = {
        symbol: selectedStock.symbol,
        quantity: parseInt(quantity),
        orderType
      };

      // Add limit price for limit orders
      if (orderType === 'limit' && limitPrice) {
        requestBody.limitPrice = parseFloat(limitPrice);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${type} stocks`);
      }

      const data = await response.json();
      const successMessage = t(
        `virtualTrading.success.${type}Order`,
        `Successfully placed ${orderType} ${type} order for ${quantity} shares of ${selectedStock.symbol}`
      );
      console.log(`[VirtualTradingPage] Trade successful:`, data);

      setSuccess(successMessage);

      // Clear form
      if (type === 'buy') {
        setBeliQuantity('');
        setBuyLimitPrice('');
      } else {
        setSellQuantity('');
        setSellLimitPrice('');
      }
      setSelectedStock(null);

      // Refresh data
      fetchBalance();
      fetchPortfolio();
      fetchTransactions();
    } catch (error) {
      console.error(`[VirtualTradingPage] Error ${type}ing stocks:`, error);
      setError(error.message || t('virtualTrading.error.tradeFailed', 'Trade failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [buyQuantity, sellQuantity, buyOrderType, sellOrderType, buyLimitPrice, sellLimitPrice, selectedStock, navigate, t, fetchBalance, fetchPortfolio, fetchTransactions, quota]);


  const updatePortfolioChart = useCallback(() => {
    if (!portfolio || portfolio.length === 0) {
      setPortfolioChartData(null);
      return;
    }

    try {
      const labels = portfolio.map(item => item.symbol || 'Unknown');
      const values = portfolio.map(item => Number(item.current_value) || 0);
      const investments = portfolio.map(item => Number(item.total_investment) || 0);

      setPortfolioChartData({
        labels,
        datasets: [
          {
            label: t('virtualTrading.chart.currentValue', 'Current Value'),
            data: values,
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 2,
          },
          {
            label: t('virtualTrading.chart.totalInvestment', 'Total Investment'),
            data: investments,
            backgroundColor: 'rgba(245, 101, 101, 0.5)',
            borderColor: 'rgb(245, 101, 101)',
            borderWidth: 2,
          }
        ]
      });
    } catch (error) {
      console.error('[VirtualTradingPage] Error updating portfolio chart:', error);
      setPortfolioChartData(null);
    }
  }, [portfolio, t]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('id-ID').format(num);
  };

  // Candlestick chart options
  const candlestickOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: {
          displayFormats: {
            hour: 'HH:mm',
            day: 'MMM dd'
          }
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        position: 'right',
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          callback: function(value) {
            return formatCurrency(value);
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const point = context.raw;
            return [
              `Open: ${formatCurrency(point.o)}`,
              `High: ${formatCurrency(point.h)}`,
              `Low: ${formatCurrency(point.l)}`,
              `Close: ${formatCurrency(point.c)}`
            ];
          }
        }
      }
    }
  };

  // Show skeleton loading on initial load
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-6">
            <SkeletonLoader className="h-8 w-64 mb-2" />
            <SkeletonLoader className="h-5 w-96" />
          </div>

          {/* Balance Card Skeleton */}
          <BalanceCardSkeleton />

          {/* Tabs Skeleton */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <div className="flex space-x-8">
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonLoader key={i} className="h-10 w-20" />
                ))}
              </div>
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PortfolioTableSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with Breadcrumb Navigation */}
        <div className="mb-6">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4" aria-label="Breadcrumb">
            <a href="/dashboard" className="hover:text-blue-600 transition-colors">
              {t('navbar.dashboard', 'Dashboard')}
            </a>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-900 font-medium">
              {t('navbar.virtualTrading', 'Virtual Trading')}
            </span>
          </nav>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {t('virtualTrading.title', 'Virtual Trading')}
              </h1>
              <p className="text-gray-600">
                {t('virtualTrading.subtitle', 'Practice trading with virtual money using real-time market data')}
              </p>
            </div>

            {/* Quick Navigation Links */}
            <div className="hidden md:flex items-center space-x-3">
              <a
                href="/virtual-trading/portfolio"
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>{t('virtualTrading.portfolio', 'Portfolio')}</span>
              </a>
              <a
                href="/virtual-trading/history"
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('virtualTrading.history', 'History')}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Balance Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {t('virtualTrading.virtualBalance', 'Virtual Balance')}
              </h2>
              <p className="text-3xl font-bold text-blue-600">
                {formatCurrency(balance)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">
                {t('virtualTrading.practiceOnly', 'Practice Only')}
              </p>
              <p className="text-sm text-gray-500">
                {t('virtualTrading.realTimeData', 'Real-time Data')}
              </p>
            </div>
          </div>
        </div>

        {/* AI Quota Display */}
        {quota && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">
                  {t('aiPage.quota', 'AI Quota')}
                </h2>
                <p className="text-lg font-medium text-gray-700">
                  {t('aiPage.remaining', 'remaining')}: {quota.current_quota}
                </p>
                <p className="text-sm text-gray-500">
                  {t('aiPage.plan', 'Plan')}: {quota.role || 'user'}
                </p>
              </div>
              <div className="text-right">
                {quota.current_quota <= 0 && (
                  <div className="mb-2 p-2 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded text-xs">
                    {t('aiPage.noQuota', 'Your AI quota has been used up.')}
                  </div>
                )}
                {quotaLoading && (
                  <div className="text-sm text-gray-500">
                    {t('common.loading', 'Loading quota...')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-4">
            <a
              href="/virtual-trading/portfolio"
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              {t('virtualTrading.viewPortfolio', 'View Portfolio')}
            </a>
            <a
              href="/virtual-trading/history"
              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            >
              {t('virtualTrading.viewHistory', 'View History')}
            </a>
          </div>
        </div>

        {/* Enhanced Notifications */}
        {notifications.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('virtualTrading.notifications', 'Market Notifications')}
              </h3>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {notifications.length} active
              </span>
            </div>
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div key={notification.id} className={`flex items-start justify-between p-3 border rounded-md ${
                  notification.type === 'gap'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-start space-x-3">
                    <span className={`text-lg ${
                      notification.type === 'gap' ? '🚨' : '📊'
                    }`}></span>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-900 block">
                        {notification.message}
                      </span>
                      {notification.data?.impact?.educationalNote && (
                        <span className="text-xs text-gray-600 mt-1 block">
                          💡 {notification.data.impact.educationalNote}
                        </span>
                      )}
                      {notification.data?.impact?.suggestedActions?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {notification.data.impact.suggestedActions.map((action, idx) => (
                            <span key={idx} className="text-xs bg-white px-2 py-1 rounded border">
                              {action.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                    {notification.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Educational Tips Section */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('virtualTrading.educationalTips', 'Trading Education')}
            </h3>
            <button
              onClick={() => setShowEducationalTips(!showEducationalTips)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
            >
              <span>{showEducationalTips ? t('common.hide', 'Hide') : t('common.show', 'Show')}</span>
              <svg className={`h-4 w-4 transition-transform ${showEducationalTips ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {showEducationalTips && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">
                    📈 {t('virtualTrading.tips.marketOrder', 'Market Orders')}
                  </h4>
                  <p className="text-sm text-blue-800">
                    {t('virtualTrading.tips.marketOrderDesc', 'Execute immediately at the best available price. Includes bid-ask spread and potential slippage for larger orders.')}
                  </p>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">
                    🎯 {t('virtualTrading.tips.limitOrder', 'Limit Orders')}
                  </h4>
                  <p className="text-sm text-green-800">
                    {t('virtualTrading.tips.limitOrderDesc', 'Execute only at your specified price or better. Must be within daily trading range to be valid.')}
                  </p>
                </div>

                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <h4 className="font-medium text-orange-900 mb-2">
                    🚨 {t('virtualTrading.tips.priceGaps', 'Price Gaps')}
                  </h4>
                  <p className="text-sm text-orange-800">
                    {t('virtualTrading.tips.priceGapsDesc', 'Significant price changes between trading sessions. Gaps often fill within the first 30 minutes of trading.')}
                  </p>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="font-medium text-purple-900 mb-2">
                    💰 {t('virtualTrading.tips.fees', 'Trading Fees')}
                  </h4>
                  <p className="text-sm text-purple-800">
                    {t('virtualTrading.tips.feesDesc', 'Buy orders: 0.19% fee, Sell orders: 0.29% fee (IDX standard rates). Fees are calculated on transaction value.')}
                  </p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">
                  💡 {t('virtualTrading.tips.proTip', 'Pro Tips')}
                </h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• {t('virtualTrading.tips.lotSize', 'Always trade in lots of 100 shares (IDX minimum)')}</li>
                  <li>• {t('virtualTrading.tips.diversify', 'Diversify your portfolio across different sectors')}</li>
                  <li>• {t('virtualTrading.tips.riskManagement', 'Use stop-loss orders to manage risk effectively')}</li>
                  <li>• {t('virtualTrading.tips.marketHours', 'Monitor stocks during market hours (9:00-16:00 WIB)')}</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Main Trading Interface */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stock Search and Price Display */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('virtualTrading.searchStocks', 'Search Stocks')}
                </h3>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder={t('virtualTrading.searchPlaceholder', 'Enter stock symbol or name...')}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      searchStocks(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                    {searchResults.map((stock) => (
                      <div
                        key={stock.symbol}
                        onClick={() => {
                          setSelectedStock(stock);
                          setSearchTerm(stock.symbol);
                          setSearchResults([]);
                        }}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{stock.symbol}</div>
                        <div className="text-sm text-gray-500">{stock.name}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Enhanced Real-time Price Display */}
                {selectedStock && currentPrices[selectedStock.symbol] && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">
                        {selectedStock.symbol} - Real-time Price
                      </h4>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${
                        currentPrices[selectedStock.symbol].change >= 0
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {currentPrices[selectedStock.symbol].change >= 0 ? '↗' : '↘'}
                        {currentPrices[selectedStock.symbol].changePercent != null ?
                          Number(currentPrices[selectedStock.symbol].changePercent).toFixed(2) :
                          '0.00'
                        }%
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="bg-white p-2 rounded border">
                        <span className="text-gray-600 block">Last Price</span>
                        <span className={`font-bold text-lg ${currentPrices[selectedStock.symbol].change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(currentPrices[selectedStock.symbol].price)}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded border">
                        <span className="text-gray-600 block">Bid Price</span>
                        <span className="font-bold text-lg text-blue-600">
                          {formatCurrency(currentPrices[selectedStock.symbol].bid)}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded border">
                        <span className="text-gray-600 block">Ask Price</span>
                        <span className="font-bold text-lg text-orange-600">
                          {formatCurrency(currentPrices[selectedStock.symbol].ask)}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded border">
                        <span className="text-gray-600 block">Spread</span>
                        <span className="font-bold text-lg text-purple-600">
                          {formatCurrency(currentPrices[selectedStock.symbol].spread || (currentPrices[selectedStock.symbol].ask - currentPrices[selectedStock.symbol].bid))}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded border">
                        <span className="text-gray-600 block">Volume</span>
                        <span className="font-bold text-lg">
                          {formatNumber(currentPrices[selectedStock.symbol].volume)}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded border">
                        <span className="text-gray-600 block">Change</span>
                        <span className={`font-bold ${currentPrices[selectedStock.symbol].change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {currentPrices[selectedStock.symbol].change >= 0 ? '+' : ''}{formatCurrency(currentPrices[selectedStock.symbol].change)}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded border md:col-span-2">
                        <span className="text-gray-600 block">Last Update</span>
                        <span className="font-medium">
                          {new Date(currentPrices[selectedStock.symbol].timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {/* Quick Order Buttons */}
                    <div className="mt-4 flex space-x-2">
                      <button
                        onClick={() => {
                          setBuyOrderType('market');
                          setBuyLimitPrice('');
                          setBeliQuantity('100');
                        }}
                        className="flex-1 bg-green-100 text-green-700 py-2 px-3 rounded text-sm font-medium hover:bg-green-200 transition-colors"
                      >
                        Quick Buy 100
                      </button>
                      <button
                        onClick={() => {
                          setSellOrderType('market');
                          setSellLimitPrice('');
                          setSellQuantity('100');
                        }}
                        className="flex-1 bg-red-100 text-red-700 py-2 px-3 rounded text-sm font-medium hover:bg-red-200 transition-colors"
                      >
                        Quick Sell 100
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Trading Forms */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('virtualTrading.tradeStocks', 'Trade Stocks')}
                </h3>
              </div>
              <div className="p-6">
                {selectedStock && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">
                      {selectedStock.symbol} - {selectedStock.name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {t('virtualTrading.selectQuantity', 'Select quantity to trade (multiples of 100)')}
                    </p>
                  </div>
                )}

                {/* Buy Form */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">
                    {t('virtualTrading.buy', 'Buy')}
                  </h4>

                  {/* Order Type Selection */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('virtualTrading.orderType', 'Order Type')}
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="market"
                          checked={buyOrderType === 'market'}
                          onChange={(e) => setBuyOrderType(e.target.value)}
                          className="mr-2"
                        />
                        <span className="text-sm">{t('virtualTrading.marketOrder', 'Market Order')}</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="limit"
                          checked={buyOrderType === 'limit'}
                          onChange={(e) => setBuyOrderType(e.target.value)}
                          className="mr-2"
                        />
                        <span className="text-sm">{t('virtualTrading.limitOrder', 'Limit Order')}</span>
                      </label>
                    </div>
                  </div>

                  {/* Limit Price Input for Limit Orders */}
                  {buyOrderType === 'limit' && (
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('virtualTrading.limitPrice', 'Limit Price')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={t('virtualTrading.limitPricePlaceholder', 'Enter limit price')}
                        value={buyLimitPrice}
                        onChange={(e) => setBuyLimitPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <input
                      type="number"
                      placeholder={t('virtualTrading.quantity', 'Quantity (lots of 100)')}
                      value={buyQuantity}
                      onChange={(e) => setBeliQuantity(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      min="100"
                      step="100"
                    />
                    <button
                      onClick={() => handleTrade('buy')}
                      disabled={loading || !selectedStock || !buyQuantity || quota?.current_quota <= 0}
                      className={`px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
                        quota?.current_quota <= 0
                          ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {loading ? t('virtualTrading.buying', 'Buying...') : t('virtualTrading.buy', 'Buy')}
                    </button>
                  </div>
                </div>

                {/* Sell Form */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">
                    {t('virtualTrading.sell', 'Sell')}
                  </h4>

                  {/* Order Type Selection */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('virtualTrading.orderType', 'Order Type')}
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="market"
                          checked={sellOrderType === 'market'}
                          onChange={(e) => setSellOrderType(e.target.value)}
                          className="mr-2"
                        />
                        <span className="text-sm">{t('virtualTrading.marketOrder', 'Market Order')}</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="limit"
                          checked={sellOrderType === 'limit'}
                          onChange={(e) => setSellOrderType(e.target.value)}
                          className="mr-2"
                        />
                        <span className="text-sm">{t('virtualTrading.limitOrder', 'Limit Order')}</span>
                      </label>
                    </div>
                  </div>

                  {/* Limit Price Input for Limit Orders */}
                  {sellOrderType === 'limit' && (
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('virtualTrading.limitPrice', 'Limit Price')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder={t('virtualTrading.limitPricePlaceholder', 'Enter limit price')}
                        value={sellLimitPrice}
                        onChange={(e) => setSellLimitPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <input
                      type="number"
                      placeholder={t('virtualTrading.quantity', 'Quantity (lots of 100)')}
                      value={sellQuantity}
                      onChange={(e) => setSellQuantity(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      min="100"
                      step="100"
                      max={selectedStock ? Math.floor((portfolio.find(p => p.symbol === selectedStock.symbol)?.quantity || 0) / 100) * 100 : 0}
                    />
                    <button
                      onClick={() => handleTrade('sell')}
                      disabled={loading || !selectedStock || !sellQuantity || quota?.current_quota <= 0}
                      className={`px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${
                        quota?.current_quota <= 0
                          ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {loading ? t('virtualTrading.selling', 'Selling...') : t('virtualTrading.sell', 'Sell')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Candlestick Chart */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('virtualTrading.priceChart', 'Price Chart')}
                </h3>
              </div>
              <div className="p-6">
                {selectedStock ? (
                  candlestickData ? (
                    <div style={{ height: '400px' }}>
                      <Chart type="candlestick" data={candlestickData} options={candlestickOptions} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                      {t('virtualTrading.loadingChart', 'Loading chart data...')}
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    {t('virtualTrading.selectStockForChart', 'Select a stock to view price chart')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced Transaction History Table */}
          {transactions.length > 0 && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {t('virtualTrading.transactionHistory', 'Transaction History')}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {t('virtualTrading.showingLast', 'Showing last {{count}} transactions', { count: Math.min(transactions.length, 10) })}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.table.date', 'Date')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.table.symbol', 'Symbol')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.table.type', 'Type')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.table.orderType', 'Order Type')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.table.quantity', 'Quantity')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.table.price', 'Price')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.table.total', 'Total')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.table.fees', 'Fees')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactions.slice(0, 10).map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              <div className="font-medium">
                                {new Date(transaction.transaction_date).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(transaction.transaction_date).toLocaleTimeString()}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {transaction.symbol}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              transaction.type === 'BUY'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                              transaction.order_type === 'MARKET'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {transaction.order_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(transaction.qty)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="font-medium">
                              {formatCurrency(transaction.price)}
                            </div>
                            {transaction.type === 'BUY' && (
                              <div className="text-xs text-green-600">
                                +0.19% fee
                              </div>
                            )}
                            {transaction.type === 'SELL' && (
                              <div className="text-xs text-red-600">
                                +0.29% fee
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="font-medium">
                              {formatCurrency(transaction.total_amount)}
                            </div>
                            {transaction.type === 'BUY' && (
                              <div className="text-xs text-gray-500">
                                Cost basis
                              </div>
                            )}
                            {transaction.type === 'SELL' && (
                              <div className="text-xs text-gray-500">
                                Net proceeds
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="font-medium">
                              {formatCurrency(transaction.fees || 0)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {transaction.fees ?
                                `${((transaction.fees / transaction.total_amount) * 100).toFixed(3)}%` :
                                '0.00%'
                              }
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {transactions.length > 10 && (
                  <div className="mt-4 text-center">
                    <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                      {t('virtualTrading.viewAllTransactions', 'View All Transactions')} →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Portfolio Chart */}
          {portfolioChartData && (
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('virtualTrading.chart.portfolioChart', 'Portfolio Chart')}
                </h3>
              </div>
              <div className="p-6">
                <Bar
                  data={portfolioChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      decimation: {
                        enabled: true,
                        algorithm: 'lttb',
                        samples: 50,
                        threshold: 100
                      },
                      legend: {
                        position: 'top',
                      },
                      title: {
                        display: true,
                        text: t('virtualTrading.chart.portfolioComparison', 'Portfolio Value Comparison')
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: function(value) {
                            return formatCurrency(value);
                          }
                        }
                      }
                    }
                  }}
                  height={400}
                />
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <Alert
          type="error"
          message={error}
          onClose={() => setError('')}
        />

        <Alert
          type="success"
          message={success}
          onClose={() => setSuccess('')}
        />

        {/* Quota Error Alert */}
        {quotaError && (
          <Alert
            type="error"
            message={t('aiPage.errors.fetchQuota', 'Failed to fetch AI quota')}
            onClose={() => setError('')}
          />
        )}

        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            <strong>{t('virtualTrading.disclaimer', 'Disclaimer')}:</strong>{' '}
            {t('virtualTrading.disclaimerText', 'This is a virtual trading simulation for educational purposes only. No real money is involved and no actual trades are executed. Market data is provided for demonstration purposes.')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VirtualTradingPage;