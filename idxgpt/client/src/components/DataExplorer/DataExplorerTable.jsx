import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const DataExplorerTable = ({
  data,
  loading,
  error,
  onRetry,
  selectedSymbols,
  onSymbolSelect,
  onAddToWatchlist,
  category
}) => {
  const { t } = useTranslation();
  const [sortConfig, setSortConfig] = useState({
    key: 'symbol',
    direction: 'asc'
  });

  // Sort data based on current sort configuration
  const sortedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      // Handle numeric comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const comparison = aValue - bValue;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      // Default string conversion
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      const comparison = aStr.localeCompare(bStr);
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  // Handle column sorting
  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get sort indicator
  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return ' ↕️';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  // Format cell value based on data type
  const formatCellValue = (value, key) => {
    if (value == null || value === undefined) return 'N/A';

    switch (key) {
      case 'price':
      case 'close':
      case 'open':
      case 'high':
      case 'low':
        return typeof value === 'number' ? `$${value.toFixed(2)}` : value;

      case 'changePercent':
      case 'change':
        if (typeof value === 'number') {
          const isPositive = value >= 0;
          return (
            <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '+' : ''}{value.toFixed(2)}%
            </span>
          );
        }
        return value;

      case 'volume':
        if (typeof value === 'number') {
          if (value >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`;
          } else if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}K`;
          }
          return value.toLocaleString();
        }
        return value;

      case 'marketCap':
        if (typeof value === 'number') {
          if (value >= 1000000000) {
            return `$${(value / 1000000000).toFixed(1)}B`;
          } else if (value >= 1000000) {
            return `$${(value / 1000000).toFixed(1)}M`;
          }
          return `$${value.toLocaleString()}`;
        }
        return value;

      default:
        return value;
    }
  };

  // Get table columns based on category
  const getTableColumns = (category) => {
    const baseColumns = [
      { key: 'symbol', label: t('dataExplorer.table.symbol', 'Symbol'), sortable: true },
      { key: 'name', label: t('dataExplorer.table.name', 'Name'), sortable: true }
    ];

    const categoryColumns = {
      stocks: [
        { key: 'price', label: t('dataExplorer.table.price', 'Price'), sortable: true },
        { key: 'changePercent', label: t('dataExplorer.table.change', 'Change'), sortable: true },
        { key: 'volume', label: t('dataExplorer.table.volume', 'Volume'), sortable: true }
      ],
      etfs: [
        { key: 'price', label: t('dataExplorer.table.price', 'Price'), sortable: true },
        { key: 'changePercent', label: t('dataExplorer.table.change', 'Change'), sortable: true },
        { key: 'volume', label: t('dataExplorer.table.volume', 'Volume'), sortable: true },
        { key: 'expenseRatio', label: t('dataExplorer.table.expenseRatio', 'Expense Ratio'), sortable: true }
      ],
      crypto: [
        { key: 'price', label: t('dataExplorer.table.price', 'Price'), sortable: true },
        { key: 'changePercent', label: t('dataExplorer.table.change24h', '24h Change'), sortable: true },
        { key: 'volume', label: t('dataExplorer.table.volume24h', '24h Volume'), sortable: true },
        { key: 'marketCap', label: t('dataExplorer.table.marketCap', 'Market Cap'), sortable: true }
      ],
      forex: [
        { key: 'rate', label: t('dataExplorer.table.rate', 'Rate'), sortable: true },
        { key: 'changePercent', label: t('dataExplorer.table.change', 'Change'), sortable: true },
        { key: 'bid', label: t('dataExplorer.table.bid', 'Bid'), sortable: true },
        { key: 'ask', label: t('dataExplorer.table.ask', 'Ask'), sortable: true }
      ],
      commodities: [
        { key: 'price', label: t('dataExplorer.table.price', 'Price'), sortable: true },
        { key: 'changePercent', label: t('dataExplorer.table.change', 'Change'), sortable: true },
        { key: 'volume', label: t('dataExplorer.table.volume', 'Volume'), sortable: true }
      ],
      economy: [
        { key: 'value', label: t('dataExplorer.table.value', 'Value'), sortable: true },
        { key: 'changePercent', label: t('dataExplorer.table.change', 'Change'), sortable: true },
        { key: 'unit', label: t('dataExplorer.table.unit', 'Unit'), sortable: false }
      ],
      portfolio: [
        { key: 'value', label: t('dataExplorer.table.value', 'Value'), sortable: true },
        { key: 'changePercent', label: t('dataExplorer.table.change', 'Change'), sortable: true },
        { key: 'shares', label: t('dataExplorer.table.shares', 'Shares'), sortable: true },
        { key: 'weight', label: t('dataExplorer.table.weight', 'Weight %'), sortable: true }
      ]
    };

    return [...baseColumns, ...(categoryColumns[category] || [])];
  };

  const columns = getTableColumns(category);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-red-600 mr-2">⚠️</span>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">
                {t('dataExplorer.table.error', 'Data unavailable')}
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {error?.message || t('dataExplorer.errors.generic', 'Unable to load data')}
              </p>
            </div>
            <button
              onClick={onRetry}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
            >
              {t('common.retry', 'Retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('dataExplorer.table.noData', 'No data available')}
          </h3>
          <p className="text-gray-600">
            {t('dataExplorer.table.noDataDesc', 'No data found for the selected category.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Table Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            {t(`dataExplorer.categories.${category}`, category.charAt(0).toUpperCase() + category.slice(1))} {t('dataExplorer.table.data', 'Data')}
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>{sortedData.length} {t('dataExplorer.table.results', 'results')}</span>
            {selectedSymbols.length > 0 && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                {selectedSymbols.length} {t('dataExplorer.table.selected', 'selected')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Selection Column */}
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedSymbols.length === sortedData.length && sortedData.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSymbolSelect(sortedData.map(item => item.symbol));
                    } else {
                      onSymbolSelect([]);
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                />
              </th>

              {/* Data Columns */}
              {columns.map(column => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100 select-none' : ''
                  }`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <span className="text-gray-400 text-sm">
                        {getSortIndicator(column.key)}
                      </span>
                    )}
                  </div>
                </th>
              ))}

              {/* Actions Column */}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('dataExplorer.table.actions', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((item, index) => (
              <tr
                key={item.symbol || index}
                className={`hover:bg-gray-50 transition-colors ${
                  selectedSymbols.includes(item.symbol) ? 'bg-blue-50' : ''
                }`}
              >
                {/* Selection Checkbox */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedSymbols.includes(item.symbol)}
                    onChange={() => onSymbolSelect(item.symbol)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </td>

                {/* Data Cells */}
                {columns.map(column => (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCellValue(item[column.key], column.key)}
                  </td>
                ))}

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onAddToWatchlist(item.symbol)}
                      className="text-blue-600 hover:text-blue-900 text-xs font-medium transition-colors"
                      title={t('dataExplorer.table.addToWatchlist', 'Add to Watchlist')}
                    >
                      ⭐
                    </button>
                    <button
                      className="text-gray-600 hover:text-gray-900 text-xs font-medium transition-colors"
                      title={t('dataExplorer.table.viewDetails', 'View Details')}
                    >
                      👁️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <div>
            {t('dataExplorer.table.showing', 'Showing')} {sortedData.length} {t('dataExplorer.table.of', 'of')} {data.length} {t('dataExplorer.table.results', 'results')}
          </div>
          {selectedSymbols.length > 0 && (
            <div className="flex items-center space-x-2">
              <span>
                {selectedSymbols.length} {t('dataExplorer.table.selected', 'selected')}
              </span>
              <button
                onClick={() => selectedSymbols.forEach(symbol => onAddToWatchlist(symbol))}
                className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              >
                {t('dataExplorer.table.addSelectedToWatchlist', 'Add Selected to Watchlist')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataExplorerTable;