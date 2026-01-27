import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
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

// Skeleton Loading Component
const SkeletonLoader = ({ className }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

// Skeleton for Portfolio Table
const PortfolioTableSkeleton = () => (
  <div className="bg-white rounded-lg shadow-md">
    <div className="p-6 border-b border-gray-200">
      <SkeletonLoader className="h-6 w-40" />
    </div>
    <div className="p-6">
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex space-x-4">
            <SkeletonLoader className="h-4 w-16" />
            <SkeletonLoader className="h-4 w-20" />
            <SkeletonLoader className="h-4 w-24" />
            <SkeletonLoader className="h-4 w-24" />
            <SkeletonLoader className="h-4 w-20" />
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
  Legend,
  BarElement
);

const PortfolioPage = () => {
  const { t } = useTranslation();
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [portfolioChartData, setPortfolioChartData] = useState(null);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  useEffect(() => {
    if (portfolio.length > 0) {
      updatePortfolioChart();
    }
  }, [portfolio]);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const userId = JSON.parse(atob(token.split('.')[1])).id;
      console.log('[PortfolioPage] Fetching portfolio for user:', userId);

      const response = await fetch('http://localhost:5000/api/stocks/virtual/portfolio', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setPortfolio(data.portfolio || []);
        console.log('[PortfolioPage] Portfolio data loaded successfully:', data.portfolio?.length || 0, 'positions');
      } else {
        throw new Error(data.message || 'Failed to fetch portfolio data');
      }
    } catch (error) {
      console.error('[PortfolioPage] Error fetching portfolio:', error);

      // Handle different types of errors
      if (error.message.includes('Unexpected token')) {
        setError('Server returned invalid response. Please check if the API endpoint is correct.');
      } else if (error.message.includes('Failed to fetch')) {
        setError('Unable to connect to server. Please check your internet connection.');
      } else {
        setError(`Failed to load portfolio data: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const updatePortfolioChart = () => {
    if (portfolio.length === 0) return;

    const labels = portfolio.map(item => item.symbol);
    const values = portfolio.map(item => item.current_value);
    const investments = portfolio.map(item => item.total_investment);

    setPortfolioChartData({
      labels,
      datasets: [
        {
          label: 'Current Value',
          data: values,
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2,
        },
        {
          label: 'Total Investment',
          data: investments,
          backgroundColor: 'rgba(245, 101, 101, 0.5)',
          borderColor: 'rgb(245, 101, 101)',
          borderWidth: 2,
        }
      ]
    });
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="mb-6">
            <SkeletonLoader className="h-8 w-64 mb-2" />
            <SkeletonLoader className="h-5 w-96" />
          </div>

          {/* Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PortfolioTableSkeleton />
            <ChartSkeleton />
          </div>
        </div>
      </div>
    );
  }

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
            <a href="/virtual-trading" className="hover:text-blue-600 transition-colors">
              {t('navbar.virtualTrading', 'Virtual Trading')}
            </a>
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-900 font-medium">
              {t('virtualTrading.portfolio', 'Portfolio')}
            </span>
          </nav>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {t('virtualTrading.portfolio', 'Portfolio')}
              </h1>
              <p className="text-gray-600">
                {t('virtualTrading.portfolioSubtitle', 'View your virtual trading portfolio and performance')}
              </p>
            </div>

            {/* Quick Navigation Links */}
            <div className="hidden md:flex items-center space-x-3">
              <a
                href="/virtual-trading"
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>{t('virtualTrading.trade', 'Trade')}</span>
              </a>
              <a
                href="/virtual-trading/history"
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('virtualTrading.history', 'History')}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* Portfolio Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Portfolio Table */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('virtualTrading.myPortfolio', 'My Portfolio')}
              </h3>
            </div>
            <div className="p-6">
              {portfolio.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {t('virtualTrading.noHoldings', 'No holdings yet. Start trading!')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.symbol', 'Symbol')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.quantity', 'Quantity')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.avgPrice', 'Avg Price')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.currentPrice', 'Current Price')}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t('virtualTrading.gainLoss', 'Gain/Loss')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {portfolio.map((item) => (
                        <tr key={item.symbol} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.symbol}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatNumber(item.quantity)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCurrency(item.avg_price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatCurrency(item.current_price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={item.gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatCurrency(item.gain_loss)}
                              <br />
                              <span className="text-xs">
                                ({item.gain_loss_percent >= 0 ? '+' : ''}{item.gain_loss_percent.toFixed(2)}%)
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Portfolio Chart */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('virtualTrading.portfolioValue', 'Portfolio Value')}
              </h3>
            </div>
            <div className="p-6">
              {portfolioChartData ? (
                <Bar data={portfolioChartData} options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                    title: {
                      display: true,
                      text: 'Portfolio Comparison'
                    }
                  }
                }} />
              ) : (
                <p className="text-gray-500 text-center py-8">
                  {t('virtualTrading.noChartData', 'No chart data available')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {portfolio.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h4 className="text-sm font-medium text-gray-500">
                {t('virtualTrading.totalValue', 'Total Portfolio Value')}
              </h4>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(portfolio.reduce((sum, item) => sum + item.current_value, 0))}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h4 className="text-sm font-medium text-gray-500">
                {t('virtualTrading.totalInvestment', 'Total Investment')}
              </h4>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(portfolio.reduce((sum, item) => sum + item.total_investment, 0))}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h4 className="text-sm font-medium text-gray-500">
                {t('virtualTrading.totalGainLoss', 'Total Gain/Loss')}
              </h4>
              <p className={`text-2xl font-bold ${
                portfolio.reduce((sum, item) => sum + item.gain_loss, 0) >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {formatCurrency(portfolio.reduce((sum, item) => sum + item.gain_loss, 0))}
              </p>
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            <strong>{t('virtualTrading.disclaimer', 'Disclaimer')}:</strong>{' '}
            {t('virtualTrading.disclaimerText', 'This is a virtual trading simulation for educational purposes only. No real money is involved and no actual trades are executed. Market data is provided for demonstration purposes.')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PortfolioPage;