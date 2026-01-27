import React, { useState, useEffect } from "react";
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from "../utils/api";
import { apiClient } from "../utils/apiClient";
import { useApiErrorHandler } from "../hooks/useApiErrorHandler";
import { safeRender } from "../utils/safeRender";
import BandarmologiTable from './BandarmologiTable';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import {
  BarChart,
  Bar as RechartsBar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  Tooltip as RechartsTooltip
} from 'recharts';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function Bandarmologi() {
  const { t } = useTranslation();
  const { handleError } = useApiErrorHandler();
  const [selectedSymbol, setSelectedSymbol] = useState('BBCA');
  const [selectedBroker, setSelectedBroker] = useState(''); // Add missing selectedBroker state
  const [stockChartData, setStockChartData] = useState(null);
  const [stockInfo, setStockInfo] = useState(null);
  const [formData, setFormData] = useState({
    symbol: 'BBCA',
    date: '',
    days: 30
  });
  const [viewType, setViewType] = useState('default');
  const [layoutView, setLayoutView] = useState('old'); // 'old' or 'new'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // New tab state
  const [brokerData, setBrokerData] = useState(null);
  // New Bandarmologi tab state
  const [bandarmologiStock, setBandarmologiStock] = useState('BBCA');
  const [bandarmologiPeriod, setBandarmologiPeriod] = useState('daily');
  const [bandarmologiCustomDays, setBandarmologiCustomDays] = useState(30);
  const [bandarmologiView, setBandarmologiView] = useState('table'); // 'table' or 'chart'
  const [bandarmologiData, setBandarmologiData] = useState(null);
  const [bandarmologiLoading, setBandarmologiLoading] = useState(false);

  // New Broker Data tab state
  const [brokerHoldings, setBrokerHoldings] = useState([]);
  const [brokerLoading, setBrokerLoading] = useState(false);
  const [brokerPeriod, setBrokerPeriod] = useState(30);
  const [brokerView, setBrokerView] = useState('table'); // 'table' or 'chart'

  // Fetch stock symbols from database with company names
  const { data: stockSymbolsData, isLoading: symbolsLoading, error: symbolsError } = useQuery({
    queryKey: ['stockSymbols'],
    queryFn: async () => {
      try {
        const data = await apiClient('/stocks/symbols');
        return data; // Return the full response object with symbols and companies
      } catch (error) {
        console.error('Error fetching stock symbols:', error);
        const errorInfo = handleError(error);
        setError(errorInfo.message);
        return { symbols: [], companies: {} };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract symbols and companies from the response
  const stockSymbols = stockSymbolsData?.symbols || [];

  // Fetch stock companies mapping
  const { data: stockCompaniesData, isLoading: companiesLoading, error: companiesError } = useQuery({
    queryKey: ['stockCompanies'],
    queryFn: async () => {
      try {
        const data = await apiClient('/stocks/symbols');
        return data.companies || {};
      } catch (error) {
        console.error('Error fetching stock companies:', error);
        const errorInfo = handleError(error);
        setError(errorInfo.message);
        return {};
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch stock chart data
  const { data: chartData, isLoading: chartLoading, error: chartError } = useQuery({
    queryKey: ['stockChart', selectedSymbol],
    queryFn: async () => {
      try {
        return await apiClient(`/stocks/price/${selectedSymbol}?market=idx&days=30`);
      } catch (error) {
        console.error('Error fetching stock chart data:', error);
        const errorInfo = handleError(error);
        setError(errorInfo.message);
        return null;
      }
    }
  });

  // Fetch stock info
  const { data: stockInfoData, isLoading: stockInfoLoading, error: stockInfoError } = useQuery({
    queryKey: ['stockInfo', selectedSymbol],
    queryFn: async () => {
      try {
        const data = await apiClient(`/stocks/bandar?symbol=${selectedSymbol}&days=30`);
        return data.stock_info || null;
      } catch (error) {
        console.error('Error fetching stock info:', error);
        const errorInfo = handleError(error);
        setError(errorInfo.message);
        return null;
      }
    }
  });

  // Fetch top stock data - Show empty state since API doesn't exist
  const { data: topStockData, isLoading: topStockLoading } = useQuery({
    queryKey: ['topStock'],
    queryFn: async () => {
      // Return empty array since API endpoint doesn't exist
      return [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch top broker data - Show empty state since API doesn't exist
  const { data: topBrokerData, isLoading: topBrokerLoading } = useQuery({
    queryKey: ['topBroker', selectedSymbol],
    queryFn: async () => {
      // Return empty array since API endpoint doesn't exist
      return [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch broker summary data - Show empty state since API doesn't exist
  const { data: brokerSummaryData, isLoading: brokerSummaryLoading } = useQuery({
    queryKey: ['brokerSummary', selectedSymbol],
    queryFn: async () => {
      // Return empty object since API endpoint doesn't exist
      return { buy: [], sell: [] };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch trading plan data - Show empty state since API doesn't exist
  const { data: tradingPlanData, isLoading: tradingPlanLoading } = useQuery({
    queryKey: ['tradingPlan'],
    queryFn: async () => {
      // Return empty array since API endpoint doesn't exist
      return [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch main broker analysis data (bandarData)
  const { data: bandarData, isLoading: bandarLoading, error: bandarError } = useQuery({
    queryKey: ['bandarData', selectedSymbol, formData.days],
    queryFn: async () => {
      try {
        const data = await apiClient(`/stocks/bandar?symbol=${selectedSymbol}&days=${formData.days}`);
        return data.brokers || [];
      } catch (error) {
        console.error('Error fetching Bandarmologi data:', error);
        const errorInfo = handleError(error);
        setError(errorInfo.message);
        // Return empty array instead of dummy data
        return [];
      }
    }
  });

  // Fetch broker-specific data
  const { data: brokerSpecificData, isLoading: brokerSpecificLoading } = useQuery({
    queryKey: ['brokerSpecificData', selectedBroker, selectedSymbol],
    queryFn: async () => {
      // Validate broker code before making API call
      const isValidBroker = selectedBroker &&
                           selectedBroker !== "" &&
                           selectedBroker !== "-" &&
                           /^[A-Z]{2}$/.test(selectedBroker);

      if (!isValidBroker) return [];

      try {
        const data = await apiClient(`/stocks/broker-data/${selectedBroker}?symbol=${selectedSymbol}&limit=50`);
        return data.data || [];
      } catch (error) {
        console.error('Error fetching broker-specific data:', error);
        // Set error state for better user feedback
        const errorInfo = handleError(error);
        setError(errorInfo.message);
        return [];
      }
    },
    enabled: !!selectedBroker && !!selectedSymbol && /^[A-Z]{2}$/.test(selectedBroker)
  });

  // Fetch broker list
  const { data: brokerListData, isLoading: brokerListLoading, error: brokerListError } = useQuery({
    queryKey: ['brokerList'],
    queryFn: async () => {
      try {
        const data = await apiClient('/brokers/list');
        return data.brokers || [];
      } catch (error) {
        console.error('Error fetching broker list:', error);
        const errorInfo = handleError(error);
        setError(errorInfo.message);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract broker list from the response
  const brokerList = brokerListData || [];

  // Fetch broker holdings
  const { data: brokerHoldingsData, isLoading: brokerHoldingsLoading } = useQuery({
    queryKey: ['brokerHoldings', selectedBroker, brokerPeriod],
    queryFn: async () => {
      // Validate broker code before making API call
      const isValidBroker = selectedBroker &&
                           selectedBroker !== "" &&
                           selectedBroker !== "-" &&
                           /^[A-Z]{2}$/.test(selectedBroker);

      if (!isValidBroker) return [];

      try {
        const data = await apiClient(`/stocks/brokers/holdings?broker=${selectedBroker}&days=${brokerPeriod}`);
        return data.holdings || [];
      } catch (error) {
        console.error('Error fetching broker holdings:', error);
        // Set error state for better user feedback
        const errorInfo = handleError(error);
        setError(errorInfo.message);
        return [];
      }
    },
    enabled: !!selectedBroker && /^[A-Z]{2}$/.test(selectedBroker)
  });

  // Extract broker holdings from the response
  const brokerHoldingsList = brokerHoldingsData || [];

  // Format numbers with K, M, B, T suffixes
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString('id-ID');
  };

  // Get broker type badge color and styling
  const getBrokerTypeStyle = (jenisBroker) => {
    switch (jenisBroker?.toLowerCase()) {
      case 'asing':
        return {
          bg: 'bg-orange-100',
          text: 'text-orange-800',
          border: 'border-orange-200',
          dot: 'bg-orange-500',
          label: 'Foreign'
        };
      case 'bumn':
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-800',
          border: 'border-yellow-200',
          dot: 'bg-yellow-500',
          label: 'BUMN'
        };
      case 'lokal retail':
        return {
          bg: 'bg-blue-100',
          text: 'text-blue-800',
          border: 'border-blue-200',
          dot: 'bg-blue-500',
          label: 'Retail'
        };
      case 'institutional':
        return {
          bg: 'bg-purple-100',
          text: 'text-purple-800',
          border: 'border-purple-200',
          dot: 'bg-purple-500',
          label: 'Institutional'
        };
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          border: 'border-gray-200',
          dot: 'bg-gray-500',
          label: 'Unknown'
        };
    }
  };

  // Get broker type label
  const getBrokerTypeLabel = (jenisBroker) => {
    const style = getBrokerTypeStyle(jenisBroker);
    return style.label;
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Fetch broker analysis data
      const response = await apiClient(`/stocks/bandar?symbol=${formData.symbol}&days=${formData.days}`);
      setBandarmologiData(response.brokers || []);
      setSuccessMessage('Data loaded successfully');
    } catch (error) {
      console.error('Error submitting form:', error);
      const errorInfo = handleError(error);
      setError(errorInfo.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Bandarmologi data
  const fetchBandarmologiData = async () => {
    if (!bandarmologiStock) return;

    setBandarmologiLoading(true);
    setError(null);

    try {
      let days = 30;
      switch (bandarmologiPeriod) {
        case 'daily':
          days = 1;
          break;
        case 'weekly':
          days = 7;
          break;
        case 'monthly':
          days = 30;
          break;
        case 'custom':
          days = bandarmologiCustomDays;
          break;
        default:
          days = 30;
      }

      const response = await apiClient(`/stocks/bandar?symbol=${bandarmologiStock}&days=${days}`);
      setBandarmologiData(response.brokers || []);
    } catch (error) {
      console.error('Error fetching Bandarmologi data:', error);
      const errorInfo = handleError(error);
      setError(errorInfo.message);
    } finally {
      setBandarmologiLoading(false);
    }
  };

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

  // Get broker type emoji
  const getBrokerTypeEmoji = (jenisBroker) => {
    switch (jenisBroker?.toLowerCase()) {
      case 'asing':
        return '🌐';
      case 'bumn':
        return '🏛️';
      case 'lokal retail':
        return '🏠';
      case 'institutional':
        return '🏢';
      default:
        return '🏦';
    }
  };


  // Filter and sort broker data
  const filteredBrokerData = bandarmologiData ?
    bandarmologiData
      .filter(item => item.kode_broker &&
                     item.kode_broker !== "-" &&
                     /^[A-Z]{2}$/.test(item.kode_broker))
      .sort((a, b) => Math.abs(b.net_vol || 0) - Math.abs(a.net_vol || 0)) : [];

  // Prepare broker chart data
  const brokerChartData = filteredBrokerData.length > 0 ? {
    labels: filteredBrokerData.map(item => item.kode_broker),
    datasets: [
      {
        label: 'Net Volume',
        data: filteredBrokerData.map(item => item.net_vol || 0),
        backgroundColor: filteredBrokerData.map(item => item.net_vol > 0 ? '#10b981' : '#ef4444'),
        borderColor: filteredBrokerData.map(item => item.net_vol > 0 ? '#059669' : '#dc2626'),
        borderWidth: 1,
      },
    ],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const data = filteredBrokerData[context.dataIndex];
            const netVal = Math.abs((data.net_vol || 0) * (data.net_vol > 0 ? data.buy_avg || 0 : data.sell_avg || 0));
            return [
              `Broker: ${data.kode_broker}`,
              `Buy Freq: ${data.buy_freq || 0}`,
              `Buy Vol: ${formatNumber(data.buy_vol || 0)}`,
              `Buy Avg: Rp ${formatNumber(data.buy_avg || 0)}`,
              `Sell Freq: ${data.sell_freq || 0}`,
              `Sell Vol: ${formatNumber(data.sell_vol || 0)}`,
              `Sell Avg: Rp ${formatNumber(data.sell_avg || 0)}`,
              `Net Vol: ${formatNumber(data.net_vol || 0)}`,
              `Net Val: Rp ${formatNumber(netVal)}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Broker Code'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Net Volume'
        },
        ticks: {
          callback: function(value) {
            return formatNumber(value);
          }
        }
      }
    }
  };

  // Sort data by Net Vol (positive to negative) - filter out invalid brokers
  const sortedBandarData = bandarData ?
    [...bandarData]
      .filter(item => item.kode_broker &&
                     item.kode_broker !== "-" &&
                     /^[A-Z]{2}$/.test(item.kode_broker))
      .sort((a, b) => (b.net_vol || 0) - (a.net_vol || 0)) : [];

  // Calculate Net Val based on Net Vol sign
  const getNetVal = (row) => {
    if (!row.net_vol) return '-';
    const baseValue = row.net_vol > 0 ? row.buy_avg || 0 : row.sell_avg || 0;
    const netVal = row.net_vol * baseValue;
    return netVal >= 1000000 ? `${(netVal / 1000000).toFixed(2)}M` : netVal.toLocaleString();
  };

  // Prepare chart data - filter out invalid brokers
  const validBandarData = bandarData ? bandarData.filter(item =>
    item.kode_broker &&
    item.kode_broker !== "-" &&
    /^[A-Z]{2}$/.test(item.kode_broker)
  ) : [];

  const brokerChartDataOld = validBandarData.length > 0 ? {
    labels: validBandarData.map(item => item.kode_broker),
    datasets: [
      {
        label: 'Net Volume',
        data: validBandarData.map(item => item.net_vol),
        backgroundColor: validBandarData.map(item => getBrokerTypeStyle(item.jenis_broker).dot),
        borderColor: validBandarData.map(item => getBrokerTypeStyle(item.jenis_broker).dot),
        borderWidth: 1,
      },
    ],
  } : null;

  const chartOptionsOld = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const data = bandarData[context.dataIndex];
            return [
              `Broker: ${data.nama_broker} (${data.kode_broker})`,
              `Type: ${data.jenis_broker}`,
              `Buy Vol: ${data.buy_vol.toLocaleString()}`,
              `Sell Vol: ${data.sell_vol.toLocaleString()}`,
              `Net Vol: ${data.net_vol.toLocaleString()}`,
              `Buy Avg: ${data.buy_avg.toLocaleString()}`,
              `Sell Avg: ${data.sell_avg.toLocaleString()}`,
              `Buy %: ${data.buy_percent.toFixed(2)}%`,
              `Sell %: ${data.sell_percent.toFixed(2)}%`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Broker Code'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Net Volume'
        },
        ticks: {
          callback: function(value) {
            return value.toLocaleString();
          }
        }
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{safeRender(t('bandarmologi.title')) || 'Bandarmologi - Broker Analysis'}</h1>

          {/* Layout Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setLayoutView('old')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                layoutView === 'old'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {safeRender(t('bandarmologi.buttons.oldView')) || 'Old View'}
            </button>
            <button
              onClick={() => setLayoutView('new')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                layoutView === 'new'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {safeRender(t('bandarmologi.buttons.newErgonomicView')) || 'New Ergonomic View'}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 {typeof t('bandarmologi.analysis') === 'object' ? 'Analysis' : t('bandarmologi.analysis')}
            </button>
            <button
              onClick={() => setActiveTab('analyze')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analyze'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 {safeRender(t('bandarmologi.analysis')) || 'Analysis'}
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'summary'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📋 {safeRender(t('bandarmologi.summary')) || 'Summary'}
            </button>
            <button
              onClick={() => setActiveTab('trading')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'trading'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🎯 {safeRender(t('bandarmologi.tradingPlan')) || 'Trading Plan'}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ⚙️ {safeRender(t('bandarmologi.settings')) || 'Settings'}
            </button>
            <button
              onClick={() => setActiveTab('brokerData')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'brokerData'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 {safeRender(t('bandarmologi.brokerData')) || 'Broker Data'}
            </button>
            <button
              onClick={() => setActiveTab('brokerHoldings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'brokerHoldings'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🏢 {safeRender(t('bandarmologi.brokerHoldings')) || 'Broker Holdings'}
            </button>
            <button
              onClick={() => setActiveTab('bandarmologi')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bandarmologi'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📈 {safeRender(t('bandarmologi.bandarmologiTab.title')) || 'Bandarmologi Analysis'}
            </button>
          </nav>
        </div>

        {/* New Ergonomic Layout */}
        {layoutView === 'new' && (
          <div className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800">{error.message || t('bandarmologi.errors.apiError')}</p>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800">{successMessage}</p>
              </div>
            )}
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Top Section - 2 Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Stock Chart */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bandarmologi.charts.stock', 'Stock Chart')}</h3>
                    {stockChartData && (
                      <div style={{ height: '300px' }}>
                        <Line data={stockChartData} options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: true },
                            tooltip: { mode: 'index', intersect: false }
                          }
                        }} />
                      </div>
                    )}
                    {stockInfo && (
                      <div className="mt-4 p-3 bg-gray-50 rounded">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{selectedSymbol}</span>
                          <span className="text-lg font-bold text-indigo-600">
                            Rp {stockInfo.closing_price?.toLocaleString() || '0'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Info Cards */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">{t('bandarmologi.charts.info', 'Stock Information')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="text-sm text-blue-600 font-medium">Net Buy</div>
                        <div className="text-xl font-bold text-blue-900">
                          {safeRender(brokerSummaryData?.net_buy) ? formatNumber(brokerSummaryData?.net_buy || 0) : '0'}
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="text-sm text-green-600 font-medium">PBV</div>
                        <div className="text-xl font-bold text-green-900">1.8x</div>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="text-sm text-purple-600 font-medium">Book Value</div>
                        <div className="text-xl font-bold text-purple-900">Rp 82</div>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="text-sm text-orange-600 font-medium">NPM</div>
                        <div className="text-xl font-bold text-orange-900">6.88%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Analyze Tab */}
            {activeTab === 'analyze' && (
              <div className="space-y-6">
                {/* Top Analysis Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Top Buyer */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-green-900 mb-4">{t('bandarmologi.analysis.topBuyer', 'Top Buyer')}</h3>
                    {bandarData && bandarData.length > 0 ? (
                      <div className="space-y-3">
                        {sortedBandarData
                          .filter(item => item.net_vol > 0)
                          .slice(0, 5)
                          .map((item, index) => (
                            <div key={item.kode_broker} className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="text-sm font-medium text-green-700 mr-2">
                                  #{index + 1}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-green-900">
                                    {item.nama_broker || item.kode_broker || 'Unknown Broker'}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getBrokerTypeStyle(item.jenis_broker).bg} ${getBrokerTypeStyle(item.jenis_broker).text} ${getBrokerTypeStyle(item.jenis_broker).border}`}>
                                    {getBrokerTypeLabel(item.jenis_broker)}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-green-600">
                                  {formatNumber(item.net_vol)}
                                </div>
                                <div className="text-xs text-green-500">
                                  Rp {formatNumber(Math.abs(item.net_vol * item.buy_avg))}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-green-600 text-sm">No buyer data available</p>
                    )}
                  </div>

                  {/* Top Seller */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-red-900 mb-4">{t('bandarmologi.analysis.topSeller', 'Top Seller')}</h3>
                    {bandarData && bandarData.length > 0 ? (
                      <div className="space-y-3">
                        {sortedBandarData
                          .filter(item => item.net_vol < 0)
                          .slice(0, 5)
                          .map((item, index) => (
                            <div key={item.kode_broker} className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="text-sm font-medium text-red-700 mr-2">
                                  #{index + 1}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-red-900">
                                    {item.nama_broker || item.kode_broker || 'Unknown Broker'}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getBrokerTypeStyle(item.jenis_broker).bg} ${getBrokerTypeStyle(item.jenis_broker).text} ${getBrokerTypeStyle(item.jenis_broker).border}`}>
                                    {getBrokerTypeLabel(item.jenis_broker)}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-red-600">
                                  {formatNumber(Math.abs(item.net_vol))}
                                </div>
                                <div className="text-xs text-red-500">
                                  Rp {formatNumber(Math.abs(item.net_vol * item.sell_avg))}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-red-600 text-sm">No seller data available</p>
                    )}
                  </div>

                  {/* Net Buyer Count */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">{t('bandarmologi.analysis.buyerCount', 'Net Buyer Count')}</h3>
                    {bandarData && bandarData.length > 0 ? (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-blue-600">
                            {sortedBandarData.filter(item => item.net_vol > 0).length}
                          </div>
                          <div className="text-sm text-blue-500">Net Buyers</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-red-600">
                            {sortedBandarData.filter(item => item.net_vol < 0).length}
                          </div>
                          <div className="text-sm text-red-500">Net Sellers</div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl font-bold text-gray-600">
                            {sortedBandarData.filter(item => item.net_vol === 0).length}
                          </div>
                          <div className="text-sm text-gray-500">Neutral</div>
                        </div>
                        <div className="mt-4 p-3 bg-blue-100 rounded">
                          <div className="text-sm text-blue-800">
                            <strong>Market Sentiment:</strong> {
                              sortedBandarData.filter(item => item.net_vol > 0).length >
                              sortedBandarData.filter(item => item.net_vol < 0).length
                                ? 'Bullish 🟢'
                                : sortedBandarData.filter(item => item.net_vol < 0).length >
                                  sortedBandarData.filter(item => item.net_vol > 0).length
                                ? 'Bearish 🔴'
                                : 'Neutral ⚪'
                            }
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-blue-600 text-sm">No analysis data available</p>
                    )}
                  </div>
                </div>

                {/* Analysis Summary */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bandarmologi.analysis.summary', 'Analysis Summary')}</h3>
                  {bandarData && bandarData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-gray-50 rounded">
                        <div className="text-2xl font-bold text-gray-900">
                          {formatNumber(sortedBandarData.reduce((sum, item) => sum + (item.buy_vol || 0), 0))}
                        </div>
                        <div className="text-sm text-gray-600">{t('bandarmologi.totals.buyVol', 'Total Buy Volume')}</div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded">
                        <div className="text-2xl font-bold text-gray-900">
                          {formatNumber(sortedBandarData.reduce((sum, item) => sum + (item.sell_vol || 0), 0))}
                        </div>
                        <div className="text-sm text-gray-600">{t('bandarmologi.totals.sellVol', 'Total Sell Volume')}</div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded">
                        <div className="text-2xl font-bold text-green-600">
                          {formatNumber(sortedBandarData.reduce((sum, item) => sum + Math.max(0, item.net_vol || 0), 0))}
                        </div>
                        <div className="text-sm text-gray-600">{t('bandarmologi.totals.netBuyVol', 'Net Buy Volume')}</div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded">
                        <div className="text-2xl font-bold text-red-600">
                          {formatNumber(Math.abs(sortedBandarData.reduce((sum, item) => sum + Math.min(0, item.net_vol || 0), 0)))}
                        </div>
                        <div className="text-sm text-gray-600">{t('bandarmologi.totals.netSellVol', 'Net Sell Volume')}</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No summary data available</p>
                  )}
                </div>
              </div>
            )}

            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Stock */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bandarmologi.topStock')}</h3>
                  <BandarmologiTable
                    data={topStockData?.slice(0, 5).map(item => ({
                      saham: item.saham,
                      net_buy: item.net_buy,
                      avg: item.avg,
                      value: item.value,
                      broker: item.broker
                    })) || []}
                    type="stockAnalysis"
                    formatNumber={formatNumber}
                    formatCurrency={formatCurrency}
                    t={t}
                  />
                </div>

                {/* Top Broker */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bandarmologi.topBroker')}</h3>
                  <BandarmologiTable
                    data={topBrokerData?.slice(0, 5).map(item => ({
                      broker: item.broker,
                      net_buy: item.net_buy,
                      total_value: item.total_value,
                      broker_type: item.broker_type
                    })) || []}
                    type="brokerAnalysis"
                    formatNumber={formatNumber}
                    formatCurrency={formatCurrency}
                    t={t}
                  />
                </div>

                {/* Broker Summary */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bandarmologi.brokerSummary')}</h3>
                  {brokerSummaryData && typeof brokerSummaryData === 'object' && !Array.isArray(brokerSummaryData) && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-green-600 mb-2">{t('bandarmologi.buy')}</h4>
                        <BandarmologiTable
                          data={brokerSummaryData.buy?.slice(0, 3).map(item => ({
                            broker: item.broker,
                            lot: item.lot,
                            val: item.val,
                            avg: item.avg
                          })) || []}
                          type="brokerSummary"
                          formatNumber={formatNumber}
                          formatCurrency={formatCurrency}
                          t={t}
                        />
                      </div>
                      <div>
                        <h4 className="font-medium text-red-600 mb-2">{t('bandarmologi.sell')}</h4>
                        <BandarmologiTable
                          data={brokerSummaryData.sell?.slice(0, 3).map(item => ({
                            broker: item.broker,
                            lot: item.lot,
                            val: item.val,
                            avg: item.avg
                          })) || []}
                          type="brokerSummary"
                          formatNumber={formatNumber}
                          formatCurrency={formatCurrency}
                          t={t}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Trading Plan Tab */}
            {activeTab === 'trading' && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bandarmologi.tradingPlan')}</h3>
                <BandarmologiTable
                  data={tradingPlanData || []}
                  type="tradingPlan"
                  formatNumber={formatNumber}
                  formatCurrency={formatCurrency}
                  t={t}
                />

                {/* Submit Button */}
                <div className="mt-6 text-center">
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="px-8 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 font-medium"
                  >
                    {isLoading ? t('common.loading') : t('bandarmologi.submitTradingPlan')}
                  </button>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bandarmologi.settings')}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="symbol" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('bandarmologi.stockSymbol')}
                      </label>
                      <input
                        type="text"
                        id="symbol"
                        name="symbol"
                        value={formData.symbol}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g., BBCA"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('bandarmologi.date')}
                      </label>
                      <input
                        type="date"
                        id="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="days" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('bandarmologi.days')}
                      </label>
                      <input
                        type="number"
                        id="days"
                        name="days"
                        value={formData.days}
                        onChange={handleInputChange}
                        min="1"
                        max="365"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-8 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 font-medium"
                    >
                      {isLoading ? t('bandarmologi.analyzing') : t('bandarmologi.analyze')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Broker Data Tab */}
            {activeTab === 'brokerData' && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bandarmologi.brokerData')}</h3>

                {/* Broker Selection */}
                <div className="mb-4">
                  <label htmlFor="brokerSelect" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('bandarmologi.ui.selectBrokerToViewData')}
                  </label>
                  <select
                    id="brokerSelect"
                    value={selectedBroker}
                    onChange={(e) => setSelectedBroker(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{t('bandarmologi.ui.chooseBroker')}</option>
                    {bandarData && bandarData
                      .filter(broker => broker.kode_broker &&
                                      broker.kode_broker !== "-" &&
                                      /^[A-Z]{2}$/.test(broker.kode_broker))
                      .map((broker, index) => (
                      <option key={broker.kode_broker || `broker-${index}`} value={broker.kode_broker}>
                        {broker.nama_broker || broker.kode_broker || 'Unknown Broker'} ({broker.kode_broker})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Broker Data Table */}
                {selectedBroker && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3">
                      {t('bandarmologi.brokerData')} for {selectedBroker.toUpperCase()}
                    </h4>
                    <BandarmologiTable
                      data={brokerData || []}
                      type="brokerData"
                      formatNumber={formatNumber}
                      formatCurrency={formatCurrency}
                      t={t}
                    />
                  </div>
                )}

                {!selectedBroker && (
                  <div className="text-center py-8 text-gray-500">
                    <p>{t('bandarmologi.ui.pleaseSelectBroker')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Broker Holdings Tab */}
            {activeTab === 'brokerHoldings' && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bandarmologi.brokerHoldings')}</h3>

                {/* Broker Selection and Period Filter */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="brokerHoldingsSelect" className="block text-sm font-medium text-gray-700 mb-1">
                        Select Broker
                      </label>
                      <select
                        id="brokerHoldingsSelect"
                        value={selectedBroker}
                        onChange={(e) => setSelectedBroker(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={brokerListLoading}
                      >
                        <option value="">Choose a broker...</option>
                        {brokerList && brokerList
                          .filter(broker => broker.code &&
                                          broker.code !== "-" &&
                                          /^[A-Z]{2}$/.test(broker.code))
                          .map((broker, index) => (
                          <option key={broker.code || index} value={broker.code}>
                            {broker.name || broker.code} ({broker.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="brokerPeriod" className="block text-sm font-medium text-gray-700 mb-1">
                        Period (Days)
                      </label>
                      <select
                        id="brokerPeriod"
                        value={brokerPeriod}
                        onChange={(e) => setBrokerPeriod(parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value={7}>7 Days</option>
                        <option value={30}>30 Days</option>
                        <option value={90}>90 Days</option>
                        <option value={180}>180 Days</option>
                        <option value={365}>1 Year</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        onClick={() => setBrokerView(brokerView === 'table' ? 'chart' : 'table')}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {brokerView === 'table' ? t('bandarmologi.ui.switchToChartView') : t('bandarmologi.ui.switchToTableView')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Loading State */}
                {brokerLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                      <p className="text-gray-600">{t('bandarmologi.ui.loadingBrokerHoldings')}</p>
                    </div>
                  </div>
                )}

                {/* Table View */}
                {brokerView === 'table' && brokerHoldingsList && !brokerLoading && (
                  brokerHoldingsList.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-2">
                        <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">{t('bandarmologi.ui.noHoldingsDataAvailable')}</h3>
                      <p className="text-gray-500 mb-4">
                        ⚠️ {t('bandarmologi.ui.noStocksHeldByBroker')}
                      </p>
                      <div className="text-sm text-gray-400">
                        <p>{t('bandarmologi.ui.debugInfo')}</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Broker: {selectedBroker}</li>
                          <li>Period: {brokerPeriod} days</li>
                          <li>{t('bandarmologi.ui.tryDifferentBroker')}</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('bandarmologi.ui.stock')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('bandarmologi.ui.buyVol')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('bandarmologi.ui.sellVol')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('bandarmologi.ui.netVol')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('bandarmologi.ui.netVal')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {[...brokerHoldingsList]
                            .sort((a, b) => Math.abs(b.net_val || 0) - Math.abs(a.net_val || 0))
                            .map((item, index) => {
                            const isPositive = item.net_vol > 0;
                            return (
                              <tr key={item.saham || index} className={isPositive ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  <div className="flex items-center">
                                    <div className={`w-3 h-3 rounded-full mr-2 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <div>
                                      <div className="font-semibold">{item.saham}</div>
                                      <div className="text-xs text-gray-500">Stock</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {formatNumber(item.total_buy_vol || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {formatNumber(item.total_sell_vol || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                                  <span className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {isPositive ? '+' : ''}{formatNumber(item.net_vol || 0)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                                  <span className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    Rp {isPositive ? '+' : ''}{formatNumber(item.net_val || 0)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* Chart View */}
                {brokerView === 'chart' && brokerHoldingsList && !brokerLoading && (
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">{t('bandarmologi.ui.holdingsChart')}</h4>
                    <div style={{ height: '400px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={brokerHoldingsList}
                          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="saham"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            fontSize={12}
                            interval={0}
                          />
                          <YAxis
                            tickFormatter={(value) => formatNumber(value)}
                            fontSize={12}
                          />
                          <RechartsTooltip
                            formatter={(value, name, props) => {
                              const item = props.payload;
                              return [
                                `Buy Vol: ${formatNumber(item.total_buy_vol || 0)}`,
                                `Sell Vol: ${formatNumber(item.total_sell_vol || 0)}`,
                                `Net Vol: ${formatNumber(item.net_vol || 0)}`,
                                `Net Val: Rp ${formatNumber(item.net_val || 0)}`
                              ];
                            }}
                            labelFormatter={(label) => `Stock: ${label}`}
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                          />
                          <RechartsBar
                            dataKey="net_val"
                            name="Net Value"
                            radius={[2, 2, 0, 0]}
                          >
                            {brokerHoldingsList.map((entry, index) => (
                              <Cell
                                key={`broker-holdings-cell-${index}`}
                                fill={entry.net_val > 0 ? '#10b981' : '#ef4444'}
                                stroke={entry.net_val > 0 ? '#059669' : '#dc2626'}
                                strokeWidth={1}
                              />
                            ))}
                          </RechartsBar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 text-center">
                      {t('bandarmologi.ui.greenBarsNetBuy')}
                    </div>
                  </div>
                )}

                {!selectedBroker && !brokerLoading && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-lg mb-2">🏢 {t('bandarmologi.ui.brokerHoldingsAnalysis')}</p>
                    <p className="text-sm">{t('bandarmologi.ui.selectBrokerToViewStocks')}</p>
                  </div>
                )}
              </div>
            )}

            {/* Bandarmologi Tab - IMPROVED BROKER ANALYSIS TABLE */}
            {activeTab === 'bandarmologi' && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bandarmologi.bandarmologiTab.title')}</h3>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-800">❌ {error}</p>
                  </div>
                )}

                {/* Filter Section */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label htmlFor="bandarmologiStock" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('bandarmologi.bandarmologiTab.stockCode')}
                      </label>
                      <select
                        id="bandarmologiStock"
                        value={bandarmologiStock}
                        onChange={(e) => setBandarmologiStock(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={symbolsLoading}
                      >
                        <option value="">{t('bandarmologi.ui.selectStock')}</option>
                        {stockSymbols && stockSymbols.map((symbol, index) => (
                          <option key={`${symbol}-${index}`} value={symbol}>
                            {symbol} - {stockCompaniesData[symbol] || 'Unknown Company'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="bandarmologiPeriod" className="block text-sm font-medium text-gray-700 mb-1">
                        {t('bandarmologi.bandarmologiTab.period')}
                      </label>
                      <select
                        id="bandarmologiPeriod"
                        value={bandarmologiPeriod}
                        onChange={(e) => setBandarmologiPeriod(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="daily">Daily (1 day)</option>
                        <option value="weekly">Weekly (7 days)</option>
                        <option value="monthly">Monthly (30 days)</option>
                        <option value="custom">Custom Days</option>
                      </select>
                    </div>

                    {bandarmologiPeriod === 'custom' && (
                      <div>
                        <label htmlFor="bandarmologiCustomDays" className="block text-sm font-medium text-gray-700 mb-1">
                          {t('bandarmologi.ui.customDays')}
                        </label>
                        <input
                          type="number"
                          id="bandarmologiCustomDays"
                          value={bandarmologiCustomDays}
                          onChange={(e) => setBandarmologiCustomDays(parseInt(e.target.value) || 30)}
                          min="1"
                          max="365"
                          placeholder="30"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    <div className="flex items-end">
                      <button
                        onClick={() => fetchBandarmologiData()}
                        disabled={bandarmologiLoading || !bandarmologiStock}
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {bandarmologiLoading ? t('common.loading') : t('bandarmologi.ui.showData')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* View Toggle */}
                {bandarmologiData && (
                  <div className="mb-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBandarmologiView('table')}
                        className={`px-4 py-2 rounded-md font-medium transition-colors ${
                          bandarmologiView === 'table'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {t('bandarmologi.ui.table')}
                      </button>
                      <button
                        onClick={() => setBandarmologiView('chart')}
                        className={`px-4 py-2 rounded-md font-medium transition-colors ${
                          bandarmologiView === 'chart'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {t('bandarmologi.ui.chart')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {bandarmologiLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                      <p className="text-gray-600">{t('bandarmologi.ui.loadingBrokerData')}</p>
                    </div>
                  </div>
                )}

                {/* Table View - IMPROVED WITH PROPER FORMATTING AND STYLING */}
                {bandarmologiView === 'table' && bandarmologiData && !bandarmologiLoading && (
                  bandarmologiData.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-2">
                        <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">{t('bandarmologi.ui.noBrokerDataAvailable')}</h3>
                      <p className="text-gray-500 mb-4">
                        ⚠️ {t('bandarmologi.ui.noBrokerDataForStock', { stock: bandarmologiStock })}
                      </p>
                      <div className="text-sm text-gray-400">
                        <p>{t('bandarmologi.ui.debugInfo')}</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Stock: {bandarmologiStock}</li>
                          <li>Period: {bandarmologiPeriod} ({bandarmologiPeriod === 'custom' ? `${bandarmologiCustomDays} days` : bandarmologiPeriod === 'daily' ? '1 day' : bandarmologiPeriod === 'weekly' ? '7 days' : '30 days'})</li>
                          <li>{t('bandarmologi.ui.tryDifferentStock')}</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Broker
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Buy Freq
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Buy Vol
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Buy Avg
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Buy %
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Sell Freq
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Sell Vol
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Sell Avg
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Sell %
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Net Vol
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Net Val
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {bandarmologiData.map((item, index) => {
                            const isPositive = item.net_vol > 0;
                            const netVal = Math.abs(item.net_vol * (item.net_vol > 0 ? item.buy_avg : item.sell_avg) || 0);
                            return (
                              <tr key={item.kode_broker || `bandarmologi-${index}`} className={isPositive ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100'}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className={`w-3 h-3 rounded-full mr-3 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <div className="text-sm font-semibold text-gray-900">
                                          {item.nama_broker || item.kode_broker || 'Unknown Broker'}
                                        </div>
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getBrokerTypeStyle(item.jenis_broker).bg} ${getBrokerTypeStyle(item.jenis_broker).text} ${getBrokerTypeStyle(item.jenis_broker).border}`}>
                                          {getBrokerTypeLabel(item.jenis_broker)}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        Code: {item.kode_broker}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {formatNumber(item.buy_freq || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {formatNumber(item.buy_vol || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  Rp {formatNumber(item.buy_avg || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {item.buy_percent?.toFixed(2) || '0.00'}%
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {formatNumber(item.sell_freq || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {formatNumber(item.sell_vol || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  Rp {formatNumber(item.sell_avg || 0)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                  {item.sell_percent?.toFixed(2) || '0.00'}%
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                                  <span className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    {isPositive ? '+' : ''}{formatNumber(item.net_vol || 0)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                                  <span className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                    Rp {isPositive ? '+' : ''}{formatNumber(netVal)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {/* Chart View */}
                {bandarmologiView === 'chart' && bandarmologiData && !bandarmologiLoading && (
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">{t('bandarmologi.ui.holdingsChart')}</h4>
                    <div style={{ height: '400px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={bandarmologiData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="kode_broker"
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            fontSize={12}
                            interval={0}
                          />
                          <YAxis
                            tickFormatter={(value) => formatNumber(value)}
                            fontSize={12}
                          />
                          <RechartsTooltip
                            formatter={(value, name) => [
                              formatNumber(value),
                              name === 'net_vol' ? 'Net Volume' : name
                            ]}
                            labelFormatter={(label) => `Broker: ${label}`}
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                          />
                          <RechartsBar
                            dataKey="net_vol"
                            name="Net Volume"
                            radius={[2, 2, 0, 0]}
                          >
                            {bandarmologiData.map((entry, index) => (
                              <Cell
                                key={`bandarmologi-cell-${index}`}
                                fill={entry.net_vol > 0 ? '#10b981' : '#ef4444'}
                                stroke={entry.net_vol > 0 ? '#059669' : '#dc2626'}
                                strokeWidth={1}
                              />
                            ))}
                          </RechartsBar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 text-center">
                      {t('bandarmologi.ui.greenBarsNetBuy')}
                    </div>
                  </div>
                )}

                {!bandarmologiData && !bandarmologiLoading && !error && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-lg mb-2">📊 {t('bandarmologi.ui.noDataAvailable')}</p>
                    <p className="text-sm">{t('bandarmologi.ui.selectStockAndShowData')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Old Layout - Keep existing functionality */}
        {layoutView === 'old' && (
          <>
            {/* Input Form */}
            <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="symbol" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('bandarmologi.stockSymbol')}
                  </label>
                  <input
                    type="text"
                    id="symbol"
                    name="symbol"
                    value={formData.symbol}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., BBCA"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('bandarmologi.date')}
                  </label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="days" className="block text-sm font-medium text-gray-700 mb-1">
                    {t('bandarmologi.days')}
                  </label>
                  <input
                    type="number"
                    id="days"
                    name="days"
                    value={formData.days}
                    onChange={handleInputChange}
                    min="1"
                    max="365"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {isLoading ? t('bandarmologi.analyzing') : t('bandarmologi.analyze')}
                  </button>
                </div>
              </div>
            </form>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800">{error.message || t('bandarmologi.errors.apiError')}</p>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800">{successMessage}</p>
              </div>
            )}

            {/* Stock Info */}
            {stockInfo && (
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Information</h3>

                {/* Current Price and Change */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white p-3 rounded border">
                    <span className="text-sm text-gray-600">Current Price</span>
                    <div className="text-xl font-bold text-gray-900">
                      Rp {stockInfo.closing_price?.toLocaleString() || '0'}
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded border">
                    <span className="text-sm text-gray-600">Change</span>
                    <div className={`text-xl font-bold ${stockInfo.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stockInfo.change >= 0 ? '+' : ''}Rp {stockInfo.change?.toLocaleString() || '0'}
                    </div>
                    <div className={`text-sm ${stockInfo.change_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ({stockInfo.change_percent >= 0 ? '+' : ''}{stockInfo.change_percent?.toFixed(2) || '0.00'}%)
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded border">
                    <span className="text-sm text-gray-600">High</span>
                    <div className="text-xl font-bold text-gray-900">
                      Rp {stockInfo.high?.toLocaleString() || '0'}
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded border">
                    <span className="text-sm text-gray-600">Low</span>
                    <div className="text-xl font-bold text-gray-900">
                      Rp {stockInfo.low?.toLocaleString() || '0'}
                    </div>
                  </div>
                </div>

                {/* Volume Summary */}
                <div className="bg-white p-4 rounded border">
                  <h4 className="text-md font-semibold text-gray-900 mb-3">📊 Volume Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Average Volume:</span>
                      <div className="text-lg font-semibold text-gray-900">
                        {stockInfo.average_volume?.toLocaleString() || '0'}
                      </div>
                    </div>

                    <div>
                      <span className="text-sm text-gray-600">Total Volume:</span>
                      <div className="text-lg font-semibold text-gray-900">
                        {stockInfo.total_volume?.toLocaleString() || '0'}
                      </div>
                    </div>

                    <div>
                      <span className="text-sm text-gray-600">Trading Days:</span>
                      <div className="text-lg font-semibold text-gray-900">
                        {stockInfo.trading_days || '0'} Days
                      </div>
                    </div>
                  </div>

                  {/* Fallback Message */}
                  {stockInfo.closing_price === 0 && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800">
                        ⚠️ Stock data not available for the selected period. Using latest available data.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* View Type Selector */}
            {bandarData && bandarData.length > 0 && (
              <div className="mb-6">
                <label htmlFor="viewType" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('bandarmologi.ui.tableView')}
                </label>
                <select
                  id="viewType"
                  value={viewType}
                  onChange={(e) => setViewType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="default">{t('bandarmologi.ui.detailedTableView')}</option>
                  <option value="detailed">{t('bandarmologi.ui.detailedTableView')}</option>
                </select>
              </div>
            )}

            {/* Chart */}
            {bandarData && bandarData.length > 0 && brokerChartData && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bandarmologi.ui.holdingsChart')}</h3>
                <div className="bg-white p-4 rounded-lg border">
                  <div style={{ height: '400px' }}>
                    <Bar data={brokerChartData} options={chartOptions} />
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Table View */}
            {viewType === 'detailed' && sortedBandarData && sortedBandarData.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('bandarmologi.ui.detailedBrokerAnalysis')} ({sortedBandarData.length} brokers)
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.bandarmologiTab.columns.broker')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.freqBuy')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.volBuy')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.avgBuy')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.buyPercent')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.freqSell')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.volSell')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.avgSell')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.sellPercent')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.netVolume')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.netValue')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedBandarData.map((item, index) => {
                        const isPositive = item.net_vol > 0;
                        const brokerEmoji = getBrokerTypeEmoji(item.jenis_broker);
                        const rowClass = isPositive ? 'bg-green-500 text-white' : item.net_vol < 0 ? 'bg-red-500 text-white' : '';

                        return (
                          <tr key={item.kode_broker || `detailed-${index}`} className={rowClass}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {brokerEmoji} {item.nama_broker || item.kode_broker || 'Unknown Broker'}
                                </span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getBrokerTypeStyle(item.jenis_broker).bg} ${getBrokerTypeStyle(item.jenis_broker).text} ${getBrokerTypeStyle(item.jenis_broker).border}`}>
                                  {getBrokerTypeLabel(item.jenis_broker)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Code: {item.kode_broker}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {item.buy_freq?.toLocaleString() || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {item.buy_vol?.toLocaleString() || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              Rp {item.buy_avg?.toLocaleString() || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {item.buy_percent?.toFixed(2) || '-'}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {item.sell_freq?.toLocaleString() || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {item.sell_vol?.toLocaleString() || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              Rp {item.sell_avg?.toLocaleString() || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {item.sell_percent?.toFixed(2) || '-'}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {item.net_vol?.toLocaleString() || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {getNetVal(item)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Main Broker Analysis Table - Always show when data is available */}
            {bandarData && bandarData.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('bandarmologi.bandarmologiTitle')} {selectedSymbol} (1 {t('bandarmologi.daysUntil')} {new Date().toLocaleDateString('id-ID')}) ({t('bandarmologi.part1')})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.bandarmologiTab.columns.broker')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.freqBuy')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.volBuy')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.avgBuy')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.buyPercent')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.freqSell')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.volSell')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.avgSell')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.sellPercent')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.netVolume')}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('bandarmologi.ui.netValue')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedBandarData.slice(0, 20).map((item, index) => {
                        const isPositive = item.net_vol > 0;
                        const rowClass = isPositive ? 'bg-green-50' : item.net_vol < 0 ? 'bg-red-50' : '';

                        return (
                          <tr key={item.kode_broker || `main-${index}`} className={rowClass}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-medium text-gray-900">
                                  {item.nama_broker || item.kode_broker || 'Unknown Broker'}
                                </div>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getBrokerTypeStyle(item.jenis_broker).bg} ${getBrokerTypeStyle(item.jenis_broker).text} ${getBrokerTypeStyle(item.jenis_broker).border}`}>
                                  {getBrokerTypeLabel(item.jenis_broker)}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                Code: {item.kode_broker}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                              {item.buy_freq?.toLocaleString() || '0'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                              {formatNumber(item.buy_vol || 0)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                              {formatNumber(item.buy_avg || 0)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                              {item.buy_percent?.toFixed(2) || '0.00'}%
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                              {item.sell_freq?.toLocaleString() || '0'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                              {formatNumber(item.sell_vol || 0)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                              {formatNumber(item.sell_avg || 0)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                              {item.sell_percent?.toFixed(2) || '0.00'}%
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-right">
                              <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                                {isPositive ? '+' : ''}{formatNumber(item.net_vol || 0)}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-right">
                              <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                                {isPositive ? '+' : ''}{formatNumber(Math.abs(item.net_vol * (item.net_vol > 0 ? item.buy_avg : item.sell_avg) || 0))}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-xs text-gray-500 text-right">
                  {t('bandarmologi.createdByBisnisIT')}
                </div>
              </div>
            )}

            {/* Show message when no data */}
            {!bandarData && !isLoading && !error && (
              <div className="text-center py-8">
                <p className="text-gray-500">{t('bandarmologi.ui.noDataAvailable')}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}