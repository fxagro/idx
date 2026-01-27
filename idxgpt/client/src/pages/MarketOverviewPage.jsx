import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
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
import { Line } from 'react-chartjs-2';

// Skeleton Loading Component
const SkeletonLoader = ({ className }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

// Skeleton for Table
const TableSkeleton = () => (
  <div className="bg-white rounded-lg shadow-md">
    <div className="p-6 border-b border-gray-200">
      <SkeletonLoader className="h-6 w-40" />
    </div>
    <div className="p-6">
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex space-x-4">
            <SkeletonLoader className="h-4 w-16" />
            <SkeletonLoader className="h-4 w-20" />
            <SkeletonLoader className="h-4 w-24" />
            <SkeletonLoader className="h-4 w-24" />
            <SkeletonLoader className="h-4 w-20" />
            <SkeletonLoader className="h-4 w-24" />
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const MarketOverviewPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('indeks');
  const [indexData, setIndexData] = useState([]);
  const [brokerData, setBrokerData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chartData, setChartData] = useState(null);
  const [dateFilter, setDateFilter] = useState('1week');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Set active tab based on current route
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/broker')) {
      setActiveTab('broker');
    } else {
      setActiveTab('indeks');
    }
  }, [location.pathname]);

  // Fetch data based on active tab
  useEffect(() => {
    if (activeTab === 'indeks') {
      fetchIndexData();
    } else {
      fetchBrokerData();
    }
  }, [activeTab, dateFilter]);

  // Update chart data when index data changes
  useEffect(() => {
    if (indexData.length > 0) {
      updateChartData();
    }
  }, [indexData]);

  const fetchIndexData = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/stocks/index?period=${dateFilter}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIndexData(data.data || []);
      } else {
        setError('Failed to fetch index data');
      }
    } catch (error) {
      setError('Network error occurred');
      console.error('Error fetching index data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrokerData = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/stocks/broker?period=${dateFilter}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBrokerData(data.data || []);
      } else {
        setError('Failed to fetch broker data');
      }
    } catch (error) {
      setError('Network error occurred');
      console.error('Error fetching broker data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateChartData = () => {
    if (indexData.length === 0) return;

    // Group data by index code and get latest date for each
    const latestDataByIndex = {};
    indexData.forEach(item => {
      if (!latestDataByIndex[item.kode_indeks] ||
          new Date(item.tanggal_perdagangan_terakhir) > new Date(latestDataByIndex[item.kode_indeks].tanggal_perdagangan_terakhir)) {
        latestDataByIndex[item.kode_indeks] = item;
      }
    });

    const labels = Object.keys(latestDataByIndex);
    const values = labels.map(label => latestDataByIndex[label].penutupan);

    setChartData({
      labels,
      datasets: [
        {
          label: 'Closing Price',
          data: values,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          tension: 0.1,
        }
      ]
    });
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedBrokerData = React.useMemo(() => {
    if (!sortConfig.key) return brokerData;

    return [...brokerData].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [brokerData, sortConfig]);

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

  const formatChange = (change) => {
    const isPositive = change > 0;
    return (
      <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </span>
    );
  };

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
              {t('navbar.marketOverview', 'Market Overview')}
            </span>
          </nav>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {t('market.title', 'Market Overview')}
              </h1>
              <p className="text-gray-600">
                {t('market.subtitle', 'Real-time market data and broker transaction summary')}
              </p>
            </div>

            {/* Date Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">
                {t('market.dateFilter', 'Period')}:
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1week">1 {t('market.week', 'Week')}</option>
                <option value="1month">1 {t('market.month', 'Month')}</option>
                <option value="3months">3 {t('market.months', 'Months')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('indeks')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'indeks'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t('navbar.indeksIdx', 'Indeks IDX')}
              </button>
              <button
                onClick={() => setActiveTab('broker')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'broker'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t('navbar.transaksiBroker', 'Transaksi Broker')}
              </button>
            </nav>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'indeks' && (
          <div className="space-y-6">
            {/* Index Data Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('market.indeksIdx', 'Indeks IDX')}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('market.indexCode', 'Index Code')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('market.closing', 'Closing')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('market.change', 'Change')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('market.volume', 'Volume')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('market.value', 'Value')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('market.marketCap', 'Market Cap')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      // Loading skeleton
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <SkeletonLoader className="h-4 w-16" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <SkeletonLoader className="h-4 w-20" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <SkeletonLoader className="h-4 w-16" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <SkeletonLoader className="h-4 w-20" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <SkeletonLoader className="h-4 w-24" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <SkeletonLoader className="h-4 w-28" />
                          </td>
                        </tr>
                      ))
                    ) : indexData.length > 0 ? (
                      indexData.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.kode_indeks}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(item.penutupan)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {formatChange(item.selisih)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(item.volume)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(item.nilai)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(item.kapitalisasi_pasar)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                          {t('market.noData', 'No data available')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('market.indexChart', 'Index Performance Chart')}
                </h3>
              </div>
              <div className="p-6">
                {loading ? (
                  <ChartSkeleton />
                ) : chartData ? (
                  <Line
                    data={chartData}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: true,
                          text: 'Index Closing Prices',
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    {t('market.noChartData', 'No chart data available')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'broker' && (
          <div className="space-y-6">
            {/* Broker Data Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('market.transaksiBroker', 'Transaksi Broker')}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('market.brokerCode', 'Broker Code')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('market.companyName', 'Company Name')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('volume')}
                      >
                        {t('market.volume', 'Volume')} {sortConfig.key === 'volume' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('nilai')}
                      >
                        {t('market.value', 'Value')} {sortConfig.key === 'nilai' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('frekuensi')}
                      >
                        {t('market.frequency', 'Frequency')} {sortConfig.key === 'frekuensi' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      // Loading skeleton
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <SkeletonLoader className="h-4 w-16" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <SkeletonLoader className="h-4 w-32" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <SkeletonLoader className="h-4 w-20" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <SkeletonLoader className="h-4 w-24" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <SkeletonLoader className="h-4 w-16" />
                          </td>
                        </tr>
                      ))
                    ) : sortedBrokerData.length > 0 ? (
                      sortedBrokerData.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.kode_broker}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.nama_perusahaan}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(item.volume)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(item.nilai)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatNumber(item.frekuensi)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                          {t('market.noData', 'No data available')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketOverviewPage;