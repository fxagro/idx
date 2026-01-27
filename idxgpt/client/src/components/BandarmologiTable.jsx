import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const BandarmologiTable = ({
  data,
  type = 'default',
  loading = false,
  error = null,
  sortable = true,
  paginated = true,
  pageSize = 10,
  emptyMessage = 'No data available',
  className = '',
  onRowClick = null,
  formatNumber,
  formatCurrency,
  t
}) => {
  const { i18n } = useTranslation();
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  // Define columns based on type
  const columns = useMemo(() => {
    switch (type) {
      case 'brokerAnalysis':
        return [
          {
            key: 'kode_broker',
            label: t('bandarmologi.tables.brokerAnalysis.broker'),
            sortable: true,
            format: 'text'
          },
          {
            key: 'buy_freq',
            label: t('bandarmologi.tables.brokerAnalysis.buyFreq'),
            sortable: true,
            format: 'number'
          },
          {
            key: 'buy_vol',
            label: t('bandarmologi.tables.brokerAnalysis.buyVol'),
            sortable: true,
            format: 'number',
            render: (value) => formatNumber ? formatNumber(value) : value?.toLocaleString()
          },
          {
            key: 'buy_avg',
            label: t('bandarmologi.tables.brokerAnalysis.avgPrice'),
            sortable: true,
            format: 'number',
            render: (value) => formatNumber ? formatNumber(value) : value?.toLocaleString()
          },
          {
            key: 'buy_percent',
            label: t('bandarmologi.tables.brokerAnalysis.buyPercent'),
            sortable: true,
            format: 'percentage'
          },
          {
            key: 'sell_freq',
            label: t('bandarmologi.tables.brokerAnalysis.sellFreq'),
            sortable: true,
            format: 'number'
          },
          {
            key: 'sell_vol',
            label: t('bandarmologi.tables.brokerAnalysis.sellVol'),
            sortable: true,
            format: 'number',
            render: (value) => formatNumber ? formatNumber(value) : value?.toLocaleString()
          },
          {
            key: 'sell_avg',
            label: t('bandarmologi.tables.brokerAnalysis.avgPrice'),
            sortable: true,
            format: 'number',
            render: (value) => formatNumber ? formatNumber(value) : value?.toLocaleString()
          },
          {
            key: 'sell_percent',
            label: t('bandarmologi.tables.brokerAnalysis.sellPercent'),
            sortable: true,
            format: 'percentage'
          },
          {
            key: 'net_vol',
            label: t('bandarmologi.tables.brokerAnalysis.netVol'),
            sortable: true,
            format: 'number',
            render: (value) => {
              const numValue = Number(value) || 0;
              const prefix = numValue > 0 ? '+' : '';
              return (
                <span className={numValue > 0 ? 'text-green-600' : 'text-red-600'}>
                  {prefix}{formatNumber ? formatNumber(numValue) : numValue.toLocaleString()}
                </span>
              );
            }
          },
          {
            key: 'net_val',
            label: t('bandarmologi.tables.brokerAnalysis.netVal'),
            sortable: true,
            format: 'number',
            render: (value, row) => {
              if (!value) {
                const numValue = Number(row.net_vol) || 0;
                const avgPrice = numValue > 0 ? (row.buy_avg || 0) : (row.sell_avg || 0);
                const netVal = numValue * avgPrice;
                const prefix = netVal > 0 ? '+' : '';
                return (
                  <span className={netVal > 0 ? 'text-green-600' : 'text-red-600'}>
                    {prefix}{formatNumber ? formatNumber(Math.abs(netVal)) : Math.abs(netVal).toLocaleString()}
                  </span>
                );
              }
              return formatNumber ? formatNumber(value) : value.toLocaleString();
            }
          }
        ];

      case 'stockAnalysis':
        return [
          {
            key: 'saham',
            label: t('bandarmologi.tables.stockAnalysis.stock'),
            sortable: true,
            format: 'text'
          },
          {
            key: 'net_buy',
            label: t('bandarmologi.tables.stockAnalysis.netFlow'),
            sortable: true,
            format: 'number',
            render: (value) => formatNumber ? formatNumber(value) : value?.toLocaleString()
          },
          {
            key: 'avg',
            label: t('bandarmologi.tables.stockAnalysis.avgPrice'),
            sortable: true,
            format: 'number'
          },
          {
            key: 'value',
            label: t('bandarmologi.tables.stockAnalysis.value'),
            sortable: true,
            format: 'number',
            render: (value) => formatNumber ? formatNumber(value) : value?.toLocaleString()
          }
        ];

      case 'brokerSummary':
        return [
          {
            key: 'broker',
            label: t('bandarmologi.tables.brokerSummary.broker'),
            sortable: true,
            format: 'text'
          },
          {
            key: 'lot',
            label: t('bandarmologi.tables.brokerSummary.totalBuy'),
            sortable: true,
            format: 'number',
            render: (value) => formatNumber ? formatNumber(value) : value?.toLocaleString()
          },
          {
            key: 'val',
            label: t('bandarmologi.tables.brokerSummary.totalSell'),
            sortable: true,
            format: 'number',
            render: (value) => formatNumber ? formatNumber(value) : value?.toLocaleString()
          }
        ];

      case 'tradingPlan':
        return [
          {
            key: 'saham',
            label: t('bandarmologi.tables.tradingPlan.stock'),
            sortable: true,
            format: 'text'
          },
          {
            key: 'net_buy',
            label: t('bandarmologi.tables.tradingPlan.netBuy'),
            sortable: true,
            format: 'number',
            render: (value) => formatNumber ? formatNumber(value) : value?.toLocaleString()
          },
          {
            key: 'value',
            label: t('bandarmologi.tables.tradingPlan.value'),
            sortable: true,
            format: 'number',
            render: (value) => formatNumber ? formatNumber(value) : value?.toLocaleString()
          },
          {
            key: 'acr_percent',
            label: t('bandarmologi.tables.tradingPlan.confidence'),
            sortable: true,
            format: 'percentage'
          },
          {
            key: 'last_price',
            label: t('bandarmologi.tables.tradingPlan.entryPrice'),
            sortable: true,
            format: 'currency',
            render: (value) => formatCurrency ? formatCurrency(value) : `Rp ${value?.toLocaleString()}`
          },
          {
            key: 'pbv',
            label: t('bandarmologi.tables.tradingPlan.stopLoss'),
            sortable: true,
            format: 'number',
            render: (value) => `${value}x`
          },
          {
            key: 'book_value',
            label: t('bandarmologi.tables.tradingPlan.targetPrice'),
            sortable: true,
            format: 'currency',
            render: (value) => formatCurrency ? formatCurrency(value) : `Rp ${value?.toLocaleString()}`
          },
          {
            key: 'npm_percent',
            label: t('bandarmologi.tables.tradingPlan.rationale'),
            sortable: true,
            format: 'percentage'
          },
          {
            key: 'tp5_percent',
            label: t('bandarmologi.tables.tradingPlan.tp5Percent'),
            sortable: true,
            format: 'percentage'
          },
          {
            key: 'tp10_percent',
            label: t('bandarmologi.tables.tradingPlan.tp10Percent'),
            sortable: true,
            format: 'percentage'
          },
          {
            key: 'tp20_percent',
            label: t('bandarmologi.tables.tradingPlan.tp20Percent'),
            sortable: true,
            format: 'percentage'
          },
          {
            key: 'keterangan',
            label: t('bandarmologi.tables.tradingPlan.info'),
            sortable: true,
            format: 'text',
            render: (value) => (
              <span className={`px-2 py-1 rounded text-sm font-medium ${
                value === t('bandarmologi.bigAcc')
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {value}
              </span>
            )
          }
        ];

      default:
        return [];
    }
  }, [type, t, formatNumber, formatCurrency]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortable || !sortConfig.key || !data) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [data, sortConfig, sortable]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!paginated || !sortedData) return sortedData;

    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize, paginated]);

  // Calculate pagination info
  const totalPages = paginated ? Math.ceil((sortedData?.length || 0) / pageSize) : 1;
  const totalItems = sortedData?.length || 0;

  const handleSort = (key) => {
    if (!sortable) return;

    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const formatCellValue = (value, column) => {
    if (value === null || value === undefined) return '-';

    // Use custom render function if provided
    if (column.render) {
      return column.render(value, data.find(row => row[column.key] === value));
    }

    // Format numbers
    if (typeof value === 'number') {
      if (column.format === 'currency' && formatCurrency) {
        return formatCurrency(value);
      }

      if (column.format === 'number' && formatNumber) {
        return formatNumber(value);
      }

      if (column.format === 'percentage') {
        return `${value.toFixed(2)}%`;
      }
    }

    return value.toString();
  };

  const getSortIcon = (key) => {
    if (!sortable || sortConfig.key !== key) {
      return '↕️';
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">{t('common.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              {t('common.error')}
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          {t('common.noData')}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-white shadow overflow-hidden sm:rounded-md ${className}`}>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    sortable && column.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => column.sortable !== false && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {sortable && column.sortable !== false && (
                      <span className="text-gray-400">{getSortIcon(column.key)}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, index) => (
              <tr
                key={row.id || index}
                className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                  >
                    {formatCellValue(row[column.key], column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paginated && totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.previous')}
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.next')}
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                {t('common.showing')} <span className="font-medium">{((currentPage - 1) * pageSize) + 1}</span> {t('common.to')}{' '}
                <span className="font-medium">
                  {Math.min(currentPage * pageSize, totalItems)}
                </span> {t('common.of', 'of')}{' '}
                <span className="font-medium">{totalItems}</span> {t('common.results')}
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">{t('common.previous')}</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pageNum === currentPage
                          ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">{t('common.next')}</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BandarmologiTable;