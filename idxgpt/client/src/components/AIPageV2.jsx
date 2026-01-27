import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import useQuota from '../hooks/useQuota';
import api from '../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  TimeScale,
  RadialLinearScale,
  ArcElement
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  X,
  Plus,
  Minus,
  Target,
  Activity,
  Brain,
  Zap,
  Eye,
  Bell,
  Settings,
  Send,
  Filter,
  Download,
  Upload,
  Calendar,
  Clock,
  DollarSign,
  Percent,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Star,
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb,
  Search,
  Grid,
  List,
  PieChart,
  Radar,
  Thermometer,
  Flame,
  Snowflake
} from 'lucide-react';

// Register Chart.js components
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
  RadialLinearScale,
  ArcElement,
  CandlestickController,
  CandlestickElement
);

// Reusable Alert Component
const Alert = ({ type, message, onClose }) => {
  const { t } = useTranslation();

  if (!message) return null;

  const alertStyles = {
    error: 'bg-red-100 border-red-400 text-red-700',
    success: 'bg-green-100 border-green-400 text-green-700',
    warning: 'bg-yellow-100 border-yellow-400 text-yellow-700',
    info: 'bg-blue-100 border-blue-400 text-blue-700'
  };

  const icons = {
    error: <AlertCircle className="h-4 w-4" />,
    success: <CheckCircle className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    info: <Info className="h-4 w-4" />
  };

  return (
    <div className={`mt-4 p-4 border rounded-md ${alertStyles[type]} flex justify-between items-start`}>
      <div className="flex items-start space-x-2">
        {icons[type]}
        <span className="text-sm">{message}</span>
      </div>
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

const CardSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <SkeletonLoader className="h-6 w-32 mb-4" />
    <SkeletonLoader className="h-4 w-full mb-2" />
    <SkeletonLoader className="h-4 w-3/4 mb-2" />
    <SkeletonLoader className="h-4 w-1/2" />
  </div>
);

const ChartSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm p-6">
    <SkeletonLoader className="h-6 w-40 mb-4" />
    <SkeletonLoader className="h-64 w-full" />
  </div>
);

const TableSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm">
    <div className="p-6 border-b border-gray-200">
      <SkeletonLoader className="h-6 w-32" />
    </div>
    <div className="p-6">
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex space-x-4">
            <SkeletonLoader className="h-4 w-16" />
            <SkeletonLoader className="h-4 w-20" />
            <SkeletonLoader className="h-4 w-24" />
            <SkeletonLoader className="h-4 w-24" />
            <SkeletonLoader className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Market Overview Component
const MarketOverview = ({ t, quota, quotaLoading }) => {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState('morning');

  const generateMarketSummary = useCallback(async (type) => {
    // Check quota before making API call
    if (quota?.current_quota <= 0) {
      console.log('[AIPageV2] Market Overview: Quota exhausted, cannot make API call');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/ai/openrouter', {
        prompt: `Generate a ${type === 'morning' ? 'morning brief' : 'closing summary'} for the Indonesian stock market (IDX). Include:
        1. Market overview and key indices performance
        2. Top 3 bullish sectors with reasons
        3. Top 3 bearish sectors with reasons
        4. Key economic indicators
        5. Market sentiment analysis
        6. Trading volume and value summary
        7. Outlook for next trading session

        Format as structured JSON with sections for easy parsing.`,
        max_tokens: 800,
        temperature: 0.3
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setMarketData({
        type,
        summary: response.data.result || response.data,
        timestamp: new Date().toISOString()
      });

      console.log('[AIPageV2] Market Overview API result:', response.data);
      console.log('[AIPageV2] Error state:', null);
    } catch (error) {
      console.error('Market summary error:', error);
    } finally {
      setLoading(false);
    }
  }, [quota]);

  useEffect(() => {
    generateMarketSummary(selectedType);
  }, [selectedType, generateMarketSummary]);

  const sectorData = [
    { name: 'Banking', change: 2.3, volume: 1250000000, sentiment: 'bullish' },
    { name: 'Technology', change: -1.2, volume: 850000000, sentiment: 'bearish' },
    { name: 'Consumer', change: 1.8, volume: 950000000, sentiment: 'bullish' },
    { name: 'Energy', change: -0.8, volume: 720000000, sentiment: 'bearish' },
    { name: 'Healthcare', change: 3.1, volume: 680000000, sentiment: 'bullish' },
    { name: 'Mining', change: -2.1, volume: 1100000000, sentiment: 'bearish' }
  ];

  return (
    <div className="space-y-6">
      {/* Market Summary Type Selector */}
      <div className="flex space-x-4">
        <button
          onClick={() => setSelectedType('morning')}
          disabled={quota?.current_quota <= 0}
          className={`px-4 py-2 rounded-md font-medium ${
            selectedType === 'morning'
              ? 'bg-blue-600 text-white'
              : quota?.current_quota <= 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {t('aiV2.morningBrief', 'Morning Brief')}
        </button>
        <button
          onClick={() => setSelectedType('closing')}
          disabled={quota?.current_quota <= 0}
          className={`px-4 py-2 rounded-md font-medium ${
            selectedType === 'closing'
              ? 'bg-blue-600 text-white'
              : quota?.current_quota <= 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {t('aiV2.closingSummary', 'Closing Summary')}
        </button>
      </div>

      {/* Market Summary */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (!marketData || Object.keys(marketData).length === 0) && !loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
            <p>{t('ai.noData', 'No analysis available')}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
            <p>{t('ai.noData', 'No analysis available')}</p>
          </div>
        </div>
      ) : marketData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">
              {t('aiV2.morningBrief', 'Morning Brief')}
            </h3>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {marketData.summary}
              </ReactMarkdown>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">
              {t('aiV2.marketIndicators', 'Market Indicators')}
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('aiV2.volume', 'Volume')}:</span>
                <span className="font-medium">Rp 15.2T</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('aiV2.value', 'Value')}:</span>
                <span className="font-medium">Rp 8.7T</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('aiV2.transactions', 'Transactions')}:</span>
                <span className="font-medium">1,247</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Sector Performance */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('aiV2.topBullishSectors', 'Top Bullish Sectors')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectorData.filter(s => s.sentiment === 'bullish').map((sector, index) => (
            <div key={index} className="bg-green-50 p-4 rounded-md border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-green-800">{sector.name}</span>
                <ArrowUp className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-sm text-green-700">
                <div>Change: +{sector.change}%</div>
                <div>Volume: Rp {sector.volume.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('aiV2.topBearishSectors', 'Top Bearish Sectors')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectorData.filter(s => s.sentiment === 'bearish').map((sector, index) => (
            <div key={index} className="bg-red-50 p-4 rounded-md border border-red-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-red-800">{sector.name}</span>
                <ArrowDown className="h-4 w-4 text-red-600" />
              </div>
              <div className="text-sm text-red-700">
                <div>Change: {sector.change}%</div>
                <div>Volume: Rp {sector.volume.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Multi-Stock Deep Dive Component
const MultiStockDeepDive = ({ t, quota, quotaLoading }) => {
  const [stocks, setStocks] = useState(['BBCA', 'BBRI', 'TLKM']);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  // Safe quota fallback
  const safeQuota = quota || { current_quota: 0, role: 'user' };

  const addStock = () => {
    setStocks([...stocks, '']);
  };

  const removeStock = (index) => {
    if (stocks.length > 1) {
      setStocks(stocks.filter((_, i) => i !== index));
    }
  };

  const updateStock = (index, value) => {
    const newStocks = [...stocks];
    newStocks[index] = value.toUpperCase();
    setStocks(newStocks);
  };

  const analyzeStocks = useCallback(async () => {
    if (stocks.length === 0 || stocks.some(s => !s.trim())) {
      return;
    }

    // Check quota before making API call
    if (safeQuota?.current_quota <= 0) {
      console.log('[AIPageV2] Multi-Stock Deep Dive: Quota exhausted, cannot make API call');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/ai/openrouter', {
        prompt: `Perform comparative analysis for these Indonesian stocks: ${stocks.join(', ')}.

        For each stock, provide:
        1. Current price and recent performance
        2. Fundamental analysis (PE, PBV, ROE, EPS)
        3. Technical analysis (trend, support/resistance)
        4. Market sentiment and news impact
        5. Investment recommendation with confidence level
        6. Risk assessment

        Format as structured JSON with comparison table data and individual stock analysis.`,
        max_tokens: 1200,
        temperature: 0.2
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setAnalysis({
        stocks: stocks.filter(s => s.trim()),
        comparison: response.data.result || response.data,
        timestamp: new Date().toISOString()
      });

      console.log('[AIPageV2] Multi-Stock Deep Dive API result:', response.data);
      console.log('[AIPageV2] Error state:', null);
    } catch (error) {
      console.error('Stock analysis error:', error);
    } finally {
      setLoading(false);
    }
  }, [stocks, safeQuota]);

  const radarData = {
    labels: ['Performance', 'Valuation', 'Growth', 'Risk', 'Liquidity'],
    datasets: stocks.slice(0, 3).map((stock, index) => ({
      label: stock,
      data: [65 + index * 10, 70 - index * 5, 60 + index * 8, 75 - index * 10, 80 - index * 5],
      backgroundColor: `rgba(${59 + index * 50}, ${130 + index * 20}, ${246 - index * 30}, 0.2)`,
      borderColor: `rgba(${59 + index * 50}, ${130 + index * 20}, ${246 - index * 30}, 1)`,
      borderWidth: 2,
    }))
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: t('aiV2.radarChart', 'Radar Chart')
      }
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        ticks: {
          stepSize: 20
        }
      }
    }
  };

  // Show loading state when quota is loading
  if (quotaLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stock Input */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('aiV2.comparativeAnalysis', 'Comparative Analysis')}
        </h3>

        <div className="space-y-4">
          {stocks.map((stock, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={stock}
                onChange={(e) => updateStock(index, e.target.value)}
                placeholder={t('aiV2.placeholders.multipleStocks', 'e.g., BBCA, BBRI, TLKM, ASII')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {stocks.length > 1 && (
                <button
                  onClick={() => removeStock(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                >
                  <Minus className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}

          <div className="flex items-center space-x-2">
            <button
              onClick={addStock}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              <Plus className="h-4 w-4" />
              <span>Add Stock</span>
            </button>

            <button
              onClick={analyzeStocks}
              disabled={loading || stocks.some(s => !s.trim()) || safeQuota?.current_quota <= 0}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md ${
                safeQuota?.current_quota <= 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400'
              }`}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BarChart3 className="h-4 w-4" />
              )}
              <span>{t('aiV2.analyzeStock', 'Analyze')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Radar Chart */}
      {stocks.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">
            {t('aiV2.radarChart', 'Radar Chart')}
          </h3>
          <div className="h-96">
            <Chart type="radar" data={radarData} options={radarOptions} />
          </div>
        </div>
      )}

      {/* Comparison Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">
            {t('aiV2.comparisonTable', 'Comparison Table')}
          </h3>
        </div>
        {loading ? (
          <TableSkeleton />
        ) : (!analysis || Object.keys(analysis).length === 0) && !loading ? (
          <div className="p-6 text-center text-gray-500">
            <p>{t('ai.noData', 'No analysis available')}</p>
          </div>
        ) : analysis ? (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('aiV2.stock', 'Stock')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('aiV2.price', 'Price')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('aiV2.change', 'Change')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('aiV2.volume', 'Volume')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('aiV2.recommendation', 'Recommendation')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stocks.slice(0, 3).map((stock, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {stock}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        Rp {(1000 + index * 500).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          index % 2 === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {index % 2 === 0 ? '+' : ''}{(index + 1) * 2.5}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(index + 1) * 1000000} lots
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          index === 0 ? 'bg-green-100 text-green-800' :
                          index === 1 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {index === 0 ? t('aiV2.buy', 'Buy') :
                           index === 1 ? t('aiV2.hold', 'Hold') :
                           t('aiV2.sell', 'Sell')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            {t('aiV2.noAnalysis', 'No analysis data available. Add stocks and click Analyze.')}
          </div>
        )}
      </div>
    </div>
  );
};

// Scenario Simulator Component
const ScenarioSimulator = ({ t, quota, quotaLoading }) => {
  const [question, setQuestion] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyzeScenario = useCallback(async () => {
    if (!question.trim()) {
      return;
    }

    // Check quota before making API call
    if (quota?.current_quota <= 0) {
      console.log('[AIPageV2] Scenario Simulator: Quota exhausted, cannot make API call');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/ai/openrouter', {
        prompt: `Analyze this market scenario: "${question}"

        Provide comprehensive analysis including:
        1. Macroeconomic impact assessment
        2. Sector-specific effects (banking, technology, consumer, energy, etc.)
        3. Individual stock recommendations (3-5 stocks)
        4. Risk factors and mitigation strategies
        5. Timeframe for expected impact
        6. Confidence level in analysis

        Format as structured JSON with clear sections.`,
        max_tokens: 1000,
        temperature: 0.3
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setAnalysis({
        question,
        result: response.data.result || response.data,
        timestamp: new Date().toISOString()
      });

      console.log('[AIPageV2] Scenario Simulator API result:', response.data);
      console.log('[AIPageV2] Error state:', null);
    } catch (error) {
      console.error('Scenario analysis error:', error);
    } finally {
      setLoading(false);
    }
  }, [question, quota]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('aiV2.scenarioSimulator', 'Scenario Simulator')}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('aiV2.whatIf', 'What If')}?
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t('aiV2.placeholders.whatIfQuestion', 'e.g., What if interest rates increase by 1%?')}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <button
            onClick={analyzeScenario}
            disabled={loading || !question.trim() || quota?.current_quota <= 0}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md ${
              quota?.current_quota <= 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400'
            }`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
            <span>{t('aiV2.analyzing', 'Analyzing...')}</span>
          </button>
        </div>
      </div>

      {/* Analysis Results */}
      {(!analysis || Object.keys(analysis).length === 0) && !loading ? (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
          <p>{t('ai.noData', 'No analysis available')}</p>
        </div>
      ) : analysis && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">
            {t('aiV2.analysis', 'Analysis Results')}
          </h3>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {analysis.result}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

// Strategy Generator Component
const StrategyGenerator = ({ t, quota, quotaLoading, navigate }) => {
  const [strategyType, setStrategyType] = useState('value');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateStrategy = useCallback(async () => {
    // Check quota before making API call
    if (quota?.current_quota <= 0) {
      console.log('[AIPageV2] Strategy Generator: Quota exhausted, cannot make API call');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/ai/openrouter', {
        prompt: `Generate a ${strategyType} investment strategy for Indonesian stock market.

        Include:
        1. Strategy overview and philosophy
        2. 5-7 stock recommendations with entry/exit points
        3. Risk management guidelines
        4. Performance expectations
        5. Market conditions when this strategy works best
        6. Monitoring and adjustment criteria

        Format as structured JSON with actionable recommendations.`,
        max_tokens: 900,
        temperature: 0.2
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setAnalysis({
        strategyType,
        result: response.data.result || response.data,
        timestamp: new Date().toISOString()
      });

      console.log('[AIPageV2] Strategy Generator API result:', response.data);
      console.log('[AIPageV2] Error state:', null);
    } catch (error) {
      console.error('Strategy generation error:', error);
    } finally {
      setLoading(false);
    }
  }, [strategyType, quota]);

  const sendToVirtualTrading = () => {
    // Navigate to virtual trading page
    navigate('/virtual-trading');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('aiV2.strategyGenerator', 'AI Strategy Generator')}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('aiV2.strategyType', 'Strategy Type')}
            </label>
            <select
              value={strategyType}
              onChange={(e) => setStrategyType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="value">{t('aiV2.value', 'Value')}</option>
              <option value="growth">{t('aiV2.growth', 'Growth')}</option>
              <option value="swing">{t('aiV2.swing', 'Swing')}</option>
              <option value="intraday">{t('aiV2.intraday', 'Intraday')}</option>
            </select>
          </div>

          <button
            onClick={generateStrategy}
            disabled={loading || quota?.current_quota <= 0}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md ${
              quota?.current_quota <= 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400'
            }`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Target className="h-4 w-4" />
            )}
            <span>{t('aiV2.generate', 'Generate')}</span>
          </button>
        </div>
      </div>

      {/* Strategy Results */}
      {(!analysis || Object.keys(analysis).length === 0) && !loading ? (
        <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
          <p>{t('ai.noData', 'No analysis available')}</p>
        </div>
      ) : analysis && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {t('aiV2.stockPicks', 'Stock Picks')} - {strategyType.toUpperCase()}
            </h3>
            <button
              onClick={sendToVirtualTrading}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Send className="h-4 w-4" />
              <span>{t('aiV2.sendToVirtualTrading', 'Send to Virtual Trading')}</span>
            </button>
          </div>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {analysis.result}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

// Sentiment Dashboard Component
const SentimentDashboard = ({ t, quota, quotaLoading }) => {
  const [sentimentData, setSentimentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedSector, setSelectedSector] = useState('all');

  const fetchSentimentData = useCallback(async () => {
    // Check quota before making API call
    if (quota?.current_quota <= 0) {
      console.log('[AIPageV2] Sentiment Dashboard: Quota exhausted, cannot make API call');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/ai/openrouter', {
        prompt: `Generate mock sentiment analysis data for Indonesian stock market sectors.

        Include:
        1. Sector sentiment scores (banking, technology, consumer, energy, healthcare, mining)
        2. Individual stock sentiment (BBCA, BBRI, TLKM, ASII, BMRI, BBNI)
        3. News sentiment trends
        4. Social media sentiment
        5. Overall market sentiment

        Format as structured JSON with numerical scores and trends.`,
        max_tokens: 600,
        temperature: 0.4
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setSentimentData({
        sectors: [
          { name: 'Banking', score: 0.7, trend: 'positive', stocks: ['BBCA', 'BBRI', 'BMRI'] },
          { name: 'Technology', score: -0.3, trend: 'negative', stocks: ['TLKM', 'EXCL', 'ISAT'] },
          { name: 'Consumer', score: 0.5, trend: 'positive', stocks: ['UNVR', 'ICBP', 'GGRM'] },
          { name: 'Energy', score: -0.1, trend: 'neutral', stocks: ['ADRO', 'PTBA', 'ITMG'] },
          { name: 'Healthcare', score: 0.8, trend: 'positive', stocks: ['KLBF', 'KAEF', 'SILO'] },
          { name: 'Mining', score: -0.6, trend: 'negative', stocks: ['ANTM', 'INCO', 'TINS'] }
        ],
        marketSentiment: 0.4,
        newsSentiment: 0.2,
        socialSentiment: 0.6,
        timestamp: new Date().toISOString()
      });

      console.log('[AIPageV2] Sentiment Dashboard API result:', response.data);
      console.log('[AIPageV2] Error state:', null);
    } catch (error) {
      console.error('Sentiment data error:', error);
    } finally {
      setLoading(false);
    }
  }, [quota]);

  useEffect(() => {
    fetchSentimentData();
  }, [fetchSentimentData]);

  const getSentimentColor = (score) => {
    if (score > 0.3) return 'bg-green-500';
    if (score < -0.3) return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getSentimentTextColor = (score) => {
    if (score > 0.3) return 'text-green-700';
    if (score < -0.3) return 'text-red-700';
    return 'text-yellow-700';
  };

  return (
    <div className="space-y-6">
      {/* Sentiment Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{t('aiV2.market', 'Market')}</h3>
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          {sentimentData && (
            <div className="text-center">
              <div className={`text-3xl font-bold ${getSentimentTextColor(sentimentData.marketSentiment)}`}>
                {sentimentData.marketSentiment > 0 ? '+' : ''}{(sentimentData.marketSentiment * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">
                {sentimentData.marketSentiment > 0.3 ? t('aiV2.positive', 'Positive') :
                 sentimentData.marketSentiment < -0.3 ? t('aiV2.negative', 'Negative') : t('aiV2.neutral', 'Neutral')}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{t('aiV2.news', 'News')}</h3>
            <BarChart3 className="h-5 w-5 text-green-600" />
          </div>
          {sentimentData && (
            <div className="text-center">
              <div className={`text-3xl font-bold ${getSentimentTextColor(sentimentData.newsSentiment)}`}>
                {sentimentData.newsSentiment > 0 ? '+' : ''}{(sentimentData.newsSentiment * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">
                {sentimentData.newsSentiment > 0.3 ? t('aiV2.positive', 'Positive') :
                 sentimentData.newsSentiment < -0.3 ? t('aiV2.negative', 'Negative') : t('aiV2.neutral', 'Neutral')}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{t('aiV2.social', 'Social')}</h3>
            <Activity className="h-5 w-5 text-purple-600" />
          </div>
          {sentimentData && (
            <div className="text-center">
              <div className={`text-3xl font-bold ${getSentimentTextColor(sentimentData.socialSentiment)}`}>
                {sentimentData.socialSentiment > 0 ? '+' : ''}{(sentimentData.socialSentiment * 100).toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">
                {sentimentData.socialSentiment > 0.3 ? t('aiV2.positive', 'Positive') :
                 sentimentData.socialSentiment < -0.3 ? t('aiV2.negative', 'Negative') : t('aiV2.neutral', 'Neutral')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sector Heatmap */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {t('aiV2.sectorHeatmap', 'Sector Heatmap')}
          </h3>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('aiV2.all', 'All Sectors')}</option>
            <option value="banking">Banking</option>
            <option value="technology">Technology</option>
            <option value="consumer">Consumer</option>
            <option value="energy">Energy</option>
            <option value="healthcare">Healthcare</option>
            <option value="mining">Mining</option>
          </select>
        </div>

        {(!sentimentData || Object.keys(sentimentData).length === 0) && !loading ? (
          <div className="text-center text-gray-500">
            <p>{t('ai.noData', 'No analysis available')}</p>
          </div>
        ) : sentimentData && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {sentimentData.sectors.map((sector, index) => (
              <div key={index} className="text-center">
                <div className={`w-16 h-16 mx-auto rounded-full ${getSentimentColor(sector.score)} flex items-center justify-center mb-2`}>
                  <span className="text-white font-bold text-sm">
                    {(sector.score * 100).toFixed(0)}
                  </span>
                </div>
                <div className="text-sm font-medium">{sector.name}</div>
                <div className={`text-xs ${getSentimentTextColor(sector.score)}`}>
                  {sector.score > 0.3 ? t('aiV2.positive', 'Positive') :
                   sector.score < -0.3 ? t('aiV2.negative', 'Negative') : t('aiV2.neutral', 'Neutral')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Pattern Finder Component
const PatternFinder = ({ t, quota, quotaLoading }) => {
  const [selectedStock, setSelectedStock] = useState('BBCA');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyzePatterns = useCallback(async () => {
    if (!selectedStock.trim()) {
      return;
    }

    // Check quota before making API call
    if (quota?.current_quota <= 0) {
      console.log('[AIPageV2] Pattern Finder: Quota exhausted, cannot make API call');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/ai/openrouter', {
        prompt: `Analyze chart patterns for ${selectedStock} stock.

        Look for:
        1. Head and Shoulders pattern
        2. Double Top/Bottom patterns
        3. Triangle patterns (ascending, descending, symmetrical)
        4. Wedge patterns
        5. Flag and Pennant patterns
        6. Cup and Handle pattern
        7. Support and resistance levels
        8. Trend analysis

        For each pattern found, provide:
        - Pattern name and description
        - Confidence level (high/medium/low)
        - Price target implications
        - Timeframe for pattern completion
        - Risk level

        Format as structured JSON with pattern analysis.`,
        max_tokens: 800,
        temperature: 0.2
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      setAnalysis({
        stock: selectedStock,
        patterns: response.data.result || response.data,
        timestamp: new Date().toISOString()
      });

      console.log('[AIPageV2] Pattern Finder API result:', response.data);
      console.log('[AIPageV2] Error state:', null);
    } catch (error) {
      console.error('Pattern analysis error:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedStock, quota]);

  const patterns = [
    { name: 'Head & Shoulders', confidence: 'high', description: 'Reversal pattern indicating trend change' },
    { name: 'Double Top', confidence: 'medium', description: 'Bearish reversal pattern' },
    { name: 'Triangle', confidence: 'high', description: 'Continuation pattern' },
    { name: 'Cup & Handle', confidence: 'low', description: 'Bullish continuation pattern' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('aiV2.patternFinder', 'AI Pattern Finder')}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('aiV2.stockSymbol', 'Stock Symbol')}
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={selectedStock}
                onChange={(e) => setSelectedStock(e.target.value.toUpperCase())}
                placeholder="e.g., BBCA"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={analyzePatterns}
                disabled={loading || !selectedStock.trim() || quota?.current_quota <= 0}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md ${
                  quota?.current_quota <= 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400'
                }`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span>{t('aiV2.analyzing', 'Analyzing...')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pattern Results */}
      {(!analysis || Object.keys(analysis).length === 0) && !loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
            <p>{t('ai.noData', 'No analysis available')}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {patterns.map((pattern, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{pattern.name}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  pattern.confidence === 'high' ? 'bg-green-100 text-green-800' :
                  pattern.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {t(`aiV2.${pattern.confidence}`, pattern.confidence)}
                </span>
              </div>
              <p className="text-gray-600 mb-4">{pattern.description}</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('aiV2.confidence', 'Confidence')}:</span>
                  <span className="font-medium">{pattern.confidence}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('aiV2.riskLevel', 'Risk Level')}:</span>
                  <span className="font-medium">Medium</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Alerts & Watchlist Component
const AlertsWatchlist = ({ t }) => {
  const [alerts, setAlerts] = useState([
    {
      id: 1,
      condition: 'Stock becomes undervalued based on PE ratio',
      stocks: ['BBCA', 'BBRI'],
      active: true,
      created: new Date().toISOString()
    },
    {
      id: 2,
      condition: 'Sentiment turns negative',
      stocks: ['TLKM'],
      active: true,
      created: new Date().toISOString()
    }
  ]);

  const [newAlert, setNewAlert] = useState({
    condition: '',
    stocks: ['']
  });

  const addStockToAlert = () => {
    setNewAlert({
      ...newAlert,
      stocks: [...newAlert.stocks, '']
    });
  };

  const updateAlertStock = (index, value) => {
    const updatedStocks = [...newAlert.stocks];
    updatedStocks[index] = value.toUpperCase();
    setNewAlert({
      ...newAlert,
      stocks: updatedStocks
    });
  };

  const removeAlertStock = (index) => {
    if (newAlert.stocks.length > 1) {
      setNewAlert({
        ...newAlert,
        stocks: newAlert.stocks.filter((_, i) => i !== index)
      });
    }
  };

  const createAlert = () => {
    if (!newAlert.condition.trim() || newAlert.stocks.some(s => !s.trim())) {
      return;
    }

    const alert = {
      id: Date.now(),
      condition: newAlert.condition,
      stocks: newAlert.stocks.filter(s => s.trim()),
      active: true,
      created: new Date().toISOString()
    };

    setAlerts([...alerts, alert]);
    setNewAlert({ condition: '', stocks: [''] });
  };

  const toggleAlert = (id) => {
    setAlerts(alerts.map(alert =>
      alert.id === id ? { ...alert, active: !alert.active } : alert
    ));
  };

  const deleteAlert = (id) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Create Alert Form */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('aiV2.createAlert', 'Create Alert')}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('aiV2.alertConditions', 'Alert Conditions')}
            </label>
            <select
              value={newAlert.condition}
              onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('aiV2.placeholders.alertCondition', 'Select condition...')}</option>
              <option value="undervalued">{t('aiV2.undervalued', 'Undervalued')}</option>
              <option value="overvalued">{t('aiV2.overvalued', 'Overvalued')}</option>
              <option value="sentimentNegative">{t('aiV2.sentimentNegative', 'Sentiment Negative')}</option>
              <option value="sentimentPositive">{t('aiV2.sentimentPositive', 'Sentiment Positive')}</option>
              <option value="priceBreakout">{t('aiV2.priceBreakout', 'Price Breakout')}</option>
              <option value="volumeSpike">{t('aiV2.volumeSpike', 'Volume Spike')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('aiV2.stocks', 'Stocks')}
            </label>
            {newAlert.stocks.map((stock, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={stock}
                  onChange={(e) => updateAlertStock(index, e.target.value)}
                  placeholder="e.g., BBCA"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {newAlert.stocks.length > 1 && (
                  <button
                    onClick={() => removeAlertStock(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addStockToAlert}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              <Plus className="h-4 w-4" />
              <span>Add Stock</span>
            </button>
          </div>

          <button
            onClick={createAlert}
            disabled={!newAlert.condition.trim() || newAlert.stocks.some(s => !s.trim())}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            <Bell className="h-4 w-4" />
            <span>{t('aiV2.createAlert', 'Create Alert')}</span>
          </button>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">
          {t('aiV2.alerts', 'Active Alerts')}
        </h3>

        <div className="space-y-4">
          {alerts.map((alert) => (
            <div key={alert.id} className="border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{alert.condition}</h4>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className={`p-1 rounded-full ${
                      alert.active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {alert.active ? <CheckCircle className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Stocks: {alert.stocks.join(', ')}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Created: {new Date(alert.created).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Main AIPageV2 Component
const AIPageV2 = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { quota, loading: quotaLoading, error: quotaError } = useQuota();
  const [activeTab, setActiveTab] = useState('marketOverview');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const tabs = [
    { id: 'marketOverview', label: t('aiV2.tabs.marketOverview', 'Market Overview'), icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'deepDive', label: t('aiV2.tabs.deepDive', 'Deep Dive'), icon: <Search className="h-4 w-4" /> },
    { id: 'scenarios', label: t('aiV2.tabs.scenarios', 'Scenarios'), icon: <Brain className="h-4 w-4" /> },
    { id: 'strategies', label: t('aiV2.tabs.strategies', 'Strategies'), icon: <Target className="h-4 w-4" /> },
    { id: 'sentiment', label: t('aiV2.tabs.sentiment', 'Sentiment'), icon: <Activity className="h-4 w-4" /> },
    { id: 'patterns', label: t('aiV2.tabs.patterns', 'Patterns'), icon: <Grid className="h-4 w-4" /> },
    { id: 'alerts', label: t('aiV2.tabs.alerts', 'Alerts'), icon: <Bell className="h-4 w-4" /> }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'marketOverview':
        return <MarketOverview t={t} quota={quota} quotaLoading={quotaLoading} />;
      case 'deepDive':
        return <MultiStockDeepDive t={t} quota={quota} quotaLoading={quotaLoading} />;
      case 'scenarios':
        return <ScenarioSimulator t={t} quota={quota} quotaLoading={quotaLoading} />;
      case 'strategies':
        return <StrategyGenerator t={t} quota={quota} quotaLoading={quotaLoading} navigate={navigate} />;
      case 'sentiment':
        return <SentimentDashboard t={t} quota={quota} quotaLoading={quotaLoading} />;
      case 'patterns':
        return <PatternFinder t={t} quota={quota} quotaLoading={quotaLoading} />;
      case 'alerts':
        return <AlertsWatchlist t={t} />;
      default:
        return <MarketOverview t={t} quota={quota} quotaLoading={quotaLoading} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('aiV2.title', 'AI Analysis V2')}
          </h1>
          <p className="text-gray-600">
            {t('aiV2.subtitle', 'Advanced AI-powered stock analysis and market insights')}
          </p>

          {/* Quota Alert */}
          {user && quota?.current_quota === 0 && (
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
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {t('aiPage.lowQuotaWarning', 'Low quota warning')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {renderTabContent()}
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
      </div>
    </div>
  );
};

export default AIPageV2;