import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line as ChartLine } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import api from '../utils/api';
import useQuota from '../hooks/useQuota';
import useAI from '../hooks/useAI';
import AIConsole from '../components/AIConsole';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  TimeScale
);

// ===== HELPER FUNCTIONS (TOP-LEVEL) =====

/**
 * Fetch forecast data from the API
 * @param {string} symbol - Stock symbol
 * @param {number} days - Number of forecast days
 * @returns {Promise<Object>} Forecast data
 */
const fetchForecastData = async (symbol, days) => {
  const response = await api.get(`/stocks/openbb/forecast/${symbol}?days=${days}`);
  return response.data;
};

/**
 * Consume AI quota for forecast operations
 * @param {number} tokens - Number of tokens to consume
 * @returns {Promise<Object>} Consumption result
 */
const consumeAIQuota = async (tokens) => {
  const response = await api.post('/stocks/ai/consume', {
    tokens_used: tokens
  });
  return response.data;
};

/**
 * Handle errors with consistent logging and user feedback
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred
 */
const handleError = (error, context) => {
  console.error(`[${context}] Error:`, error);
  return {
    success: false,
    message: error.response?.data?.message || error.message || 'An unexpected error occurred'
  };
};

// ===== MAIN COMPONENT =====

const OpenBBDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // ===== STATE DECLARATIONS (HOOKS IN PROPER ORDER) =====

  // Component state
  const [selectedSymbol, setSelectedSymbol] = useState('BBCA');
  const [selectedTimeframe, setSelectedTimeframe] = useState('30');
  const [forecastDays, setForecastDays] = useState(7);
  const [toast, setToast] = useState(null);
  const [optimisticRemaining, setOptimisticRemaining] = useState(null);

  // Custom hooks (must come before other hooks)
  const {
    used,
    limit,
    remaining,
    isLoading: quotaLoading,
    isError: quotaError,
    refetch: refetchQuota,
    consumeQuota,
    consumeQuotaSafe,
    isConsuming
  } = useQuota();

  // AI functionality hook
  const {
    isLoading: aiLoading,
    error: aiError,
    responses: aiResponses,
    isConsoleOpen,
    consolePrompt,
    setConsolePrompt,
    consoleHistory,
    showDebugLogs,
    setShowDebugLogs,
    sendQuery,
    sendConsoleQuery,
    cancelRequest,
    toggleConsole,
    testConnection,
    handleKeyDown,
    isDebugMode,
    getDebugInfo
  } = useAI();

  // ===== DATA FETCHING (USEQUERY HOOKS) =====

  // Market Overview Query
  const {
    data: marketData,
    isLoading: marketLoading,
    error: marketError,
    refetch: refetchMarket
  } = useQuery({
    queryKey: ['openbb-market'],
    queryFn: async () => {
      const response = await api.get('/stocks/openbb/market');
      return response.data;
    },
    staleTime: 30000,
    gcTime: 300000, // 5 minutes cache (formerly cacheTime)
    refetchInterval: 30000,
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (client errors)
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => handleError(error, 'Market Data Fetch')
  });

  // Stock Prices Queries (Parallel)
  const defaultSymbols = ['BBCA', 'TLKM', 'ASII', 'AAPL'];
  const stockQueries = useQueries({
    queries: defaultSymbols.map(symbol => ({
      queryKey: ['openbb-price', symbol],
      queryFn: async () => {
        const response = await api.get(`/stocks/openbb/price/${symbol}`);
        return { symbol, ...response.data };
      },
      staleTime: 45000, // 45 seconds - prices don't change as frequently
      gcTime: 300000, // 5 minutes cache
      refetchInterval: 30000,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors, max 2 retries for 5xx
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    }))
  });

  // Fundamentals Query
  const {
    data: fundamentalsData,
    isLoading: fundamentalsLoading,
    error: fundamentalsError,
    refetch: refetchFundamentals
  } = useQuery({
    queryKey: ['openbb-fundamentals', selectedSymbol],
    queryFn: async () => {
      const response = await api.get(`/stocks/openbb/fundamentals/${selectedSymbol}`);
      return response.data;
    },
    enabled: !!selectedSymbol,
    staleTime: 300000, // 5 minutes - fundamentals don't change frequently
    gcTime: 1800000, // 30 minutes cache (formerly cacheTime)
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors, max 2 retries for 5xx
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Chart Data Query
  const {
    data: chartData,
    isLoading: chartLoading,
    error: chartError,
    refetch: refetchChart
  } = useQuery({
    queryKey: ['openbb-chart', selectedSymbol, selectedTimeframe],
    queryFn: async () => {
      const response = await api.get(`/stocks/openbb/chart/${selectedSymbol}?days=${selectedTimeframe}`);
      return response.data;
    },
    enabled: !!selectedSymbol,
    staleTime: 60000, // 1 minute - chart data can be cached longer
    gcTime: 600000, // 10 minutes cache
    retry: (failureCount, error) => {
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // News/Analytics Query
  const {
    data: newsData,
    isLoading: newsLoading,
    error: newsError,
    refetch: refetchNews
  } = useQuery({
    queryKey: ['openbb-news', selectedSymbol],
    queryFn: async () => {
      const response = await api.get(`/stocks/openbb/news/${selectedSymbol}?limit=5`);
      return response.data;
    },
    enabled: !!selectedSymbol,
    staleTime: 60000, // 1 minute - news can be cached longer
    gcTime: 1800000, // 30 minutes cache (news stays relevant longer)
    retry: (failureCount, error) => {
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // ML Forecast Query (only enabled when quota is available)
  const {
    data: forecastData,
    isLoading: forecastLoading,
    error: forecastError,
    refetch: refetchForecastQuery
  } = useQuery({
    queryKey: ['ml-forecast', selectedSymbol, forecastDays],
    queryFn: async () => {
      const response = await api.get(`/stocks/openbb/forecast/${selectedSymbol}?days=${forecastDays}`);
      return response.data;
    },
    enabled: !!selectedSymbol && (optimisticRemaining !== null ? optimisticRemaining : remaining) > 0,
    staleTime: 300000, // 5 minutes cache
    gcTime: 1800000, // 30 minutes cache for forecast results
    retry: (failureCount, error) => {
      // More conservative retry for expensive AI operations
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 10000),
  });

  // ===== FUNCTION DECLARATIONS (BEFORE USEEFFECT) =====

  // Toast notification helper
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Process stock prices data
  const stockPricesData = useMemo(() => {
    return stockQueries.map(query => query.data).filter(Boolean);
  }, [stockQueries]);

  // Process chart data for Chart.js
  const chartJsData = useMemo(() => {
    if (!chartData?.data || !Array.isArray(chartData.data) || chartData.data.length === 0) return null;

    return {
      labels: chartData.data.map(item => new Date(item.date).toLocaleDateString()),
      datasets: [
        {
          label: 'Price',
          data: chartData.data.map(item => item.close),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
        }
      ]
    };
  }, [chartData]);

  // Chart options
  const chartOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `${selectedSymbol} - ${selectedTimeframe} Day Price Chart`,
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day',
        },
      },
      y: {
        beginAtZero: false,
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  }), [selectedSymbol, selectedTimeframe]);

  // Market stats cards
  const marketStatsCards = useMemo(() => {
    if (!marketData) return [];

    return [
      {
        title: t('openbb.overview.totalStocks', 'Total Stocks'),
        value: marketData.totalStocks || 'N/A',
        icon: '📊',
        color: 'blue'
      },
      {
        title: t('openbb.overview.gainers', 'Gainers'),
        value: marketData.gainers || 'N/A',
        icon: '📈',
        color: 'green'
      },
      {
        title: t('openbb.overview.losers', 'Losers'),
        value: marketData.losers || 'N/A',
        icon: '📉',
        color: 'red'
      },
      {
        title: t('openbb.overview.volume', 'Total Volume'),
        value: marketData.totalVolume ? `${(marketData.totalVolume / 1000000).toFixed(1)}M` : 'N/A',
        icon: '📊',
        color: 'purple'
      }
    ];
  }, [marketData, t]);

  // Stock options for dropdown
  const stockOptions = [
    { value: 'BBCA', label: 'BBCA - Bank Central Asia' },
    { value: 'TLKM', label: 'TLKM - Telekomunikasi Indonesia' },
    { value: 'ASII', label: 'ASII - Astra International' },
    { value: 'BMRI', label: 'BMRI - Bank Mandiri' },
    { value: 'BBNI', label: 'BBNI - Bank Negara Indonesia' },
    { value: 'AAPL', label: 'AAPL - Apple Inc.' },
    { value: 'MSFT', label: 'MSFT - Microsoft Corporation' },
    { value: 'GOOGL', label: 'GOOGL - Alphabet Inc.' },
  ];

  // ===== FORECAST FUNCTION (DECLARED BEFORE USEEFFECT) =====

  const refetchForecast = useCallback(async () => {
    try {
      const data = await fetchForecastData(selectedSymbol, forecastDays);
      return data;
    } catch (error) {
      const errorResult = handleError(error, 'Forecast Fetch');
      showToast(errorResult.message, 'error');
      throw error;
    }
  }, [selectedSymbol, forecastDays, showToast]);

  // ===== FORECAST HANDLER (DECLARED BEFORE USEEFFECT) =====

  const handleForecastClick = useCallback(async () => {
    const currentRemaining = optimisticRemaining !== null ? optimisticRemaining : remaining;

    if (currentRemaining <= 0) {
      showToast('You\'ve reached your AI limit. Upgrade or wait until reset.', 'error');
      return;
    }

    const estimatedTokens = 50;

    try {
      // Optimistic update
      setOptimisticRemaining(Math.max(0, currentRemaining - estimatedTokens));

      // Use safe quota consumption with retry logic
      const quotaResult = await consumeQuotaSafe(estimatedTokens);

      if (quotaResult.success) {
        // Generate forecast
        await refetchForecast();
        showToast('AI quota consumed successfully. Generating forecast...', 'success');
        setOptimisticRemaining(null); // Clear optimistic update
      } else {
        // Rollback optimistic update
        setOptimisticRemaining(null);

        if (quotaResult.message.includes('exceeded')) {
          showToast('You\'ve reached your AI limit. Upgrade or wait until reset.', 'error');
        } else {
          showToast(`Unable to update quota: ${quotaResult.message}`, 'error');
        }
      }
    } catch (error) {
      // Rollback optimistic update
      setOptimisticRemaining(null);
      const errorResult = handleError(error, 'Forecast Handler');
      showToast(errorResult.message, 'error');
    }
  }, [remaining, optimisticRemaining, consumeQuotaSafe, refetchForecast, showToast]);

  // ===== DEBUG MODE FUNCTIONALITY =====

  const isAIDebugMode = import.meta.env.VITE_AI_DEBUG_MODE === 'true' || import.meta.env.MODE === 'development';

  // Debug overlay component
  const DebugOverlay = () => {
    if (!isAIDebugMode) return null;

    return (
      <div className="fixed bottom-4 left-4 bg-black bg-opacity-75 text-white p-4 rounded-lg text-xs font-mono max-w-md">
        <div className="font-bold mb-2">🔧 AI Debug Mode</div>
        <div>Used: {used} / {limit}</div>
        <div>Remaining: {optimisticRemaining !== null ? optimisticRemaining : remaining}</div>
        <div>Optimistic: {optimisticRemaining !== null ? 'Yes' : 'No'}</div>
        <div>Consuming: {isConsuming ? 'Yes' : 'No'}</div>
        <div>Loading: {quotaLoading ? 'Yes' : 'No'}</div>
        <div>Error: {quotaError ? 'Yes' : 'No'}</div>
        <div className="mt-2 pt-2 border-t border-gray-600">
          <div className="text-yellow-300">🧪 Test Functions:</div>
          <button
            onClick={() => {
              console.log('🧪 Testing quota consumption...');
              consumeQuotaSafe(10).then(result => {
                console.log('✅ Test result:', result);
                showToast(`Test consumption: ${result.success ? 'Success' : 'Failed'}`, result.success ? 'success' : 'error');
              });
            }}
            className="mt-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            Test Consume 10
          </button>
        </div>
      </div>
    );
  };

  // Sync status indicator
  const getSyncStatus = () => {
    if (quotaError) return { icon: '❌', color: 'red', text: 'Error' };
    if (isConsuming) return { icon: '🔄', color: 'yellow', text: 'Syncing' };
    if (optimisticRemaining !== null) return { icon: '⚡', color: 'blue', text: 'Optimistic' };
    return { icon: '✅', color: 'green', text: 'Synced' };
  };

  const syncStatus = getSyncStatus();

  // ===== USEEFFECT HOOKS (AFTER FUNCTION DECLARATIONS) =====

  // Auto-refresh quota every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchQuota();
    }, 60000);

    return () => clearInterval(interval);
  }, [refetchQuota]);

  // ===== UI COMPONENT HELPERS =====

  // Error fallback component
  const ErrorFallback = ({ error, onRetry, title }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center">
        <span className="text-red-600 mr-2">⚠️</span>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {title || t('openbb.errors.dataUnavailable', 'Data unavailable')}
          </h3>
          <p className="text-sm text-red-700 mt-1">
            {error?.message || t('openbb.errors.generic', 'Unable to load data')}
          </p>
        </div>
        <button
          onClick={onRetry}
          className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    </div>
  );

  // Loading skeleton
  const LoadingSkeleton = ({ height = 'h-32' }) => (
    <div className={`${height} bg-gray-200 animate-pulse rounded-lg`}></div>
  );

  // Toast notification component
  const Toast = ({ message, type, onClose }) => (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 ${
      type === 'error' ? 'bg-red-500 text-white' :
      type === 'success' ? 'bg-green-500 text-white' :
      'bg-blue-500 text-white'
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-3 text-white hover:text-gray-200 focus:outline-none"
        >
          ×
        </button>
      </div>
    </div>
  );

  // ===== RENDER =====

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Toast Notifications */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        {/* Debug Overlay */}
        <DebugOverlay />

        {/* AI Console */}
        <AIConsole
          isOpen={isConsoleOpen}
          onClose={() => toggleConsole()}
          prompt={consolePrompt}
          setPrompt={setConsolePrompt}
          history={consoleHistory}
          onSendPrompt={sendConsoleQuery}
          isLoading={aiLoading}
          onCancel={cancelRequest}
          showDebugLogs={showDebugLogs}
          setShowDebugLogs={setShowDebugLogs}
          onKeyDown={handleKeyDown}
          isDebugMode={isDebugMode}
          responses={aiResponses}
        />

        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {t('openbb.title', 'OpenBB Dashboard')}
              </h1>
              <p className="text-gray-600">
                {t('openbb.subtitle', 'Real-time market data and financial analytics')}
              </p>
            </div>

            {/* AI Console Button */}
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleConsole}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                  isConsoleOpen
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title="Open AI Console (Chat with AI)"
              >
                <span className="text-lg">🤖</span>
                <span>{isConsoleOpen ? 'AI Active' : 'AI Chat'}</span>
              </button>

              {/* Test AI Connection Button (Debug Mode Only) */}
              {isAIDebugMode && (
                <button
                  onClick={testConnection}
                  disabled={aiLoading}
                  className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                  title="Test AI Connection"
                >
                  {aiLoading ? 'Testing...' : 'Test AI'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Market Overview Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              {t('openbb.overview.title', 'Market Overview')}
            </h2>
            {marketError && (
              <button
                onClick={refetchMarket}
                className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                {t('common.refresh', 'Refresh')}
              </button>
            )}
          </div>

          {marketLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <LoadingSkeleton key={i} />
              ))}
            </div>
          ) : marketError ? (
            <ErrorFallback
              error={marketError}
              onRetry={refetchMarket}
              title={t('openbb.overview.error', 'Market data unavailable')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {marketStatsCards.map((card, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{card.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                    </div>
                    <div className="text-2xl">{card.icon}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Two-column layout for main content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Stock Prices Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t('openbb.prices.title', 'Stock Prices')}
            </h2>

            {stockQueries.some(query => query.isLoading) ? (
              <LoadingSkeleton height="h-48" />
            ) : stockQueries.some(query => query.error) ? (
              <ErrorFallback
                error={stockQueries.find(query => query.error)?.error}
                onRetry={() => stockQueries.forEach(query => query.refetch())}
                title={t('openbb.prices.error', 'Price data unavailable')}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-medium text-gray-600">
                        {t('openbb.prices.symbol', 'Symbol')}
                      </th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">
                        {t('openbb.prices.price', 'Price')}
                      </th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">
                        {t('openbb.prices.change', 'Change')}
                      </th>
                      <th className="text-right py-2 px-2 font-medium text-gray-600">
                        {t('openbb.prices.volume', 'Volume')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockPricesData.map((stock) => (
                      <tr key={stock.symbol} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{stock.symbol}</td>
                        <td className="py-2 px-2 text-right font-mono">
                          {stock.price ? `$${stock.price.toFixed(2)}` : 'N/A'}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono ${
                          stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {stock.changePercent !== undefined
                            ? `${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%`
                            : 'N/A'
                          }
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {stock.volume ? `${(stock.volume / 1000).toFixed(1)}K` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Fundamentals Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {t('openbb.fundamentals.title', 'Fundamentals')}
              </h2>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="border border-gray-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {stockOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {fundamentalsLoading ? (
              <LoadingSkeleton height="h-48" />
            ) : fundamentalsError ? (
              <ErrorFallback
                error={fundamentalsError}
                onRetry={refetchFundamentals}
                title={t('openbb.fundamentals.error', 'Fundamentals data unavailable')}
              />
            ) : fundamentalsData ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">P/E Ratio:</span>
                    <span className="font-medium">{fundamentalsData.pe || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">P/B Ratio:</span>
                    <span className="font-medium">{fundamentalsData.pb || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ROE:</span>
                    <span className="font-medium">{fundamentalsData.roe ? `${fundamentalsData.roe.toFixed(2)}%` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dividend Yield:</span>
                    <span className="font-medium">{fundamentalsData.dividendYield ? `${fundamentalsData.dividendYield.toFixed(2)}%` : 'N/A'}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Market Cap:</span>
                    <span className="font-medium">{fundamentalsData.marketCap ? `$${(fundamentalsData.marketCap / 1000000000).toFixed(1)}B` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Revenue:</span>
                    <span className="font-medium">{fundamentalsData.revenue ? `$${(fundamentalsData.revenue / 1000000).toFixed(1)}M` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Net Income:</span>
                    <span className="font-medium">{fundamentalsData.netIncome ? `$${(fundamentalsData.netIncome / 1000000).toFixed(1)}M` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Debt/Equity:</span>
                    <span className="font-medium">{fundamentalsData.debtToEquity || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {t('openbb.fundamentals.noData', 'No fundamentals data available')}
              </div>
            )}
          </div>
        </div>

        {/* Technical Chart Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              {t('openbb.chart.title', 'Technical Chart')}
            </h2>
            <div className="flex space-x-2">
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="border border-gray-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {stockOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="border border-gray-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
                <option value="180">180 Days</option>
              </select>
              {chartError && (
                <button
                  onClick={refetchChart}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                >
                  {t('common.refresh', 'Refresh')}
                </button>
              )}
            </div>
          </div>

          {chartLoading ? (
            <LoadingSkeleton height="h-96" />
          ) : chartError ? (
            <ErrorFallback
              error={chartError}
              onRetry={refetchChart}
              title={t('openbb.chart.error', 'Chart data unavailable')}
            />
          ) : chartJsData ? (
            <div className="h-96">
              <ChartLine data={chartJsData} options={chartOptions} />
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {t('openbb.chart.noData', 'No chart data available')}
            </div>
          )}
        </div>

        {/* Two-column layout for Analytics and Forecast */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Analytics/News Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {t('openbb.analytics.title', 'Market Analytics')}
              </h2>
              <div className="flex items-center space-x-2">
                <select
                  value={selectedSymbol}
                  onChange={(e) => setSelectedSymbol(e.target.value)}
                  className="border border-gray-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {stockOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {newsError && (
                  <button
                    onClick={refetchNews}
                    className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                  >
                    {t('common.refresh', 'Refresh')}
                  </button>
                )}
              </div>
            </div>

            {newsLoading ? (
              <LoadingSkeleton height="h-48" />
            ) : newsError ? (
              <ErrorFallback
                error={newsError}
                onRetry={refetchNews}
                title={t('openbb.analytics.error', 'Analytics data unavailable')}
              />
            ) : newsData?.articles && Array.isArray(newsData.articles) ? (
              <div className="space-y-4">
                {newsData.articles.slice(0, 5).map((article, index) => (
                  <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer">
                          {article.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {article.summary || article.description}
                        </p>
                        <div className="flex items-center mt-2 text-xs text-gray-500">
                          <span>{article.source}</span>
                          <span className="mx-2">•</span>
                          <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                          {article.sentiment && (
                            <>
                              <span className="mx-2">•</span>
                              <span className={`px-2 py-1 rounded ${
                                article.sentiment === 'positive' ? 'bg-green-100 text-green-800' :
                                article.sentiment === 'negative' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {article.sentiment}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {t('openbb.analytics.noData', 'No analytics data available')}
              </div>
            )}
          </div>

          {/* Predictive Analytics Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {t('openbb.forecast.title', 'Predictive Analytics')}
              </h2>
              <div className="flex items-center space-x-2">
                <select
                  value={forecastDays}
                  onChange={(e) => setForecastDays(parseInt(e.target.value))}
                  className="border border-gray-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="3">3 Days</option>
                  <option value="7">7 Days</option>
                  <option value="14">14 Days</option>
                </select>
                <button
                  onClick={handleForecastClick}
                  disabled={forecastLoading || (optimisticRemaining !== null ? optimisticRemaining : remaining) <= 0 || isConsuming}
                  className={`px-3 py-2 text-sm rounded transition-colors ${
                    (optimisticRemaining !== null ? optimisticRemaining : remaining) <= 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : (forecastLoading || isConsuming)
                        ? 'bg-blue-400 text-white cursor-wait'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isConsuming
                    ? 'Updating quota...'
                    : forecastLoading
                      ? t('openbb.forecast.generating', 'Generating...')
                      : t('openbb.forecast.generate', 'Generate Forecast')
                  }
                </button>
              </div>
            </div>

            {/* Enhanced Quota Display */}
            <div className="mb-4">
              {quotaLoading ? (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Fetching quota...</span>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
                </div>
              ) : quotaError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-red-600 font-medium">Unable to fetch quota</span>
                    <button
                      onClick={refetchQuota}
                      className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm space-y-2 sm:space-y-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">AI Usage:</span>
                      <span className="font-mono font-medium">
                        {used} / {limit} tokens
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">Remaining:</span>
                      <span className={`font-mono font-medium ${
                        (optimisticRemaining !== null ? optimisticRemaining : remaining) <= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {optimisticRemaining !== null ? optimisticRemaining : remaining}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        syncStatus.color === 'green' ? 'bg-green-100 text-green-800' :
                        syncStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {syncStatus.icon} {syncStatus.text}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar for mobile and desktop */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Usage Progress</span>
                      <span>{Math.round((used / limit) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          ((optimisticRemaining !== null ? optimisticRemaining : remaining) / limit) < 0.2 ? 'bg-red-500' :
                          ((optimisticRemaining !== null ? optimisticRemaining : remaining) / limit) < 0.4 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(((optimisticRemaining !== null ? optimisticRemaining : remaining) / limit) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {forecastLoading ? (
              <LoadingSkeleton height="h-48" />
            ) : forecastError ? (
              <ErrorFallback
                error={forecastError}
                onRetry={refetchForecastQuery}
                title={t('openbb.forecast.error', 'Forecast unavailable')}
              />
            ) : forecastData?.data ? (
              <div className="space-y-4">
                {/* Forecast Chart */}
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecastData.data?.forecast_vol?.map ? forecastData.data.forecast_vol.map((vol, index) => ({
                      day: `Day ${index + 1}`,
                      volatility: vol * 100 // Convert to percentage for display
                    })) : []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis label={{ value: 'Volatility (%)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value) => [`${value.toFixed(2)}%`, 'Volatility']} />
                      <Line
                        type="monotone"
                        dataKey="volatility"
                        stroke="#8884d8"
                        strokeWidth={2}
                        dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Forecast Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('openbb.forecast.avgVol', 'Avg Volatility')}:</span>
                      <span className="font-medium">{(forecastData.data.avg_volatility * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('openbb.forecast.confidence', 'Confidence')}:</span>
                      <span className="font-medium">{(forecastData.data.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('openbb.forecast.signal', 'Signal')}:</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        forecastData.data.signal === 'BUY' ? 'bg-green-100 text-green-800' :
                        forecastData.data.signal === 'SELL' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {t(`openbb.forecast.signal.${forecastData.data.signal.toLowerCase()}`, forecastData.data.signal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('openbb.forecast.source', 'Source')}:</span>
                      <span className="font-medium text-xs">{forecastData.data.source}</span>
                    </div>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{t('openbb.forecast.confidenceLevel', 'Confidence Level')}</span>
                    <span className="font-medium">{(forecastData.data.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        forecastData.data.confidence > 0.8 ? 'bg-green-500' :
                        forecastData.data.confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${forecastData.data.confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (optimisticRemaining !== null ? optimisticRemaining : remaining) <= 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🔒</div>
                <p>{t('openbb.forecast.noQuota', 'Insufficient AI quota for ML forecasting')}</p>
                <p className="text-sm mt-1">{t('openbb.forecast.upgradeQuota', 'Please upgrade your plan to access predictive analytics')}</p>
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm font-medium">Quota Status: {syncStatus.icon} {syncStatus.text}</p>
                  <p className="text-red-500 text-xs mt-1">Used: {used} / {limit} tokens</p>
                </div>
                <button
                  onClick={() => {
                    showToast('You\'ve reached your AI limit. Please upgrade your plan.', 'error');
                    // Also try to refresh quota in case of sync issues
                    refetchQuota();
                  }}
                  className="mt-3 px-4 py-2 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                >
                  Show Error & Refresh
                </button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📈</div>
                <p>{t('openbb.forecast.noData', 'Click "Generate Forecast" to run ML prediction')}</p>
                <p className="text-sm mt-1">{t('openbb.forecast.description', 'Uses LSTM model to predict volatility trends')}</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Forecast Result & Visualization Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              {t('openbb.forecast.visualization.title', 'AI Forecast Result & Visualization')}
            </h2>
            <div className="flex items-center space-x-3">
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="border border-gray-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {stockOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={forecastDays}
                onChange={(e) => setForecastDays(parseInt(e.target.value))}
                className="border border-gray-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="3">3 Days</option>
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
              </select>
              <button
                onClick={handleForecastClick}
                disabled={forecastLoading || (optimisticRemaining !== null ? optimisticRemaining : remaining) <= 0 || isConsuming}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  (optimisticRemaining !== null ? optimisticRemaining : remaining) <= 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : (forecastLoading || isConsuming)
                      ? 'bg-blue-400 text-white cursor-wait'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isConsuming
                  ? 'Updating quota...'
                  : forecastLoading
                    ? t('openbb.forecast.generating', 'Generating...')
                    : t('openbb.forecast.runAI', 'Run AI Forecast')
                }
              </button>
              <button
                onClick={() => showToast('Compare Models feature coming soon!', 'info')}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('openbb.forecast.compareModels', 'Compare Models')}
              </button>
            </div>
          </div>

          {/* Quota Consumption Progress Bar */}
          <div className="mb-6">
            {quotaLoading ? (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Loading quota information...</span>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              </div>
            ) : quotaError ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-red-600 font-medium">Unable to fetch quota</span>
                  <button
                    onClick={refetchQuota}
                    className="px-3 py-2 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm space-y-3 sm:space-y-0">
                  <div className="flex items-center justify-between sm:justify-start sm:space-x-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">Used:</span>
                      <span className="font-mono font-medium text-gray-900">
                        {used} / {limit} tokens
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-600">Remaining:</span>
                      <span className={`font-mono font-medium ${
                        (optimisticRemaining !== null ? optimisticRemaining : remaining) <= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {optimisticRemaining !== null ? optimisticRemaining : remaining}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      syncStatus.color === 'green' ? 'bg-green-100 text-green-800' :
                      syncStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {syncStatus.icon} {syncStatus.text}
                    </span>
                  </div>
                </div>

                {/* Enhanced Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Quota Usage Progress</span>
                    <span>{Math.round((used / limit) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        (used / limit) > 0.8 ? 'bg-red-500' :
                        (used / limit) > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((used / limit) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0</span>
                    <span>{limit} tokens</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Forecast Visualization Content */}
          {forecastLoading ? (
            <div className="space-y-6">
              <LoadingSkeleton height="h-64" />
              <LoadingSkeleton height="h-48" />
            </div>
          ) : forecastError ? (
            <ErrorFallback
              error={forecastError}
              onRetry={refetchForecastQuery}
              title={t('openbb.forecast.visualization.error', 'Forecast visualization unavailable')}
            />
          ) : forecastData?.data ? (
            <div className="space-y-6">
              {/* Dual Chart Container */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Actual vs Forecast Prices - Line Chart */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {t('openbb.forecast.priceComparison', 'Actual vs Forecast Prices')}
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={forecastData.data?.forecast_prices?.map ? forecastData.data.forecast_prices.map((price, index) => ({
                          day: `Day ${index + 1}`,
                          actual: price.actual || price.historical,
                          forecast: price.forecast,
                          confidence: price.confidence || 0.8
                        })) : []}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                        <XAxis
                          dataKey="day"
                          stroke="#6b7280"
                          fontSize={12}
                        />
                        <YAxis
                          stroke="#6b7280"
                          fontSize={12}
                          label={{ value: 'Price ($)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            `$${typeof value === 'number' ? value.toFixed(2) : value}`,
                            name === 'actual' ? 'Actual Price' : 'Forecast Price'
                          ]}
                          labelStyle={{ color: '#374151' }}
                          contentStyle={{
                            backgroundColor: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="actual"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                          name="actual"
                        />
                        <Line
                          type="monotone"
                          dataKey="forecast"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                          name="forecast"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Confidence Intervals - Bar Chart */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {t('openbb.forecast.confidenceIntervals', 'Forecast Confidence Intervals')}
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={forecastData.data?.forecast_prices?.map ? forecastData.data.forecast_prices.map((price, index) => ({
                          day: `Day ${index + 1}`,
                          confidence: (price.confidence || 0.8) * 100,
                          upper: price.upper_bound || price.forecast * 1.05,
                          lower: price.lower_bound || price.forecast * 0.95,
                          forecast: price.forecast
                        })) : []}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                        <XAxis
                          dataKey="day"
                          stroke="#6b7280"
                          fontSize={12}
                        />
                        <YAxis
                          stroke="#6b7280"
                          fontSize={12}
                          label={{ value: 'Confidence (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            name === 'confidence' ? `${value.toFixed(1)}%` : `$${typeof value === 'number' ? value.toFixed(2) : value}`,
                            name === 'confidence' ? 'Confidence' :
                            name === 'upper' ? 'Upper Bound' :
                            name === 'lower' ? 'Lower Bound' : 'Forecast'
                          ]}
                          labelStyle={{ color: '#374151' }}
                          contentStyle={{
                            backgroundColor: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar
                          dataKey="confidence"
                          fill="#8b5cf6"
                          radius={[4, 4, 0, 0]}
                          name="confidence"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Forecast Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Avg Confidence</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {forecastData.data?.avg_confidence ?
                          `${(forecastData.data.avg_confidence * 100).toFixed(1)}%` :
                          `${(forecastData.data.confidence * 100).toFixed(1)}%`
                        }
                      </p>
                    </div>
                    <div className="text-blue-500 text-2xl">🎯</div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">Forecast Signal</p>
                      <p className={`text-2xl font-bold ${
                        forecastData.data.signal === 'BUY' ? 'text-green-900' :
                        forecastData.data.signal === 'SELL' ? 'text-red-900' : 'text-yellow-900'
                      }`}>
                        {forecastData.data.signal}
                      </p>
                    </div>
                    <div className="text-green-500 text-2xl">
                      {forecastData.data.signal === 'BUY' ? '📈' :
                       forecastData.data.signal === 'SELL' ? '📉' : '⚖️'}
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">Model Source</p>
                      <p className="text-lg font-bold text-purple-900">
                        {forecastData.data.source || 'LSTM'}
                      </p>
                    </div>
                    <div className="text-purple-500 text-2xl">🤖</div>
                  </div>
                </div>
              </div>

              {/* Detailed Metrics Table */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {t('openbb.forecast.detailedMetrics', 'Detailed Forecast Metrics')}
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 font-medium text-gray-600">Day</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-600">Forecast Price</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-600">Confidence</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-600">Upper Bound</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-600">Lower Bound</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecastData.data?.forecast_prices?.map ?
                        forecastData.data.forecast_prices.slice(0, forecastDays).map((price, index) => (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-2 font-medium">Day {index + 1}</td>
                            <td className="py-2 px-2 text-right font-mono">
                              ${typeof price.forecast === 'number' ? price.forecast.toFixed(2) : 'N/A'}
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                              {typeof price.confidence === 'number' ? `${(price.confidence * 100).toFixed(1)}%` : '80.0%'}
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                              ${typeof price.upper_bound === 'number' ? price.upper_bound.toFixed(2) :
                                (price.forecast * 1.05).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono">
                              ${typeof price.lower_bound === 'number' ? price.lower_bound.toFixed(2) :
                                (price.forecast * 0.95).toFixed(2)}
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="5" className="py-4 text-center text-gray-500">
                              No detailed forecast data available
                            </td>
                          </tr>
                        )
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (optimisticRemaining !== null ? optimisticRemaining : remaining) <= 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                {t('openbb.forecast.quotaExceeded', 'AI Quota Exceeded')}
              </h3>
              <p className="text-gray-600 mb-4">
                {t('openbb.forecast.quotaExceededDesc', 'You\'ve reached your AI analysis limit. Upgrade your plan to access advanced forecasting features.')}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
                <p className="text-red-600 text-sm font-medium">Current Status: {syncStatus.icon} {syncStatus.text}</p>
                <p className="text-red-500 text-sm mt-1">Usage: {used} / {limit} tokens</p>
              </div>
              <button
                onClick={() => {
                  showToast('Please upgrade your plan to continue using AI forecasting.', 'error');
                  refetchQuota();
                }}
                className="mt-4 px-6 py-3 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
              >
                {t('openbb.forecast.upgradePlan', 'Upgrade Plan')}
              </button>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                {t('openbb.forecast.readyToAnalyze', 'Ready to Analyze')}
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {t('openbb.forecast.readyToAnalyzeDesc', 'Click "Run AI Forecast" to generate detailed price predictions and confidence intervals for the selected stock.')}
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-sm mx-auto">
                <p className="text-blue-600 text-sm">
                  💡 {t('openbb.forecast.tip', 'Tip: Select your preferred stock and forecast horizon above, then click Run AI Forecast')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default OpenBBDashboard;

// ===== REGRESSION TESTS (Development Only) =====
if (import.meta.env.MODE === 'development' && (import.meta.env.VITE_RUN_AI_TESTS || 'false') === 'true') {
  console.log('🧪 Running AI Quota Regression Tests...');

  const runTests = async () => {
    // Test 1: Valid quota consumption
    try {
      console.log('🧪 Test 1: Valid quota consumption');
      const testResult = await consumeQuotaSafe(25);
      console.log('✅ Test 1 Result:', testResult);
    } catch (error) {
      console.error('❌ Test 1 Failed:', error);
    }

    // Test 2: Invalid quota consumption
    try {
      console.log('🧪 Test 2: Invalid quota consumption (negative tokens)');
      const testResult = await consumeQuotaSafe(-10);
      console.log('✅ Test 2 Result:', testResult);
    } catch (error) {
      console.error('❌ Test 2 Failed:', error);
    }

    // Test 3: Network error handling
    try {
      console.log('🧪 Test 3: Network error handling (simulated)');
      const testResult = await consumeQuotaSafe(10);
      console.log('✅ Test 3 Result:', testResult);
    } catch (error) {
      console.error('❌ Test 3 Failed:', error);
    }
  };

  setTimeout(runTests, 2000);
}
