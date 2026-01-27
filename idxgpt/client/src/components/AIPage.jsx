import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../hooks/useAuth.jsx';
import useQuota from '../hooks/useQuota';
import FundamentalTable from './FundamentalTable';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import { Loader2, AlertCircle, TrendingUp, DollarSign, BarChart3, RefreshCw, X } from 'lucide-react';

// Reusable Alert Component
const Alert = ({ type, message, onClose }) => {
  const { t } = useTranslation();

  if (!message) return null;

  const alertStyles = {
    error: 'bg-red-100 border-red-400 text-red-700',
    success: 'bg-green-100 border-green-400 text-green-700'
  };

  return (
    <div className={`mt-4 p-4 border rounded-md ${alertStyles[type]} flex justify-between items-center`}>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-4 text-gray-400 hover:text-gray-600"
        aria-label={t('common.close', 'Close')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

// Skeleton Loading Components
const SkeletonLoader = ({ className }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

// CORS Error Banner Component
const CORSErrorBanner = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">
              ⚠️ CORS/Network Error Detected
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              Tidak bisa terhubung ke server AI (ngrok). Menggunakan data simulasi dan quota fallback.
            </p>
            <p className="text-xs text-yellow-600 mt-2">
              Pastikan server ngrok berjalan di https://14a16c21071b.ngrok-free.app
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-yellow-600 hover:text-yellow-800 transition-colors"
          aria-label="Close banner"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

const QuotaCardSkeleton = () => (
  <div className="mt-4 flex items-center space-x-4 bg-white p-4 rounded-lg shadow-sm">
    <div className="flex items-center space-x-2">
      <SkeletonLoader className="h-5 w-5" />
      <SkeletonLoader className="h-4 w-16" />
      <SkeletonLoader className="h-6 w-8" />
      <SkeletonLoader className="h-4 w-20" />
    </div>
    <div className="text-sm">
      <SkeletonLoader className="h-4 w-12" />
    </div>
  </div>
);

const FormSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <SkeletonLoader className="h-6 w-40 mb-4" />
    <div className="space-y-4">
      <div>
        <SkeletonLoader className="h-4 w-24 mb-2" />
        <SkeletonLoader className="h-10 w-full" />
      </div>
      <div>
        <SkeletonLoader className="h-4 w-16 mb-2" />
        <SkeletonLoader className="h-10 w-full" />
      </div>
      <div>
        <SkeletonLoader className="h-4 w-28 mb-2" />
        <SkeletonLoader className="h-16 w-full" />
      </div>
      <SkeletonLoader className="h-12 w-full" />
    </div>
  </div>
);

const ChartSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <div className="flex items-center justify-between mb-4">
      <SkeletonLoader className="h-6 w-32" />
      <div className="flex items-center space-x-2">
        <SkeletonLoader className="h-4 w-4" />
        <SkeletonLoader className="h-4 w-16" />
      </div>
    </div>
    <SkeletonLoader className="h-96 w-full" />
  </div>
);

const ResultsSkeleton = () => (
  <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
    <SkeletonLoader className="h-8 w-48 mb-6" />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i}>
          <SkeletonLoader className="h-5 w-32 mb-3" />
          <SkeletonLoader className="h-32 w-full" />
        </div>
      ))}
    </div>
  </div>
);

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  CandlestickController,
  CandlestickElement
);

const AIPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const chartRef = useRef(null);
  const { quota, loading: quotaLoading, error: quotaError, corsError } = useQuota();

  // State management
  const [symbol, setSymbol] = useState('BBCA'); // Default symbol for chart
  const [market, setMarket] = useState('idx');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [corsBannerVisible, setCorsBannerVisible] = useState(false);


  // Fetch stock data for chart with proper error handling and cleanup
  const fetchStockData = useCallback(async () => {
    if (!symbol.trim()) {
      setStockData(null);
      return;
    }

    // Validate symbol format before fetching
    if (!/^[A-Z]{4,5}$/.test(symbol.trim())) {
      setStockData(null);
      return;
    }

    setChartLoading(true);
    try {
      console.log('Fetching stock data for:', symbol, market);
      const response = await api.get(`/stocks/price/${symbol}?market=${market}&days=60`);

      // Validate response structure
      if (!response.data || !Array.isArray(response.data.history)) {
        throw new Error(t('aiPage.errors.invalidResponse', 'Invalid response from server'));
      }

      console.log('Stock data response:', response.data);
      setStockData(response.data);
    } catch (err) {
      console.error('Failed to fetch stock data:', err);

      // Handle 401 Unauthorized - redirect to login
      if (err.response?.status === 401) {
        navigate('/login');
        return;
      }

      // Handle CORS/Network errors
      if (err.isCORSError || err.message?.includes('CORS') || err.message?.includes('Network Error')) {
        console.warn('[AIPage] CORS/Network Error in stock data fetch, using fallback data');
        setCorsBannerVisible(true);

        // Set fallback/mock stock data
        const fallbackData = {
          symbol: symbol.toUpperCase(),
          market: market.toUpperCase(),
          current: {
            price: 5000 + Math.random() * 5000,
            date: new Date().toISOString().split('T')[0],
            volume: Math.floor(1000000 + Math.random() * 10000000),
            high: 5500 + Math.random() * 2000,
            low: 4500 + Math.random() * 1000,
            open: 5100 + Math.random() * 1000
          },
          history: generateFallbackStockHistory(symbol, 60)
        };
        setStockData(fallbackData);
      } else if (err.code === 'NETWORK_ERROR' || !err.response) {
        setError(t('aiPage.errors.networkError', 'Network error occurred'));
        setStockData(null);
      } else {
        setError(err.response?.data?.error || t('aiPage.errors.fetchStockData', 'Failed to fetch stock data'));
        setStockData(null);
      }
    } finally {
      setChartLoading(false);
    }
  }, [symbol, market, navigate, t]);

  useEffect(() => {
    const debounceTimer = setTimeout(fetchStockData, 500);
    return () => clearTimeout(debounceTimer);
  }, [fetchStockData]);

  // Fix initial loading state - set to false when quota and chart loading complete
  useEffect(() => {
    if (!quotaLoading && !chartLoading) {
      setInitialLoading(false);
    }
  }, [quotaLoading, chartLoading]);

  // Handle quota errors - set initial loading to false
  useEffect(() => {
    if (quotaError) {
      console.error('[AIPage] Quota fetch failed:', quotaError);
      setInitialLoading(false);
      setError(t('aiPage.errors.fetchQuota', 'Failed to fetch AI quota'));
    }
  }, [quotaError, t]);

  // Show CORS banner when CORS error is detected
  useEffect(() => {
    if (corsError) {
      console.warn('[AIPage] CORS Error detected, showing fallback banner');
      setCorsBannerVisible(true);
    }
  }, [corsError]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      console.log('[AIPage] Component unmounting, cleaning up...');
      setError(null);
      setSuccess(null);
      setStockData(null);
      setResult(null);
    };
  }, []);

  // Handle AI analysis with proper error handling and validation
  const handleAnalyze = useCallback(async () => {
    // Clear previous messages
    setError(null);
    setSuccess(null);

    // Validate input fields
    if (!symbol.trim() || !question.trim()) {
      setError(t('aiPage.validation.fillAllFields', 'Please fill in all fields'));
      return;
    }

    // Validate stock symbol format (4-5 uppercase letters)
    if (!/^[A-Z]{4,5}$/.test(symbol.trim())) {
      setError(t('aiPage.validation.invalidSymbol', 'Stock symbol must be 4-5 uppercase letters (e.g., BBCA, TLKM)'));
      return;
    }

    // Check quota
    if (typeof quota?.current_quota === 'number' && quota.current_quota <= 0) {
      setError(t('aiPage.validation.quotaExceeded', 'AI quota exceeded. Please upgrade your plan or wait for quota reset.'));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      console.log('Starting AI analysis for:', { symbol: symbol.trim(), market, question: question.trim() });

      const response = await api.post('/stocks/ai/analyze', {
        symbol: symbol.trim(),
        market,
        question: question.trim()
      });

      console.log('AI analysis response:', response.data);

      // Validate response structure
      if (!response.data) {
        throw new Error(t('aiPage.errors.invalidResponse', 'Invalid response from server'));
      }

      if (response.data.error) {
        setError(response.data.error);
        return;
      }

      setResult(response.data);
      setSuccess(t('aiPage.success.analysisCompleted', 'Analysis completed successfully'));

      console.log('[AIPage] API result:', response.data);
      console.log('[AIPage] Error state:', null);

      // Quota is automatically refreshed by the useQuota hook
    } catch (err) {
      console.error('[AIPage] AI analysis error:', err);

      // Handle 401 Unauthorized - redirect to login
      if (err.response?.status === 401) {
        navigate('/login');
        return;
      }

      // Handle CORS/Network errors
      if (err.isCORSError || err.message?.includes('CORS') || err.message?.includes('Network Error')) {
        console.warn('[AIPage] CORS/Network Error in AI analysis, showing fallback banner');
        setCorsBannerVisible(true);
        setError('⚠️ Tidak bisa terhubung ke server AI (ngrok). Menggunakan data simulasi.');

        // Set mock/fallback result
        setResult({
          analysis: {
            technical: 'Analisis teknikal tidak tersedia karena CORS error. Menggunakan data simulasi.',
            fundamental: [],
            investment_thesis: 'Analisis investasi tidak tersedia karena CORS error. Menggunakan data simulasi.',
            sentiment: 'Netral (Simulasi)',
            recommendation: 'HOLD (Simulasi)',
            risk_level: 'medium'
          },
          data_summary: {
            technical_points: 0,
            fundamental_points: 0,
            news_articles: 0,
            overall_sentiment: 'N/A'
          }
        });
      } else if (err.code === 'NETWORK_ERROR' || !err.response) {
        setError(t('aiPage.errors.networkError', 'Network error occurred'));
      } else if (err.response?.status >= 500) {
        setError(t('aiPage.errors.networkError', 'Server error occurred'));
      } else {
        setError(err.response?.data?.error || t('aiPage.errors.analysisFailed', 'Failed to fetch analysis'));
      }

      console.log('[AIPage] API result:', null);
      console.log('[AIPage] Error state:', err.response?.data?.error || t('aiPage.errors.analysisFailed', 'Failed to fetch analysis'));
    } finally {
      setLoading(false);
    }
  }, [symbol, question, quota, navigate, t]);

  // Chart data configuration with validation
  const chartData = stockData && stockData.history && Array.isArray(stockData.history) ? {
    datasets: [{
      label: `${symbol} Price`,
      data: stockData.history.map(item => ({
        x: new Date(item.date).getTime(),
        o: item.open,
        h: item.high,
        l: item.low,
        c: item.close,
        v: item.volume
      })),
      color: {
        up: '#10B981',
        down: '#EF4444',
        unchanged: '#6B7280',
      },
    }]
  } : null;

  // Chart options with responsive design and proper formatting
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: t('aiPage.chart.60DayChart', '60 Day Price Chart') + ` - ${symbol}`,
      },
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const point = context.raw;
            return [
              `${t('aiPage.chart.open', 'Open')}: ${point.o}`,
              `${t('aiPage.chart.high', 'High')}: ${point.h}`,
              `${t('aiPage.chart.low', 'Low')}: ${point.l}`,
              `${t('aiPage.chart.close', 'Close')}: ${point.c}`,
              `${t('aiPage.chart.volume', 'Volume')}: ${point.v?.toLocaleString()}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          displayFormats: {
            day: 'MMM dd',
            week: 'MMM dd',
            month: 'MMM yyyy'
          }
        },
        grid: {
          display: false
        }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: {
          display: false
        }
      }
    }
  };

  // Show initial loading skeleton
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <SkeletonLoader className="h-8 w-64 mb-2" />
            <SkeletonLoader className="h-5 w-96" />
            <QuotaCardSkeleton />
          </div>

          {/* Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <FormSkeleton />
            <ChartSkeleton />
          </div>

          <ResultsSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* CORS Error Banner */}
        {corsBannerVisible && (
          <CORSErrorBanner onClose={() => setCorsBannerVisible(false)} />
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('aiPage.title', 'AI Stock Analysis')}
          </h1>
          <p className="text-gray-600">
            {t('aiPage.subtitle', 'Get intelligent insights and predictions for your stocks')}
          </p>

          {/* Quota Alert */}
          {quota?.current_quota === 0 && (
            <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
              {t('ai.noQuota', 'Your AI quota has been used up.')}
            </div>
          )}

          {/* Quota Display */}
          {user && quota && (
            <div className="mt-4 flex items-center space-x-4 bg-white p-4 rounded-lg shadow-sm">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">
                  {t('aiPage.quota', 'AI Quota')}:
                </span>
                <span className="text-lg font-bold text-blue-600">
                  {typeof quota.current_quota === 'number' && !isNaN(quota.current_quota) ? quota.current_quota : t('common.loading', 'Loading...')}
                </span>
                <span className="text-sm text-gray-500">
                  {t('aiPage.remaining', 'remaining')}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {t('aiPage.plan', 'Plan')}: <span className="font-medium">{quota.role || 'user'}</span>
              </div>
              {typeof quota.current_quota === 'number' && !isNaN(quota.current_quota) && quota.current_quota <= 2 && (
                <div className="flex items-center space-x-1 text-orange-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {t('aiPage.lowQuotaWarning', 'Low quota warning')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Form */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">
              {t('aiPage.analysisParameters', 'Analysis Parameters')}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('aiPage.stockSymbol', 'Stock Symbol')}
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder={t('aiPage.placeholders.stockSymbol', 'e.g., BBCA, TLKM, ASII')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('aiPage.market', 'Market')}
                </label>
                <select
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value="idx">{t('aiPage.markets.idx', 'Indonesia (IDX)')}</option>
                  <option value="us">{t('aiPage.markets.us', 'United States (US)')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('aiPage.yourQuestion', 'Your Question')}
                </label>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('aiPage.placeholders.question', 'e.g., Predict tomorrow\'s price movement, What are the key support and resistance levels?, Should I buy or sell this stock?')}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={loading}
                />
              </div>

              <button
                onClick={handleAnalyze}
                disabled={
                  loading ||
                  !symbol.trim() ||
                  !question.trim() ||
                  quotaLoading ||
                  (typeof quota?.current_quota === 'number' && quota.current_quota <= 0)
                }
                className={`w-full py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors flex items-center justify-center space-x-2 ${
                  loading || !symbol.trim() || !question.trim() || quotaLoading || (typeof quota?.current_quota === 'number' && quota.current_quota <= 0)
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{t('aiPage.analyzing', 'Analyzing...')}</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-5 w-5" />
                    <span>{t('aiPage.analyzeStock', 'Analyze Stock')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Chart Display */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {t('aiPage.priceChart', 'Price Chart')}
              </h2>
              {chartLoading && (
                <div className="flex items-center space-x-2 text-gray-500">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t('aiPage.loading', 'Loading...')}</span>
                </div>
              )}
            </div>

            <div className="h-96">
              {stockData && chartData ? (
                <Chart ref={chartRef} type="candlestick" data={chartData} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>{t('aiPage.enterStockSymbol', 'Enter a stock symbol to view chart')}</p>
                    {chartLoading && (
                      <div className="flex items-center justify-center mt-2">
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm">{t('aiPage.loadingStates.loadingChart', 'Loading chart data...')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert Messages */}
        <Alert
          type="error"
          message={error}
          onClose={() => setError(null)}
        />

        <Alert
          type="success"
          message={success}
          onClose={() => setSuccess(null)}
        />

        {/* Fallback UI for empty results */}
        {(!result || Object.keys(result).length === 0) && !loading && (
          <div className="mt-8 text-center text-gray-500">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>{t('ai.noData', 'No analysis available')}</p>
              <p className="text-sm text-gray-400 mt-1">
                {t('aiPage.loadingStates.processing', 'Click "Analyze Stock" to generate analysis')}
              </p>
            </div>
          </div>
        )}

        {/* Analysis Results */}
        {result && (
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-semibold mb-6">
              {t('aiPage.analysisResults', 'Analysis Results')}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Technical Analysis */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
                  {t('aiPage.technicalAnalysis', 'Technical Analysis')}
                </h3>
                <div className="prose prose-sm max-w-none">
                  {typeof result.analysis?.technical === 'string' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.analysis.technical}
                    </ReactMarkdown>
                  ) : (
                    <div className="text-gray-600">
                      <p>{t('aiPage.noTechnicalAnalysis', 'No technical analysis available')}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Type: {typeof result.analysis?.technical}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Fundamental Analysis */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                  {t('aiPage.fundamentalAnalysis', 'Fundamental Analysis')}
                </h3>
                <FundamentalTable
                  data={result.analysis?.fundamental || []}
                  trends={result.analysis?.fundamental?.[0]?.trends}
                />
              </div>

              {/* News Analysis */}
              {result.analysis?.news && result.analysis.news.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
                    {t('aiPage.newsAnalysis', 'News Analysis')} ({result.analysis.news.length} articles)
                  </h3>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {result.analysis.news.slice(0, 3).map((news, index) => (
                      <div key={index} className="bg-gray-50 p-3 rounded-md">
                        <h4 className="text-sm font-medium text-gray-900 mb-1">{news.title}</h4>
                        <p className="text-xs text-gray-600 mb-2">{news.description?.substring(0, 100)}...</p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{news.source}</span>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            news.sentiment_score > 0.1 ? 'bg-green-100 text-green-800' :
                            news.sentiment_score < -0.1 ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {news.sentiment_score > 0.1 ? t('aiPage.sentiment.positive', 'Positive') :
                             news.sentiment_score < -0.1 ? t('aiPage.sentiment.negative', 'Negative') : t('aiPage.sentiment.neutral', 'Neutral')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Analysis */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-indigo-600" />
                  {t('aiPage.aiAnalysis', 'AI Analysis')}
                </h3>
                <div className="prose prose-sm max-w-none">
                  {typeof result.analysis?.investment_thesis === 'string' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result.analysis.investment_thesis}
                    </ReactMarkdown>
                  ) : (
                    <div className="text-gray-600">
                      <p>{t('aiPage.noAdditionalAnalysis', 'No additional analysis available')}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Type: {typeof result.analysis?.investment_thesis}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sentiment */}
              <div>
                <h3 className="text-lg font-medium mb-3">
                  {t('aiPage.marketSentiment', 'Market Sentiment')}
                </h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-700">{result.analysis?.sentiment || t('aiPage.noSentimentAnalysis', 'No sentiment analysis available')}</p>
                </div>
              </div>

              {/* Recommendation */}
              <div>
                <h3 className="text-lg font-medium mb-3">
                  {t('aiPage.recommendation', 'Recommendation')}
                </h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  <p className="text-gray-700">{result.analysis?.recommendation || t('aiPage.noRecommendation', 'No recommendation available')}</p>
                </div>
              </div>

              {/* Risk Level */}
              {result.analysis?.risk_level && (
                <div>
                  <h3 className="text-lg font-medium mb-3">
                    {t('aiPage.riskAssessment', 'Risk Assessment')}
                  </h3>
                  <div className={`p-4 rounded-md border-l-4 ${
                    result.analysis.risk_level === 'low' ? 'bg-green-50 border-green-400' :
                    result.analysis.risk_level === 'medium' ? 'bg-yellow-50 border-yellow-400' :
                    'bg-red-50 border-red-400'
                  }`}>
                    <div className="flex items-center">
                      <span className={`text-sm font-medium ${
                        result.analysis.risk_level === 'low' ? 'text-green-800' :
                        result.analysis.risk_level === 'medium' ? 'text-yellow-800' :
                        'text-red-800'
                      }`}>
                        {t('aiPage.riskLevel', 'Risk Level')}: {t(`aiPage.riskLevels.${result.analysis.risk_level}`, result.analysis.risk_level.toUpperCase())}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Key Factors */}
              {result.analysis?.key_factors && result.analysis.key_factors.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3">
                    {t('aiPage.keyFactors', 'Key Factors')}
                  </h3>
                  <div className="bg-blue-50 p-4 rounded-md">
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {result.analysis.key_factors.map((factor, index) => (
                        <li key={index}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Investment Thesis */}
              {result.analysis?.investment_thesis && (
                <div>
                  <h3 className="text-lg font-medium mb-3">
                    {t('aiPage.investmentThesis', 'Investment Thesis')}
                  </h3>
                  <div className="bg-indigo-50 p-4 rounded-md border-l-4 border-indigo-400">
                    <p className="text-gray-700">{result.analysis.investment_thesis}</p>
                  </div>
                </div>
              )}

              {/* Price Prediction */}
              {result.analysis?.price_prediction && (
                <div className="lg:col-span-2">
                  <h3 className="text-lg font-medium mb-3">
                    {t('aiPage.pricePrediction', 'Price Prediction')}
                  </h3>
                  <div className="bg-blue-50 p-4 rounded-md border-l-4 border-blue-400">
                    <p className="text-gray-700">{result.analysis.price_prediction}</p>
                  </div>
                </div>
              )}

              {/* Data Summary */}
              {result.data_summary && (
                <div className="lg:col-span-2">
                  <h3 className="text-lg font-medium mb-3">
                    {t('aiPage.analysisSummary', 'Analysis Summary')}
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">{t('aiPage.technicalPoints', 'Technical Points')}:</span>
                        <span className="ml-2 font-medium">{result.data_summary.technical_points || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">{t('aiPage.fundamentalPoints', 'Fundamental Points')}:</span>
                        <span className="ml-2 font-medium">{result.data_summary.fundamental_points || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">{t('aiPage.newsArticles', 'News Articles')}:</span>
                        <span className="ml-2 font-medium">{result.data_summary.news_articles || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">{t('aiPage.overallSentiment', 'Overall Sentiment')}:</span>
                        <span className="ml-2 font-medium">{result.data_summary.overall_sentiment || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Generate fallback stock history for CORS errors
function generateFallbackStockHistory(symbol, days) {
  const basePrice = 5000 + Math.random() * 5000; // Random base price 5000-10000
  const history = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - 1 - i));

    const priceVariation = (Math.random() - 0.5) * 0.03; // ±1.5% daily variation
    const dayPrice = basePrice * (1 + priceVariation * i / days);
    const volume = Math.floor(1000000 + Math.random() * 10000000); // 1M-11M volume

    history.push({
      date: date.toISOString().split('T')[0],
      open: Math.round(dayPrice * 0.98 * 100) / 100,
      high: Math.round(dayPrice * 1.03 * 100) / 100,
      low: Math.round(dayPrice * 0.97 * 100) / 100,
      close: Math.round(dayPrice * 100) / 100,
      volume: volume
    });
  }

  console.log(`📊 Generated ${history.length} fallback data points for ${symbol} (CORS error)`);
  return history;
}

export default AIPage;