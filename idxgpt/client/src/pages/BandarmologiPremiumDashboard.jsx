import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.jsx';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line
} from 'recharts';
import BrokerDetailModal from '../components/BrokerDetailModal.jsx';

export default function BandarmologiPremiumDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [topBandarData, setTopBandarData] = useState([]);
  const [watchlistData, setWatchlistData] = useState([]);
  const [alertToggles, setAlertToggles] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState(null);

  // Inline mock data
  const mockData = {
    alerts: [
      {
        id: 1,
        brokerCode: 'CC',
        action: 'accumulation',
        value: 18500000000,
        period: '30d',
        stock: 'BBCA',
        type: 'institutional'
      },
      {
        id: 2,
        brokerCode: 'BB',
        action: 'distribution',
        value: -15200000000,
        period: '7d',
        stock: 'TLKM',
        type: 'bumn'
      },
      {
        id: 3,
        brokerCode: 'CI',
        action: 'accumulation',
        value: 12800000000,
        period: '1d',
        stock: 'ASII',
        type: 'asing'
      },
      {
        id: 4,
        brokerCode: 'MS',
        action: 'distribution',
        value: -8900000000,
        period: '14d',
        stock: 'BMRI',
        type: 'asing'
      },
      {
        id: 5,
        brokerCode: 'BC',
        action: 'accumulation',
        value: 6700000000,
        period: '30d',
        stock: 'BBNI',
        type: 'lokal retail'
      }
    ],
    heatmap: [
      { broker: 'CC', name: 'Mandiri Sekuritas', value: 18500000000, type: 'institutional', intensity: 95 },
      { broker: 'BB', name: 'Bahana Sekuritas', value: -15200000000, type: 'bumn', intensity: 88 },
      { broker: 'CI', name: 'Citi Sekuritas', value: 12800000000, type: 'asing', intensity: 92 },
      { broker: 'MS', name: 'Morgan Stanley', value: -8900000000, type: 'asing', intensity: 78 },
      { broker: 'BC', name: 'BCA Sekuritas', value: 6700000000, type: 'lokal retail', intensity: 85 },
      { broker: 'JP', name: 'JP Morgan', value: 5400000000, type: 'asing', intensity: 82 },
      { broker: 'DB', name: 'Deutsche Bank', value: -3200000000, type: 'asing', intensity: 71 },
      { broker: 'GS', name: 'Goldman Sachs', value: 9800000000, type: 'asing', intensity: 89 }
    ],
    topBandar: [
      { rank: 1, broker: 'Mandiri Sekuritas', code: 'CC', netBuyValue: 18500000000, type: 'institutional' },
      { rank: 2, broker: 'Citi Sekuritas', code: 'CI', netBuyValue: 12800000000, type: 'asing' },
      { rank: 3, broker: 'BCA Sekuritas', code: 'BC', netBuyValue: 6700000000, type: 'lokal retail' },
      { rank: 4, broker: 'JP Morgan', code: 'JP', netBuyValue: 5400000000, type: 'asing' },
      { rank: 5, broker: 'Goldman Sachs', code: 'GS', netBuyValue: 9800000000, type: 'asing' },
      { rank: 6, broker: 'Bahana Sekuritas', code: 'BB', netBuyValue: -15200000000, type: 'bumn' },
      { rank: 7, broker: 'Morgan Stanley', code: 'MS', netBuyValue: -8900000000, type: 'asing' },
      { rank: 8, broker: 'Deutsche Bank', code: 'DB', netBuyValue: -3200000000, type: 'asing' }
    ],
    watchlist: [
      { symbol: 'BBCA', name: 'Bank Central Asia', probability: 87, alertEnabled: true },
      { symbol: 'TLKM', name: 'Telkom Indonesia', probability: 34, alertEnabled: false },
      { symbol: 'ASII', name: 'Astra International', probability: 56, alertEnabled: true },
      { symbol: 'BMRI', name: 'Bank Mandiri', probability: 78, alertEnabled: true },
      { symbol: 'BBNI', name: 'Bank Negara Indonesia', probability: 92, alertEnabled: false },
      { symbol: 'UNVR', name: 'Unilever Indonesia', probability: 45, alertEnabled: true }
    ]
  };

  useEffect(() => {
    setIsLoading(true);

    // Initialize state with mock data
    setAlerts(mockData.alerts);
    setHeatmapData(mockData.heatmap);
    setTopBandarData(mockData.topBandar);
    setWatchlistData(mockData.watchlist);

    // Initialize alert toggles
    const initialToggles = {};
    mockData.watchlist.forEach(item => {
      initialToggles[item.symbol] = item.alertEnabled;
    });
    setAlertToggles(initialToggles);

    setIsLoading(false);
  }, []);

  // Utility functions
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    if (Math.abs(num) >= 1e12) return (num / 1e12).toFixed(1) + 'T';
    if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString('id-ID');
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
    return 'Rp ' + formatNumber(amount);
  };

  const formatPercentage = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0.0%';
    return num.toFixed(1) + '%';
  };

  const getAlertBackground = (action) => {
    return action === 'accumulation' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  };

  const getAlertTextColor = (action) => {
    return action === 'accumulation' ? 'text-green-800' : 'text-red-800';
  };

  const getBrokerTypeBadge = (type) => {
    const badges = {
      'asing': { emoji: '🟠', color: 'bg-orange-100 text-orange-800 border-orange-200' },
      'bumn': { emoji: '🟡', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      'lokal retail': { emoji: '🔵', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      'institutional': { emoji: '🟣', color: 'bg-purple-100 text-purple-800 border-purple-200' }
    };
    return badges[type] || { emoji: '⚪', color: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  const getProbabilityColor = (probability) => {
    if (probability >= 60) return 'text-green-600 bg-green-50';
    if (probability >= 40) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const toggleAlert = (symbol) => {
    setAlertToggles(prev => ({
      ...prev,
      [symbol]: !prev[symbol]
    }));
  };

  const handleBrokerClick = (broker) => {
    // Ensure broker has all required properties for the modal
    const enhancedBroker = {
      ...broker,
      // Add default values for any missing properties
      netBuyTotal: broker.netBuyTotal || broker.value || 0,
      netSellTotal: broker.netSellTotal || 0,
      totalTrades: broker.totalTrades || 100,
      winRate: broker.winRate || 75.0,
      recentTrades: broker.recentTrades || [
        { date: '2025-01-15', symbol: 'BBCA', buyVol: 50000, sellVol: 0, netValue: 925000000 },
        { date: '2025-01-14', symbol: 'TLKM', buyVol: 0, sellVol: 100000, netValue: -382000000 },
        { date: '2025-01-13', symbol: 'ASII', buyVol: 75000, sellVol: 25000, netValue: 283500000 },
        { date: '2025-01-12', symbol: 'BMRI', buyVol: 30000, sellVol: 0, netValue: 555000000 },
        { date: '2025-01-11', symbol: 'BBNI', buyVol: 0, sellVol: 80000, netValue: -296000000 },
      ],
      chartData: broker.chartData || {
        labels: ['Jan 1', 'Jan 2', 'Jan 3', 'Jan 4', 'Jan 5', 'Jan 6', 'Jan 7', 'Jan 8', 'Jan 9', 'Jan 10',
                 'Jan 11', 'Jan 12', 'Jan 13', 'Jan 14', 'Jan 15', 'Jan 16', 'Jan 17', 'Jan 18', 'Jan 19', 'Jan 20',
                 'Jan 21', 'Jan 22', 'Jan 23', 'Jan 24', 'Jan 25', 'Jan 26', 'Jan 27', 'Jan 28', 'Jan 29', 'Jan 30'],
        datasets: [
          {
            label: 'Net Buy Value',
            data: [1200000000, 1800000000, -500000000, 2100000000, 800000000, -1200000000, 1500000000, 2200000000, -800000000, 1900000000,
                   600000000, -900000000, 1700000000, 2400000000, -600000000, 2100000000, 900000000, -1100000000, 1600000000, 2300000000,
                   -700000000, 2000000000, 750000000, -1000000000, 1800000000, 2500000000, -850000000, 1950000000, 650000000, -950000000],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
          },
          {
            label: 'Net Sell Value',
            data: [-800000000, 600000000, -1500000000, 400000000, -1100000000, 900000000, -1300000000, 500000000, -1200000000, 700000000,
                   -1000000000, 800000000, -1400000000, 300000000, -1300000000, 600000000, -1100000000, 900000000, -1500000000, 400000000,
                   -1200000000, 700000000, -1300000000, 500000000, -1400000000, 300000000, -1200000000, 800000000, -1500000000, 400000000],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
          }
        ]
      }
    };

    setSelectedBroker(enhancedBroker);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedBroker(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Premium Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2">⭐ Bandarmologi Premium</h1>
            <p className="text-xl opacity-90">Advanced broker analysis dashboard</p>
            <p className="text-sm opacity-75 mt-2">
              Welcome back, {user?.email || 'Premium User'} • Last updated: {new Date().toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Alerts Panel */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">🚨 Real-time Alerts</h2>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Live
              </span>
              <span className="text-sm text-gray-500">
                {alerts.length} active alerts
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${getAlertBackground(alert.action)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">{alert.brokerCode}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.action === 'accumulation' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                    }`}>
                      {alert.action === 'accumulation' ? 'ACCUMULATION' : 'DISTRIBUTION'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{alert.period}</span>
                </div>
                <div className={`text-lg font-bold mb-1 ${getAlertTextColor(alert.action)}`}>
                  {formatCurrency(alert.value)}
                </div>
                <div className="text-sm text-gray-600">{alert.stock}</div>
                <div className="flex items-center gap-1 mt-2">
                  <span>{getBrokerTypeBadge(alert.type).emoji}</span>
                  <span className={`text-xs font-medium ${getBrokerTypeBadge(alert.type).color.replace('bg-', 'text-').replace('border-', 'border-')}`}>
                    {alert.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Broker Heatmap */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">🔥 Broker Heatmap</h2>
            <div className="grid grid-cols-2 gap-4">
              {heatmapData.map((item, index) => (
                <div
                  key={index}
                  onClick={() => handleBrokerClick(item)}
                  className={`p-4 rounded-lg border-2 relative group cursor-pointer transition-all duration-200 ${
                    item.value > 0
                      ? 'border-green-200 bg-green-50 hover:bg-green-100 hover:shadow-md'
                      : 'border-red-200 bg-red-50 hover:bg-red-100 hover:shadow-md'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{item.broker}</div>
                    <div className={`text-sm font-medium mt-1 ${
                      item.value > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatNumber(item.value)}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          item.value > 0 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${item.intensity}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    <div className="font-semibold">{item.name}</div>
                    <div className="flex items-center gap-1">
                      <span>{getBrokerTypeBadge(item.type).emoji}</span>
                      <span>{item.type}</span>
                    </div>
                    <div className="text-gray-300">Intensity: {item.intensity}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Bandar Battle */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">👑 Top Bandar Battle</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Rank</th>
                    <th className="text-left py-2 text-sm font-medium text-gray-500">Broker</th>
                    <th className="text-right py-2 text-sm font-medium text-gray-500">Net Buy Value</th>
                    <th className="text-center py-2 text-sm font-medium text-gray-500">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {topBandarData.map((bandar) => (
                    <tr
                      key={bandar.rank}
                      onClick={() => handleBrokerClick(bandar)}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                    >
                      <td className="py-3">
                        <span className="text-lg font-bold text-indigo-600">#{bandar.rank}</span>
                      </td>
                      <td className="py-3">
                        <div>
                          <div className="font-semibold text-gray-900">{bandar.broker}</div>
                          <div className="text-sm text-gray-500">{bandar.code}</div>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <span className={`font-bold text-lg ${
                          bandar.netBuyValue > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(bandar.netBuyValue)}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getBrokerTypeBadge(bandar.type).color}`}>
                          {getBrokerTypeBadge(bandar.type).emoji} {bandar.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Watchlist + AI Prediction */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📊 Watchlist + AI Prediction</h2>

          {/* AI Prediction Summary */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🤖 AI Prediction Summary</h3>
            <p className="text-gray-700 mb-3">
              Based on advanced machine learning algorithms analyzing broker behavior patterns,
              market sentiment, and technical indicators, our AI predicts:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center p-3 bg-green-100 rounded">
                <div className="font-bold text-green-800">67%</div>
                <div className="text-green-600">Bullish Stocks</div>
              </div>
              <div className="text-center p-3 bg-yellow-100 rounded">
                <div className="font-bold text-yellow-800">20%</div>
                <div className="text-yellow-600">Neutral Stocks</div>
              </div>
              <div className="text-center p-3 bg-red-100 rounded">
                <div className="font-bold text-red-800">13%</div>
                <div className="text-red-600">Bearish Stocks</div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Symbol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company Name
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Alert
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AI Probability ↑
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {watchlistData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{item.symbol}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => toggleAlert(item.symbol)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                          alertToggles[item.symbol] ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            alertToggles[item.symbol] ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getProbabilityColor(item.probability)}`}>
                        {formatPercentage(item.probability)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-gray-500 text-sm bg-white rounded-lg p-4 shadow">
          <p>💎 Premium features powered by advanced AI algorithms</p>
          <p className="mt-1">Real-time data updates every 30 seconds • Historical analysis up to 5 years • Advanced broker pattern recognition</p>
        </div>
      </div>

      {/* Broker Detail Modal */}
      <BrokerDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        broker={selectedBroker}
      />
    </div>
  );
}