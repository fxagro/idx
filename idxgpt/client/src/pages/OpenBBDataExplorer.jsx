import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
   Pie,
   AreaChart,
   Area
 } from 'recharts';
import api from '../utils/api';

// Import child components (we'll create these next)
import DataCategorySelector from '../components/DataExplorer/DataCategorySelector';
import DataExplorerTable from '../components/DataExplorer/DataExplorerTable';
import DataExplorerChart from '../components/DataExplorer/DataExplorerChart';

// ===== CONSTANTS =====

const DATA_CATEGORIES = {
  stocks: {
    key: 'stocks',
    label: 'Stocks',
    icon: '📊',
    apiEndpoint: '/stocks/openbb/stocks',
    color: 'blue'
  },
  etfs: {
    key: 'etfs',
    label: 'ETFs',
    icon: '📈',
    apiEndpoint: '/stocks/openbb/etf',
    color: 'green'
  },
  crypto: {
    key: 'crypto',
    label: 'Crypto',
    icon: '₿',
    apiEndpoint: '/stocks/openbb/crypto',
    color: 'orange'
  },
  forex: {
    key: 'forex',
    label: 'Forex',
    icon: '💱',
    apiEndpoint: '/stocks/openbb/forex',
    color: 'purple'
  },
  commodities: {
    key: 'commodities',
    label: 'Commodities',
    icon: '🏗️',
    apiEndpoint: '/stocks/openbb/commodities',
    color: 'yellow'
  },
  economy: {
    key: 'economy',
    label: 'Economy',
    icon: '🏛️',
    apiEndpoint: '/stocks/openbb/economy',
    color: 'indigo'
  },
  portfolio: {
    key: 'portfolio',
    label: 'Portfolio',
    icon: '💼',
    apiEndpoint: '/portfolio',
    color: 'teal'
  }
};

const CHART_TYPES = {
  line: { key: 'line', label: 'Line Chart', icon: '📈' },
  area: { key: 'area', label: 'Area Chart', icon: '🏔️' },
  bar: { key: 'bar', label: 'Bar Chart', icon: '📊' },
  candlestick: { key: 'candlestick', label: 'Candlestick', icon: '🕯️' }
};

// ===== MAIN COMPONENT =====

const OpenBBDataExplorer = () => {
  const { t } = useTranslation();

  // ===== STATE MANAGEMENT =====

  const [selectedCategory, setSelectedCategory] = useState('stocks');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSymbols, setSelectedSymbols] = useState([]);
  const [chartType, setChartType] = useState('line');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'chart'
  const [timeframe, setTimeframe] = useState('30');
  const [toast, setToast] = useState(null);
  const [isWatchlistMode, setIsWatchlistMode] = useState(false);

  // ===== DATA FETCHING =====

  // Market Overview Query
  const {
    data: marketData,
    isLoading: marketLoading,
    error: marketError,
    refetch: refetchMarket
  } = useQuery({
    queryKey: ['openbb-market-overview'],
    queryFn: async () => {
      const response = await api.get('/stocks/openbb/market');
      return response.data;
    },
    staleTime: 30000,
    gcTime: 300000,
    refetchInterval: 60000, // Refresh every minute
    retry: (failureCount, error) => {
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Category Data Query
  const {
    data: categoryData,
    isLoading: categoryLoading,
    error: categoryError,
    refetch: refetchCategory
  } = useQuery({
    queryKey: ['openbb-category-data', selectedCategory, searchQuery],
    queryFn: async () => {
      const endpoint = DATA_CATEGORIES[selectedCategory]?.apiEndpoint;
      if (!endpoint) return [];

      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);

      // Only add query string if params exist
      const queryString = params.toString();
      const url = queryString ? `${endpoint}?${queryString}` : endpoint;

      const response = await api.get(url);
      return response.data?.data || response.data || [];
    },
    enabled: !!selectedCategory,
    staleTime: 15000, // 15 seconds for category data
    gcTime: 300000,
    retry: (failureCount, error) => {
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Chart Data Query (for selected symbols)
  const {
    data: chartData,
    isLoading: chartLoading,
    error: chartError,
    refetch: refetchChart
  } = useQuery({
    queryKey: ['openbb-chart-data', selectedSymbols, timeframe],
    queryFn: async () => {
      if (selectedSymbols.length === 0) return {};

      const chartPromises = selectedSymbols.map(async (symbol) => {
        try {
          const response = await api.get(`/stocks/openbb/chart/${symbol}?days=${timeframe}`);
          return {
            symbol,
            data: response.data?.data || []
          };
        } catch (error) {
          console.error(`Error fetching chart data for ${symbol}:`, error);
          return { symbol, data: [], error: error.message };
        }
      });

      const results = await Promise.all(chartPromises);
      return Object.fromEntries(results.map(result => [result.symbol, result]));
    },
    enabled: selectedSymbols.length > 0 && viewMode === 'chart',
    staleTime: 60000,
    gcTime: 600000,
  });

  // ===== COMPUTED VALUES =====

  // Filtered data based on search query
  const filteredData = useMemo(() => {
    if (!categoryData) return [];

    if (!searchQuery) return categoryData;

    return categoryData.filter(item => {
      const symbol = item.symbol?.toLowerCase() || '';
      const name = item.name?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();

      return symbol.includes(query) || name.includes(query);
    });
  }, [categoryData, searchQuery]);

  // Chart data formatted for visualization
  const formattedChartData = useMemo(() => {
    if (!chartData || Object.keys(chartData).length === 0) return [];

    // Get all unique dates from all symbols
    const allDates = new Set();
    Object.values(chartData).forEach(symbolData => {
      if (symbolData.data) {
        symbolData.data.forEach(item => allDates.add(item.date));
      }
    });

    const sortedDates = Array.from(allDates).sort();

    // Format data for each date
    return sortedDates.map(date => {
      const dataPoint = { date };

      Object.entries(chartData).forEach(([symbol, symbolData]) => {
        if (symbolData.data) {
          const dayData = symbolData.data.find(item => item.date === date);
          if (dayData) {
            dataPoint[`${symbol}_close`] = dayData.close;
            dataPoint[`${symbol}_volume`] = dayData.volume;
          }
        }
      });

      return dataPoint;
    });
  }, [chartData]);

  // Market stats for display
  const marketStats = useMemo(() => {
    if (!marketData?.data) return [];

    return [
      {
        title: t('dataExplorer.market.totalStocks', 'Total Instruments'),
        value: marketData.data.totalStocks || 'N/A',
        icon: '📊',
        color: 'blue',
        change: marketData.data.totalStocksChange
      },
      {
        title: t('dataExplorer.market.gainers', 'Gainers'),
        value: marketData.data.gainers || 'N/A',
        icon: '📈',
        color: 'green',
        change: marketData.data.gainersChange
      },
      {
        title: t('dataExplorer.market.losers', 'Losers'),
        value: marketData.data.losers || 'N/A',
        icon: '📉',
        color: 'red',
        change: marketData.data.losersChange
      },
      {
        title: t('dataExplorer.market.volume', 'Total Volume'),
        value: marketData.data.totalVolume ? `${(marketData.data.totalVolume / 1000000).toFixed(1)}M` : 'N/A',
        icon: '📊',
        color: 'purple',
        change: marketData.data.volumeChange
      }
    ];
  }, [marketData, t]);

  // ===== EVENT HANDLERS =====

  const handleCategoryChange = useCallback((category) => {
    setSelectedCategory(category);
    setSearchQuery('');
    setSelectedSymbols([]);
    setViewMode('table');
  }, []);

  const handleSymbolSelect = useCallback((symbol) => {
    setSelectedSymbols(prev => {
      if (prev.includes(symbol)) {
        return prev.filter(s => s !== symbol);
      } else {
        return [...prev, symbol];
      }
    });
  }, []);

  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  const handleAddToWatchlist = useCallback(async (symbol) => {
    try {
      await api.post('/watchlist', { symbol });
      showToast(`${symbol} added to watchlist`, 'success');
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      showToast('Failed to add to watchlist', 'error');
    }
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ===== UI COMPONENTS =====

  const ErrorFallback = ({ error, onRetry, title }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-center">
        <span className="text-red-600 mr-2">⚠️</span>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {title || t('dataExplorer.errors.dataUnavailable', 'Data unavailable')}
          </h3>
          <p className="text-sm text-red-700 mt-1">
            {error?.message || t('dataExplorer.errors.generic', 'Unable to load data')}
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

  const LoadingSkeleton = ({ height = 'h-32' }) => (
    <div className={`${height} bg-gray-200 animate-pulse rounded-lg`}></div>
  );

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

        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {t('dataExplorer.title', 'OpenBB Data Explorer')}
              </h1>
              <p className="text-gray-600">
                {t('dataExplorer.subtitle', 'Browse and visualize financial data from multiple sources')}
              </p>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleViewModeChange('table')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📋 {t('dataExplorer.view.table', 'Table')}
                </button>
                <button
                  onClick={() => handleViewModeChange('chart')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'chart'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📊 {t('dataExplorer.view.chart', 'Chart')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Market Overview Cards */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">
              {t('dataExplorer.market.title', 'Market Overview')}
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
              title={t('dataExplorer.market.error', 'Market data unavailable')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {marketStats.map((stat, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      {stat.change && (
                        <p className={`text-sm ${stat.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stat.change >= 0 ? '+' : ''}{stat.change.toFixed(2)}%
                        </p>
                      )}
                    </div>
                    <div className="text-2xl">{stat.icon}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Category Selector */}
          <div className="lg:col-span-1">
            <DataCategorySelector
              categories={DATA_CATEGORIES}
              selectedCategory={selectedCategory}
              onCategoryChange={handleCategoryChange}
              isWatchlistMode={isWatchlistMode}
              onWatchlistToggle={setIsWatchlistMode}
            />
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Search and Controls */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                {/* Search Bar */}
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder={t('dataExplorer.search.placeholder', 'Search by symbol or name...')}
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Chart Type Selector (Chart Mode) */}
                {viewMode === 'chart' && (
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    {Object.entries(CHART_TYPES).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setChartType(key)}
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          chartType === key
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {config.icon} {config.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Timeframe Selector (Chart Mode) */}
                {viewMode === 'chart' && (
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                    <option value="180">180 Days</option>
                  </select>
                )}
              </div>
            </div>

            {/* Data Display */}
            {viewMode === 'table' ? (
              <DataExplorerTable
                data={filteredData}
                loading={categoryLoading}
                error={categoryError}
                onRetry={refetchCategory}
                selectedSymbols={selectedSymbols}
                onSymbolSelect={handleSymbolSelect}
                onAddToWatchlist={handleAddToWatchlist}
                category={selectedCategory}
              />
            ) : (
              <DataExplorerChart
                data={formattedChartData}
                loading={chartLoading}
                error={chartError}
                onRetry={refetchChart}
                chartType={chartType}
                selectedSymbols={selectedSymbols}
                timeframe={timeframe}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpenBBDataExplorer;