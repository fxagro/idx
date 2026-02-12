import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
} from 'chart.js';
import api from '../utils/api';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const StocklistPage = () => {
  const { t } = useTranslation();
  const [socket, setSocket] = useState(null);
  const [realTimePrices, setRealTimePrices] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('symbol');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedStock, setSelectedStock] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [watchlistSymbols, setWatchlistSymbols] = useState(new Set());
  const [isInWatchlist, setIsInWatchlist] = useState(false);

  // Fetch stock list data
  const {
    data: stockList,
    isLoading: stockListLoading,
    error: stockListError,
    refetch: refetchStockList
  } = useQuery({
    queryKey: ['stockList', sortBy, sortOrder, searchTerm],
    queryFn: async () => {
      const params = {
        sortBy,
        sortOrder,
        search: searchTerm,
        limit: 100
      };
      const response = await api.get('/stocks/list', { params });
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
    meta: {
      onError: (error) => {
        console.error('[StocklistPage] Error fetching stock list:', error);
      }
    }
  });

  // Fetch market indices for overview widget
  const {
    data: marketIndices,
    isLoading: indicesLoading
  } = useQuery({
    queryKey: ['marketIndices'],
    queryFn: async () => {
      const response = await api.get('/stocks/indices');
      return response.data;
    },
    refetchInterval: 60000, // Refetch every minute
    retry: 3
  });

  // Initialize WebSocket connection for real-time price updates
  useEffect(() => {
    console.log('[StocklistPage] Initializing WebSocket connection');

    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('price_update', (data) => {
      console.log('[StocklistPage] Received price update:', data);
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
      console.log('[StocklistPage] WebSocket connected');
    });

    newSocket.on('disconnect', () => {
      console.log('[StocklistPage] WebSocket disconnected');
    });

    return () => {
      console.log('[StocklistPage] Cleaning up WebSocket connection');
      newSocket.close();
    };
  }, []);

  // Get real-time price for a symbol
  const getRealTimePrice = useCallback((symbol) => {
    return realTimePrices[symbol] || null;
  }, [realTimePrices]);

  // Handle stock click to open modal
  const handleStockClick = useCallback(async (stock) => {
    try {
      setSelectedStock(stock);
      setShowModal(true);

      // Check if stock is in watchlist
      const watchlistResponse = await api.get('/stocks/watchlist');
      const watchlistData = watchlistResponse.data || [];
      const isInList = watchlistData.some(item => item.symbol === stock.symbol);
      setIsInWatchlist(isInList);

    } catch (error) {
      console.error('[StocklistPage] Error fetching stock details:', error);
    }
  }, []);

  // Handle watchlist toggle
  const handleWatchlistToggle = useCallback(async () => {
    if (!selectedStock) return;

    try {
      if (isInWatchlist) {
        await api.delete(`/stocks/watchlist/${selectedStock.symbol}`);
        setIsInWatchlist(false);
      } else {
        await api.post('/stocks/watchlist', { symbol: selectedStock.symbol });
        setIsInWatchlist(true);
      }
    } catch (error) {
      console.error('[StocklistPage] Error toggling watchlist:', error);
    }
  }, [selectedStock, isInWatchlist]);

  // Handle AI analysis
  const handleAIAnalysis = useCallback(async () => {
    if (!selectedStock) return;

    try {
      const response = await api.get(`/stocks/ai/analyze?symbol=${selectedStock.symbol}&market=idx`);
      // Handle AI analysis response - could open another modal or show results
      console.log('[StocklistPage] AI Analysis result:', response.data);
    } catch (error) {
      console.error('[StocklistPage] Error getting AI analysis:', error);
    }
  }, [selectedStock]);

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

  // Handle sorting
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Filter and sort stocks
  const filteredStocks = stockList?.stocks?.filter(stock => {
    const realTimePrice = getRealTimePrice(stock.symbol);
    const currentPrice = realTimePrice?.price || stock.price;
    const changePercent = realTimePrice?.changePercent ?? stock.changePercent;

    return stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
           stock.name.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {t('stocklist.title', 'Stock List')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('stocklist.subtitle', 'Interactive stock table with real-time updates and advanced filtering')}
          </p>
        </div>

        {/* Market Overview Widget */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            🌍 {t('stocklist.marketOverview', 'Market Overview')}
          </h2>
          {indicesLoading ? (
            <div className="text-center py-4">{t('common.loading', 'Loading...')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {marketIndices?.map((index) => (
                <div key={index.code} className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                  <div className="text-sm text-gray-600 mb-1">{index.code}</div>
                  <div className="text-lg font-bold text-gray-800">
                    {formatCurrency(index.close)}
                  </div>
                  <div className={`text-sm font-medium ${index.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPercentage(index.changePercent).value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder={t('stocklist.searchPlaceholder', 'Search by symbol or company name...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="symbol">{t('stocklist.sort.symbol', 'Symbol')}</option>
                <option value="name">{t('stocklist.sort.name', 'Name')}</option>
                <option value="price">{t('stocklist.sort.price', 'Price')}</option>
                <option value="change_percent">{t('stocklist.sort.change', 'Change %')}</option>
                <option value="volume">{t('stocklist.sort.volume', 'Volume')}</option>
                <option value="market_cap">{t('stocklist.sort.marketCap', 'Market Cap')}</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Stock Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {stockListLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('common.loading', 'Loading...')}</p>
            </div>
          ) : stockListError ? (
            <div className="p-8 text-center">
              <div className="text-red-600 text-4xl mb-4">⚠️</div>
              <p className="text-gray-600 mb-4">{t('stocklist.error.loading', 'Failed to load stock data')}</p>
              <button
                onClick={() => refetchStockList()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                {t('common.retry', 'Retry')}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('symbol')}
                    >
                      {t('stocklist.table.symbol', 'Symbol')}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      {t('stocklist.table.company', 'Company')}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('price')}
                    >
                      {t('stocklist.table.price', 'Price')}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('change_percent')}
                    >
                      {t('stocklist.table.change', 'Change %')}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('volume')}
                    >
                      {t('stocklist.table.volume', 'Volume')}
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('market_cap')}
                    >
                      {t('stocklist.table.marketCap', 'Market Cap')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('stocklist.table.actions', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredStocks.map((stock) => {
                    const realTimePrice = getRealTimePrice(stock.symbol);
                    const currentPrice = realTimePrice?.price || stock.price;
                    const changePercent = realTimePrice?.changePercent ?? stock.changePercent;

                    return (
                      <tr key={stock.symbol} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-900">{stock.symbol}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 max-w-xs truncate" title={stock.name}>
                            {stock.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(currentPrice)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-medium ${formatPercentage(changePercent).className}`}>
                            {formatPercentage(changePercent).value}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stock.volume?.toLocaleString() || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stock.marketCap ? formatCurrency(stock.marketCap) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleStockClick(stock)}
                              className="text-blue-600 hover:text-blue-900"
                              title={t('stocklist.actions.details', 'View Details')}
                            >
                              📊
                            </button>
                            <button
                              className="text-green-600 hover:text-green-900"
                              title={t('stocklist.actions.trade', 'Trade')}
                            >
                              💹
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredStocks.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">{t('stocklist.noResults', 'No stocks found matching your criteria')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stock Details Modal */}
        {showModal && selectedStock && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedStock.symbol} - {selectedStock.name}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stock Info */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">{t('stocklist.modal.stockInfo', 'Stock Information')}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('stocklist.modal.currentPrice', 'Current Price')}:</span>
                      <span className="font-medium">{formatCurrency(selectedStock.price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('stocklist.modal.change', 'Change')}:</span>
                      <span className={`font-medium ${formatPercentage(selectedStock.changePercent).className}`}>
                        {formatPercentage(selectedStock.changePercent).value}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('stocklist.modal.volume', 'Volume')}:</span>
                      <span className="font-medium">{selectedStock.volume?.toLocaleString() || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('stocklist.modal.marketCap', 'Market Cap')}:</span>
                      <span className="font-medium">{selectedStock.marketCap ? formatCurrency(selectedStock.marketCap) : 'N/A'}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={handleWatchlistToggle}
                      className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium ${
                        isInWatchlist
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isInWatchlist ? '⭐ ' + t('stocklist.modal.removeFromWatchlist', 'Remove from Watchlist') : '☆ ' + t('stocklist.modal.addToWatchlist', 'Add to Watchlist')}
                    </button>
                    <button
                      onClick={handleAIAnalysis}
                      className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                    >
                      🤖 {t('stocklist.modal.aiAnalysis', 'AI Analysis')}
                    </button>
                  </div>
                </div>

                {/* Candlestick Chart Placeholder */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">{t('stocklist.modal.priceChart', 'Price Chart')}</h4>
                  <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📈</div>
                      <p className="text-gray-600 text-sm">
                        {t('stocklist.modal.chartPlaceholder', 'Candlestick chart will be displayed here')}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {t('stocklist.modal.chartDesc', 'Click to view detailed historical chart')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Educational Tooltips */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">💡 {t('stocklist.modal.educationalTips', 'Educational Tips')}</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• {t('stocklist.modal.tip1', 'Market Cap shows the total value of a company\'s shares')}</p>
                  <p>• {t('stocklist.modal.tip2', 'Volume indicates trading activity and liquidity')}</p>
                  <p>• {t('stocklist.modal.tip3', 'Daily change % helps identify price momentum')}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StocklistPage;