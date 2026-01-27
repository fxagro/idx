import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import DataExplorerCandleChart from './DataExplorerCandleChart';

const DataExplorerChart = ({
  data,
  loading,
  error,
  onRetry,
  chartType,
  selectedSymbols,
  timeframe
}) => {
  const { t } = useTranslation();

  // Color palette for multiple symbols
  const colors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // yellow
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1'  // indigo
  ];

  // Format data for different chart types
  const formattedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map(item => {
      const formatted = { ...item };

      // Convert date string to display format
      if (item.date) {
        const date = new Date(item.date);
        formatted.displayDate = date.toLocaleDateString();
        formatted.shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }

      return formatted;
    });
  }, [data]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              ></div>
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-medium text-gray-900">
                {typeof entry.value === 'number' ? `$${entry.value.toFixed(2)}` : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Render different chart types
  const renderChart = () => {
    if (formattedData.length === 0) {
      return (
        <div className="flex items-center justify-center h-96 text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📈</div>
            <p>{t('dataExplorer.chart.noData', 'No chart data available')}</p>
            <p className="text-sm mt-1">
              {t('dataExplorer.chart.selectSymbols', 'Select symbols to view chart')}
            </p>
          </div>
        </div>
      );
    }

    const chartProps = {
      data: formattedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="shortDate"
              stroke="#6b7280"
              fontSize={12}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tick={{ fontSize: 11 }}
              label={{ value: 'Price ($)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            {selectedSymbols.map((symbol, index) => (
              <Line
                key={symbol}
                type="monotone"
                dataKey={`${symbol}_close`}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[index % colors.length], strokeWidth: 2, r: 3 }}
                name={symbol}
                connectNulls={false}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="shortDate"
              stroke="#6b7280"
              fontSize={12}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tick={{ fontSize: 11 }}
              label={{ value: 'Price ($)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            {selectedSymbols.map((symbol, index) => (
              <Area
                key={symbol}
                type="monotone"
                dataKey={`${symbol}_close`}
                stackId="1"
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.3}
                name={symbol}
              />
            ))}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="shortDate"
              stroke="#6b7280"
              fontSize={12}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tick={{ fontSize: 11 }}
              label={{ value: 'Price ($)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            />
            <Tooltip content={<CustomTooltip />} />
            {selectedSymbols.map((symbol, index) => (
              <Bar
                key={symbol}
                dataKey={`${symbol}_close`}
                fill={colors[index % colors.length]}
                name={symbol}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case 'candlestick':
        // Use the dedicated candlestick chart component
        return (
          <DataExplorerCandleChart
            data={formattedData}
            selectedSymbol={selectedSymbols[0]}
            timeframe={timeframe}
          />
        );

      default:
        return (
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="shortDate" />
            <YAxis />
            <Tooltip />
            {selectedSymbols.map((symbol, index) => (
              <Line
                key={symbol}
                type="monotone"
                dataKey={`${symbol}_close`}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        );
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="h-96 bg-gray-100 rounded"></div>
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
                {t('dataExplorer.chart.error', 'Chart data unavailable')}
              </h3>
              <p className="text-sm text-red-700 mt-1">
                {error?.message || t('dataExplorer.errors.generic', 'Unable to load chart data')}
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

  if (selectedSymbols.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {t('dataExplorer.chart.selectSymbolsTitle', 'Select Symbols to View Chart')}
          </h3>
          <p className="text-gray-600">
            {t('dataExplorer.chart.selectSymbolsDesc', 'Choose symbols from the table view to visualize their data.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Chart Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {t('dataExplorer.chart.title', 'Price Chart')}
            </h3>
            <p className="text-sm text-gray-600">
              {selectedSymbols.join(', ')} • {timeframe} {t('dataExplorer.chart.days', 'days')}
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center space-x-4">
            {selectedSymbols.map((symbol, index) => (
              <div key={symbol} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                ></div>
                <span className="text-sm font-medium text-gray-700">{symbol}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="p-6">
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>
              {t('dataExplorer.chart.dataPoints', 'Data points')}: {formattedData.length}
            </span>
            <span>
              {t('dataExplorer.chart.symbols', 'Symbols')}: {selectedSymbols.length}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
              {chartType.charAt(0).toUpperCase() + chartType.slice(1)} {t('dataExplorer.chart.view', 'View')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataExplorerChart;