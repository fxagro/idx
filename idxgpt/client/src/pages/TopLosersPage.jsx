import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { safeArray, safeLength, safeMap, safeGet } from '../utils/safeData';
import { TrendingDown, RefreshCw } from 'lucide-react';

export default function TopLosersPage() {
  const { t } = useTranslation();
  const [losers, setLosers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mock data for development (can be removed when backend API is ready)
  const mockLosers = [
    { symbol: 'ANTM', name: 'Aneka Tambang', price: 2100, change: -4.2 },
    { symbol: 'INCO', name: 'Vale Indonesia', price: 4500, change: -3.8 },
    { symbol: 'PTBA', name: 'Bukit Asam', price: 2800, change: -3.5 },
    { symbol: 'ADRO', name: 'Adaro Energy', price: 3200, change: -3.1 },
    { symbol: 'ITMG', name: 'Indo Tambangraya', price: 18500, change: -2.9 },
  ];

  const fetchTopLosers = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to fetch from API first
      const response = await api.get('/stocks/top-losers');
      setLosers(safeArray(response.data));
    } catch (err) {
      console.error('Failed to fetch top losers:', err);
      // Use mock data if API fails
      setLosers(mockLosers);
      setError('Using mock data - API endpoint not available');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopLosers();
  }, []);

  const formatPrice = (price) => {
    return (price || 0).toLocaleString?.('id-ID') ?? '0';
  };

  const formatChange = (change) => {
    const numChange = Number(change) || 0;
    return `${numChange.toFixed(2)}%`;
  };

  const getChangeClass = (change) => {
    const numChange = Number(change) || 0;
    return numChange >= 0
      ? 'text-green-600 font-bold'
      : 'text-red-600 font-bold';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading top losers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
                <TrendingDown className="h-8 w-8 text-red-600 mr-3" />
                {t('topLosers.title', 'Top Losers')}
              </h1>
              <p className="text-gray-600">
                {t('topLosers.subtitle', 'Stocks with the highest percentage decrease today')}
              </p>
            </div>
            <button
              onClick={fetchTopLosers}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{t('common.refresh', 'Refresh')}</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <span className="text-orange-600">⚠️</span>
              <span className="text-orange-800">{error}</span>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {safeLength(losers) === 0 ? (
            <div className="text-center py-12">
              <TrendingDown className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No Top Losers data available</p>
              <p className="text-sm text-gray-400 mt-1">Please try refreshing the page</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('topLosers.table.symbol', 'Symbol')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('topLosers.table.name', 'Name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('topLosers.table.price', 'Price')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('topLosers.table.change', '% Change')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {safeMap(losers, (stock, index) => (
                    <tr key={safeGet(stock, 'symbol', index)} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {safeGet(stock, 'symbol', '-')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {safeGet(stock, 'name', '-')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          Rp {formatPrice(safeGet(stock, 'price'))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${getChangeClass(safeGet(stock, 'change'))}`}>
                          {formatChange(safeGet(stock, 'change'))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}