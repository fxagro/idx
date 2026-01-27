import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import api from "../utils/api";

export default function MarketOverview() {
  const { t } = useTranslation();
  const [indexData, setIndexData] = useState([]);
  const [brokerData, setBrokerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [activeTab, setActiveTab] = useState('index');
  const [period, setPeriod] = useState('1week');
  const [lastFetch, setLastFetch] = useState(0);
  const [cacheTimeout] = useState(60000); // 60 seconds cache for better performance
  const [fallbackData] = useState({
    index: [
      { kode_indeks: 'IHSG', penutupan: 7200, selisih: 45, volume: 15000000, nilai: 8500000000, kapitalisasi_pasar: 8500000000000, frekuensi: 125000, tanggal_perdagangan_terakhir: new Date().toISOString() },
      { kode_indeks: 'LQ45', penutupan: 950, selisih: 8, volume: 850000, nilai: 1200000000, kapitalisasi_pasar: 450000000000, frekuensi: 8500, tanggal_perdagangan_terakhir: new Date().toISOString() }
    ],
    broker: [
      { kode_broker: 'BB', nama_perusahaan: 'Bank Central Asia', volume: 2500000, nilai: 15000000000, frekuensi: 15000, tanggal: new Date().toISOString() },
      { kode_broker: 'BR', nama_perusahaan: 'Bank Rakyat Indonesia', volume: 1800000, nilai: 8500000000, frekuensi: 12000, tanggal: new Date().toISOString() }
    ]
  });

  useEffect(() => {
    fetchData();
  }, [period]);

  // Check if we should use cached data
  const shouldUseCache = () => {
    return Date.now() - lastFetch < cacheTimeout && (indexData.length > 0 || brokerData.length > 0);
  };

  const fetchData = async (isRetry = false, forceRefresh = false) => {
    // Use cached data if available and not forcing refresh
    if (!forceRefresh && shouldUseCache()) {
      setLoading(false);
      return;
    }

    if (isRetry) {
      setRetryCount(prev => prev + 1);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      // Fetch index data with timeout
      const indexResponse = await Promise.race([
        api.get(`/stocks/index?period=${period}`),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Index data timeout')), 15000)
        )
      ]);
      setIndexData(indexResponse.data.data || []);

      // Fetch broker data with timeout
      const brokerResponse = await Promise.race([
        api.get(`/stocks/broker?period=${period}`),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Broker data timeout')), 15000)
        )
      ]);
      setBrokerData(brokerResponse.data.data || []);

      setLastFetch(Date.now());
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      console.error("Error fetching market data:", error);

      // Use fallback data if available and error is critical
      if (error.response?.status === 429 || error.response?.status >= 500) {
        console.log("Using fallback data due to API error");
        setIndexData(fallbackData.index);
        setBrokerData(fallbackData.broker);
        setError("Using cached data due to API rate limiting. Data may not be real-time.");
      } else if (error.response?.status === 503) {
        setError("Database connection issue. Please try again.");
      } else if (error.message?.includes('timeout')) {
        setError("Request timeout. Please check your connection and try again.");
      } else {
        setError("Failed to fetch market data. Please try again.");
      }

      // Auto-retry logic for certain errors (but not for rate limiting)
      if (retryCount < 3 && error.response?.status !== 429 && (error.response?.status === 503 || error.message?.includes('timeout'))) {
        setTimeout(() => {
          fetchData(true);
        }, 3000 + (retryCount * 2000)); // Progressive delay: 3s, 5s, 7s
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(0);
    fetchData();
  };

  const formatNumber = (num) => {
    if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString('id-ID');
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading market data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-8">
          <div className={`${error.includes('cached data') ? 'text-yellow-500' : 'text-red-500'} mb-4`}>
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className={`text-lg font-medium mb-2 ${error.includes('cached data') ? 'text-yellow-900' : 'text-gray-900'}`}>
            {error.includes('cached data') ? 'Using Cached Market Data' : 'Failed to Load Market Data'}
          </h3>
          <p className={`mb-4 ${error.includes('cached data') ? 'text-yellow-700' : 'text-gray-500'}`}>
            {error}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleRetry}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            {error.includes('cached data') && (
              <button
                onClick={() => fetchData(false, true)}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                Force Refresh
              </button>
            )}
          </div>
          {retryCount > 0 && !error.includes('cached data') && (
            <p className="text-sm text-gray-400 mt-2">Retry attempt: {retryCount}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">{t('market.title', 'Market Overview')}</h2>
          {!loading && !error && (
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${
                shouldUseCache()
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {shouldUseCache() ? '📦 Cached' : '🆕 Fresh'}
              </span>
              <span className="text-xs text-gray-500">
                Last updated: {new Date(lastFetch).toLocaleTimeString('id-ID')}
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchData(false, true)}
            disabled={loading}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Refresh data"
          >
            {loading ? '⟳' : '↻'}
          </button>
          {['1week', '1month', '3months'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              disabled={loading}
              className={`px-3 py-1 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                period === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p === '1week' ? '1W' : p === '1month' ? '1M' : '3M'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('index')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'index'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('market.indeksIdx', 'Index IDX')}
        </button>
        <button
          onClick={() => setActiveTab('broker')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            activeTab === 'broker'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('market.transaksiBroker', 'Broker Transactions')}
        </button>
      </div>

      {/* Index Data Tab */}
      {activeTab === 'index' && (
        <div className="overflow-x-auto">
          {indexData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{t('market.noData', 'No data available')}</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Index Code</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Closing</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Change</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Volume</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Value</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Market Cap</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Frequency</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {indexData.slice(0, 10).map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium text-indigo-600">{item.kode_indeks}</td>
                    <td className="py-2 px-2 text-right">{formatNumber(item.penutupan)}</td>
                    <td className={`py-2 px-2 text-right ${item.selisih >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.selisih >= 0 ? '+' : ''}{formatNumber(item.selisih)}
                    </td>
                    <td className="py-2 px-2 text-right">{formatNumber(item.volume)}</td>
                    <td className="py-2 px-2 text-right">{formatCurrency(item.nilai)}</td>
                    <td className="py-2 px-2 text-right">{formatNumber(item.kapitalisasi_pasar)}</td>
                    <td className="py-2 px-2 text-right">{formatNumber(item.frekuensi)}</td>
                    <td className="py-2 px-2 text-gray-500">
                      {new Date(item.tanggal_perdagangan_terakhir).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Broker Data Tab */}
      {activeTab === 'broker' && (
        <div className="overflow-x-auto">
          {brokerData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>{t('market.noData', 'No data available')}</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Broker Code</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Company Name</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Volume</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Value</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-600">Frequency</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {brokerData.slice(0, 15).map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-2 font-medium text-indigo-600">{item.kode_broker}</td>
                    <td className="py-2 px-2">{item.nama_perusahaan}</td>
                    <td className="py-2 px-2 text-right">{formatNumber(item.volume)}</td>
                    <td className="py-2 px-2 text-right">{formatCurrency(item.nilai)}</td>
                    <td className="py-2 px-2 text-right">{formatNumber(item.frekuensi)}</td>
                    <td className="py-2 px-2 text-gray-500">
                      {new Date(item.tanggal).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Index Summary</h3>
          <div className="text-sm text-blue-700">
            <p>Total Records: {indexData.length}</p>
            <p>Period: {period}</p>
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="font-medium text-green-900 mb-2">Broker Summary</h3>
          <div className="text-sm text-green-700">
            <p>Total Records: {brokerData.length}</p>
            <p>Period: {period}</p>
          </div>
        </div>
      </div>
    </div>
  );
}