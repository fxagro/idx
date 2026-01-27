import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import io from 'socket.io-client';

// Throttle utility for performance optimization
const throttle = (func, delay) => {
  let timeoutId;
  let lastExecTime = 0;
  return function (...args) {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[TVS Chart] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">The TVS component encountered an error. Please refresh the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
import Select from 'react-select';
import api from '../utils/api';

// Register Chart.js components
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

// Enhanced Technical Indicators Calculation Functions
const calculateSMA = (data, period) => {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val, 0);
      sma.push(sum / period);
    }
  }
  return sma;
};

const calculateEMA = (data, period) => {
  const ema = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      ema.push(data[i]);
    } else {
      const emaValue = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
      ema.push(emaValue);
    }
  }
  return ema;
};

const calculateRSI = (data, period = 14) => {
  const rsi = [];
  const gains = [];
  const losses = [];

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

  for (let i = period; i < data.length; i++) {
    if (i > period) {
      avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
    }

    const rs = avgGain / avgLoss;
    rsi.push(100 - (100 / (1 + rs)));
  }

  for (let i = 0; i < period; i++) {
    rsi.unshift(null);
  }

  return rsi;
};

const calculateMACD = (data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  const emaFast = calculateEMA(data, fastPeriod);
  const emaSlow = calculateEMA(data, slowPeriod);

  const macdLine = emaFast.map((fast, i) => {
    if (fast === null || emaSlow[i] === null) return null;
    return fast - emaSlow[i];
  });

  const signalLine = calculateEMA(macdLine.filter(val => val !== null), signalPeriod);

  const fullSignalLine = [];
  let signalIndex = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      fullSignalLine.push(null);
    } else {
      fullSignalLine.push(signalIndex < signalLine.length ? signalLine[signalIndex] : null);
      signalIndex++;
    }
  }

  const histogram = macdLine.map((macd, i) => {
    if (macd === null || fullSignalLine[i] === null) return null;
    return macd - fullSignalLine[i];
  });

  return { macdLine, signalLine: fullSignalLine, histogram };
};

const calculateBollingerBands = (data, period = 20, standardDeviations = 2) => {
  const sma = calculateSMA(data, period);
  const upperBand = [];
  const lowerBand = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1 || sma[i] === null) {
      upperBand.push(null);
      lowerBand.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = sma[i];
      const variance = slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);

      upperBand.push(mean + (standardDeviations * stdDev));
      lowerBand.push(mean - (standardDeviations * stdDev));
    }
  }

  return { sma, upperBand, lowerBand };
};

const calculateFibonacciRetracement = (data) => {
  if (data.length < 2) return { levels: [], fibLevels: [], annotations: [] };

  const high = Math.max(...data.map(d => d.high));
  const low = Math.min(...data.map(d => d.low));
  const range = high - low;

  const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const levels = fibLevels.map(level => low + (range * level));

  // Create annotations for Chart.js
  const annotations = levels.map((level, index) => ({
    type: 'line',
    yMin: level,
    yMax: level,
    borderColor: `rgba(${index === 0 ? '239, 68, 68' : index === fibLevels.length - 1 ? '16, 185, 129' : '59, 130, 246'}, 0.8)`,
    borderWidth: 1,
    borderDash: [5, 5],
    label: {
      display: true,
      content: `${(fibLevels[index] * 100)}% (${level.toFixed(2)})`,
      position: 'start'
    }
  }));

  return { levels, fibLevels, annotations };
};

// Custom hook for technical indicators
const useTechnicalIndicators = (data, indicators) => {
  return useMemo(() => {
    if (!data || data.length === 0) return {};

    const result = {};

    indicators.forEach(indicator => {
      switch (indicator.type) {
        case 'SMA':
          result[`SMA_${indicator.period}`] = calculateSMA(
            data.map(d => d.close),
            indicator.period
          );
          break;
        case 'EMA':
          result[`EMA_${indicator.period}`] = calculateEMA(
            data.map(d => d.close),
            indicator.period
          );
          break;
        case 'RSI':
          result[`RSI_${indicator.period}`] = calculateRSI(
            data.map(d => d.close),
            indicator.period
          );
          break;
        case 'MACD':
          result[`MACD_${indicator.fast}_${indicator.slow}_${indicator.signal}`] = calculateMACD(
            data.map(d => d.close),
            indicator.fast,
            indicator.slow,
            indicator.signal
          );
          break;
        case 'BB':
          result[`BB_${indicator.period}_${indicator.stdDev}`] = calculateBollingerBands(
            data.map(d => d.close),
            indicator.period,
            indicator.stdDev
          );
          break;
        case 'FIBONACCI':
          result['FIBONACCI'] = calculateFibonacciRetracement(data);
          break;
        default:
          break;
      }
    });

    return result;
  }, [data, indicators]);
};

