import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function BrokerDetailModal({ isOpen, onClose, broker }) {
  const [isLoading, setIsLoading] = useState(false);

  // Mock broker data if none provided
  const defaultBroker = {
    code: 'CC',
    name: 'Mandiri Sekuritas',
    type: 'institutional',
    netBuyTotal: 18500000000,
    netSellTotal: -2500000000,
    totalTrades: 1250,
    winRate: 78.5,
    recentTrades: [
      { date: '2025-01-15', symbol: 'BBCA', buyVol: 50000, sellVol: 0, netValue: 925000000 },
      { date: '2025-01-14', symbol: 'TLKM', buyVol: 0, sellVol: 100000, netValue: -382000000 },
      { date: '2025-01-13', symbol: 'ASII', buyVol: 75000, sellVol: 25000, netValue: 283500000 },
      { date: '2025-01-12', symbol: 'BMRI', buyVol: 30000, sellVol: 0, netValue: 555000000 },
      { date: '2025-01-11', symbol: 'BBNI', buyVol: 0, sellVol: 80000, netValue: -296000000 },
    ],
    chartData: {
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

  const currentBroker = broker || defaultBroker;

  // Ensure all required properties exist with fallbacks
  const safeBroker = {
    ...defaultBroker,
    ...currentBroker,
    recentTrades: currentBroker?.recentTrades || defaultBroker.recentTrades,
    chartData: currentBroker?.chartData || defaultBroker.chartData,
    netBuyTotal: currentBroker?.netBuyTotal ?? defaultBroker.netBuyTotal,
    netSellTotal: currentBroker?.netSellTotal ?? defaultBroker.netSellTotal,
    totalTrades: currentBroker?.totalTrades ?? defaultBroker.totalTrades,
    winRate: currentBroker?.winRate ?? defaultBroker.winRate,
  };

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

  const getBrokerTypeBadge = (type) => {
    const badges = {
      'asing': { emoji: '🟠', color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Foreign' },
      'bumn': { emoji: '🟡', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'BUMN' },
      'lokal retail': { emoji: '🔵', color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Retail' },
      'institutional': { emoji: '🟣', color: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Institutional' }
    };
    return badges[type] || { emoji: '⚪', color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Unknown' };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: '30-Day Net Buy vs Net Sell Trend',
        font: {
          size: 16,
          weight: 'bold'
        }
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Net Value (IDR)'
        },
        ticks: {
          callback: function(value) {
            return formatNumber(value);
          }
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold">{safeBroker.name}</h2>
                <p className="text-indigo-100">Broker Code: {safeBroker.code}</p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getBrokerTypeBadge(safeBroker.type).color}`}>
                {getBrokerTypeBadge(safeBroker.type).emoji} {getBrokerTypeBadge(safeBroker.type).label}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">Net Buy Total</div>
              <div className="text-2xl font-bold text-green-800">
                {formatCurrency(safeBroker.netBuyTotal)}
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-600 font-medium">Net Sell Total</div>
              <div className="text-2xl font-bold text-red-800">
                {formatCurrency(safeBroker.netSellTotal)}
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">Total Trades</div>
              <div className="text-2xl font-bold text-blue-800">
                {formatNumber(safeBroker.totalTrades)}
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-sm text-purple-600 font-medium">Win Rate</div>
              <div className="text-2xl font-bold text-purple-800">
                {safeBroker.winRate}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Trades Table */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Recent Trades</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Symbol
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Buy Vol
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sell Vol
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Net Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {safeBroker.recentTrades && safeBroker.recentTrades.map((trade, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {new Date(trade.date).toLocaleDateString('id-ID')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {trade.symbol}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatNumber(trade.buyVol)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatNumber(trade.sellVol)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-right">
                          <span className={trade.netValue >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(trade.netValue)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">30-Day Trading Trend</h3>
              </div>
              <div className="p-4" style={{ height: '400px' }}>
                <Line data={safeBroker.chartData} options={chartOptions} />
              </div>
            </div>
          </div>

          {/* Performance Summary */}
          <div className="mt-8 bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Key Metrics</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Total Trading Volume: {formatNumber(safeBroker.netBuyTotal + Math.abs(safeBroker.netSellTotal))}</li>
                  <li>• Average Trade Size: {formatCurrency((safeBroker.netBuyTotal + Math.abs(safeBroker.netSellTotal)) / safeBroker.totalTrades)}</li>
                  <li>• Success Rate: {safeBroker.winRate}% of trades profitable</li>
                  <li>• Net Position: {formatCurrency(safeBroker.netBuyTotal + safeBroker.netSellTotal)}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Trading Pattern</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• Primary Strategy: {safeBroker.netBuyTotal > Math.abs(safeBroker.netSellTotal) ? 'Accumulation' : 'Distribution'}</li>
                  <li>• Market Impact: {safeBroker.netBuyTotal > 10000000000 ? 'High' : safeBroker.netBuyTotal > 5000000000 ? 'Medium' : 'Low'}</li>
                  <li>• Consistency: {safeBroker.winRate > 70 ? 'Very High' : safeBroker.winRate > 60 ? 'High' : 'Moderate'}</li>
                  <li>• Risk Level: {safeBroker.winRate > 80 ? 'Conservative' : safeBroker.winRate > 60 ? 'Balanced' : 'Aggressive'}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}