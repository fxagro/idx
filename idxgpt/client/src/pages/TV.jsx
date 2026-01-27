import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

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
    console.error('[TradingViewChart] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">The TradingView component encountered an error. Please refresh the page.</p>
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

// Technical Indicators Calculation Functions (Enhanced)
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

const calculateStochastic = (data, kPeriod = 14, dPeriod = 3) => {
  const kValues = [];

  for (let i = 0; i < data.length; i++) {
    if (i < kPeriod - 1) {
      kValues.push(null);
    } else {
      const slice = data.slice(i - kPeriod + 1, i + 1);
      const highest = Math.max(...slice.map(d => d.h));
      const lowest = Math.min(...slice.map(d => d.l));
      const currentClose = slice[slice.length - 1].c;

      const k = ((currentClose - lowest) / (highest - lowest)) * 100;
      kValues.push(k);
    }
  }

  const dValues = calculateSMA(kValues.filter(val => val !== null), dPeriod);

  const fullDValues = [];
  let dIndex = 0;
  for (let i = 0; i < kValues.length; i++) {
    if (kValues[i] === null) {
      fullDValues.push(null);
    } else {
      fullDValues.push(dIndex < dValues.length ? dValues[dIndex] : null);
      dIndex++;
    }
  }

  return { k: kValues, d: fullDValues };
};

// Additional Technical Indicators for TradingView-like experience

const calculateATR = (data, period = 14) => {
  const atr = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      atr.push(null);
    } else {
      const trs = [];
      for (let j = i - period + 1; j <= i; j++) {
        const high = data[j].h;
        const low = data[j].l;
        const prevClose = data[j - 1]?.c || high; // fallback to current high if no prev close
        const tr = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );
        trs.push(tr);
      }
      atr.push(trs.reduce((a, b) => a + b, 0) / period);
    }
  }
  return atr;
};

const calculateWilliamsR = (data, period = 14) => {
  const williamsR = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      williamsR.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const highest = Math.max(...slice.map(d => d.h));
      const lowest = Math.min(...slice.map(d => d.l));
      const currentClose = data[i].c;
      const r = ((highest - currentClose) / (highest - lowest)) * 100;
      williamsR.push(-r); // Williams %R is typically negative
    }
  }
  return williamsR;
};

const calculateCCI = (data, period = 20) => {
  const cci = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      cci.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const tpValues = slice.map(d => (d.h + d.l + d.c) / 3);
      const smaTp = tpValues.reduce((a, b) => a + b, 0) / period;
      const meanDeviation = tpValues.reduce((sum, tp) => sum + Math.abs(tp - smaTp), 0) / period;
      const currentTp = tpValues[tpValues.length - 1];

      if (meanDeviation !== 0) {
        cci.push((currentTp - smaTp) / (0.015 * meanDeviation));
      } else {
        cci.push(0);
      }
    }
  }
  return cci;
};

const calculateIchimoku = (data, tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52) => {
  const tenkanSen = [];
  const kijunSen = [];
  const senkouSpanA = [];
  const senkouSpanB = [];
  const chikouSpan = [];

  for (let i = 0; i < data.length; i++) {
    // Tenkan-sen (Conversion Line)
    if (i >= tenkanPeriod - 1) {
      const slice = data.slice(i - tenkanPeriod + 1, i + 1);
      const high = Math.max(...slice.map(d => d.h));
      const low = Math.min(...slice.map(d => d.l));
      tenkanSen.push((high + low) / 2);
    } else {
      tenkanSen.push(null);
    }

    // Kijun-sen (Base Line)
    if (i >= kijunPeriod - 1) {
      const slice = data.slice(i - kijunPeriod + 1, i + 1);
      const high = Math.max(...slice.map(d => d.h));
      const low = Math.min(...slice.map(d => d.l));
      kijunSen.push((high + low) / 2);
    } else {
      kijunSen.push(null);
    }

    // Senkou Span A (Leading Span A) - shifted forward by 26 periods
    if (i >= kijunPeriod - 1) {
      const tenkan = tenkanSen[tenkanSen.length - 1];
      const kijun = kijunSen[kijunSen.length - 1];
      if (tenkan !== null && kijun !== null) {
        senkouSpanA.push((tenkan + kijun) / 2);
      } else {
        senkouSpanA.push(null);
      }
    } else {
      senkouSpanA.push(null);
    }

    // Senkou Span B (Leading Span B) - shifted forward by 26 periods
    if (i >= senkouBPeriod - 1) {
      const slice = data.slice(i - senkouBPeriod + 1, i + 1);
      const high = Math.max(...slice.map(d => d.h));
      const low = Math.min(...slice.map(d => d.l));
      senkouSpanB.push((high + low) / 2);
    } else {
      senkouSpanB.push(null);
    }

    // Chikou Span (Lagging Span) - shifted backward by 26 periods
    if (i >= kijunPeriod - 1) {
      chikouSpan.push(data[i - (kijunPeriod - 1)].c);
    } else {
      chikouSpan.push(null);
    }
  }

  return {
    tenkanSen,
    kijunSen,
    senkouSpanA,
    senkouSpanB,
    chikouSpan
  };
};

const calculateParabolicSAR = (data, step = 0.02, maxStep = 0.2) => {
  const sar = [];
  if (data.length < 2) return sar;

  let isUp = true; // Assume initial trend is up
  let ep = data[0].l; // Extreme point
  let af = step; // Acceleration factor
  let sarValue = data[0].h; // Initial SAR

  for (let i = 0; i < data.length; i++) {
    sar.push(sarValue);

    if (isUp) {
      if (data[i].l <= sarValue) {
        // Trend reversal
        isUp = false;
        sarValue = ep;
        ep = data[i].l;
        af = step;
      } else {
        // Continue uptrend
        if (data[i].h > ep) {
          ep = data[i].h;
          af = Math.min(af + step, maxStep);
        }
        sarValue = sarValue + af * (ep - sarValue);
      }
    } else {
      if (data[i].h >= sarValue) {
        // Trend reversal
        isUp = true;
        sarValue = ep;
        ep = data[i].h;
        af = step;
      } else {
        // Continue downtrend
        if (data[i].l < ep) {
          ep = data[i].l;
          af = Math.min(af + step, maxStep);
        }
        sarValue = sarValue - af * (sarValue - ep);
      }
    }
  }

  return sar;
};

const calculateADX = (data, period = 14) => {
  const adx = [];
  const trueRanges = [];
  const plusDM = [];
  const minusDM = [];

  // Calculate True Range, +DM, -DM
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      trueRanges.push(data[i].h - data[i].l);
      plusDM.push(0);
      minusDM.push(0);
    } else {
      const tr = Math.max(
        data[i].h - data[i].l,
        Math.abs(data[i].h - data[i-1].c),
        Math.abs(data[i].l - data[i-1].c)
      );
      trueRanges.push(tr);

      const moveUp = data[i].h - data[i-1].h;
      const moveDown = data[i-1].l - data[i].l;

      if (moveUp > moveDown && moveUp > 0) {
        plusDM.push(moveUp);
      } else {
        plusDM.push(0);
      }

      if (moveDown > moveUp && moveDown > 0) {
        minusDM.push(moveDown);
      } else {
        minusDM.push(0);
      }
    }
  }

  // Calculate smoothed averages
  const smoothedTR = [];
  const smoothedPlusDM = [];
  const smoothedMinusDM = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      smoothedTR.push(null);
      smoothedPlusDM.push(null);
      smoothedMinusDM.push(null);
    } else {
      const trSlice = trueRanges.slice(i - period + 1, i + 1);
      const plusSlice = plusDM.slice(i - period + 1, i + 1);
      const minusSlice = minusDM.slice(i - period + 1, i + 1);

      smoothedTR.push(trSlice.reduce((a, b) => a + b, 0) / period);
      smoothedPlusDM.push(plusSlice.reduce((a, b) => a + b, 0) / period);
      smoothedMinusDM.push(minusSlice.reduce((a, b) => a + b, 0) / period);
    }
  }

  // Calculate DX and ADX
  for (let i = 0; i < data.length; i++) {
    if (i < period * 2 - 1 || !smoothedTR[i] || !smoothedPlusDM[i] || !smoothedMinusDM[i]) {
      adx.push(null);
    } else {
      const plusDI = (smoothedPlusDM[i] / smoothedTR[i]) * 100;
      const minusDI = (smoothedMinusDM[i] / smoothedTR[i]) * 100;

      if (plusDI + minusDI === 0) {
        adx.push(0);
      } else {
        const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;

        if (adx.length === 0) {
          adx.push(dx);
        } else {
          const prevADX = adx[adx.length - 1] || dx;
          adx.push(((prevADX * (period - 1)) + dx) / period);
        }
      }
    }
  }

  return adx;
};

// TradingView-like Component
const TradingViewChart = () => {
  const { t, i18n } = useTranslation();

  // Debug logging
  useEffect(() => {
    console.log('[TradingViewChart] Component mounted successfully', {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      theme: localStorage.getItem('tv-chart-theme') || 'light',
      settings: localStorage.getItem('tv-chart-settings') ? 'loaded' : 'default'
    });
  }, []);
  const [symbols, setSymbols] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [compareSymbols, setCompareSymbols] = useState([]);
  const [timeRange, setTimeRange] = useState('1D');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);


  // Theme and UI state
  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('chart');

  // Drawing tools state
  const [drawingMode, setDrawingMode] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);

  // Watchlist and screener state
  const [watchlist, setWatchlist] = useState([]);
  const [screenerFilters, setScreenerFilters] = useState({
    minVolume: '',
    maxVolume: '',
    minChange: '',
    maxChange: '',
    sector: ''
  });

  // Trading simulation state
  const [portfolio, setPortfolio] = useState({
    balance: 100000000, // 100M IDR
    positions: [],
    orders: [],
    trades: []
  });

  // User settings
  const [userSettings, setUserSettings] = useState({
    indicators: {
      SMA: { enabled: true, periods: [20, 50] },
      EMA: { enabled: true, periods: [12, 26] },
      RSI: { enabled: true, period: 14 },
      MACD: { enabled: true, fast: 12, slow: 26, signal: 9 },
      BB: { enabled: true, period: 20, stdDev: 2 },
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
      chartType: 'candlestick'
    }
  });

  // Chart refs
  const mainChartRef = useRef(null);
  const indicatorChartRef = useRef(null);
  const mainChartInstance = useRef(null);
  const indicatorChartInstance = useRef(null);

  // Timeframes for TradingView-like experience
  const timeframes = [
    { value: '1m', label: '1M' },
    { value: '5m', label: '5M' },
    { value: '15m', label: '15M' },
    { value: '30m', label: '30M' },
    { value: '1H', label: '1H' },
    { value: '4H', label: '4H' },
    { value: '1D', label: '1D' },
    { value: '1W', label: '1W' },
    { value: '1M', label: '1M' }
  ];


  // Generate dummy data as fallback
  const generateDummyData = (symbol, range, count) => {
    const data = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      data.push({
        trade_date: date.toISOString(),
        open: 1000 + Math.random() * 100,
        high: 1100 + Math.random() * 100,
        low: 900 + Math.random() * 100,
        close: 1000 + Math.random() * 100,
        volume: 100000 + Math.random() * 10000
      });
    }
    return data.reverse();
  };



  // Technical indicators hook
  const useTechnicalIndicators = (data, indicators) => {
    return useMemo(() => {
      if (!data || data.length === 0) return {};

      const result = {};

      indicators.forEach(indicator => {
        switch (indicator.type) {
          case 'SMA':
            result[`SMA_${indicator.period}`] = calculateSMA(
              data.map(d => d.c),
              indicator.period
            );
            break;
          case 'EMA':
            result[`EMA_${indicator.period}`] = calculateEMA(
              data.map(d => d.c),
              indicator.period
            );
            break;
          case 'RSI':
            result[`RSI_${indicator.period}`] = calculateRSI(
              data.map(d => d.c),
              indicator.period
            );
            break;
          case 'MACD':
            result[`MACD_${indicator.fast}_${indicator.slow}_${indicator.signal}`] = calculateMACD(
              data.map(d => d.c),
              indicator.fast,
              indicator.slow,
              indicator.signal
            );
            break;
          case 'BB':
            result[`BB_${indicator.period}_${indicator.stdDev}`] = calculateBollingerBands(
              data.map(d => d.c),
              indicator.period,
              indicator.stdDev
            );
            break;
          case 'STOCHASTIC':
            result[`STOCHASTIC_${indicator.kPeriod}_${indicator.dPeriod}`] = calculateStochastic(
              data,
              indicator.kPeriod,
              indicator.dPeriod
            );
            break;
          case 'ATR':
            result[`ATR_${indicator.period}`] = calculateATR(
              data,
              indicator.period
            );
            break;
          case 'WILLIAMS_R':
            result[`WILLIAMS_R_${indicator.period}`] = calculateWilliamsR(
              data,
              indicator.period
            );
            break;
          case 'CCI':
            result[`CCI_${indicator.period}`] = calculateCCI(
              data,
              indicator.period
            );
            break;
          case 'ICHIMOKU':
            result['ICHIMOKU'] = calculateIchimoku(
              data,
              indicator.tenkan,
              indicator.kijun,
              indicator.senkouB
            );
            break;
          case 'ADX':
            result[`ADX_${indicator.period}`] = calculateADX(
              data,
              indicator.period
            );
            break;
          case 'PARABOLIC_SAR':
            result['PARABOLIC_SAR'] = calculateParabolicSAR(
              data,
              indicator.step,
              indicator.maxStep
            );
            break;
          default:
            break;
        }
      });

      return result;
    }, [data, indicators]);
  };

  // Prepare indicators configuration
  const indicatorsConfig = useMemo(() => {
    const configArray = [];

    Object.entries(userSettings.indicators).forEach(([key, indicatorConfig]) => {
      if (!indicatorConfig.enabled) return;

      switch (key) {
        case 'SMA':
          indicatorConfig.periods.forEach(period => {
            configArray.push({ type: 'SMA', period });
          });
          break;
        case 'EMA':
          indicatorConfig.periods.forEach(period => {
            configArray.push({ type: 'EMA', period });
          });
          break;
        case 'RSI':
          configArray.push({ type: 'RSI', period: indicatorConfig.period });
          break;
        case 'MACD':
          configArray.push({
            type: 'MACD',
            fast: indicatorConfig.fast,
            slow: indicatorConfig.slow,
            signal: indicatorConfig.signal
          });
          break;
        case 'BB':
          configArray.push({
            type: 'BB',
            period: indicatorConfig.period,
            stdDev: indicatorConfig.stdDev
          });
          break;
        case 'STOCHASTIC':
          configArray.push({
            type: 'STOCHASTIC',
            kPeriod: indicatorConfig.kPeriod,
            dPeriod: indicatorConfig.dPeriod
          });
          break;
        case 'ATR':
          configArray.push({
            type: 'ATR',
            period: indicatorConfig.period
          });
          break;
        case 'WILLIAMS_R':
          configArray.push({
            type: 'WILLIAMS_R',
            period: indicatorConfig.period
          });
          break;
        case 'CCI':
          configArray.push({
            type: 'CCI',
            period: indicatorConfig.period
          });
          break;
        case 'ICHIMOKU':
          configArray.push({
            type: 'ICHIMOKU',
            tenkan: indicatorConfig.tenkan,
            kijun: indicatorConfig.kijun,
            senkouB: indicatorConfig.senkouB
          });
          break;
        case 'ADX':
          configArray.push({
            type: 'ADX',
            period: indicatorConfig.period
          });
          break;
        case 'PARABOLIC_SAR':
          configArray.push({
            type: 'PARABOLIC_SAR',
            step: indicatorConfig.step,
            maxStep: indicatorConfig.maxStep
          });
          break;
        default:
          break;
      }
    });

    return configArray;
  }, [userSettings.indicators]);

  // Technical indicators
  const technicalIndicators = useMemo(() => ({
    SMA_10: calculateSMA(validChartData.map(d => d.close), 10),
    EMA_10: calculateEMA(validChartData.map(d => d.close), 10),
    RSI_14: calculateRSI(validChartData.map(d => d.close), 14),
    MACD: calculateMACD(validChartData.map(d => d.close)),
    BollingerBands_20: calculateBollingerBands(validChartData.map(d => d.close), 20),
    Stochastic_14: calculateStochastic(validChartData, 14),
    ATR_14: calculateATR(validChartData, 14),
    IchimokuCloud: calculateIchimoku(validChartData),
    WilliamsR_14: calculateWilliamsR(validChartData, 14),
    CCI_20: calculateCCI(validChartData, 20),
    ADX_14: calculateADX(validChartData, 14),
    ParabolicSAR: calculateParabolicSAR(validChartData)
  }), [validChartData]);

  // Debug logging for technical indicators
  console.log('[TV.jsx:475] technicalIndicators:', technicalIndicators);

  // Debug logging for technical indicators
  Object.keys(technicalIndicators).forEach(key => {
    console.log(`[TV.jsx] Indicator ${key} data length:`, technicalIndicators[key]?.length);
  });

  // Data validation function - MOVED TO TOP
  function isValidDataPoint(d) {
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
  }

  // Process and validate chart data
  const validChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      console.warn('[TV.jsx] No chart data available for validation');
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

    console.log('[TV.jsx] Valid data points:', processed.length, 'of', chartData.length);
    return processed;
  }, [chartData, isValidDataPoint]);

  // Debug logging for getMaxPointsForTimeRange
  console.log('[TV.jsx:475] Using getMaxPointsForTimeRange:', getMaxPointsForTimeRange(timeRange));

  // Debug logging for getMaxPointsForTimeRange
  console.log('[TV.jsx:475] Using getMaxPointsForTimeRange:', getMaxPointsForTimeRange(timeRange));

  // Debug logging for getMaxPointsForTimeRange
  console.log('[TV.jsx:475] Using getMaxPointsForTimeRange:', getMaxPointsForTimeRange(timeRange));


  // Render main chart
  useEffect(() => {
    console.log('[TV.jsx] Main chart useEffect triggered', {
      hasChartData: !!chartData && chartData.length > 0,
      chartDataLength: chartData?.length || 0,
      hasMainChartRef: !!mainChartRef.current,
      selectedSymbol,
      chartType: userSettings.layout.chartType,
      validChartDataLength: validChartData?.length || 0
    });

    if (!chartData || chartData.length === 0) {
      console.warn('[TV.jsx] No chart data available for rendering');
      return;
    }

    if (!mainChartRef.current) {
      console.error('[TV.jsx] Main chart ref not initialized');
      return;
    }

    const ctx = mainChartRef.current.getContext('2d');
    if (!ctx) {
      console.error('[TV.jsx] Failed to get 2d context from main chart canvas');
      console.error('[TV.jsx] Canvas element:', mainChartRef.current);
      console.error('[TV.jsx] Canvas width:', mainChartRef.current?.width);
      console.error('[TV.jsx] Canvas height:', mainChartRef.current?.height);
      return;
    }
    console.log('[TV.jsx] Got 2d context successfully:', ctx);
    console.log('[TV.jsx] Canvas dimensions:', {
      width: mainChartRef.current.width,
      height: mainChartRef.current.height,
      style: window.getComputedStyle(mainChartRef.current)
    });

    // Destroy existing chart
    if (mainChartInstance.current) {
      console.log('[TV.jsx] Destroying existing main chart');
      console.log('[TV.jsx] Existing chart instance:', mainChartInstance.current);
      mainChartInstance.current.destroy();
      mainChartInstance.current = null;
    }

    if (validChartData.length === 0) {
      console.error('[TV.jsx] No valid chart data after filtering');
      console.error('[TV.jsx] Original chartData length:', chartData?.length);
      console.error('[TV.jsx] Sample chartData:', chartData?.slice(0, 3));
      setError('No valid chart data available');
      return;
    }

    console.log(`[TV.jsx] Rendering main chart with ${validChartData.length} valid data points`);
    console.log('[TV.jsx] Sample validChartData:', validChartData.slice(0, 3));

    // Prepare datasets for main chart
    const datasets = (() => {
      if (!validChartData || validChartData.length === 0) {
        console.warn('[TV.jsx] No valid data for datasets');
        return [];
      }

      return [
        // Main price dataset (candlestick/line)
        {
          label: `${selectedSymbol} Price`,
          type: chartType === 'candlestick' ? 'candlestick' : 'line',
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
        },
        // Volume dataset
        {
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
        }
      ];
    }, [validChartData, userSettings.layout.chartType, selectedSymbol, theme]);

    console.log(`[TV.jsx] Prepared ${datasets.length} datasets for main chart`);
    console.log('[TV.jsx] Sample datasets:', datasets.map(d => ({ label: d.label, type: d.type, dataLength: d.data?.length })));
    console.log('[TV.jsx] Main chart datasets:', datasets);
    console.log('[TV.jsx] Volume dataset:', datasets.find(d => d.label === 'Volume'));
    console.log('[TV.jsx] Main chart datasets:', datasets);
    console.log('[TV.jsx] Volume dataset:', datasets.find(d => d.label === 'Volume'));

     // Chart configuration
     const chartConfig = (() => {
       console.log('[TV.jsx] Creating chartConfig with datasets:', datasets);
       return {
         type: userSettings.layout.chartType === 'candlestick' ? 'candlestick' : 'line',
         data: { datasets },
         options: {
           responsive: true,
           maintainAspectRatio: false,
           animation: {
             duration: 0 // Disable animation for better performance
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
                 label: (context) => {
                   if (context.dataset.type === 'candlestick') {
                     const point = context.raw;
                     return [
                       `Open: Rp ${point.o?.toLocaleString('id-ID') || 0}`,
                       `High: Rp ${point.h?.toLocaleString('id-ID') || 0}`,
                       `Low: Rp ${point.l?.toLocaleString('id-ID') || 0}`,
                       `Close: Rp ${point.c?.toLocaleString('id-ID') || 0}`
                     ];
                   }
                   return `${context.dataset.label}: ${context.parsed.y?.toLocaleString('id-ID') || 0}`;
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
                 callback: (value) => `Rp ${value.toLocaleString('id-ID')}`,
                 color: theme === 'dark' ? '#D1D5DB' : '#6B7280',
                 maxTicksLimit: 6
               },
               grid: {
                 color: theme === 'dark' ? 'rgba(107, 114, 128, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                 display: userSettings.layout.showGrid
               }
             },
             'y-volume': {
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
             }
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
           }
         }
       };
     })();

    console.log('[TV.jsx] Creating new main chart with config:', {
      type: chartConfig.type,
      datasetsCount: datasets.length,
      dataPoints: validChartData.length
    });
    console.log('[TV.jsx] Chart config data:', {
      datasets: chartConfig.data?.datasets?.map(d => ({
        label: d.label,
        type: d.type,
        dataLength: d.data?.length,
        sampleData: d.data?.slice(0, 2)
      }))
    });

    try {
       console.log('[TV.jsx] About to create Chart.js instance with config:', {
         type: chartConfig.type,
         data: chartConfig.data,
         options: chartConfig.options
       });

       const newChart = new Chart(ctx, chartConfig);
       mainChartInstance.current = newChart;
       console.log('[TV.jsx] Main chart created successfully');
          console.log('[TV.jsx] Main chart instance:', newChart);
          console.log('[TV.jsx] Chart data length:', newChart.data?.datasets?.length);
          console.log('[TV.jsx] Chart canvas:', newChart.canvas);
          console.log('[TV.jsx] Chart width:', newChart.width);
          console.log('[TV.jsx] Chart height:', newChart.height);
          console.log('[TV.jsx] Chart options:', newChart.options);
   
          // Force a render update
          setTimeout(() => {
            newChart.update();
            console.log('[TV.jsx] Chart updated manually');
          }, 100);
     } catch (error) {
       console.error('[TV.jsx] Error creating main chart:', error);
       console.error('[TV.jsx] Error details:', {
         message: error.message,
         stack: error.stack,
         chartConfig: chartConfig
       });
     }

    return () => {
      if (mainChartInstance.current) {
        console.log('[TV.jsx] Destroying main chart');
        mainChartInstance.current.destroy();
        mainChartInstance.current = null;
      }
    };
  }, [chartData, selectedSymbol, userSettings, theme]);

  // Render indicator panel
  useEffect(() => {
    console.log('[TV.jsx] Indicator panel useEffect triggered', {
      hasChartData: !!chartData && chartData.length > 0,
      chartDataLength: chartData?.length || 0,
      hasIndicatorChartRef: !!indicatorChartRef.current,
      technicalIndicatorsKeys: Object.keys(technicalIndicators || {}),
      enabledIndicators: Object.entries(userSettings.indicators).filter(([_, config]) => config.enabled).map(([key, _]) => key)
    });

    if (!chartData || chartData.length === 0) {
      console.warn('[TV.jsx] No chart data available for indicator rendering');
      return;
    }

    if (!indicatorChartRef.current) {
      console.error('[TV.jsx] Indicator chart ref not initialized');
      return;
    }

    const ctx = indicatorChartRef.current.getContext('2d');
    if (!ctx) {
      console.error('[TV.jsx] Failed to get 2d context from indicator chart canvas');
      return;
    }

    // Destroy existing chart
    if (indicatorChartInstance.current) {
      console.log('[TV.jsx] Destroying existing indicator chart');
      indicatorChartInstance.current.destroy();
      indicatorChartInstance.current = null;
    }

    const datasets = [];

    // Use the same validChartData from main chart for consistency
    if (!validChartData || validChartData.length === 0) {
      console.error('[TV.jsx] No valid chart data for indicators');
      return;
    }

    console.log(`[TV.jsx] Rendering indicator chart with ${validChartData.length} valid data points`);

    // Debug logging for indicator rendering
    const subplotRefs = { RSI: indicatorChartRef, MACD: indicatorChartRef, ATR: indicatorChartRef, WilliamsR: indicatorChartRef, CCI: indicatorChartRef, ADX: indicatorChartRef };
    Object.entries(subplotRefs).forEach(([ind, ref]) => {
      console.log(`[TV.jsx] Rendering ${ind} subplot:`, technicalIndicators[`${ind}_${userSettings.indicators[ind].period}`]?.length);
    });

    // RSI indicator
    if (userSettings.indicators.RSI.enabled && technicalIndicators.RSI_14) {
      const rsiData = technicalIndicators.RSI_14;
      console.log(`[TV.jsx] Adding RSI indicator with ${rsiData?.length || 0} data points`);

      datasets.push({
        label: `RSI 14`,
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
    if (userSettings.indicators.MACD.enabled && technicalIndicators.MACD) {
      const macdData = technicalIndicators.MACD;
      console.log(`[TV.jsx] Adding MACD indicator with ${macdData.macdLine?.length || 0} data points`);

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

    // ATR indicator
    if (userSettings.indicators.ATR.enabled && technicalIndicators.ATR_14) {
      const atrData = technicalIndicators.ATR_14;
      console.log(`[TV.jsx] Adding ATR indicator with ${atrData?.length || 0} data points`);

      datasets.push({
        label: `ATR 14`,
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime(),
          y: atrData[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: '#F59E0B',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        yAxisID: 'atr'
      });
    }

    // Williams %R indicator
    if (userSettings.indicators.WILLIAMS_R.enabled && technicalIndicators.WilliamsR_14) {
      const williamsRData = technicalIndicators.WilliamsR_14;
      console.log(`[TV.jsx] Adding Williams %R indicator with ${williamsRData?.length || 0} data points`);

      datasets.push({
        label: `Williams %R 14`,
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime(),
          y: williamsRData[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: '#8B5CF6',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        yAxisID: 'williamsR'
      });
    }

    // CCI indicator
    if (userSettings.indicators.CCI.enabled && technicalIndicators.CCI_20) {
      const cciData = technicalIndicators.CCI_20;
      console.log(`[TV.jsx] Adding CCI indicator with ${cciData?.length || 0} data points`);

      datasets.push({
        label: `CCI 20`,
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime(),
          y: cciData[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: '#EF4444',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        yAxisID: 'cci'
      });
    }

    // ADX indicator
    if (userSettings.indicators.ADX.enabled && technicalIndicators.ADX_14) {
      const adxData = technicalIndicators.ADX_14;
      console.log(`[TV.jsx] Adding ADX indicator with ${adxData?.length || 0} data points`);

      datasets.push({
        label: `ADX 14`,
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime(),
          y: adxData[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: '#6366F1',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        yAxisID: 'adx'
      });
    }

    // Ichimoku Cloud indicator
    if (userSettings.indicators.ICHIMOKU.enabled && technicalIndicators.IchimokuCloud) {
      const ichimokuData = technicalIndicators.IchimokuCloud;
      console.log(`[TV.jsx] Adding Ichimoku Cloud indicator`);

      // Tenkan-sen (Conversion Line)
      datasets.push({
        label: 'Tenkan-sen',
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime(),
          y: ichimokuData.tenkanSen[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: '#FF6B6B',
        backgroundColor: 'transparent',
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 3,
        yAxisID: 'y'
      });

      // Kijun-sen (Base Line)
      datasets.push({
        label: 'Kijun-sen',
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime(),
          y: ichimokuData.kijunSen[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: '#4ECDC4',
        backgroundColor: 'transparent',
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 3,
        yAxisID: 'y'
      });

      // Senkou Span A (Leading Span A) - shifted forward
      datasets.push({
        label: 'Senkou Span A',
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime() + (26 * 24 * 60 * 60 * 1000), // Shift forward by 26 periods
          y: ichimokuData.senkouSpanA[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: '#45B7D1',
        backgroundColor: 'rgba(69, 183, 209, 0.1)',
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 3,
        yAxisID: 'y'
      });

      // Senkou Span B (Leading Span B) - shifted forward
      datasets.push({
        label: 'Senkou Span B',
        type: 'line',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime() + (26 * 24 * 60 * 60 * 1000), // Shift forward by 26 periods
          y: ichimokuData.senkouSpanB[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: '#96CEB4',
        backgroundColor: 'rgba(150, 206, 180, 0.1)',
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 3,
        yAxisID: 'y'
      });
    }

    // Parabolic SAR indicator
    if (userSettings.indicators.PARABOLIC_SAR.enabled && technicalIndicators.ParabolicSAR) {
      const sarData = technicalIndicators.ParabolicSAR;
      console.log(`[TV.jsx] Adding Parabolic SAR indicator with ${sarData?.length || 0} data points`);

      datasets.push({
        label: 'Parabolic SAR',
        type: 'scatter',
        data: validChartData.map((d, i) => ({
          x: new Date(d.trade_date).getTime(),
          y: sarData[i]
        })).filter(d => d.y !== null && !isNaN(d.y)),
        borderColor: '#00FF00',
        backgroundColor: '#00FF00',
        borderWidth: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
        yAxisID: 'y'
      });
    }

    if (datasets.length === 0) {
      console.log('[TV.jsx] No indicators enabled, creating empty indicator chart');

      // Create empty chart if no indicators are enabled
      const chartConfig = {
        type: 'line',
        data: { datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 0
          },
          plugins: {
            title: {
              display: true,
              text: 'No indicators selected',
              color: theme === 'dark' ? '#D1D5DB' : '#6B7280'
            }
          },
          scales: {
            x: {
              display: false
            },
            y: {
              display: false
            }
          }
        }
      };

      try {
        const newChart = new Chart(ctx, chartConfig);
        indicatorChartInstance.current = newChart;
        console.log('[TV.jsx] Empty indicator chart created successfully');
      } catch (error) {
        console.error('[TV.jsx] Error creating empty indicator chart:', error);
      }
      return;
    }

    console.log(`[TV.jsx] Creating indicator chart with ${datasets.length} datasets`);

    const chartConfig = {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0
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
            position: 'right',
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
          },
          atr: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'ATR',
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
          },
          williamsR: {
            type: 'linear',
            display: true,
            position: 'right',
            min: -100,
            max: 0,
            title: {
              display: true,
              text: 'Williams %R',
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
          },
          cci: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'CCI',
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
          },
          adx: {
            type: 'linear',
            display: true,
            position: 'right',
            min: 0,
            max: 100,
            title: {
              display: true,
              text: 'ADX',
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

    console.log('[TV.jsx] Creating indicator chart with config:', {
      datasetsCount: datasets.length,
      dataPoints: validChartData.length
    });

    try {
      const newChart = new Chart(ctx, chartConfig);
      indicatorChartInstance.current = newChart;
      console.log('[TV.jsx] Indicator chart created successfully');
    } catch (error) {
      console.error('[TV.jsx] Error creating indicator chart:', error);
    }

    return () => {
      if (indicatorChartInstance.current) {
        console.log('[TV.jsx] Destroying indicator chart');
        indicatorChartInstance.current.destroy();
        indicatorChartInstance.current = null;
      }
    };
  }, [chartData, userSettings, technicalIndicators, theme]);

  // Drawing tools
  const drawingTools = [
    { id: 'trendline', label: 'Trend Line', icon: '📈' },
    { id: 'horizontal', label: 'Horizontal Line', icon: '─' },
    { id: 'rectangle', label: 'Rectangle', icon: '□' },
    { id: 'fibonacci', label: 'Fibonacci', icon: 'Φ' }
  ];

  // Load user settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('tv-chart-settings');
    if (savedSettings) {
      setUserSettings(JSON.parse(savedSettings));
    }

    const savedTheme = localStorage.getItem('tv-chart-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('tv-chart-settings', JSON.stringify(userSettings));
  }, [userSettings]);

  useEffect(() => {
    localStorage.setItem('tv-chart-theme', theme);
  }, [theme]);

  // WebSocket connection - REMOVED FOR HISTORICAL DATA ONLY
  console.log('[TradingViewChart] WebSocket disabled for historical data focus');

  // Fetch symbols
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const response = await api.get('/stocks/symbols');
        const symbolsList = response.data.symbols || [];
        setSymbols(symbolsList);

        if (symbolsList.length > 0 && !selectedSymbol) {
          setSelectedSymbol(symbolsList[0]);
        }
      } catch (error) {
        console.error('Error fetching symbols:', error);
        setError('Failed to load symbols');
      }
    };

    fetchSymbols();
  }, []);

  // Load watchlist from localStorage
  useEffect(() => {
    const savedWatchlist = localStorage.getItem('tv-watchlist');
    if (savedWatchlist) {
      setWatchlist(JSON.parse(savedWatchlist));
    }
  }, []);

  // Save watchlist to localStorage
  useEffect(() => {
    localStorage.setItem('tv-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);


  // Fetch chart data with performance optimization
  useEffect(() => {
    if (!selectedSymbol) return;

    const fetchChartData = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(`[TradingViewChart] Fetching data for ${selectedSymbol} with timeframe ${timeRange}`);

        const response = await api.get('/stocks/candlestick', {
          params: {
            symbol: selectedSymbol,
            timeframe: timeRange
          }
        });

        let data = response.data?.data || [];

        if (data.length === 0) {
          console.warn(`[TradingViewChart] No data from API for ${selectedSymbol}, using dummy data`);
          data = generateDummyData(selectedSymbol, timeRange, 100);
        }

        const maxPoints = getMaxPointsForTimeRange(timeRange);
        const limitedData = limitDataPoints(data, maxPoints);

        console.log(`[TradingViewChart] Data loaded: ${data.length} points, limited to ${limitedData.length} points`);
        setChartData(limitedData);
      } catch (error) {
        console.error('[TradingViewChart] Error fetching chart data:', error);

        // Use dummy data as fallback on error
        console.log(`[TradingViewChart] Using dummy data due to API error`);
        const dummyData = generateDummyData(selectedSymbol, timeRange, 100);
        setChartData(dummyData);
        setError(null); // Don't show error if we have fallback data
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [selectedSymbol, timeRange, limitDataPoints, getMaxPointsForTimeRange, generateDummyData]);

  // Add/remove symbol from watchlist
  const toggleWatchlist = (symbol) => {
    setWatchlist(prev => {
      const exists = prev.find(item => item.symbol === symbol);
      if (exists) {
        return prev.filter(item => item.symbol !== symbol);
      } else {
        return [...prev, { symbol, addedAt: new Date().toISOString() }];
      }
    });
  };

  // Trading simulation functions
  const placeOrder = (type, symbol, price, quantity) => {
    const order = {
      id: Date.now(),
      type,
      symbol,
      price,
      quantity,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    setPortfolio(prev => ({
      ...prev,
      orders: [...prev.orders, order]
    }));

    // Simulate order execution
    setTimeout(() => {
      executeOrder(order);
    }, 1000);
  };

  const executeOrder = (order) => {
    const currentPrice = chartData[chartData.length - 1]?.c || 0;

    if (order.type === 'buy' && portfolio.balance >= order.price * order.quantity) {
      const cost = order.price * order.quantity;
      const position = {
        symbol: order.symbol,
        quantity: order.quantity,
        avgPrice: order.price,
        currentPrice,
        pnl: (currentPrice - order.price) * order.quantity
      };

      setPortfolio(prev => ({
        ...prev,
        balance: prev.balance - cost,
        positions: [...prev.positions, position],
        orders: prev.orders.map(o => o.id === order.id ? { ...o, status: 'executed' } : o),
        trades: [...prev.trades, { ...order, executedPrice: order.price, status: 'executed' }]
      }));
    } else if (order.type === 'sell') {
      const position = portfolio.positions.find(p => p.symbol === order.symbol);
      if (position && position.quantity >= order.quantity) {
        const revenue = order.price * order.quantity;

        setPortfolio(prev => ({
          ...prev,
          balance: prev.balance + revenue,
          positions: prev.positions.map(p =>
            p.symbol === order.symbol
              ? { ...p, quantity: p.quantity - order.quantity }
              : p
          ).filter(p => p.quantity > 0),
          orders: prev.orders.map(o => o.id === order.id ? { ...o, status: 'executed' } : o),
          trades: [...prev.trades, { ...order, executedPrice: order.price, status: 'executed' }]
        }));
      }
    }
  };

  // Share to X (Twitter)
  const shareToX = () => {
    const currentPrice = chartData[chartData.length - 1]?.c || 0;
    const text = `📊 Trading Analysis: ${selectedSymbol} at Rp ${currentPrice.toLocaleString('id-ID')}\n\nCheck out this technical analysis on our TradingView-like platform! #Trading #${selectedSymbol} #StockMarket`;
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
    console.log(`[TradingViewChart] Language changed to: ${newLang}`);
  };

  return (
    <ErrorBoundary>
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} shadow-sm border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">{t('tradingView.title', '📺 TradingView Pro')}</h1>
              <div className="flex items-center space-x-2 px-2 py-1 rounded bg-blue-100 text-blue-800">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-xs font-medium">
                  Historical Data
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={shareToX}
                className="px-3 py-1 bg-black text-white text-sm rounded hover:bg-gray-800 transition-colors"
                title={t('tradingView.shareToX', 'Share to X')}
              >
                {t('tradingView.shareToX', 'Share to X')}
              </button>
              <button
                onClick={toggleLanguage}
                className={`px-3 py-1 text-sm rounded transition-colors ${theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
                title={t('tradingView.toggleLanguage', 'Toggle Language')}
              >
                {i18n.language === 'id' ? '🇺🇸 EN' : '🇮🇩 ID'}
              </button>
              <button
                onClick={toggleTheme}
                className={`px-3 py-1 text-sm rounded transition-colors ${theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
                title={t('tradingView.toggleTheme', 'Toggle Theme')}
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`px-3 py-1 text-sm rounded transition-colors ${theme === 'dark' ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`}
                title={t('tradingView.toggleSidebar', 'Toggle Sidebar')}
              >
                {sidebarOpen ? '→' : '←'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row h-screen">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className={`w-full lg:w-80 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-b lg:border-b-0 lg:border-r ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} overflow-y-auto`}>
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {['watchlist', 'screener', 'portfolio', 'settings'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-sm font-medium ${
                    activeTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-4">
              {activeTab === 'watchlist' && (
                <div>
                  <h3 className="font-semibold mb-3">Watchlist</h3>
                  <div className="space-y-2">
                    {watchlist.map(item => (
                      <div key={item.symbol} className={`p-2 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{item.symbol}</span>
                          <button
                            onClick={() => toggleWatchlist(item.symbol)}
                            className="text-red-500 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    <Select
                      options={symbols.map(s => ({ value: s, label: s }))}
                      onChange={(option) => option && toggleWatchlist(option.value)}
                      placeholder="Add symbol to watchlist"
                    />
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

              {activeTab === 'settings' && (
                <div>
                  <h3 className="font-semibold mb-3">Settings</h3>
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
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'} p-2 lg:p-3`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4">
              {/* Symbol Selection */}
              <Select
                value={selectedSymbol ? { value: selectedSymbol, label: selectedSymbol } : null}
                onChange={(option) => setSelectedSymbol(option?.value || '')}
                options={symbols.map(s => ({ value: s, label: s }))}
                placeholder={t('tradingView.selectSymbol', 'Select Symbol')}
                className="w-full sm:w-48"
                styles={{
                  control: (provided, state) => ({
                    ...provided,
                    backgroundColor: theme === 'dark' ? '#1F2937' : 'white',
                    borderColor: theme === 'dark' ? '#4B5563' : '#D1D5DB',
                    color: theme === 'dark' ? 'white' : 'black',
                    minHeight: '2.5rem',
                    fontSize: '0.875rem'
                  }),
                  menu: (provided) => ({
                    ...provided,
                    backgroundColor: theme === 'dark' ? '#1F2937' : 'white',
                    border: `1px solid ${theme === 'dark' ? '#4B5563' : '#D1D5DB'}`
                  }),
                  option: (provided, state) => ({
                    ...provided,
                    backgroundColor: state.isSelected
                      ? (theme === 'dark' ? '#3B82F6' : '#2563EB')
                      : (theme === 'dark' ? '#1F2937' : 'white'),
                    color: theme === 'dark' ? 'white' : 'black',
                    '&:hover': {
                      backgroundColor: theme === 'dark' ? '#374151' : '#F3F4F6'
                    }
                  }),
                  singleValue: (provided) => ({
                    ...provided,
                    color: theme === 'dark' ? 'white' : 'black'
                  })
                }}
              />

              {/* Timeframe Selection */}
              <Select
                value={timeframes.find(tf => tf.value === timeRange)}
                onChange={(option) => setTimeRange(option?.value || '1D')}
                options={timeframes}
                className="w-24"
              />

              {/* Chart Type */}
              <Select
                value={{
                  value: userSettings.layout.chartType,
                  label: userSettings.layout.chartType === 'candlestick' ? 'Candlestick' : 'Line'
                }}
                onChange={(option) => setUserSettings(prev => ({
                  ...prev,
                  layout: { ...prev.layout, chartType: option?.value || 'candlestick' }
                }))}
                options={[
                  { value: 'candlestick', label: 'Candlestick' },
                  { value: 'line', label: 'Line' }
                ]}
                className="w-32"
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
                  >
                    {tool.icon}
                  </button>
                ))}
              </div>

              {/* Indicators Toggle */}
              <div className="flex space-x-1">
                {Object.entries(userSettings.indicators).map(([key, config]) => (
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
                <div className="h-3/5 sm:h-2/3 mb-2 sm:mb-4">
                  <canvas
                    ref={mainChartRef}
                    className="w-full h-full border rounded"
                    style={{
                      maxHeight: window.innerWidth < 640 ? '250px' : '400px',
                      backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF'
                    }}
                  />
                </div>

                {/* Indicator Panel */}
                <div className="h-2/5 sm:h-1/3">
                  <canvas
                    ref={indicatorChartRef}
                    className="w-full h-full border rounded"
                    style={{
                      maxHeight: window.innerWidth < 640 ? '150px' : '200px',
                      backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
};

export default TradingViewChart;