// TradingView Super Enhanced Component
// Debugging Instructions:
// 1. Clear browser cache: Ctrl+F5 or Cmd+Shift+R
// 2. Restart Vite server: npm run dev
// 3. Clear node_modules and reinstall: rm -rf node_modules && npm install
// 4. Check console for '[TVS] Fetching US symbols...' and '[TVS] US symbols fetched:'
// 5. Check console for '[TVS] Formatting Y-axis tick:' and '[TVS] Formatting tooltip:'
// 6. Verify market switching: window.simulateTVSTest()
// 7. Verify alert creation: window.simulateAlertTest()
// 8. Verify API connection: window.debugApiConnection()
const TradingViewSuperChart = () => {
  const { t, i18n } = useTranslation();

  // Core state management
  const [idxSymbols, setIdxSymbols] = useState([]);
  const [usSymbols, setUsSymbols] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [compareSymbols, setCompareSymbols] = useState([]);
  const [timeRange, setTimeRange] = useState('1D');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Company name state
  const [companyName, setCompanyName] = useState('');

  // Market selection state
  const [marketType, setMarketType] = useState('IDX');
  const [loadingSymbols, setLoadingSymbols] = useState(true);
  const [loadingUsSymbols, setLoadingUsSymbols] = useState(false);

  // Custom alerts state
  const [alerts, setAlerts] = useState([]);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertModalData, setAlertModalData] = useState({
    price: 0,
    type: 'price_above'
  });
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Enhanced alerts state for interactive features
  const [alertNotifications, setAlertNotifications] = useState([]);

  // Enhanced state for TradingView-like experience
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('chart');

  // Real-time data state
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const socketRef = useRef(null);

  // Drawing tools state
  const [drawingMode, setDrawingMode] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [activeDrawings, setActiveDrawings] = useState([]);

  // Watchlist and screener state
  const [watchlist, setWatchlist] = useState([]);
  const [screenerFilters, setScreenerFilters] = useState({
    minVolume: '',
    maxVolume: '',
    minChange: '',
    maxChange: '',
    sector: ''
  });
  const [screenerResults, setScreenerResults] = useState([]);

  // Trading simulation state
  const [portfolio, setPortfolio] = useState({
    balance: 100000000, // 100M IDR
    positions: [],
    orders: [],
    trades: [],
    totalPnL: 0
  });

  // Backtesting state
  const [backtestResults, setBacktestResults] = useState(null);
  const [isBacktesting, setIsBacktesting] = useState(false);

  // Multi-symbol comparison state
  const [comparisonData, setComparisonData] = useState({});

  // Crosshair state
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);
  const [crosshairPosition, setCrosshairPosition] = useState(null);

  // User settings with enhanced options
  const [userSettings, setUserSettings] = useState({
    indicators: {
      SMA: { enabled: true, periods: [20, 50] },
      EMA: { enabled: true, periods: [12, 26] },
      RSI: { enabled: true, period: 14 },
      MACD: { enabled: true, fast: 12, slow: 26, signal: 9 },
      BB: { enabled: true, period: 20, stdDev: 2 },
      FIBONACCI: { enabled: false }, // Fibonacci Retracement
      STOCHASTIC: { enabled: false, kPeriod: 14, dPeriod: 3 },
      ATR: { enabled: false, period: 14 },
      WILLIAMS_R: { enabled: false, period: 14 },
      CCI: { enabled: false, period: 20 },
      ICHIMOKU: { enabled: false, tenkan: 9, kijun: 26, senkouB: 52 },
      ADX: { enabled: false, period: 14 },
      PARABOLIC_SAR: { enabled: false, step: 0.02, maxStep: 0.2 }
    },
    layout: {
      showVolume: true,
      showGrid: true,
      chartType: 'candlestick',
      crosshair: true,
      animations: true
    },
    trading: {
      defaultQuantity: 100,
      riskManagement: {
        maxPositionSize: 10000000, // 10M IDR
        stopLossPercent: 5,
        takeProfitPercent: 10
      }
    }
  });

  // Chart refs
  const mainChartRef = useRef(null);
  const indicatorChartRef = useRef(null);
  const mainChartInstance = useRef(null);
  const indicatorChartInstance = useRef(null);

  // Enhanced timeframes - TradingView Style
  const timeframes = [
    { value: '1m', label: '1M' },
    { value: '5m', label: '5M' },
    { value: '15m', label: '15M' },
    { value: '30m', label: '30M' },
    { value: '1H', label: '1H' },
    { value: '2H', label: '2H' },
    { value: '4H', label: '4H' },
    { value: '1D', label: '1D' },
    { value: '1W', label: '1W' },
    { value: '1M', label: '1M' },
    { value: '3M', label: '3M' },
    { value: '6M', label: '6M' },
    { value: 'YTD', label: 'YTD' },
    { value: '1Y', label: '1Y' },
    { value: 'ALL', label: 'ALL' }
  ];

  // Drawing tools
  const drawingTools = [
    { id: 'trendline', label: 'Trend Line', icon: '📈', color: '#3B82F6' },
    { id: 'horizontal', label: 'Horizontal Line', icon: '─', color: '#EF4444' },
    { id: 'vertical', label: 'Vertical Line', icon: '│', color: '#10B981' },
    { id: 'rectangle', label: 'Rectangle', icon: '□', color: '#F59E0B' },
    { id: 'fibonacci', label: 'Fibonacci', icon: 'Φ', color: '#8B5CF6' },
    { id: 'arrow', label: 'Arrow', icon: '→', color: '#EC4899' }
  ];

  // Data validation function
  const isValidDataPoint = (d) => {
    const isValidNumber = (val) => typeof val === 'number' && !isNaN(val) && val !== null && val !== undefined;
    const isValidDate = (date) => date && !isNaN(new Date(date).getTime());

    return (
      d &&
      isValidDate(d.trade_date) &&
      isValidNumber(d.open) &&
      isValidNumber(d.high) &&
      isValidNumber(d.low) &&
      isValidNumber(d.close) &&
      isValidNumber(d.volume)
    );
  };

  // Process and validate chart data
  const validChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return [];
    }

    const processed = chartData
      .map(d => ({
        trade_date: new Date(d.trade_date).toISOString(),
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
        volume: Number(d.volume)
      }))
      .filter(isValidDataPoint);

    return processed;
  }, [chartData]);

  // Prepare indicators configuration for the hook
  const indicatorsConfig = useMemo(() => {
    const config = [];

    if (userSettings.indicators.SMA.enabled) {
      userSettings.indicators.SMA.periods.forEach(period => {
        config.push({ type: 'SMA', period });
      });
    }

    if (userSettings.indicators.EMA.enabled) {
      userSettings.indicators.EMA.periods.forEach(period => {
        config.push({ type: 'EMA', period });
      });
    }

    if (userSettings.indicators.RSI.enabled) {
      config.push({ type: 'RSI', period: userSettings.indicators.RSI.period });
    }

    if (userSettings.indicators.MACD.enabled) {
      config.push({
        type: 'MACD',
        fast: userSettings.indicators.MACD.fast,
        slow: userSettings.indicators.MACD.slow,
        signal: userSettings.indicators.MACD.signal
      });
    }

    if (userSettings.indicators.BB.enabled) {
      config.push({
        type: 'BB',
        period: userSettings.indicators.BB.period,
        stdDev: userSettings.indicators.BB.stdDev
      });
    }

    if (userSettings.indicators.FIBONACCI && userSettings.indicators.FIBONACCI.enabled) {
      config.push({ type: 'FIBONACCI' });
    }

    return config;
  }, [userSettings.indicators]);

  // Use the technical indicators hook
  const technicalIndicators = useTechnicalIndicators(validChartData, indicatorsConfig);

  // WebSocket connection DISABLED for historical data only
  useEffect(() => {
    console.log(`[TVS] WebSocket disabled - Running in historical data mode only`);
    setIsConnected(false);
    setLastUpdate(null);

    // Removed WebSocket connection code for static historical data
  }, [selectedSymbol, timeRange]);

  // Load user settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('tvs-chart-settings');
    if (savedSettings) {
      setUserSettings(JSON.parse(savedSettings));
    }

    const savedTheme = localStorage.getItem('tvs-chart-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    }

    const savedWatchlist = localStorage.getItem('tvs-watchlist');
    if (savedWatchlist) {
      setWatchlist(JSON.parse(savedWatchlist));
    }

    const savedMarketType = localStorage.getItem('tvs-market-type');
    if (savedMarketType) {
      setMarketType(savedMarketType);
    }

    const savedAlerts = localStorage.getItem('tvs-alerts');
    if (savedAlerts) {
      setAlerts(JSON.parse(savedAlerts));
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('tvs-chart-settings', JSON.stringify(userSettings));
  }, [userSettings]);

  useEffect(() => {
    localStorage.setItem('tvs-chart-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('tvs-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem('tvs-market-type', marketType);
  }, [marketType]);

  useEffect(() => {
    localStorage.setItem('tvs-alerts', JSON.stringify(alerts));
  }, [alerts]);

 // Fetch IDX symbols function - DEFINED BEFORE useEffect
 const fetchIdxSymbols = useCallback(async () => {
   console.log('[TVS] 🔄 Fetching IDX symbols from /stocks/idx/symbols...');
   setLoadingSymbols(true);
   try {
     const response = await api.get('/stocks/idx/symbols');
     console.log('[TVS] ✅ API response for /stocks/idx/symbols:', response.data);
     const symbolsList = response.data.symbols || [];
     console.log('[TVS] 📋 IDX symbols fetched:', symbolsList.length, symbolsList.slice(0, 3));
     setIdxSymbols(symbolsList);

     if (symbolsList.length > 0 && !selectedSymbol && marketType === 'IDX') {
       console.log('[TVS] 🎯 Auto-selecting first IDX symbol:', symbolsList[0]);
       setSelectedSymbol(symbolsList[0]);
     }
   } catch (error) {
     console.error('[TVS] ❌ Error fetching IDX symbols:', error);
     console.error('[TVS] 🔍 Error details:', {
       message: error.message,
       status: error.response?.status,
       data: error.response?.data,
       url: error.config?.url
     });
     console.warn('[TVS] ⚠️ IDX symbols fetch failed, using empty list');
     setIdxSymbols([]);
   } finally {
     setLoadingSymbols(false);
     console.log('[TVS] 🏁 fetchIdxSymbols completed');
   }
 }, []);

 // Fetch US symbols function with extensive logging - DEFINED BEFORE useEffect
 const fetchUsSymbols = useCallback(async () => {
   console.log('[TVS] 🔄 Fetching US symbols from /stocks/usa/symbols...');
   setLoadingUsSymbols(true);
   try {
     const response = await api.get('/stocks/usa/symbols');
     console.log('[TVS] ✅ API response for /stocks/usa/symbols:', response.data);
     const symbolsList = response.data.symbols || [];
     console.log('[TVS] 📋 US symbols fetched:', symbolsList.length, symbolsList.slice(0, 3));
     setUsSymbols(symbolsList);

     if (symbolsList.length > 0 && !selectedSymbol && marketType === 'US') {
       console.log('[TVS] 🎯 Auto-selecting first US symbol:', symbolsList[0]);
       setSelectedSymbol(symbolsList[0]);
     }
   } catch (error) {
     console.error('[TVS] ❌ Error fetching US symbols:', error);
     console.error('[TVS] 🔍 Error details:', {
       message: error.message,
       status: error.response?.status,
       data: error.response?.data,
       url: error.config?.url
     });
     console.warn('[TVS] ⚠️ US symbols fetch failed, using empty list');
     setUsSymbols([]);
   } finally {
     setLoadingUsSymbols(false);
     console.log('[TVS] 🏁 fetchUsSymbols completed');
   }
 }, []);

 // Market switching effect - reset symbols and fetch appropriate data
 useEffect(() => {
   console.log('[TVS] 🔄 Market changed to:', marketType);
   setSelectedSymbol('');  // Reset symbol
   setCompareSymbols([]);  // Reset comparison
   setCompanyName('');     // Reset company name

   if (marketType === 'IDX') {
     if (typeof fetchIdxSymbols === 'function') {
       console.log('[TVS] 📞 Calling fetchIdxSymbols...');
       fetchIdxSymbols();  // Fetch IDX symbols
     } else {
       console.error('[TVS] ❌ fetchIdxSymbols not defined');
       setIdxSymbols([]);
       setLoadingSymbols(false);
     }
   } else if (marketType === 'US') {
     if (typeof fetchUsSymbols === 'function') {
       console.log('[TVS] 📞 Calling fetchUsSymbols...');
       fetchUsSymbols();   // Fetch US symbols
     } else {
       console.error('[TVS] ❌ fetchUsSymbols not defined');
       setUsSymbols([]);
       setLoadingUsSymbols(false);
     }
   }
 }, [marketType, fetchIdxSymbols, fetchUsSymbols]);

 // Initial load effect
 useEffect(() => {
   console.log('[TVS] 🚀 Initial load - fetching IDX symbols');
   if (marketType === 'IDX') {
     fetchIdxSymbols();
   }
 }, [fetchIdxSymbols]);

  // Fetch chart data with enhanced error handling
  useEffect(() => {
    if (!selectedSymbol) return;

    const fetchChartData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(`[TVS] Fetching ${marketType} data for ${selectedSymbol} with timeframe ${timeRange}`);

        // Choose endpoint based on market type
        const endpoint = marketType === 'US' ? '/stocks/usa/candlestick' : '/stocks/idx/candlestick';

        const response = await api.get(endpoint, {
          params: {
            symbol: selectedSymbol,
            timeframe: timeRange
          }
        });

        let data = response.data?.data || [];

        if (data.length === 0) {
          console.warn(`[TVS] No data from API for ${selectedSymbol}, using fallback`);
          // Generate fallback data if API returns empty
          data = generateFallbackData(selectedSymbol, timeRange, 100);
        }

        // Limit data points based on timeframe for performance
        const maxPoints = getMaxPointsForTimeRange(timeRange);
        const limitedData = limitDataPoints(data, maxPoints);

        console.log(`[TVS] Data loaded: ${data.length} points, limited to ${limitedData.length} points`);
        setChartData(limitedData);

        // Extract and set company name from API response
        const companyNameFromAPI = response.data?.company_name || 'Unknown Company';
        setCompanyName(companyNameFromAPI);
        console.log(`[TVS] Company name set: ${companyNameFromAPI}`);

        // Fetch comparison data if symbols are selected
        if (compareSymbols.length > 0) {
          fetchComparisonData(compareSymbols);
        }

      } catch (error) {
        console.error(`[TVS] Error fetching ${marketType} chart data:`, error);

        // Use fallback data on error
        const fallbackData = generateFallbackData(selectedSymbol, timeRange, 100);
        setChartData(fallbackData);
        setError(null); // Don't show error if we have fallback data
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [selectedSymbol, timeRange, compareSymbols, marketType]);

  // Generate fallback data function
  const generateFallbackData = (symbol, range, count) => {
    const data = [];
    const now = new Date();
    const basePrice = 1000 + Math.random() * 5000;

    for (let i = 0; i < count; i++) {
      const date = new Date(now.getTime() - i * getTimeInterval(range));
      const volatility = 0.02;
      const trend = (Math.random() - 0.5) * 0.01;
      const randomChange = (Math.random() - 0.5) * 2 * volatility;

      const priceChange = trend + randomChange;
      const open = basePrice * (1 + priceChange * (i / count));
      const close = open * (1 + (Math.random() - 0.5) * volatility * 2);
      const high = Math.max(open, close) * (1 + Math.random() * volatility);
      const low = Math.min(open, close) * (1 - Math.random() * volatility);

      data.push({
        trade_date: date.toISOString(),
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume: Math.floor(Math.random() * 1000000) + 500000
      });
    }

    return data.reverse();
  };

  // Helper functions
  const getMaxPointsForTimeRange = (timeRange) => {
    switch (timeRange) {
      case '1m': return 100;
      case '5m': return 200;
      case '15m': return 300;
      case '30m': return 400;
      case '1H': return 500;
      case '2H': return 550;
      case '4H': return 600;
      case '1D': return 365;
      case '1W': return 200;
      case '1M': return 150;
      case '3M': return 180;    // 3 months
      case '6M': return 200;    // 6 months
      case 'YTD': return 250;   // Year to date
      case '1Y': return 365;    // 1 year
      case 'ALL': return 300;   // All time (limited for performance)
      default: return 150;
    }
  };

  const getTimeInterval = (timeRange) => {
    switch (timeRange) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '30m': return 30 * 60 * 1000;
      case '1H': return 60 * 60 * 1000;
      case '2H': return 2 * 60 * 60 * 1000;
      case '4H': return 4 * 60 * 60 * 1000;
      case '1D': return 24 * 60 * 60 * 1000;
      case '1W': return 7 * 24 * 60 * 60 * 1000;
      case '1M': return 30 * 24 * 60 * 60 * 1000;
      case '3M': return 90 * 24 * 60 * 60 * 1000;   // 3 months
      case '6M': return 180 * 24 * 60 * 60 * 1000;  // 6 months
      case 'YTD': return 365 * 24 * 60 * 60 * 1000; // Year to date (approx)
      case '1Y': return 365 * 24 * 60 * 60 * 1000;  // 1 year
      case 'ALL': return 5 * 365 * 24 * 60 * 60 * 1000; // All time (5 years max)
      default: return 24 * 60 * 60 * 1000;
    }
  };

  const limitDataPoints = (data, maxPoints) => {
    if (!data || data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, index) => index % step === 0);
  };

  // Get combined symbols from both markets - filtered by marketType
  const getCombinedSymbols = useCallback(() => {
    console.log('[TVS] 📋 Generating combined symbols for:', marketType);
    const combined = [];

    if (marketType === 'IDX') {
      idxSymbols.forEach(symbol => {
        combined.push({ symbol, market: 'IDX' });
      });
    } else if (marketType === 'US') {
      usSymbols.forEach(symbol => {
        combined.push({ symbol, market: 'US' });
      });
    }

    return combined;
  }, [marketType, idxSymbols, usSymbols]);

  // Fetch comparison data for multi-symbol analysis
  const fetchComparisonData = async (symbols) => {
    try {
      const comparisonPromises = symbols.map(symbol => {
        // Determine market type for each symbol
        const symbolData = getCombinedSymbols().find(s => s.symbol === symbol);
        const symbolMarket = symbolData?.market || 'IDX';
        const endpoint = symbolMarket === 'US' ? '/stocks/usa/candlestick' : '/stocks/idx/candlestick';

        return api.get(endpoint, {
          params: { symbol, timeframe: timeRange }
        }).then(response => ({
          symbol,
          data: response.data?.data || []
        })).catch(error => {
          console.warn(`[TVS] Error fetching ${symbolMarket} data for ${symbol}:`, error);
          return { symbol, data: [] };
        });
      });

      const results = await Promise.all(comparisonPromises);
      const comparisonMap = {};

      results.forEach(result => {
        if (result.data.length > 0) {
          comparisonMap[result.symbol] = result.data.slice(-100); // Last 100 points
        }
      });

      setComparisonData(comparisonMap);
    } catch (error) {
      console.error('[TVS] Error fetching comparison data:', error);
    }
  };

  // Enhanced watchlist management
  const toggleWatchlist = (symbol) => {
    setWatchlist(prev => {
      const exists = prev.find(item => item.symbol === symbol);
      if (exists) {
        return prev.filter(item => item.symbol !== symbol);
      } else {
        return [...prev, {
          symbol,
          addedAt: new Date().toISOString(),
          alerts: {
            priceAbove: null,
            priceBelow: null,
            volumeAbove: null
          }
        }];
      }
    });
  };

  // Enhanced trading simulation
  const placeOrder = (type, symbol, price, quantity, orderType = 'market') => {
    const order = {
      id: Date.now() + Math.random(),
      type,
      symbol,
      price,
      quantity,
      orderType,
      timestamp: new Date().toISOString(),
      status: orderType === 'market' ? 'executed' : 'pending'
    };

    setPortfolio(prev => ({
      ...prev,
      orders: [...prev.orders, order]
    }));

    if (orderType === 'market') {
      executeOrder(order);
    }
  };

  const executeOrder = (order) => {
    const currentPrice = validChartData[validChartData.length - 1]?.close || 0;

    if (order.type === 'buy' && portfolio.balance >= order.price * order.quantity) {
      const cost = order.price * order.quantity;
      const position = {
        symbol: order.symbol,
        quantity: order.quantity,
        avgPrice: order.price,
        currentPrice,
        pnl: (currentPrice - order.price) * order.quantity,
        openDate: new Date().toISOString()
      };

      setPortfolio(prev => ({
        ...prev,
        balance: prev.balance - cost,
        positions: [...prev.positions, position],
        orders: prev.orders.map(o => o.id === order.id ? { ...o, status: 'executed' } : o),
        trades: [...prev.trades, { ...order, executedPrice: order.price, status: 'executed' }]
      }));
    } else if (order.type === 'sell') {
      const positionIndex = portfolio.positions.findIndex(p => p.symbol === order.symbol);
      if (positionIndex !== -1) {
        const position = portfolio.positions[positionIndex];
        if (position.quantity >= order.quantity) {
          const revenue = order.price * order.quantity;

          setPortfolio(prev => {
            const updatedPositions = [...prev.positions];
            updatedPositions[positionIndex] = {
              ...position,
              quantity: position.quantity - order.quantity
            };

            return {
              ...prev,
              balance: prev.balance + revenue,
              positions: updatedPositions.filter(p => p.quantity > 0),
              orders: prev.orders.map(o => o.id === order.id ? { ...o, status: 'executed' } : o),
              trades: [...prev.trades, { ...order, executedPrice: order.price, status: 'executed' }]
            };
          });
        }
      }
    }
  };

  // Backtesting functionality
  const runBacktest = async (strategy, startDate, endDate) => {
    setIsBacktesting(true);

    try {
      // Simple MA crossover strategy as example
      const strategyResults = {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalPnL: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        trades: []
      };

      // Simulate strategy execution
      let position = null;
      let balance = 100000000; // 100M IDR
      let peak = balance;

      for (let i = 20; i < validChartData.length; i++) {
        const currentData = validChartData[i];
        const pastData = validChartData.slice(0, i);

        if (pastData.length < 50) continue;

        // Simple MA crossover logic
        const sma20 = calculateSMA(pastData.map(d => d.close), 20);
        const sma50 = calculateSMA(pastData.map(d => d.close), 50);

        const currentSMA20 = sma20[sma20.length - 1];
        const currentSMA50 = sma50[sma50.length - 1];
        const prevSMA20 = sma20[sma20.length - 2];
        const prevSMA50 = sma50[sma50.length - 2];

        // Buy signal: SMA20 crosses above SMA50
        if (!position && currentSMA20 > currentSMA50 && prevSMA20 <= prevSMA50) {
          const quantity = Math.floor(balance * 0.1 / currentData.close); // 10% of balance
          position = {
            type: 'long',
            entryPrice: currentData.close,
            quantity,
            entryDate: currentData.trade_date
          };
        }
        // Sell signal: SMA20 crosses below SMA50
        else if (position && currentSMA20 < currentSMA50 && prevSMA20 >= prevSMA50) {
          const exitPrice = currentData.close;
          const pnl = (exitPrice - position.entryPrice) * position.quantity;

          strategyResults.trades.push({
            entryDate: position.entryDate,
            exitDate: currentData.trade_date,
            entryPrice: position.entryPrice,
            exitPrice,
            quantity: position.quantity,
            pnl,
            type: 'long'
          });

          strategyResults.totalTrades++;
          if (pnl > 0) strategyResults.winningTrades++;
          else strategyResults.losingTrades++;

          strategyResults.totalPnL += pnl;
          balance += pnl;

          // Update drawdown
          if (balance > peak) peak = balance;
          const drawdown = (peak - balance) / peak * 100;
          if (drawdown > strategyResults.maxDrawdown) {
            strategyResults.maxDrawdown = drawdown;
          }

          position = null;
        }
      }

      // Calculate Sharpe ratio (simplified)
      if (strategyResults.trades.length > 0) {
        const returns = strategyResults.trades.map(t => t.pnl);
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const stdDev = Math.sqrt(returns.reduce((sq, n) => sq + Math.pow(n - avgReturn, 2), 0) / returns.length);
        strategyResults.sharpeRatio = stdDev !== 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
      }

      setBacktestResults(strategyResults);
    } catch (error) {
      console.error('[TVS] Backtesting error:', error);
    } finally {
      setIsBacktesting(false);
    }
  };

  // Enhanced alert management functions
  const createAlert = (price, type) => {
    if (!selectedSymbol || !price || price <= 0) {
      console.error('[TVS] Invalid alert price');
      return;
    }

    const newAlert = {
      id: Date.now() + Math.random(),
      symbol: selectedSymbol,
      market: marketType,
      type,
      price: Number(price),
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    setAlerts(prev => {
      // Limit to 50 alerts max
      const updated = [...prev, newAlert];
      return updated.length > 50 ? updated.slice(-50) : updated;
    });
    setShowAlertModal(false);
  };

  const deleteAlert = (alertId) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const checkAlerts = () => {
    if (!validChartData || validChartData.length === 0) return;

    const latestPrice = validChartData[validChartData.length - 1]?.close;
    if (!latestPrice) return;

    alerts.forEach(alert => {
      if (alert.status === 'active') {
        let triggered = false;

        if (alert.type === 'price_above' && latestPrice >= alert.price) {
          triggered = true;
        } else if (alert.type === 'price_below' && latestPrice <= alert.price) {
          triggered = true;
        }

        if (triggered) {
          // Update alert status
          setAlerts(prev => prev.map(a =>
            a.id === alert.id ? { ...a, status: 'triggered' } : a
          ));

          // Add toast notification
          const notification = {
            id: Date.now() + Math.random(),
            message: `Alert: ${alert.symbol} (${alert.market}) price ${alert.type === 'price_above' ? 'above' : 'below'} ${alert.price.toLocaleString('id-ID')}`,
            type: 'alert',
            timestamp: new Date().toISOString()
          };

          setAlertNotifications(prev => [...prev, notification]);

          // Auto-hide notification after 5 seconds
          setTimeout(() => {
            setAlertNotifications(prev => prev.filter(n => n.id !== notification.id));
          }, 5000);
        }
      }
    });
  };

  // Get active alerts for current symbol and market
  const getActiveAlerts = useMemo(() => {
    return alerts.filter(alert =>
      alert.status === 'active' &&
      alert.symbol === selectedSymbol &&
      alert.market === marketType
    );
  }, [alerts, selectedSymbol, marketType]);

  // Optimized symbol options for dropdown
  const symbolOptions = useMemo(() => {
    return getCombinedSymbols().map(s => ({
      value: s.symbol,
      label: `${s.symbol} (${s.market})`
    }));
  }, [getCombinedSymbols]);

  // Currency formatter based on market type with i18n support
  const currencyFormatter = useMemo(() => {
    console.log('[TVS] 🔄 Setting currency formatter for:', marketType);
    const locale = marketType === 'US' ? 'en-US' : 'id-ID';
    const currency = marketType === 'US' ? 'USD' : 'IDR';

    console.log('[TVS] 🌐 Using locale:', locale, 'currency:', currency);

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [marketType]);

  // Drawing tools functionality
  const handleChartClick = (event, elements) => {
    if (!mainChartInstance.current) return;

    const chart = mainChartInstance.current;
    const rect = chart.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert pixel coordinates to data coordinates
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    const dataX = xScale.getValueForPixel(x);
    const dataY = yScale.getValueForPixel(y);

    // Handle right-click for alerts
    if (event.button === 2) { // Right click
      event.preventDefault();
      setAlertModalData({
        price: Math.round(dataY * 100) / 100,
        type: 'price_above'
      });
      setShowAlertModal(true);
      return;
    }

    // Handle left-click for drawing tools
    if (drawingMode) {
      if (!drawStart) {
        setDrawStart({ x: dataX, y: dataY });
      } else {
        // Complete the drawing
        const newAnnotation = {
          id: Date.now(),
          type: drawingMode,
          start: drawStart,
          end: { x: dataX, y: dataY },
          color: drawingTools.find(t => t.id === drawingMode)?.color || '#3B82F6'
        };

        setActiveDrawings(prev => [...prev, newAnnotation]);
        setDrawStart(null);
      }
    }
  };

  // Share to X (Twitter)
  const shareToX = () => {
    const currentPrice = validChartData[validChartData.length - 1]?.close || 0;
    const text = `📊 TVS Trading Analysis: ${selectedSymbol} at Rp ${currentPrice.toLocaleString('id-ID')}\n\nAdvanced technical analysis with real-time data! #TradingViewSuper #${selectedSymbol} #StockMarket`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Theme toggle
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Language toggle
  const toggleLanguage = () => {
    const newLang = i18n.language === 'id' ? 'en' : 'id';
    i18n.changeLanguage(newLang);
  };

  // Chart rendering effect for main chart - STABLE VERSION
  useEffect(() => {
    if (!validChartData || validChartData.length === 0 || !mainChartRef.current) {
      return;
    }

    const ctx = mainChartRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (mainChartInstance.current) {
      mainChartInstance.current.destroy();
      mainChartInstance.current = null;
    }

    console.log(`[TVS] Rendering stable chart with ${validChartData.length} data points`);

    // Prepare datasets for main chart
    const datasets = [];

    // Main price dataset
    datasets.push({
      label: `${selectedSymbol} - ${companyName}`,
      type: userSettings.layout.chartType === 'candlestick' ? 'candlestick' : 'line',
      data: validChartData.map(d => ({
        x: new Date(d.trade_date).getTime(),
        o: userSettings.layout.chartType === 'candlestick' ? d.open : undefined,
        h: userSettings.layout.chartType === 'candlestick' ? d.high : undefined,
        l: userSettings.layout.chartType === 'candlestick' ? d.low : undefined,
        c: userSettings.layout.chartType === 'candlestick' ? d.close : undefined,
        y: userSettings.layout.chartType === 'line' ? d.close : undefined
      })),
      color: userSettings.layout.chartType === 'candlestick' ? {
        up: theme === 'dark' ? '#10B981' : '#16A34A',
        down: theme === 'dark' ? '#EF4444' : '#DC2626',
        unchanged: '#6B7280'
      } : undefined,
      borderColor: userSettings.layout.chartType === 'line' ? (theme === 'dark' ? '#3B82F6' : '#2563EB') : undefined,
      borderWidth: userSettings.layout.chartType === 'line' ? 2 : 1,
      yAxisID: 'y-price'
    });

    // Comparison datasets
    Object.entries(comparisonData).forEach(([symbol, data]) => {
      if (data.length > 0) {
        datasets.push({
          label: `${symbol} Price`,
          type: 'line',
          data: data.map(d => ({
            x: new Date(d.trade_date).getTime(),
            y: d.close
          })),
          borderColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.7)`,
          borderWidth: 1,
          pointRadius: 0,
          yAxisID: 'y-price'
        });
      }
    });

    // Volume dataset
    if (userSettings.layout.showVolume) {
      datasets.push({
        label: 'Volume',
        type: 'bar',
        data: validChartData.map(d => ({
          x: new Date(d.trade_date).getTime(),
          y: d.volume
        })),
        backgroundColor: validChartData.map(d =>
          d.close >= d.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'
        ),
        yAxisID: 'y-volume',
        barPercentage: 0.4
      });
    }

    // Chart configuration
    const chartConfig = {
      type: userSettings.layout.chartType === 'candlestick' ? 'candlestick' : 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0 // Disabled for stability
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: { size: 11 },
              color: theme === 'dark' ? '#ffffff' : '#374151'
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.9)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: theme === 'dark' ? '#4B5563' : '#D1D5DB',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            callbacks: {
              title: (context) => {
                const date = new Date(context[0].parsed.x);
                return date.toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
              },
              label: (context) => {
                if (context.dataset.type === 'candlestick') {
                  const point = context.raw;
                  const dataIndex = context.dataIndex;
                  const currentData = validChartData[dataIndex];

                  // Calculate daily percentage change for this specific candle
                  let dailyChange = 0;
                  let changeText = '';

                  if (currentData && dataIndex > 0) {
                    const prevClose = validChartData[dataIndex - 1]?.close;
                    const currentClose = point.c || currentData.close;

                    if (prevClose && currentClose && prevClose !== 0) {
                      dailyChange = ((currentClose - prevClose) / prevClose) * 100;
                      changeText = `Daily Change: ${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)}%`;
                    }
                  }

                  console.log('[TVS] 📊 Formatting candlestick tooltip:', point, marketType, 'Daily Change:', dailyChange);
                  return [
                    `Open: ${currencyFormatter.format(point.o || 0)}`,
                    `High: ${currencyFormatter.format(point.h || 0)}`,
                    `Low: ${currencyFormatter.format(point.l || 0)}`,
                    `Close: ${currencyFormatter.format(point.c || 0)}`,
                    changeText
                  ].filter(item => item !== '');
                }
                const value = context.parsed.y;
                console.log('[TVS] 📊 Formatting tooltip:', value, marketType);
                return `${context.dataset.label}: ${currencyFormatter.format(value || 0)}`;
              }
            }
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x'
            },
            zoom: {
              wheel: {
                enabled: true
              },
              pinch: {
                enabled: true
              },
              mode: 'x'
            }
          },
          annotation: {
            annotations: [
              // Alert annotations for current symbol and market
              ...getActiveAlerts.map(alert => ({
                type: 'line',
                yMin: alert.price,
                yMax: alert.price,
                borderColor: alert.type === 'price_above' ? '#10B981' : '#EF4444',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  display: true,
                  content: `Alert: ${alert.type === 'price_above' ? 'Above' : 'Below'} ${alert.price.toLocaleString('id-ID')}`,
                  position: 'start',
                  backgroundColor: alert.type === 'price_above' ? '#10B981' : '#EF4444',
                  color: 'white',
                  font: { size: 10 }
                }
              })),
              // Drawing annotations
              ...activeDrawings.map(drawing => {
                switch (drawing.type) {
                  case 'trendline':
                    return {
                      type: 'line',
                      xMin: drawing.start.x,
                      xMax: drawing.end.x,
                      yMin: drawing.start.y,
                      yMax: drawing.end.y,
                      borderColor: drawing.color,
                      borderWidth: 2
                    };
                  case 'horizontal':
                    return {
                      type: 'line',
                      yMin: drawing.start.y,
                      yMax: drawing.start.y,
                      borderColor: drawing.color,
                      borderWidth: 2,
                      label: {
                        display: true,
                        content: `Rp ${drawing.start.y.toLocaleString('id-ID')}`,
                        position: 'start'
                      }
                    };
                  default:
                    return null;
                }
              }).filter(Boolean)
            ]
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                day: 'dd/MM/yyyy',
                month: 'MMM yyyy'
              }
            },
            title: {
              display: true,
              text: 'Date',
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              font: { size: 12, weight: 'bold' }
            },
            grid: {
              color: theme === 'dark' ? 'rgba(107, 114, 128, 0.1)' : 'rgba(107, 114, 128, 0.1)',
              display: userSettings.layout.showGrid
            },
            ticks: {
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              maxTicksLimit: 8
            }
          },
          'y-price': {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Price (IDR)',
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              font: { size: 12, weight: 'bold' }
            },
            ticks: {
              callback: (value) => {
                console.log('[TVS] 📊 Formatting Y-axis tick:', value, marketType);
                return currencyFormatter.format(value);
              },
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              maxTicksLimit: 6
            },
            grid: {
              color: theme === 'dark' ? 'rgba(107, 114, 128, 0.1)' : 'rgba(107, 114, 128, 0.1)',
              display: userSettings.layout.showGrid
            }
          },
          'y-volume': userSettings.layout.showVolume ? {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Volume',
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              font: { size: 11, weight: 'bold' }
            },
            ticks: {
              callback: (value) => {
                if (value >= 1000000000) {
                  return (value / 1000000000).toFixed(1) + 'B';
                } else if (value >= 1000000) {
                  return (value / 1000000).toFixed(1) + 'M';
                } else if (value >= 1000) {
                  return (value / 1000).toFixed(1) + 'K';
                }
                return value.toString();
              },
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              maxTicksLimit: 4
            },
            grid: {
              drawOnChartArea: false
            }
          } : {}
        },
        elements: {
          point: {
            radius: 0,
            hoverRadius: 6
          },
          candlestick: {
            barThickness: 0.8,
            color: {
              up: theme === 'dark' ? '#10B981' : '#16A34A',
              down: theme === 'dark' ? '#EF4444' : '#DC2626',
              unchanged: '#6B7280'
            }
          }
        },
        onClick: handleChartClick
      }
    };

    try {
      const newChart = new Chart(ctx, {
        ...chartConfig,
        options: {
          ...chartConfig.options,
          // Force fixed dimensions
          plugins: {
            ...chartConfig.options.plugins,
            legend: {
              ...chartConfig.options.plugins.legend,
              display: false // Disable legend for more space
            }
          }
        }
      });
      mainChartInstance.current = newChart;

      // Resize to fit container properly
      setTimeout(() => {
        newChart.resize();
      }, 100);

    } catch (error) {
      console.error('[TVS] Error creating main chart:', error);
    }

    return () => {
      if (mainChartInstance.current) {
        console.log('[TVS] Destroying main chart');
        mainChartInstance.current.destroy();
        mainChartInstance.current = null;
      }
    };
  }, [validChartData?.length, selectedSymbol, JSON.stringify(userSettings), theme, JSON.stringify(comparisonData), activeDrawings?.length, technicalIndicators]);

  // Indicator panel rendering effect
  useEffect(() => {
    if (!validChartData || validChartData.length === 0 || !indicatorChartRef.current) {
      return;
    }

    const ctx = indicatorChartRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (indicatorChartInstance.current) {
      indicatorChartInstance.current.destroy();
      indicatorChartInstance.current = null;
    }

    const datasets = [];

    // RSI indicator
    if (userSettings.indicators.RSI.enabled) {
      const rsiData = calculateRSI(validChartData.map(d => d.close), userSettings.indicators.RSI.period);
      datasets.push({
        label: `RSI ${userSettings.indicators.RSI.period}`,
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime(),
          y: rsiData[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: '#A855F7',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        yAxisID: 'rsi'
      });
    }

    // MACD indicator
    if (userSettings.indicators.MACD.enabled) {
      const macdData = calculateMACD(
        validChartData.map(d => d.close),
        userSettings.indicators.MACD.fast,
        userSettings.indicators.MACD.slow,
        userSettings.indicators.MACD.signal
      );

      datasets.push({
        label: 'MACD',
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime(),
          y: macdData.macdLine[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: '#3B82F6',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        yAxisID: 'macd'
      });

      datasets.push({
        label: 'Signal',
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime(),
          y: macdData.signalLine[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: '#F97316',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        yAxisID: 'macd'
      });
    }

    // Bollinger Bands
    if (userSettings.indicators.BB.enabled) {
      const bbData = calculateBollingerBands(
        validChartData.map(d => d.close),
        userSettings.indicators.BB.period,
        userSettings.indicators.BB.stdDev
      );

      datasets.push({
        label: `BB Upper`,
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime(),
          y: bbData.upperBand[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: `rgba(239, 68, 68, 0.6)`,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        yAxisID: 'y-price'
      });

      datasets.push({
        label: `BB Lower`,
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime(),
          y: bbData.lowerBand[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: `rgba(239, 68, 68, 0.6)`,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 0,
        yAxisID: 'y-price'
      });
    }

    // Fibonacci Retracement Levels
    if (userSettings.indicators.FIBONACCI && userSettings.indicators.FIBONACCI.enabled) {
      const fibData = calculateFibonacciRetracement(validChartData);

      // Add Fibonacci levels as horizontal lines
      fibData.levels.forEach((level, index) => {
        if (level && !isNaN(level)) {
          datasets.push({
            label: `Fib ${Math.round((fibData.fibLevels[index] || 0) * 100)}%`,
            type: 'line',
            data: validChartData.map((d, i) => ({
              x: new Date(d.trade_date).getTime(),
              y: level
            })),
            borderColor: `rgba(${index === 0 ? '239, 68, 68' : index === fibData.fibLevels.length - 1 ? '16, 185, 129' : '59, 130, 246'}, 0.8)`,
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderDash: [3, 3],
            pointRadius: 0,
            pointHoverRadius: 0,
            yAxisID: 'y-price',
            fill: false
          });
        }
      });
    }

    if (datasets.length === 0) {
      // Create empty chart if no indicators are enabled
      const chartConfig = {
        type: 'line',
        data: { datasets: [] },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'No indicators selected',
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280'
            }
          },
          scales: {
            x: { display: false },
            y: { display: false }
          }
        }
      };

      const newChart = new Chart(ctx, chartConfig);
      indicatorChartInstance.current = newChart;
      return;
    }

    const chartConfig = {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0 // Disabled for stability
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 10,
              font: { size: 10 },
              color: theme === 'dark' ? '#ffffff' : '#374151'
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.9)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            callbacks: {
              label: (context) => {
                return `${context.dataset.label}: ${context.parsed.y?.toFixed(2) || 0}`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                day: 'dd/MM/yyyy',
                month: 'MMM yyyy'
              }
            },
            grid: {
              color: theme === 'dark' ? 'rgba(107, 114, 128, 0.1)' : 'rgba(107, 114, 128, 0.1)',
              display: userSettings.layout.showGrid
            },
            ticks: {
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              maxTicksLimit: 5
            }
          },
          'y-price': {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Price (IDR)',
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              font: { size: 10, weight: 'bold' }
            },
            ticks: {
              callback: (value) => `Rp ${value.toLocaleString('id-ID')}`,
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              maxTicksLimit: 4
            },
            grid: {
              drawOnChartArea: false
            }
          },
          rsi: {
            type: 'linear',
            display: true,
            position: 'left',
            min: 0,
            max: 100,
            title: {
              display: true,
              text: 'RSI',
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              font: { size: 10, weight: 'bold' }
            },
            ticks: {
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              maxTicksLimit: 4
            },
            grid: {
              color: theme === 'dark' ? 'rgba(107, 114, 128, 0.1)' : 'rgba(107, 114, 128, 0.1)',
              display: userSettings.layout.showGrid
            }
          },
          macd: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'MACD',
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              font: { size: 10, weight: 'bold' }
            },
            ticks: {
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
              maxTicksLimit: 4
            },
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    };

    try {
      const newChart = new Chart(ctx, {
        ...chartConfig,
        options: {
          ...chartConfig.options,
          responsive: true,
          maintainAspectRatio: false
        }
      });
      indicatorChartInstance.current = newChart;

      // Resize to fit container properly
      setTimeout(() => {
        newChart.resize();
      }, 100);

    } catch (error) {
      console.error('[TVS] Error creating indicator chart:', error);
    }

    return () => {
      if (indicatorChartInstance.current) {
        indicatorChartInstance.current.destroy();
        indicatorChartInstance.current = null;
      }
    };
  }, [validChartData?.length, JSON.stringify(userSettings), theme, technicalIndicators]);

  // Calculate daily percentage change
  const getDailyChange = () => {
    if (validChartData.length < 2) return 0;

    const firstPrice = validChartData[0]?.open || validChartData[0]?.close;
    const lastPrice = validChartData[validChartData.length - 1]?.close;

    if (!firstPrice || !lastPrice || firstPrice === 0) return 0;

    return ((lastPrice - firstPrice) / firstPrice) * 100;
  };

  // Check alerts when chart data updates
  useEffect(() => {
    checkAlerts();
  }, [validChartData, alerts]);

  // Performance monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      if (mainChartInstance.current) {
        const chart = mainChartInstance.current;
        console.log(`[TVS] Chart performance - Width: ${chart.width}, Height: ${chart.height}, Data points: ${validChartData.length}`);
      }
    }, 30000); // Log every 30 seconds

    return () => clearInterval(interval);
  }, [validChartData.length]);

  return (
    <ErrorBoundary>
      <style jsx>{`
        canvas {
          max-height: 70vh !important;
          height: 100% !important;
        }
        .chart-container {
          height: 60vh;
          max-height: 70vh;
          min-height: 300px;
          overflow: hidden;
        }
        .indicator-container {
          height: 25vh;
          max-height: 30vh;
          min-height: 150px;
          overflow: hidden;
        }
      `}</style>
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        {/* Enhanced Header */}
        <header className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold">📺 TradingView Super</h1>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span>Historical Data</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={shareToX}
                  className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
                  title="Share to X"
                >
                  Share to X
                </button>
                <button
                  onClick={toggleLanguage}
                  className={`px-3 py-1 text-sm rounded transition-colors ${theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
                >
                  {i18n.language === 'id' ? '🇺🇸 EN' : '🇮🇩 ID'}
                </button>
                <button
                  onClick={toggleTheme}
                  className={`px-3 py-1 text-sm rounded transition-colors ${theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
                >
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
                >
                  {sidebarOpen ? '→' : '←'}
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-col lg:flex-row h-screen">
          {/* Enhanced Sidebar */}
          {sidebarOpen && (
            <div className={`w-full lg:w-80 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-b lg:border-b-0 lg:border-r ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} overflow-y-auto`}>
              {/* Enhanced Tabs */}
              <div className="flex border-b border-gray-200 overflow-x-auto">
                {['chart', 'watchlist', 'alerts', 'screener', 'portfolio', 'backtest', 'settings'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2 text-sm font-medium whitespace-nowrap px-2 ${
                      activeTab === tab
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Enhanced Tab Content */}
              <div className="p-4">
                {activeTab === 'chart' && (
                  <div>
                    <h3 className="font-semibold mb-3">Chart Settings</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={userSettings.layout.showVolume}
                            onChange={(e) => setUserSettings(prev => ({
                              ...prev,
                              layout: { ...prev.layout, showVolume: e.target.checked }
                            }))}
                            className="mr-2"
                          />
                          Show Volume
                        </label>
                      </div>
                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={userSettings.layout.crosshair}
                            onChange={(e) => setUserSettings(prev => ({
                              ...prev,
                              layout: { ...prev.layout, crosshair: e.target.checked }
                            }))}
                            className="mr-2"
                          />
                          Enable Crosshair
                        </label>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Chart Type</label>
                        <select
                          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}
                          value={userSettings.layout.chartType}
                          onChange={(e) => setUserSettings(prev => ({
                            ...prev,
                            layout: { ...prev.layout, chartType: e.target.value }
                          }))}
                        >
                          <option value="candlestick">Candlestick</option>
                          <option value="line">Line</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'watchlist' && (
                  <div>
                    <h3 className="font-semibold mb-3">Watchlist</h3>
                    <div className="space-y-2">
                      {watchlist.map(item => {
                        const symbolData = getCombinedSymbols().find(s => s.symbol === item.symbol);
                        return (
                          <div key={item.symbol} className={`p-2 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{item.symbol} ({symbolData?.market || 'IDX'})</span>
                              <button
                                onClick={() => toggleWatchlist(item.symbol)}
                                className="text-red-500 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <Select
                        options={getCombinedSymbols().map(s => ({
                          value: s.symbol,
                          label: `${s.symbol} (${s.market})`
                        }))}
                        onChange={(option) => option && toggleWatchlist(option.value)}
                        placeholder="Add symbol to watchlist"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'alerts' && (
                  <div>
                    <h3 className="font-semibold mb-3">Custom Alerts</h3>
                    <div className="space-y-2">
                      {alerts.length === 0 ? (
                        <div className={`p-4 rounded text-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <p className="text-gray-500 text-sm">No alerts created yet</p>
                          <p className="text-gray-400 text-xs mt-1">Right-click on chart to create price alerts</p>
                        </div>
                      ) : (
                        alerts.map(alert => (
                          <div key={alert.id} className={`p-3 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="font-medium">{alert.symbol} ({alert.market})</span>
                                <div className={`text-xs ${alert.status === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                                  {alert.status}
                                </div>
                              </div>
                              <button
                                onClick={() => deleteAlert(alert.id)}
                                className="text-red-500 text-sm hover:text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                            <div className="text-sm text-gray-600">
                              {alert.type === 'price_above' ? 'Price Above' : 'Price Below'}: Rp {alert.price.toLocaleString('id-ID')}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Created: {new Date(alert.createdAt).toLocaleDateString('id-ID')}
                            </div>
                          </div>
                        ))
                      )}
                      <button
                        onClick={() => setShowAlertModal(true)}
                        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
                        disabled={!selectedSymbol}
                      >
                        Create Alert
                      </button>
                      {!selectedSymbol && (
                        <p className="text-xs text-gray-500 text-center">Select a symbol first</p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'screener' && (
                  <div>
                    <h3 className="font-semibold mb-3">Stock Screener</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Min Volume</label>
                        <input
                          type="number"
                          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}
                          value={screenerFilters.minVolume}
                          onChange={(e) => setScreenerFilters(prev => ({ ...prev, minVolume: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Min Change %</label>
                        <input
                          type="number"
                          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}
                          value={screenerFilters.minChange}
                          onChange={(e) => setScreenerFilters(prev => ({ ...prev, minChange: e.target.value }))}
                        />
                      </div>
                      <button className="w-full bg-blue-600 text-white py-2 rounded">
                        Screen Stocks
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'portfolio' && (
                  <div>
                    <h3 className="font-semibold mb-3">Portfolio</h3>
                    <div className={`p-3 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <div className="text-sm text-gray-600">Balance</div>
                      <div className="text-xl font-bold">Rp {portfolio.balance.toLocaleString('id-ID')}</div>
                      <div className={`text-sm ${portfolio.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        PnL: Rp {portfolio.totalPnL.toLocaleString('id-ID')}
                      </div>
                    </div>

                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Positions</h4>
                      {portfolio.positions.map((position, index) => (
                        <div key={index} className={`p-2 rounded mb-2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <div className="flex justify-between">
                            <span>{position.symbol}</span>
                            <span>{position.quantity} shares</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Avg: Rp {position.avgPrice.toLocaleString('id-ID')}
                          </div>
                          <div className={`text-sm ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            PnL: Rp {position.pnl.toLocaleString('id-ID')}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Quick Trading */}
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Quick Trade</h4>
                      <div className="space-y-2">
                        <Select
                          options={[
                            { value: 'buy', label: 'Buy' },
                            { value: 'sell', label: 'Sell' }
                          ]}
                          placeholder="Order Type"
                        />
                        <input
                          type="number"
                          placeholder="Quantity"
                          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}
                        />
                        <button className="w-full bg-green-600 text-white py-2 rounded">
                          Place Order
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'backtest' && (
                  <div>
                    <h3 className="font-semibold mb-3">Strategy Backtesting</h3>
                    <div className="space-y-3">
                      <Select
                        options={[
                          { value: 'ma_crossover', label: 'MA Crossover' },
                          { value: 'rsi_divergence', label: 'RSI Divergence' },
                          { value: 'bb_mean_reversion', label: 'BB Mean Reversion' }
                        ]}
                        placeholder="Select Strategy"
                      />
                      <input
                        type="date"
                        placeholder="Start Date"
                        className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}
                      />
                      <input
                        type="date"
                        placeholder="End Date"
                        className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}
                      />
                      <button
                        className="w-full bg-purple-600 text-white py-2 rounded"
                        onClick={() => runBacktest('ma_crossover')}
                        disabled={isBacktesting}
                      >
                        {isBacktesting ? 'Running...' : 'Run Backtest'}
                      </button>

                      {backtestResults && (
                        <div className={`p-3 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <div className="text-sm space-y-1">
                            <div>Total Trades: {backtestResults.totalTrades}</div>
                            <div>Win Rate: {((backtestResults.winningTrades / backtestResults.totalTrades) * 100).toFixed(1)}%</div>
                            <div>Total PnL: Rp {backtestResults.totalPnL.toLocaleString('id-ID')}</div>
                            <div>Max Drawdown: {backtestResults.maxDrawdown.toFixed(2)}%</div>
                            <div>Sharpe Ratio: {backtestResults.sharpeRatio.toFixed(2)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div>
                    <h3 className="font-semibold mb-3">Settings</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={userSettings.layout.showGrid}
                            onChange={(e) => setUserSettings(prev => ({
                              ...prev,
                              layout: { ...prev.layout, showGrid: e.target.checked }
                            }))}
                            className="mr-2"
                          />
                          Show Grid
                        </label>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Default Quantity</label>
                        <input
                          type="number"
                          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}
                          value={userSettings.trading.defaultQuantity}
                          onChange={(e) => setUserSettings(prev => ({
                            ...prev,
                            trading: { ...prev.trading, defaultQuantity: parseInt(e.target.value) }
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Enhanced Toolbar */}
            <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} p-2 lg:p-3`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4">
                {/* Market Selection */}
                <Select
                  value={{ value: marketType, label: marketType === 'IDX' ? '🇮🇩 IDX' : '🇺🇸 US' }}
                  onChange={(option) => {
                    setMarketType(option?.value || 'IDX');
                    setSelectedSymbol(''); // Reset symbol when market changes
                    setCompareSymbols([]); // Reset comparison symbols
                  }}
                  options={[
                    { value: 'IDX', label: '🇮🇩 IDX' },
                    { value: 'US', label: '🇺🇸 US' }
                  ]}
                  placeholder="Select Market"
                  className="w-24"
                />

                {/* Symbol Selection */}
                <Select
                  key={`symbols-${marketType}`}  // Force re-render saat marketType berubah
                  value={selectedSymbol ? { value: selectedSymbol, label: `${selectedSymbol} (${marketType})` } : null}
                  onChange={(option) => setSelectedSymbol(option?.value || '')}
                  options={symbolOptions}
                  placeholder={loadingSymbols || loadingUsSymbols ? "Loading..." : usSymbols.length === 0 && marketType === 'US' ? "No US symbols available" : idxSymbols.length === 0 && marketType === 'IDX' ? "No IDX symbols available" : "Select Symbol"}
                  className="w-full sm:w-48"
                  isDisabled={loadingSymbols || loadingUsSymbols}
                />

                {/* Timeframe Selection */}
                <Select
                  value={timeframes.find(tf => tf.value === timeRange)}
                  onChange={(option) => setTimeRange(option?.value || '1D')}
                  options={timeframes}
                  className="w-24"
                />

                {/* Comparison Symbols */}
                <Select
                  isMulti
                  value={compareSymbols.map(s => {
                    const symbolData = getCombinedSymbols().find(item => item.symbol === s);
                    return { value: s, label: `${s} (${symbolData?.market || 'IDX'})` };
                  })}
                  onChange={(options) => setCompareSymbols(options ? options.map(o => o.value) : [])}
                  options={getCombinedSymbols()
                    .filter(s => s.symbol !== selectedSymbol)
                    .map(s => ({ value: s.symbol, label: `${s.symbol} (${s.market})` }))}
                  placeholder="Compare with..."
                  className="w-full sm:w-48"
                />

                {/* Drawing Tools */}
                <div className="flex space-x-1">
                  {drawingTools.map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => setDrawingMode(drawingMode === tool.id ? null : tool.id)}
                      className={`px-2 py-1 text-sm rounded ${
                        drawingMode === tool.id
                          ? 'bg-blue-600 text-white'
                          : theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                      title={tool.label}
                    >
                      {tool.icon}
                    </button>
                  ))}
                </div>

                {/* Indicators Toggle */}
                <div className="flex space-x-1">
                  {Object.entries(userSettings.indicators).slice(0, 7).map(([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setUserSettings(prev => ({
                        ...prev,
                        indicators: {
                          ...prev.indicators,
                          [key]: { ...config, enabled: !config.enabled }
                        }
                      }))}
                      className={`px-2 py-1 text-xs rounded ${
                        config.enabled
                          ? 'bg-green-600 text-white'
                          : theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                      title={`${key} ${config.enabled ? 'ON' : 'OFF'}`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart Area */}
            <div className="flex-1 p-2 sm:p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-16 sm:w-16 border-b-2 border-blue-600"></div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-red-600 text-sm sm:text-base text-center px-4">{error}</div>
                </div>
              ) : (
                <div className="h-full min-h-[400px]">
                  {/* Main Chart */}
                  <div className="chart-container mb-4 w-full">
                    {/* Company Name Header */}
                    {selectedSymbol && companyName && validChartData.length > 0 && (
                      <div className={`mb-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'} border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-blue-600">
                              {selectedSymbol} ({marketType})
                            </h3>
                            <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                              {companyName}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                              Timeframe: {timeRange}
                            </div>
                            <div className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                              Data Points: {validChartData.length}
                            </div>
                          </div>
                        </div>

                        {/* OHLC and Daily Change Info */}
                        <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div>
                              <div className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Open</div>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {currencyFormatter.format(validChartData[0]?.open || 0)}
                              </div>
                            </div>
                            <div>
                              <div className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>High</div>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {currencyFormatter.format(validChartData.reduce((max, d) => d.high > max ? d.high : max, 0))}
                              </div>
                            </div>
                            <div>
                              <div className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Low</div>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {currencyFormatter.format(validChartData.reduce((min, d) => d.low < min ? d.low : min, Infinity))}
                              </div>
                            </div>
                            <div>
                              <div className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Close</div>
                              <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {currencyFormatter.format(validChartData[validChartData.length - 1]?.close || 0)}
                              </div>
                            </div>
                            <div>
                              <div className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Daily Change</div>
                              <div className={`font-semibold ${getDailyChange() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {getDailyChange() >= 0 ? '+' : ''}{getDailyChange().toFixed(2)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <canvas
                      key={`main-chart-${selectedSymbol}-${timeRange}-${theme}`}
                      ref={mainChartRef}
                      className="w-full h-full border rounded cursor-crosshair"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF'
                      }}
                      onClick={handleChartClick}
                    />
                  </div>

                  {/* Indicator Panel */}
                  <div className="indicator-container w-full">
                    <canvas
                      key={`indicator-chart-${selectedSymbol}-${timeRange}-${theme}`}
                      ref={indicatorChartRef}
                      className="w-full h-full border rounded"
                      style={{
                        backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert Modal */}
        {showAlertModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`p-6 rounded-lg shadow-lg w-96 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
              <h3 className="text-lg font-semibold mb-4">Create Price Alert</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Alert Type</label>
                <select
                  className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}
                  value={alertModalData.type}
                  onChange={(e) => setAlertModalData(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="price_above">Price Above</option>
                  <option value="price_below">Price Below</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Price (IDR)</label>
                <input
                  type="number"
                  className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : ''}`}
                  value={alertModalData.price}
                  onChange={(e) => setAlertModalData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="Enter price level"
                />
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => createAlert(alertModalData.price, alertModalData.type)}
                  className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                  Save Alert
                </button>
                <button
                  onClick={() => setShowAlertModal(false)}
                  className={`flex-1 py-2 rounded ${theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {alertNotifications.map(notification => (
            <div
              key={notification.id}
              className={`p-3 rounded shadow-lg max-w-sm ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'} border-l-4 ${notification.type === 'alert' ? 'border-green-500' : 'border-blue-500'}`}
            >
              <p className="text-sm">{notification.message}</p>
            </div>
          ))}
        </div>
      </div>
    </ErrorBoundary>
  );
};

// Enhanced E2E Test Simulation (Run in console: window.simulateTVSTest())
window.simulateTVSTest = () => {
  console.log('=== TVS E2E Test: Market Switching ===');
  console.log('[TVS] 🧪 Testing IDX market...');

  setMarketType('IDX');
  setTimeout(() => {
    const idxOptions = getCombinedSymbols().map(s => `${s.symbol} (${s.market})`);
    console.assert(idxOptions.length > 0 && idxOptions[0].includes('IDX'), 'FAIL: IDX symbols not loaded');
    console.log('✅ IDX Test: Symbols:', idxOptions.slice(0, 3));

    // Test IDX currency formatting
    console.assert(document.querySelector('.chart-container').textContent.includes('Rp'), 'FAIL: IDX chart should display IDR');
    console.log('✅ IDX Test: Chart displays IDR');

    // Test company name display for IDX
    console.assert(companyName && companyName !== 'Unknown Company', 'FAIL: IDX company name not loaded');
    console.log('✅ IDX Test: Company name displayed:', companyName);

    console.log('[TVS] 🧪 Switching to US market...');
    setMarketType('US');
    setTimeout(() => {
      const usOptions = getCombinedSymbols().map(s => `${s.symbol} (${s.market})`);
      console.assert(usOptions.length > 0 && usOptions[0].includes('US') && !usOptions[0].includes('IDX'), 'FAIL: US symbols not loaded');
      console.assert(usSymbols.length > 0, 'FAIL: fetchUsSymbols not called or failed');
      console.log('✅ US Test: Symbols:', usOptions.slice(0, 3));

      // Test US currency formatting
      console.assert(document.querySelector('.chart-container').textContent.includes('$'), 'FAIL: US chart should display USD');
      console.log('✅ US Test: Chart displays USD');

      // Test company name display for US
      console.assert(companyName && companyName !== 'Unknown Company', 'FAIL: US company name not loaded');
      console.log('✅ US Test: Company name displayed:', companyName);

      console.log('=== All Tests Passed! ===');
    }, 200);
  }, 200);
};

// API Connection Debugging Function (Run in console: window.debugApiConnection())
window.debugApiConnection = async () => {
  console.log('=== TVS API Debug: Testing Connections ===');
  try {
    console.log('[TVS] 🔍 Testing IDX API endpoint: /stocks/idx/symbols');
    const idxResponse = await api.get('/stocks/idx/symbols');
    console.log('✅ IDX API Test: /stocks/idx/symbols', idxResponse.status, idxResponse.data);
    console.log('📊 IDX symbols count:', idxResponse.data.symbols?.length || 0);
  } catch (error) {
    console.error('❌ IDX API Test FAILED:', error.message);
    console.error('🔍 IDX Error details:', error.response?.data || error);
  }

  try {
    console.log('[TVS] 🔍 Testing US API endpoint: /stocks/usa/symbols');
    const usResponse = await api.get('/stocks/usa/symbols');
    console.log('✅ US API Test: /stocks/usa/symbols', usResponse.status, usResponse.data);
    console.log('📊 US symbols count:', usResponse.data.symbols?.length || 0);
  } catch (error) {
    console.error('❌ US API Test FAILED:', error.message);
    console.error('🔍 US Error details:', error.response?.data || error);
    console.log('💡 Suggestion: Check if /stocks/usa/* endpoints exist in server/routes/stocks.js');
  }

  try {
    console.log('[TVS] 🔍 Testing IDX Candlestick endpoint: /stocks/idx/candlestick');
    const idxCandleResponse = await api.get('/stocks/idx/candlestick', {
      params: { symbol: 'BBCA', timeframe: '1D' }
    });
    console.log('✅ IDX Candlestick Test:', idxCandleResponse.status);
  } catch (error) {
    console.error('❌ IDX Candlestick Test FAILED:', error.message);
  }

  try {
    console.log('[TVS] 🔍 Testing US Candlestick endpoint: /stocks/usa/candlestick');
    const usCandleResponse = await api.get('/stocks/usa/candlestick', {
      params: { symbol: 'AAPL', timeframe: '1D' }
    });
    console.log('✅ US Candlestick Test:', usCandleResponse.status);
  } catch (error) {
    console.error('❌ US Candlestick Test FAILED:', error.message);
    console.log('💡 Suggestion: Check if usa_data table exists and /stocks/usa/* routes are implemented');
  }
};

// Enhanced E2E Test Simulation for Alerts (Run in console: window.simulateAlertTest())
window.simulateAlertTest = () => {
  console.log('=== TVS E2E Test: Custom Alerts ===');
  console.log('[TVS] 🧪 Testing US alert creation...');

  setMarketType('US');
  setSelectedSymbol('AAPL');

  setTimeout(() => {
    const newAlert = {
      id: Date.now(),
      symbol: 'AAPL',
      market: 'US',
      type: 'price_above',
      price: 100,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    console.log('[TVS] ➕ Creating US alert:', newAlert);
    setAlerts([newAlert]);

    setTimeout(() => {
      console.assert(alerts.length === 1 && alerts[0].market === 'US', 'FAIL: US Alert not created');
      console.log('✅ US Alert Test: Created alert for AAPL (US)');

      console.log('[TVS] 🧪 Testing US alert notification...');
      setTimeout(() => {
        console.assert(alertNotifications.length > 0, 'FAIL: US Notification not triggered');
        console.log('✅ US Notification Test: Triggered');

        console.log('[TVS] 🧪 Testing US alert deletion...');
        setAlerts([]);
        setTimeout(() => {
          console.assert(alerts.length === 0, 'FAIL: US Alert not deleted');
          console.log('✅ US Deletion Test: Success');
          console.log('=== All Alert Tests Passed! ===');
        }, 50);
      }, 200);
    }, 200);
  }, 200);
};

export default TradingViewSuperChart;