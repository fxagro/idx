import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { useTranslation } from 'react-i18next';

const DataExplorerCandleChart = ({ data, selectedSymbol, timeframe }) => {
  const { t } = useTranslation();
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const seriesRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [error, setError] = useState(null);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || 800,
          height: rect.height || 400
        });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize chart
  useEffect(() => {
    try {
      setError(null);

      if (!chartContainerRef.current || !data || data.length === 0) return;

      // Dispose of existing chart
      if (chartRef.current) {
        chartRef.current.remove();
      }

      // Create new chart
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#6b7280',
        },
        width: dimensions.width,
        height: dimensions.height,
        grid: {
          vertLines: { color: '#e5e7eb' },
          horzLines: { color: '#e5e7eb' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: '#e5e7eb',
          textColor: '#6b7280',
        },
        timeScale: {
          borderColor: '#e5e7eb',
          textColor: '#6b7280',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      chartRef.current = chart;

      // Create candlestick series
      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      seriesRef.current = candlestickSeries;

      // Format data for lightweight-charts
      const formattedData = data
        .filter(item => {
          // Filter for the selected symbol's OHLC data
          const hasOHLC = item[`${selectedSymbol}_open`] &&
                         item[`${selectedSymbol}_high`] &&
                         item[`${selectedSymbol}_low`] &&
                         item[`${selectedSymbol}_close`];
          return hasOHLC;
        })
        .map(item => {
          const time = Math.floor(new Date(item.date).getTime() / 1000);

          return {
            time,
            open: parseFloat(item[`${selectedSymbol}_open`]),
            high: parseFloat(item[`${selectedSymbol}_high`]),
            low: parseFloat(item[`${selectedSymbol}_low`]),
            close: parseFloat(item[`${selectedSymbol}_close`]),
          };
        })
        .filter(item => !isNaN(item.open) && !isNaN(item.high) && !isNaN(item.low) && !isNaN(item.close));

      if (formattedData.length === 0) {
        setError('No valid OHLC data available for candlestick chart');
        return;
      }

      // Set data
      candlestickSeries.setData(formattedData);

      // Fit content
      chart.timeScale().fitContent();

      // Cleanup function
      return () => {
        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
      };
    } catch (err) {
      console.error('Error initializing candlestick chart:', err);
      setError(err.message);
    }
  }, [data, selectedSymbol, dimensions]);

  // Update chart dimensions when they change
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        width: dimensions.width,
        height: dimensions.height,
      });
    }
  }, [dimensions]);

  // Handle errors
  if (error) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-red-600 font-medium">Chart Error</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">🕯️</div>
          <p>{t('dataExplorer.chart.noCandlestickData', 'No candlestick data available')}</p>
          <p className="text-sm mt-1">
            {t('dataExplorer.chart.selectSymbolForCandlestick', 'Select a symbol with OHLC data')}
          </p>
        </div>
      </div>
    );
  }

  if (!selectedSymbol) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p>{t('dataExplorer.chart.selectSymbol', 'Select a symbol to view candlestick chart')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-96">
      <div
        ref={chartContainerRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      {/* Chart overlay with symbol info */}
      <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
        {selectedSymbol} • {timeframe} {t('dataExplorer.chart.days', 'days')}
      </div>
    </div>
  );
};

export default DataExplorerCandleChart;