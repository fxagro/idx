import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Skeleton Loading Component
const SkeletonLoader = ({ className }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

// Skeleton for Transaction Table
const TransactionTableSkeleton = () => (
  <div className="bg-white rounded-lg shadow-md">
    <div className="p-6 border-b border-gray-200">
      <SkeletonLoader className="h-6 w-48" />
    </div>
    <div className="p-6">
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex space-x-4">
            <SkeletonLoader className="h-4 w-16" />
            <SkeletonLoader className="h-4 w-20" />
            <SkeletonLoader className="h-4 w-24" />
            <SkeletonLoader className="h-4 w-24" />
            <SkeletonLoader className="h-4 w-28" />
            <SkeletonLoader className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const HistoryPage = () => {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalTrades: 0,
    buyTrades: 0,
    sellTrades: 0,
    totalVolume: 0,
    totalValue: 0
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    if (transactions.length > 0) {
      calculateStats();
    }
  }, [transactions]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/stocks/virtual/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const totalTrades = transactions.length;
    const buyTrades = transactions.filter(t => t.type === 'BUY').length;
    const sellTrades = transactions.filter(t => t.type === 'SELL').length;
    const totalVolume = transactions.reduce((sum, t) => sum + t.quantity, 0);
    const totalValue = transactions.reduce((sum, t) => sum + t.total_amount, 0);

    setStats({
      totalTrades,
      buyTrades,
      sellTrades,
      totalVolume,
      totalValue
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
            <SkeletonLoader className="h-8 w-48 mb-2" />
            <SkeletonLoader className="h-5 w-96" />
          </div>

          {/* Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-md p-4">
                <SkeletonLoader className="h-4 w-20 mb-2" />
                <SkeletonLoader className="h-6 w-16" />
              </div>
            ))}
          </div>

          {/* Table Skeleton */}
          <TransactionTableSkeleton />
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
              {t('virtualTrading.history', 'Transaction History')}
            </span>
          </nav>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {t('virtualTrading.history', 'Transaction History')}
              </h1>
              <p className="text-gray-600">
                {t('virtualTrading.historySubtitle', 'View your complete virtual trading transaction history')}
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
                href="/virtual-trading/portfolio"
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>{t('virtualTrading.portfolio', 'Portfolio')}</span>
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

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <h4 className="text-sm font-medium text-gray-500">
              {t('virtualTrading.totalTrades', 'Total Trades')}
            </h4>
            <p className="text-2xl font-bold text-blue-600">
              {stats.totalTrades}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <h4 className="text-sm font-medium text-gray-500">
              {t('virtualTrading.buyTrades', 'Buy Trades')}
            </h4>
            <p className="text-2xl font-bold text-green-600">
              {stats.buyTrades}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <h4 className="text-sm font-medium text-gray-500">
              {t('virtualTrading.sellTrades', 'Sell Trades')}
            </h4>
            <p className="text-2xl font-bold text-red-600">
              {stats.sellTrades}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <h4 className="text-sm font-medium text-gray-500">
              {t('virtualTrading.totalVolume', 'Total Volume')}
            </h4>
            <p className="text-2xl font-bold text-gray-900">
              {formatNumber(stats.totalVolume)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <h4 className="text-sm font-medium text-gray-500">
              {t('virtualTrading.totalValueTraded', 'Total Value')}
            </h4>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(stats.totalValue)}
            </p>
          </div>
        </div>

        {/* Transaction History Table */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('virtualTrading.transactionHistory', 'Transaction History')}
            </h3>
          </div>
          <div className="p-6">
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg">
                  {t('virtualTrading.noTransactions', 'No transactions yet')}
                </p>
                <p className="text-gray-400 mt-2">
                  {t('virtualTrading.startTrading', 'Start trading to see your transaction history here')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('virtualTrading.symbol', 'Symbol')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('virtualTrading.type', 'Type')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('virtualTrading.quantity', 'Quantity')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('virtualTrading.price', 'Price')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('virtualTrading.total', 'Total')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('virtualTrading.date', 'Date')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.map((transaction, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {transaction.symbol}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            transaction.type === 'BUY'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.type === 'BUY' ? t('virtualTrading.buy', 'Buy') : t('virtualTrading.sell', 'Sell')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatNumber(transaction.quantity)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(transaction.price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(transaction.total_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            {new Date(transaction.transaction_date).toLocaleDateString('id-ID', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(transaction.transaction_date).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
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

export default HistoryPage;