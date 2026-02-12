import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  TrendingUp,
  BarChart3,
  Zap,
  Shield,
  RefreshCw,
  AlertCircle,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Chart
} from 'chart.js';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import 'chartjs-adapter-date-fns';
import api from '../utils/api';

// Register ChartJS components and plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  CandlestickController,
  CandlestickElement,
  zoomPlugin,
  annotationPlugin
);

const TechnicalPage = () => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('BBCA');
  const [timeframe, setTimeframe] = useState('1M');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stocksList, setStocksList] = useState([]);
  const [showStocksDropdown, setShowStocksDropdown] = useState(false);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // Timeframe options
  const timeframeOptions = [
    { value: '1D', label: '1 Day', days: 1 },
    { value: '1W', label: '1 Week', days: 7 },
    { value: '1M', label: '1 Month', days: 30 },
    { value: '3M', label: '3 Months', days: 90 },
    { value: '6M', label: '6 Months', days: 180 },
    { value: '1Y', label: '1 Year', days: 365 }
  ];

  // Technical indicators
  const [indicators, setIndicators] = useState({
    sma: true,
    ema: true,
    rsi: true,
    macd: true,
    bollinger: true,
    fibonacci: false
  });

  // Fetch available stocks list
  useEffect(() => {
    const fetchStocksList = async () => {
      try {
        const response = await api.get('/stocks/symbols');
        if (response.success) {
          setStocksList(response.symbols);
        }
      } catch (err) {
        console.error('Error fetching stocks list:', err);
      }
    };

    fetchStocksList();
  }, []);

  // Fetch chart data
  useEffect(() => {
    const fetchChartData = async () => {
      if (!selectedSymbol) return;

      setLoading(true);
      setError(null);

      try {
        const response = await api.get(`/stocks/technical/${selectedSymbol}`, {
          params: { timeframe }
        });

        if (response.success) {
          setChartData(response.data);
        } else {
          setError('Failed to fetch chart data');
        }
      } catch (err) {
        console.error('Error fetching chart data:', err);
        setError('Network error while fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [selectedSymbol, timeframe]);

  // Initialize and update chart
  useEffect(() => {
    if (!chartData || !chartRef.current) return;

    // Destroy existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    // Create new chart
    const ctx = chartRef.current.getContext('2d');
    
    const data = {
      datasets: [
        {
          label: 'Stock Price',
          data: chartData.map(d => ({
            x: new Date(d.trade_date),
            o: d.open,
            h: d.high,
            l: d.low,
            c: d.close
          })),
          borderColor: 'rgba(53, 162, 235, 1)',
          backgroundColor: 'rgba(53, 162, 235, 0.2)',
          borderWidth: 2
        }
      ]
    };

    // Add technical indicators
    if (indicators.sma) {
      data.datasets.push({
        label: 'SMA 20',
        type: 'line',
        data: chartData.map(d => ({
          x: new Date(d.trade_date),
          y: d.sma20
        })),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 0
      });

      data.datasets.push({
        label: 'SMA 50',
        type: 'line',
        data: chartData.map(d => ({
          x: new Date(d.trade_date),
          y: d.sma50
        })),
        borderColor: 'rgba(153, 102, 255, 1)',
        backgroundColor: 'rgba(153, 102, 255, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 0
      });
    }

    if (indicators.ema) {
      data.datasets.push({
        label: 'EMA 12',
        type: 'line',
        data: chartData.map(d => ({
          x: new Date(d.trade_date),
          y: d.ema12
        })),
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 0
      });

      data.datasets.push({
        label: 'EMA 26',
        type: 'line',
        data: chartData.map(d => ({
          x: new Date(d.trade_date),
          y: d.ema26
        })),
        borderColor: 'rgba(255, 159, 64, 1)',
        backgroundColor: 'rgba(255, 159, 64, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 0
      });
    }

    if (indicators.bollinger) {
      data.datasets.push({
        label: 'Bollinger Upper',
        type: 'line',
        data: chartData.map(d => ({
          x: new Date(d.trade_date),
          y: d.bollinger?.upper
        })),
        borderColor: 'rgba(255, 206, 86, 1)',
        backgroundColor: 'rgba(255, 206, 86, 0.1)',
        borderWidth: 1,
        fill: false,
        tension: 0.1,
        pointRadius: 0
      });

      data.datasets.push({
        label: 'Bollinger Lower',
        type: 'line',
        data: chartData.map(d => ({
          x: new Date(d.trade_date),
          y: d.bollinger?.lower
        })),
        borderColor: 'rgba(255, 206, 86, 1)',
        backgroundColor: 'rgba(255, 206, 86, 0.1)',
        borderWidth: 1,
        fill: '-1',
        tension: 0.1,
        pointRadius: 0
      });
    }

    const chartInstance = new ChartJS(ctx, {
      type: 'candlestick',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14
            },
            bodyFont: {
              size: 13
            },
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';

                if (label) {
                  label += ': ';
                }

                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat('id-ID', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }).format(context.parsed.y);
                }

                return label;
              }
            }
          },
          zoom: {
            zoom: {
              wheel: {
                enabled: true
              },
              pinch: {
                enabled: true
              },
              mode: 'x'
            },
            pan: {
              enabled: true,
              mode: 'x'
            }
          },
          annotation: {
            annotations: indicators.fibonacci ? generateFibonacciAnnotations(chartData) : []
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: timeframe === '1D' ? 'hour' : 'day',
              displayFormats: {
                hour: 'HH:mm',
                day: 'MMM d'
              }
            },
            title: {
              display: true,
              text: 'Date'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Price (IDR)'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
              callback: function(value) {
                return new Intl.NumberFormat('id-ID').format(value);
              }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        },
        animation: {
          duration: 750
        }
      }
    });

    chartInstanceRef.current = chartInstance;

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [chartData, timeframe, indicators]);

  // Helper function to generate Fibonacci retracement levels
  const generateFibonacciAnnotations = (data) => {
    if (!data || data.length === 0) return [];

    const prices = data.map(d => d.close);
    const high = Math.max(...prices);
    const low = Math.min(...prices);

    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const annotations = [];

    levels.forEach((level, index) => {
      const price = high - (high - low) * level;
      annotations.push({
        type: 'line',
        yMin: price,
        yMax: price,
        xMin: 0,
        xMax: data.length - 1,
        borderColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.8)`,
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
          content: `${(level * 100).toFixed(0)}%`,
          position: 'top',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          font: {
            size: 10,
            weight: 'bold'
          },
          padding: 4,
          borderRadius: 4
        }
      });
    });

    return annotations;
  };

  // Handle search and symbol selection
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setShowStocksDropdown(true);
  };

  const handleSymbolSelect = (symbol) => {
    setSelectedSymbol(symbol);
    setSearchTerm(symbol);
    setShowStocksDropdown(false);
  };

  // Filter stocks list based on search term
  const filteredStocks = useMemo(() => {
    if (!searchTerm) return stocksList.slice(0, 10);

    return stocksList.filter(stock =>
      stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 10);
  }, [searchTerm, stocksList]);

  // Calculate current price information
  const currentPriceInfo = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    const current = chartData[chartData.length - 1];
    const previous = chartData.length > 1 ? chartData[chartData.length - 2] : current;

    const change = current.close - previous.close;
    const changePercent = ((change / previous.close) * 100).toFixed(2);

    return {
      price: current.close,
      change: change.toFixed(2),
      changePercent: changePercent,
      isPositive: change > 0
    };
  }, [chartData]);

  // Calculate volume information
  const volumeInfo = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    const currentVolume = chartData[chartData.length - 1].volume;
    const avgVolume = chartData.reduce((sum, d) => sum + d.volume, 0) / chartData.length;

    return {
      current: currentVolume,
      average: avgVolume
    };
  }, [chartData]);

  // Calculate RSI information
  const rsiInfo = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    const currentRSI = chartData[chartData.length - 1].rsi14;
    
    let status = 'neutral';
    if (currentRSI >= 70) status = 'overbought';
    else if (currentRSI <= 30) status = 'oversold';

    return {
      value: currentRSI,
      status: status
    };
  }, [chartData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t('technicalAnalysis')}</h1>
          <p className="text-slate-400">{t('technicalAnalysisDescription')}</p>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Stock Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder={t('searchStock')}
                value={searchTerm}
                onChange={handleSearch}
                onFocus={() => setShowStocksDropdown(true)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showStocksDropdown && (
                <div className="absolute z-50 w-full mt-2 bg-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {filteredStocks.map((stock) => (
                    <div
                      key={stock.symbol}
                      onClick={() => handleSymbolSelect(stock.symbol)}
                      className="px-4 py-3 hover:bg-slate-600 cursor-pointer transition-colors"
                    >
                      <div className="font-semibold text-white">{stock.symbol}</div>
                      <div className="text-sm text-slate-400">{stock.name}</div>
                    </div>
                  ))}
                  {filteredStocks.length === 0 && (
                    <div className="px-4 py-3 text-slate-400">{t('noResultsFound')}</div>
                  )}
                </div>
              )}
            </div>

            {/* Timeframe Selector */}
            <div>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timeframeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Indicators Toggle */}
            <div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(indicators).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => setIndicators(prev => ({ ...prev, [key]: !value }))}
                    className={`px-3 py-1 text-sm rounded-full ${
                      value ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'
                    } hover:bg-blue-700 transition-colors`}
                  >
                    {key.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Refresh Button */}
            <div>
              <button
                onClick={() => {
                  // Reset chart to current data
                  window.location.reload();
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={20} />
                {t('refresh')}
              </button>
            </div>
          </div>
        </div>

        {/* Price Information Card */}
        {currentPriceInfo && (
          <div className="bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center gap-6">
              <div className="text-4xl font-bold text-white">
                {new Intl.NumberFormat('id-ID', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }).format(currentPriceInfo.price)}
              </div>
              <div className={`flex items-center gap-2 ${currentPriceInfo.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {currentPriceInfo.isPositive ? (
                  <ArrowUp size={24} />
                ) : (
                  <ArrowDown size={24} />
                )}
                <span className="text-xl font-semibold">
                  {currentPriceInfo.isPositive ? '+' : ''}{currentPriceInfo.change}
                </span>
                <span className="text-xl font-semibold">
                  ({currentPriceInfo.isPositive ? '+' : ''}{currentPriceInfo.changePercent}%)
                </span>
              </div>
              <div className="text-slate-400 text-sm">{selectedSymbol}</div>
            </div>
          </div>
        )}

        {/* Chart Container */}
        <div className="bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="relative">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw className="animate-spin text-blue-500 mb-4" size={40} />
                <p className="text-slate-400">{t('loadingData')}</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20">
                <AlertCircle className="text-red-500 mb-4" size={40} />
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('tryAgain')}
                </button>
              </div>
            ) : (
              <div className="h-96">
                <canvas ref={chartRef}></canvas>
              </div>
            )}
          </div>
        </div>

        {/* Technical Analysis Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Volume Card */}
          {volumeInfo && (
            <div className="bg-slate-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="text-blue-500" size={24} />
                <h3 className="text-xl font-semibold text-white">{t('volume')}</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-slate-400 text-sm">{t('currentVolume')}</div>
                  <div className="text-2xl font-bold text-white">
                    {new Intl.NumberFormat('id-ID').format(volumeInfo.current)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-sm">{t('averageVolume')}</div>
                  <div className="text-xl font-semibold text-white">
                    {new Intl.NumberFormat('id-ID').format(Math.round(volumeInfo.average))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* RSI Card */}
          {rsiInfo && (
            <div className="bg-slate-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="text-green-500" size={24} />
                <h3 className="text-xl font-semibold text-white">RSI (14)</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-slate-400 text-sm">{t('rsiValue')}</div>
                  <div className="text-2xl font-bold text-white">
                    {rsiInfo.value?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-sm">{t('status')}</div>
                  <div className={`text-xl font-semibold ${
                    rsiInfo.status === 'overbought' ? 'text-red-400' :
                    rsiInfo.status === 'oversold' ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    {t(rsiInfo.status)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SMA Card */}
          {chartData && chartData.length > 0 && (
            <div className="bg-slate-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="text-purple-500" size={24} />
                <h3 className="text-xl font-semibold text-white">{t('movingAverages')}</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-slate-400 text-sm">SMA 20</div>
                  <div className="text-2xl font-bold text-white">
                    {new Intl.NumberFormat('id-ID', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(chartData[chartData.length - 1].sma20 || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-sm">SMA 50</div>
                  <div className="text-xl font-semibold text-white">
                    {new Intl.NumberFormat('id-ID', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }).format(chartData[chartData.length - 1].sma50 || 0)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MACD Card */}
          {chartData && chartData.length > 0 && (
            <div className="bg-slate-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="text-yellow-500" size={24} />
                <h3 className="text-xl font-semibold text-white">MACD</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-slate-400 text-sm">MACD</div>
                  <div className="text-2xl font-bold text-white">
                    {chartData[chartData.length - 1].macd?.macd?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-sm">Signal</div>
                  <div className="text-xl font-semibold text-white">
                    {chartData[chartData.length - 1].macd?.signal?.toFixed(2) || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Trading Recommendations */}
        <div className="bg-slate-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="text-green-500" size={24} />
            <h3 className="text-xl font-semibold text-white">{t('tradingRecommendations')}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-green-400 font-semibold mb-2">{t('buySignal')}</div>
              <p className="text-slate-400 text-sm">
                {t('buyRecommendation')}
              </p>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-yellow-400 font-semibold mb-2">{t('holdSignal')}</div>
              <p className="text-slate-400 text-sm">
                {t('holdRecommendation')}
              </p>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-red-400 font-semibold mb-2">{t('sellSignal')}</div>
              <p className="text-slate-400 text-sm">
                {t('sellRecommendation')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicalPage;
