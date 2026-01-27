import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../utils/api';
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
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement
);

const FundamentalTab = ({ symbol, market }) => {
  const [fundamentalData, setFundamentalData] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('overview'); // overview, trends, analysis

  useEffect(() => {
    if (symbol && market) {
      fetchFundamentalData();
    }
  }, [symbol, market]);

  const fetchFundamentalData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch fundamental analysis data
      const response = await api.get(`/stocks/fundamental/${symbol}/${market}`);
      setFundamentalData(response.data);

      // Fetch trend data for visualization
      const trendResponse = await api.get(`/stocks/trend/${symbol}/${market}`);
      setTrendData(trendResponse.data);

      // Set AI analysis
      setAiAnalysis(response.data.ai_analysis);

    } catch (err) {
      console.error('Error fetching fundamental data:', err);
      setError(
        err.response?.data?.message ||
        'Failed to fetch fundamental data. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }

    const num = parseFloat(value);
    if (num >= 1e12) {
      return (num / 1e12).toFixed(2) + 'T';
    } else if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
    } else {
      return num.toFixed(2);
    }
  };

  const getTrendDirection = (data, field) => {
    if (!data || data.length < 2) return 'neutral';

    const values = data.map(d => parseFloat(d[field])).filter(v => !isNaN(v));
    if (values.length < 2) return 'neutral';

    const first = values[0];
    const last = values[values.length - 1];

    if (last > first) return 'up';
    if (last < first) return 'down';
    return 'neutral';
  };

  const renderTrendChart = () => {
    if (!trendData) return null;

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `Fundamental Trends - ${symbol} (${market.toUpperCase()})`,
        },
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Report Date'
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: {
            display: true,
            text: 'EPS / PER / PBV'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'ROE (%)'
          },
          grid: {
            drawOnChartArea: false,
          },
        },
        y2: {
          type: 'linear',
          display: true,
          position: 'right',
          title: {
            display: true,
            text: 'Dividend Yield (%)'
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    };

    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="h-96">
          <Line options={options} data={trendData.trend_data} />
        </div>
      </div>
    );
  };

  const renderFundamentalTable = () => {
    if (!fundamentalData || !fundamentalData.fundamental_data) return null;

    const data = fundamentalData.fundamental_data;

    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Historical Fundamental Data</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Report Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  EPS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PER
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PBV
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ROE (%)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Div Yield (%)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((row, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {new Date(row.report_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(row.eps)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(row.per)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(row.pbv)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(row.roe)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatValue(row.dividend_yield)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTechnicalIndicators = () => {
    if (!fundamentalData || !fundamentalData.technical_indicators) return null;

    const indicators = fundamentalData.technical_indicators;

    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Technical Indicators</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {formatValue(indicators.sma20)}
            </div>
            <div className="text-sm text-blue-800">SMA 20</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {formatValue(indicators.sma50)}
            </div>
            <div className="text-sm text-green-800">SMA 50</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {formatValue(indicators.rsi14)}
            </div>
            <div className="text-sm text-purple-800">RSI 14</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {formatValue(indicators.volatility)}%
            </div>
            <div className="text-sm text-orange-800">Volatility</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {formatValue(indicators.support)}
            </div>
            <div className="text-sm text-red-800">Support</div>
          </div>
          <div className="text-center p-4 bg-indigo-50 rounded-lg">
            <div className="text-2xl font-bold text-indigo-600">
              {formatValue(indicators.resistance)}
            </div>
            <div className="text-sm text-indigo-800">Resistance</div>
          </div>
        </div>
      </div>
    );
  };

  const renderAIAnalysis = () => {
    if (!aiAnalysis) return null;

    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">AI Analysis</h3>
        <div className="prose max-w-none">
          {aiAnalysis.split('\n').map((line, index) => {
            if (line.startsWith('# ')) {
              return <h4 key={index} className="text-lg font-semibold text-gray-800 mt-4 mb-2">{line.substring(2)}</h4>;
            } else if (line.startsWith('## ')) {
              return <h5 key={index} className="text-base font-medium text-gray-700 mt-3 mb-1">{line.substring(3)}</h5>;
            } else if (line.startsWith('- ')) {
              return <li key={index} className="text-gray-700 mb-1">{line.substring(2)}</li>;
            } else if (line.trim()) {
              return <p key={index} className="text-gray-700 mb-2">{line}</p>;
            } else {
              return <br key={index} />;
            }
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg text-gray-600">Loading fundamental data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!fundamentalData) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">No fundamental data available for {symbol}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveView('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeView === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveView('trends')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeView === 'trends'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Trends
          </button>
          <button
            onClick={() => setActiveView('analysis')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeView === 'analysis'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            AI Analysis
          </button>
        </nav>
      </div>

      {/* Content based on active view */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {renderTechnicalIndicators()}
          {renderFundamentalTable()}
        </div>
      )}

      {activeView === 'trends' && (
        <div className="space-y-6">
          {renderTrendChart()}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Trend Analysis</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">EPS Trend: </span>
                <span className={`${
                  getTrendDirection(fundamentalData.fundamental_data, 'eps') === 'up' ? 'text-green-600' :
                  getTrendDirection(fundamentalData.fundamental_data, 'eps') === 'down' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {getTrendDirection(fundamentalData.fundamental_data, 'eps') === 'up' ? '↗ Improving' :
                   getTrendDirection(fundamentalData.fundamental_data, 'eps') === 'down' ? '↘ Declining' : '→ Stable'}
                </span>
              </div>
              <div>
                <span className="font-medium">ROE Trend: </span>
                <span className={`${
                  getTrendDirection(fundamentalData.fundamental_data, 'roe') === 'up' ? 'text-green-600' :
                  getTrendDirection(fundamentalData.fundamental_data, 'roe') === 'down' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {getTrendDirection(fundamentalData.fundamental_data, 'roe') === 'up' ? '↗ Improving' :
                   getTrendDirection(fundamentalData.fundamental_data, 'roe') === 'down' ? '↘ Declining' : '→ Stable'}
                </span>
              </div>
              <div>
                <span className="font-medium">Dividend Trend: </span>
                <span className={`${
                  getTrendDirection(fundamentalData.fundamental_data, 'dividend_yield') === 'up' ? 'text-green-600' :
                  getTrendDirection(fundamentalData.fundamental_data, 'dividend_yield') === 'down' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {getTrendDirection(fundamentalData.fundamental_data, 'dividend_yield') === 'up' ? '↗ Increasing' :
                   getTrendDirection(fundamentalData.fundamental_data, 'dividend_yield') === 'down' ? '↘ Decreasing' : '→ Stable'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'analysis' && (
        <div className="space-y-6">
          {renderAIAnalysis()}
        </div>
      )}
    </div>
  );
};

export default FundamentalTab;