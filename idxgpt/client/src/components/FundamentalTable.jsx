import React from 'react';

const FundamentalTable = ({ data, trends }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Fundamental Data</h3>
        <p className="text-gray-500">No fundamental data available</p>
      </div>
    );
  }

  const formatNumber = (num) => {
    if (num === null || num === undefined || num === 0) return 'N/A';
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const formatPercentage = (num) => {
    if (num === null || num === undefined || num === 0) return 'N/A';
    const numValue = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(numValue)) return 'N/A';
    return `${numValue.toFixed(2)}%`;
  };

  const getTrendIcon = (trend) => {
    if (trend > 5) return <span className="text-green-500">↗</span>;
    if (trend < -5) return <span className="text-red-500">↘</span>;
    return <span className="text-gray-400">→</span>;
  };

  const getTrendColor = (trend) => {
    if (trend > 5) return 'text-green-600';
    if (trend < -5) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Fundamental Data</h3>

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Metric
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Latest
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Previous
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trend
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* EPS Row */}
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                EPS (Earnings Per Share)
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {formatNumber(data[0]?.eps)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {data[1] ? formatNumber(data[1].eps) : 'N/A'}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm">
                {trends?.eps_trend !== undefined ? (
                  <span className={`flex items-center ${getTrendColor(trends.eps_trend)}`}>
                    {getTrendIcon(trends.eps_trend)}
                    <span className="ml-1">{formatPercentage(trends.eps_trend)}</span>
                  </span>
                ) : 'N/A'}
              </td>
            </tr>

            {/* PER Row */}
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                PER (Price to Earnings Ratio)
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {formatNumber(data[0]?.per)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {data[1] ? formatNumber(data[1].per) : 'N/A'}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm">
                {trends?.per_trend !== undefined ? (
                  <span className={`flex items-center ${getTrendColor(trends.per_trend)}`}>
                    {getTrendIcon(trends.per_trend)}
                    <span className="ml-1">{formatPercentage(trends.per_trend)}</span>
                  </span>
                ) : 'N/A'}
              </td>
            </tr>

            {/* PBV Row */}
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                PBV (Price to Book Value)
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {formatNumber(data[0]?.pbv)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {data[1] ? formatNumber(data[1].pbv) : 'N/A'}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm">
                {trends?.pbv_trend !== undefined ? (
                  <span className={`flex items-center ${getTrendColor(trends.pbv_trend)}`}>
                    {getTrendIcon(trends.pbv_trend)}
                    <span className="ml-1">{formatPercentage(trends.pbv_trend)}</span>
                  </span>
                ) : 'N/A'}
              </td>
            </tr>

            {/* ROE Row */}
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                ROE (Return on Equity)
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {formatPercentage(data[0]?.roe)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {data[1] ? formatPercentage(data[1].roe) : 'N/A'}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm">
                {trends?.roe_trend !== undefined ? (
                  <span className={`flex items-center ${getTrendColor(trends.roe_trend)}`}>
                    {getTrendIcon(trends.roe_trend)}
                    <span className="ml-1">{formatPercentage(trends.roe_trend)}</span>
                  </span>
                ) : 'N/A'}
              </td>
            </tr>

            {/* Dividend Yield Row */}
            <tr className="hover:bg-gray-50">
              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                Dividend Yield
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                {formatPercentage(data[0]?.dividend_yield)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                {data[1] ? formatPercentage(data[1].dividend_yield) : 'N/A'}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400">
                N/A
              </td>
            </tr>

            {/* Additional metrics - only show if data exists */}
            {data[0]?.market_cap && (
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  Market Cap
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(data[0].market_cap)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {data[1]?.market_cap ? formatNumber(data[1].market_cap) : 'N/A'}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400">
                  N/A
                </td>
              </tr>
            )}

            {data[0]?.total_equity && (
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  Total Equity
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(data[0].total_equity)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {data[1]?.total_equity ? formatNumber(data[1].total_equity) : 'N/A'}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400">
                  N/A
                </td>
              </tr>
            )}

            {data[0]?.total_debt && (
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  Total Debt
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(data[0].total_debt)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {data[1]?.total_debt ? formatNumber(data[1].total_debt) : 'N/A'}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-400">
                  N/A
                </td>
              </tr>
            )}

            {data[0]?.revenue && (
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  Revenue
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(data[0].revenue)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {data[1]?.revenue ? formatNumber(data[1].revenue) : 'N/A'}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm">
                  {trends?.revenue_trend !== undefined ? (
                    <span className={`flex items-center ${getTrendColor(trends.revenue_trend)}`}>
                      {getTrendIcon(trends.revenue_trend)}
                      <span className="ml-1">{formatPercentage(trends.revenue_trend)}</span>
                    </span>
                  ) : 'N/A'}
                </td>
              </tr>
            )}

            {data[0]?.net_profit && (
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                  Net Profit
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                  {formatNumber(data[0].net_profit)}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                  {data[1]?.net_profit ? formatNumber(data[1].net_profit) : 'N/A'}
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-sm">
                  {trends?.profit_trend !== undefined ? (
                    <span className={`flex items-center ${getTrendColor(trends.profit_trend)}`}>
                      {getTrendIcon(trends.profit_trend)}
                      <span className="ml-1">{formatPercentage(trends.profit_trend)}</span>
                    </span>
                  ) : 'N/A'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {trends && (
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <h4 className="text-sm font-medium text-gray-800 mb-2">Overall Assessment</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Fundamental Trend:</span>
              <span className={`ml-2 font-medium ${getTrendColor(0)}`}>
                {trends.eps_trend > 10 && trends.roe_trend > 5 ? 'Improving' :
                 trends.eps_trend < -10 || trends.roe_trend < -5 ? 'Declining' : 'Stable'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Growth Potential:</span>
              <span className={`ml-2 font-medium ${getTrendColor(trends.revenue_trend)}`}>
                {trends.revenue_trend > 15 ? 'High' :
                 trends.revenue_trend > 5 ? 'Moderate' : 'Low'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FundamentalTable;