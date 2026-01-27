import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
// import io from 'socket.io-client'; // Disabled for static historical data
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

// Technical Indicators Calculation Functions
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

    // Calculate gains and losses
    for (let i = 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

    // Calculate RSI for each point
    for (let i = period; i < data.length; i++) {
        if (i > period) {
            avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
            avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
        }

        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
    }

    // Fill initial values with null
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

    // Fill signal line to match data length
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
    if (data.length < 2) return { levels: [], annotations: [] };

    const high = Math.max(...data.map(d => d.h));
    const low = Math.min(...data.map(d => d.l));
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

    return { levels, annotations };
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

const StockChart = () => {
    const { t } = useTranslation();
    const [symbols, setSymbols] = useState([]);
    const [selectedSymbol, setSelectedSymbol] = useState('');
    const [timeRange, setTimeRange] = useState('1M');
    const [chartData, setChartData] = useState([]);
    const [companyInfo, setCompanyInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingSymbols, setLoadingSymbols] = useState(true);
    const [error, setError] = useState(null);
    const [stockStats, setStockStats] = useState(null);
    const [dataPoints, setDataPoints] = useState(0);
    const [useDummyData, setUseDummyData] = useState(false);

    // Enhanced state for technical indicators
    const [activeIndicators, setActiveIndicators] = useState({
        SMA: { enabled: false, periods: [20, 50] },
        EMA: { enabled: false, periods: [12, 26] },
        RSI: { enabled: false, period: 14 },
        MACD: { enabled: false, fast: 12, slow: 26, signal: 9 },
        BB: { enabled: false, period: 20, stdDev: 2 },
        FIBONACCI: { enabled: false }
    });

    const [showVolume, setShowVolume] = useState(true);
    const [chartType, setChartType] = useState('candlestick');

    const candlestickChartRef = useRef(null);

    // Function to limit data points for performance
    const limitDataPoints = (data, maxPoints = 100) => {
      if (!data || data.length <= maxPoints) return data;
      const step = Math.ceil(data.length / maxPoints);
      return data.filter((_, index) => index % step === 0);
    };

    // Function to get max points based on timeRange
    const getMaxPointsForTimeRange = (timeRange) => {
      switch (timeRange) {
        case '1M': return 30;    // 1 month = ~30 days
        case '3M': return 60;    // 3 months = ~90 days, but limit to 60
        case '6M': return 80;    // 6 months = ~180 days, but limit to 80
        case '1Y': return 100;   // 1 year = ~365 days, limit to 100
        case 'ALL': return 100;  // All time, limit to 100
        default: return 100;
      }
    };
  
    // Function to generate dummy data for testing
    const generateDummyData = (symbol, timeRange, points = 50) => {
      const now = new Date();
      const data = [];
      const basePrice = 1000 + Math.random() * 5000; // Random base price between 1000-6000
  
      for (let i = points - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
  
        // Generate realistic price movements
        const volatility = 0.02; // 2% daily volatility
        const trend = (Math.random() - 0.5) * 0.01; // Small trend component
        const randomChange = (Math.random() - 0.5) * 2 * volatility;
  
        const priceChange = trend + randomChange;
        const open = basePrice * (1 + priceChange * (i / points));
        const close = open * (1 + (Math.random() - 0.5) * volatility * 2);
        const high = Math.max(open, close) * (1 + Math.random() * volatility);
        const low = Math.min(open, close) * (1 - Math.random() * volatility);
  
        const volume = Math.floor(Math.random() * 1000000) + 500000; // 500K to 1.5M shares
  
        data.push({
          trade_date: date.toISOString().split('T')[0],
          open: Math.round(open * 100) / 100,
          high: Math.round(high * 100) / 100,
          low: Math.round(low * 100) / 100,
          close: Math.round(close * 100) / 100,
          volume: volume
        });
      }
  
      return data;
    };

    const timeRangeOptions = [
        { label: t('market.month', '1 Month'), value: '1M' },
        { label: t('market.3 months', '3Months'), value: '3M' },
        { label: t('market.6 months', '6Months'), value: '6M' },
        { label: 'YTD', value: 'YTD' },
        { label: t('common.all', 'All'), value: 'ALL' }
    ];

    // Fetch available symbols on component mount
    useEffect(() => {
        const fetchSymbols = async () => {
            setLoadingSymbols(true);
            setError(null);

            try {
                const response = await api.get('/stocks/symbols');
                const symbolsList = response.data.symbols || [];
                const companies = response.data.companies || {};
                const total = response.data.total || 0;
                const source = response.data.source || 'Database';

                // Filter out duplicate symbols to ensure unique keys
                const uniqueSymbols = Array.from(new Set(symbolsList));

                setSymbols(uniqueSymbols);

                if (uniqueSymbols.length > 0) {
                    setSelectedSymbol(uniqueSymbols[0]);
                }

                console.log(`✅ Loaded ${total} symbols from ${source}:`, uniqueSymbols);

                // Update the database status indicator
                if (total === 0) {
                    setError(t('market.noData', 'No data available'));
                } else {
                    setError(null);
                }
            } catch (error) {
                console.error('Error fetching symbols:', error);
                setError(t('market.error', 'Error loading data'));
                setSymbols([]);
            } finally {
                setLoadingSymbols(false);
            }
        };

        fetchSymbols();
    }, []);

    // WebSocket functionality disabled for static historical data
    // useEffect(() => {
    //     if (!selectedSymbol) return;
    //
    //     // Initialize Socket.io connection with CORS fix
    //     socketRef.current = io('http://localhost:5000', {
    //         transports: ['websocket', 'polling']
    //     });
    //
    //     socketRef.current.on('connect', () => {
    //         console.log('🔌 Connected to WebSocket server', socketRef.current.id);
    //         // Subscribe to stock updates
    //         socketRef.current.emit('subscribe_stock', { symbol: selectedSymbol, market: 'idx' });
    //     });
    //
    //     socketRef.current.on('price_update', (data) => {
    //         console.log('📈 Real-time price update:', data);
    //         // Update both charts with new price data if it's for the selected symbol
    //         if (data.symbol === selectedSymbol && candlestickDatasets && volumeDatasets) {
    //             // Create new candlestick data point
    //             const newCandlestickPoint = {
    //                 x: new Date().getTime(),
    //                 o: data.price,
    //                 h: data.price,
    //                 l: data.price,
    //                 c: data.price
    //             };
    //
    //             // Create new volume data point
    //             const newVolumePoint = {
    //                 x: new Date().getTime(),
    //                 y: data.volume || Math.floor(Math.random() * 1000000) + 500000,
    //                 color: 'rgba(16, 185, 129, 0.8)' // Green for volume bars
    //             };
    //
    //     //     // Update candlestick datasets using functional update
    //     //     setCandlestickDatasets(prevDatasets => {
    //     //         if (!prevDatasets || !prevDatasets[0]) return prevDatasets;
    //     //
    //     //         const updatedDatasets = JSON.parse(JSON.stringify(prevDatasets)); // Deep clone
    //     //         const candlestickDataset = updatedDatasets[0];
    //     //
    //     //         if (candlestickDataset && candlestickDataset.data) {
    //     //             candlestickDataset.data = [...candlestickDataset.data, newCandlestickPoint];
    //     //             if (candlestickDataset.data.length > 100) {
    //     //                 candlestickDataset.data = candlestickDataset.data.slice(-100);
    //     //             }
    //     //         }
    //     //         return updatedDatasets;
    //     //     });
    //     //
    //     //     // Update volume datasets using functional update
    //     //     setVolumeDatasets(prevDatasets => {
    //     //         if (!prevDatasets || !prevDatasets[0]) return prevDatasets;
    //     //
    //     //         const updatedDatasets = JSON.parse(JSON.stringify(prevDatasets)); // Deep clone
    //     //         const volumeDataset = updatedDatasets[0];
    //     //
    //     //         if (volumeDataset && volumeDataset.data) {
    //     //             volumeDataset.data = [...volumeDataset.data, newVolumePoint];
    //     //             volumeDataset.backgroundColor = [...volumeDataset.backgroundColor, newVolumePoint.color];
    //     //             volumeDataset.borderColor = [...volumeDataset.borderColor, newVolumePoint.color];
    //     //             if (volumeDataset.data.length > 100) {
    //     //                 volumeDataset.data = volumeDataset.data.slice(-100);
    //     //                 volumeDataset.backgroundColor = volumeDataset.backgroundColor.slice(-100);
    //     //                 volumeDataset.borderColor = volumeDataset.borderColor.slice(-100);
    //     //             }
    //     //         }
    //     //         return updatedDatasets;
    //     //     });
    //     //     }
    //     });
    //
    //     socketRef.current.on('disconnect', () => {
    //         console.log('🔌 Disconnected from WebSocket server');
    //     });
    //
    //     // Cleanup on unmount
    //     return () => {
    //         if (socketRef.current) {
    //             socketRef.current.disconnect();
    //             socketRef.current = null;
    //         }
    //     };
    // }, [selectedSymbol, candlestickDatasets, volumeDatasets]); // Add datasets to dependencies

    // Prepare indicators configuration for the hook
    const indicatorsConfig = useMemo(() => {
        const config = [];

        if (activeIndicators.SMA.enabled) {
            activeIndicators.SMA.periods.forEach(period => {
                config.push({ type: 'SMA', period });
            });
        }

        if (activeIndicators.EMA.enabled) {
            activeIndicators.EMA.periods.forEach(period => {
                config.push({ type: 'EMA', period });
            });
        }

        if (activeIndicators.RSI.enabled) {
            config.push({ type: 'RSI', period: activeIndicators.RSI.period });
        }

        if (activeIndicators.MACD.enabled) {
            config.push({
                type: 'MACD',
                fast: activeIndicators.MACD.fast,
                slow: activeIndicators.MACD.slow,
                signal: activeIndicators.MACD.signal
            });
        }

        if (activeIndicators.BB.enabled) {
            config.push({
                type: 'BB',
                period: activeIndicators.BB.period,
                stdDev: activeIndicators.BB.stdDev
            });
        }

        if (activeIndicators.FIBONACCI.enabled) {
            config.push({ type: 'FIBONACCI' });
        }

        return config;
    }, [activeIndicators]);

    // Use the technical indicators hook
    const technicalIndicators = useTechnicalIndicators(chartData, indicatorsConfig);

    // Render enhanced candlestick chart
    useEffect(() => {
        if (!chartData || chartData.length === 0 || !candlestickChartRef.current) {
            return;
        }

        const chartElement = candlestickChartRef.current;
        const ctx = chartElement.getContext('2d');

        // Destroy existing chart
        if (candlestickChartRef.current.chart) {
            candlestickChartRef.current.chart.destroy();
        }

        // Prepare datasets for main chart
        const datasets = [];

        // Candlestick dataset
        if (chartType === 'candlestick') {
            datasets.push({
                label: `Price - ${selectedSymbol}`,
                type: 'candlestick',
                data: chartData.map(d => ({
                    x: new Date(d.trade_date).getTime(),
                    o: d.o,
                    h: d.h,
                    l: d.l,
                    c: d.c
                })),
                color: {
                    up: '#10B981',
                    down: '#EF4444',
                    unchanged: '#6B7280'
                },
                borderColor: chartData.map(d => d.c > d.o ? '#10B981' : '#EF4444'),
                borderWidth: 1
            });
        } else {
            // Line chart dataset
            datasets.push({
                label: `Price - ${selectedSymbol}`,
                type: 'line',
                data: chartData.map(d => ({
                    x: new Date(d.trade_date).getTime(),
                    y: d.c
                })),
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: false,
                pointRadius: 0,
                pointHoverRadius: 4
            });
        }

        // Add technical indicator datasets
        Object.entries(technicalIndicators).forEach(([key, indicatorData]) => {
            if (key.startsWith('SMA_')) {
                const period = key.split('_')[1];
                datasets.push({
                    label: `SMA ${period}`,
                    type: 'line',
                    data: chartData.map((d, i) => ({
                        x: new Date(d.trade_date).getTime(),
                        y: indicatorData[i]
                    })).filter(d => d.y !== null),
                    borderColor: `rgba(168, 85, 247, 0.8)`,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 0
                });
            }

            if (key.startsWith('EMA_')) {
                const period = key.split('_')[1];
                datasets.push({
                    label: `EMA ${period}`,
                    type: 'line',
                    data: chartData.map((d, i) => ({
                        x: new Date(d.trade_date).getTime(),
                        y: indicatorData[i]
                    })).filter(d => d.y !== null),
                    borderColor: `rgba(249, 115, 22, 0.8)`,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 0
                });
            }

            if (key.startsWith('BB_')) {
                const [, period, stdDev] = key.split('_');
                datasets.push({
                    label: `BB Upper ${period}`,
                    type: 'line',
                    data: chartData.map((d, i) => ({
                        x: new Date(d.trade_date).getTime(),
                        y: indicatorData.upperBand[i]
                    })).filter(d => d.y !== null),
                    borderColor: `rgba(239, 68, 68, 0.6)`,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0
                });

                datasets.push({
                    label: `BB Lower ${period}`,
                    type: 'line',
                    data: chartData.map((d, i) => ({
                        x: new Date(d.trade_date).getTime(),
                        y: indicatorData.lowerBand[i]
                    })).filter(d => d.y !== null),
                    borderColor: `rgba(239, 68, 68, 0.6)`,
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0
                });
            }
        });

        // Add volume dataset to main chart
        if (showVolume && chartData.length > 0) {
            const volumeData = chartData.map((d, i) => {
                const color = i === 0 ? 'rgba(156, 163, 175, 0.6)' :
                             d.c > chartData[i-1]?.c ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)';

                return {
                    x: new Date(d.trade_date).getTime(),
                    y: d.volume,
                    color: color
                };
            });

            datasets.push({
                label: 'Volume',
                type: 'bar',
                data: volumeData,
                backgroundColor: volumeData.map(d => d.color),
                borderColor: volumeData.map(d => d.color),
                borderWidth: 1,
                yAxisID: 'y1'
            });
        }

        // Chart configuration
        const chartConfig = {
            type: chartType === 'candlestick' ? 'candlestick' : 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: `${selectedSymbol} - Advanced Technical Analysis`,
                        font: { size: 16, weight: 'bold' }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#374151',
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
                                const dataset = context.dataset;
                                const point = context.raw;

                                if (dataset.type === 'candlestick') {
                                    const change = point.c - point.o;
                                    const changePercent = ((change / point.o) * 100).toFixed(2);
                                    return [
                                        `Open: Rp ${point.o?.toLocaleString('id-ID') || 'N/A'}`,
                                        `High: Rp ${point.h?.toLocaleString('id-ID') || 'N/A'}`,
                                        `Low: Rp ${point.l?.toLocaleString('id-ID') || 'N/A'}`,
                                        `Close: Rp ${point.c?.toLocaleString('id-ID') || 'N/A'}`,
                                        `Change: ${change >= 0 ? '+' : ''}Rp ${change.toLocaleString('id-ID')} (${changePercent}%)`
                                    ];
                                } else if (dataset.label === 'Volume') {
                                    const volume = point.y;
                                    if (volume >= 1000000000) {
                                        return `Volume: ${(volume / 1000000000).toFixed(1)}B shares`;
                                    } else if (volume >= 1000000) {
                                        return `Volume: ${(volume / 1000000).toFixed(1)}M shares`;
                                    } else if (volume >= 1000) {
                                        return `Volume: ${(volume / 1000).toFixed(1)}K shares`;
                                    }
                                    return `Volume: ${volume?.toLocaleString('id-ID') || 'N/A'} shares`;
                                } else {
                                    return `${dataset.label}: Rp ${point.y?.toLocaleString('id-ID') || 'N/A'}`;
                                }
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: { size: 11 },
                            generateLabels: (chart) => {
                                return chart.data.datasets.map((dataset, i) => ({
                                    text: dataset.label,
                                    fillStyle: dataset.borderColor,
                                    strokeStyle: dataset.borderColor,
                                    lineWidth: dataset.borderWidth,
                                    hidden: !chart.isDatasetVisible(i),
                                    index: i
                                }));
                            }
                        },
                        onClick: (e, legendItem, legend) => {
                            const index = legendItem.index;
                            const chart = legend.chart;
                            const meta = chart.getDatasetMeta(index);

                            meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                            chart.update();
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
                        annotations: activeIndicators.FIBONACCI.enabled && technicalIndicators.FIBONACCI ?
                            technicalIndicators.FIBONACCI.annotations : []
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
                            color: '#6B7280',
                            font: { size: 12, weight: 'bold' }
                        },
                        grid: {
                            color: 'rgba(107, 114, 128, 0.1)'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Price (IDR)',
                            color: '#6B7280',
                            font: { size: 12, weight: 'bold' }
                        },
                        ticks: {
                            callback: (value) => `Rp ${value.toLocaleString('id-ID')}`,
                            color: '#6B7280'
                        },
                        grid: {
                            color: 'rgba(107, 114, 128, 0.1)'
                        }
                    },
                    y1: showVolume ? {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Volume',
                            color: '#6B7280',
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
                            color: '#6B7280'
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
                    }
                },
                animation: {
                    duration: 800,
                    easing: 'easeInOutQuart'
                }
            }
        };

        const newChart = new Chart(ctx, chartConfig);
        candlestickChartRef.current.chart = newChart;

        // Cleanup function
        return () => {
            if (candlestickChartRef.current?.chart) {
                candlestickChartRef.current.chart.destroy();
            }
        };
    }, [chartData, selectedSymbol, chartType, technicalIndicators, activeIndicators]);


    // Fetch chart data when symbol or time range changes
    useEffect(() => {
        if (!selectedSymbol) return;

        const fetchChartData = async () => {
            setLoading(true);
            setError(null);

            try {
                console.log(`🔄 Fetching chart data for ${selectedSymbol} with timeframe ${timeRange}`);

                // Use dummy data if enabled
                let data, company_name, data_points;

                if (useDummyData) {
                    console.log(`🧪 Using dummy data for ${selectedSymbol} with ${timeRange}`);
                    const dummyData = generateDummyData(selectedSymbol, timeRange, getMaxPointsForTimeRange(timeRange));

                    data = dummyData;
                    company_name = `${selectedSymbol} - Dummy Data`;
                    data_points = dummyData.length;
                } else {
                    const response = await api.get('/stocks/candlestick', {
                        params: {
                            symbol: selectedSymbol,
                            timeframe: timeRange
                        }
                    });

                    const responseData = response.data;
                    data = responseData.data;
                    company_name = responseData.company_name;
                    data_points = responseData.data_points;
                }

                // Apply data limiting based on timeRange
                const maxPoints = getMaxPointsForTimeRange(timeRange);
                const limitedData = limitDataPoints(data, maxPoints);

                if (!limitedData || limitedData.length === 0) {
                    setChartData([]);
                    setCompanyInfo(`Tidak ada data tersedia untuk ${selectedSymbol}`);
                    setStockStats(null);
                    setDataPoints(0);
                    return;
                }

                setDataPoints(data_points || limitedData.length);

                // Calculate stock statistics
                const closes = limitedData.map(d => parseFloat(String(d.close).replace(/,/g, '')));
                const volumes = limitedData.map(d => parseInt(String(d.volume).replace(/,/g, '')));
                const firstPrice = closes[0];
                const lastPrice = closes[closes.length - 1];
                const change = lastPrice - firstPrice;
                const changePercent = (change / firstPrice) * 100;

                const stats = {
                    currentPrice: lastPrice,
                    previousPrice: firstPrice,
                    change: change,
                    changePercent: changePercent,
                    high: Math.max(...limitedData.map(d => parseFloat(String(d.high).replace(/,/g, '')))),
                    low: Math.min(...limitedData.map(d => parseFloat(String(d.low).replace(/,/g, '')))),
                    avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
                    totalVolume: volumes.reduce((a, b) => a + b, 0)
                };

                setStockStats(stats);

                // Process data for charts - ensure valid numbers
                const processedData = limitedData.map(d => ({
                    trade_date: d.trade_date,
                    o: parseFloat(String(d.open).replace(/,/g, '')),
                    h: parseFloat(String(d.high).replace(/,/g, '')),
                    l: parseFloat(String(d.low).replace(/,/g, '')),
                    c: parseFloat(String(d.close).replace(/,/g, '')),
                    volume: parseInt(String(d.volume).replace(/,/g, ''))
                })).filter(d => !isNaN(d.o) && !isNaN(d.h) && !isNaN(d.l) && !isNaN(d.c));

                setChartData(processedData);
                setCompanyInfo(`Perusahaan: ${company_name || 'Unknown'} | Data Points: ${data_points}`);

            } catch (error) {
                console.error('❌ Error fetching chart data:', error);
                setError('Gagal memuat data grafik');
                setChartData([]);
                setStockStats(null);
                setDataPoints(0);
            } finally {
                setLoading(false);
            }
        };

        fetchChartData();
    }, [selectedSymbol, timeRange, useDummyData]);

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        📊 Advanced Technical Analysis Dashboard
                    </h1>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>IDX Stock Market: <strong>{symbols.length.toLocaleString()} Symbols</strong></span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span>Source: PostgreSQL Database</span>
                        </div>
                        {symbols.length > 0 && (
                            <>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                    <span>Status: <strong className="text-green-600">✅ Connected</strong></span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Main Controls */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Stock Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Stock Symbol
                        </label>
                        <Select
                            value={selectedSymbol ? { value: selectedSymbol, label: `${selectedSymbol} - IDX` } : null}
                            onChange={(selectedOption) => setSelectedSymbol(selectedOption ? selectedOption.value : '')}
                            options={symbols.map(symbol => ({
                                value: symbol,
                                label: `${symbol} - IDX Stock`
                            }))}
                            isLoading={loadingSymbols}
                            isDisabled={loading || loadingSymbols}
                            placeholder={loadingSymbols ? "Loading..." : "Select stock symbol..."}
                            isSearchable={true}
                            styles={{
                                control: (provided, state) => ({
                                    ...provided,
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.5rem',
                                    minHeight: '2.75rem',
                                    boxShadow: state.isFocused ? '0 0 0 2px rgba(99, 102, 241, 0.2)' : 'none'
                                })
                            }}
                        />
                    </div>

                    {/* Time Range & Chart Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Time Period</label>
                            <select
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value)}
                                disabled={loading}
                            >
                                {timeRangeOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Chart Type</label>
                            <select
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                value={chartType}
                                onChange={(e) => setChartType(e.target.value)}
                                disabled={loading}
                            >
                                <option value="candlestick">Candlestick</option>
                                <option value="line">Line Chart</option>
                            </select>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Actions</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                disabled={loading}
                            >
                                🔄 Refresh
                            </button>
                            <button
                                onClick={() => setUseDummyData(!useDummyData)}
                                className={`flex-1 p-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 ${
                                    useDummyData ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
                                }`}
                                disabled={loading}
                            >
                                🧪 {useDummyData ? 'Real Data' : 'Test Data'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Technical Indicators Controls */}
                <div className="bg-gray-50 rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Technical Indicators</h3>

                    {/* Moving Averages */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <label className="font-medium text-gray-700">Moving Averages</label>
                                <button
                                    onClick={() => setActiveIndicators(prev => ({
                                        ...prev,
                                        SMA: { ...prev.SMA, enabled: !prev.SMA.enabled }
                                    }))}
                                    className={`px-3 py-1 rounded text-sm font-medium ${
                                        activeIndicators.SMA.enabled
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    {activeIndicators.SMA.enabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            {activeIndicators.SMA.enabled && (
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-600">SMA Periods:</label>
                                    <div className="flex gap-2">
                                        {[20, 50, 200].map(period => (
                                            <button
                                                key={period}
                                                onClick={() => {
                                                    const periods = activeIndicators.SMA.periods.includes(period)
                                                        ? activeIndicators.SMA.periods.filter(p => p !== period)
                                                        : [...activeIndicators.SMA.periods, period];
                                                    setActiveIndicators(prev => ({
                                                        ...prev,
                                                        SMA: { ...prev.SMA, periods }
                                                    }));
                                                }}
                                                className={`px-2 py-1 rounded text-xs ${
                                                    activeIndicators.SMA.periods.includes(period)
                                                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                                        : 'bg-gray-100 text-gray-600'
                                                }`}
                                            >
                                                SMA {period}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <label className="font-medium text-gray-700">EMA</label>
                                <button
                                    onClick={() => setActiveIndicators(prev => ({
                                        ...prev,
                                        EMA: { ...prev.EMA, enabled: !prev.EMA.enabled }
                                    }))}
                                    className={`px-3 py-1 rounded text-sm font-medium ${
                                        activeIndicators.EMA.enabled
                                            ? 'bg-orange-600 text-white'
                                            : 'bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    {activeIndicators.EMA.enabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            {activeIndicators.EMA.enabled && (
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-600">EMA Periods:</label>
                                    <div className="flex gap-2">
                                        {[12, 26].map(period => (
                                            <button
                                                key={period}
                                                onClick={() => {
                                                    const periods = activeIndicators.EMA.periods.includes(period)
                                                        ? activeIndicators.EMA.periods.filter(p => p !== period)
                                                        : [...activeIndicators.EMA.periods, period];
                                                    setActiveIndicators(prev => ({
                                                        ...prev,
                                                        EMA: { ...prev.EMA, periods }
                                                    }));
                                                }}
                                                className={`px-2 py-1 rounded text-xs ${
                                                    activeIndicators.EMA.periods.includes(period)
                                                        ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                                        : 'bg-gray-100 text-gray-600'
                                                }`}
                                            >
                                                EMA {period}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <label className="font-medium text-gray-700">RSI</label>
                                <button
                                    onClick={() => setActiveIndicators(prev => ({
                                        ...prev,
                                        RSI: { ...prev.RSI, enabled: !prev.RSI.enabled }
                                    }))}
                                    className={`px-3 py-1 rounded text-sm font-medium ${
                                        activeIndicators.RSI.enabled
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    {activeIndicators.RSI.enabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            {activeIndicators.RSI.enabled && (
                                <div className="space-y-2">
                                    <label className="text-xs text-gray-600">Period:</label>
                                    <select
                                        className="w-full p-1 border border-gray-300 rounded text-xs"
                                        value={activeIndicators.RSI.period}
                                        onChange={(e) => setActiveIndicators(prev => ({
                                            ...prev,
                                            RSI: { ...prev.RSI, period: parseInt(e.target.value) }
                                        }))}
                                    >
                                        {[7, 14, 21].map(period => (
                                            <option key={period} value={period}>{period}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <label className="font-medium text-gray-700">MACD</label>
                                <button
                                    onClick={() => setActiveIndicators(prev => ({
                                        ...prev,
                                        MACD: { ...prev.MACD, enabled: !prev.MACD.enabled }
                                    }))}
                                    className={`px-3 py-1 rounded text-sm font-medium ${
                                        activeIndicators.MACD.enabled
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    {activeIndicators.MACD.enabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <label className="font-medium text-gray-700">Bollinger Bands</label>
                                <button
                                    onClick={() => setActiveIndicators(prev => ({
                                        ...prev,
                                        BB: { ...prev.BB, enabled: !prev.BB.enabled }
                                    }))}
                                    className={`px-3 py-1 rounded text-sm font-medium ${
                                        activeIndicators.BB.enabled
                                            ? 'bg-red-600 text-white'
                                            : 'bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    {activeIndicators.BB.enabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            {activeIndicators.BB.enabled && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-gray-600">Period:</label>
                                        <select
                                            className="w-full p-1 border border-gray-300 rounded text-xs"
                                            value={activeIndicators.BB.period}
                                            onChange={(e) => setActiveIndicators(prev => ({
                                                ...prev,
                                                BB: { ...prev.BB, period: parseInt(e.target.value) }
                                            }))}
                                        >
                                            {[10, 20, 30].map(period => (
                                                <option key={period} value={period}>{period}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-600">Std Dev:</label>
                                        <select
                                            className="w-full p-1 border border-gray-300 rounded text-xs"
                                            value={activeIndicators.BB.stdDev}
                                            onChange={(e) => setActiveIndicators(prev => ({
                                                ...prev,
                                                BB: { ...prev.BB, stdDev: parseFloat(e.target.value) }
                                            }))}
                                        >
                                            {[1.5, 2, 2.5].map(stdDev => (
                                                <option key={stdDev} value={stdDev}>{stdDev}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <label className="font-medium text-gray-700">Fibonacci</label>
                                <button
                                    onClick={() => setActiveIndicators(prev => ({
                                        ...prev,
                                        FIBONACCI: { ...prev.FIBONACCI, enabled: !prev.FIBONACCI.enabled }
                                    }))}
                                    className={`px-3 py-1 rounded text-sm font-medium ${
                                        activeIndicators.FIBONACCI.enabled
                                            ? 'bg-yellow-600 text-white'
                                            : 'bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    {activeIndicators.FIBONACCI.enabled ? 'ON' : 'OFF'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Volume Toggle */}
                    <div className="flex items-center justify-between bg-white rounded-lg p-4">
                        <label className="font-medium text-gray-700">Show Volume (Right Axis)</label>
                        <button
                            onClick={() => setShowVolume(!showVolume)}
                            className={`px-4 py-2 rounded-lg font-medium ${
                                showVolume
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-200 text-gray-700'
                            }`}
                        >
                            {showVolume ? 'Visible' : 'Hidden'}
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Chart Container */}
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-96">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                                <p className="text-gray-600">Loading Chart Data...</p>
                                <p className="text-sm text-gray-500 mt-2">
                                    Fetching {selectedSymbol} data...
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">Data Points:</span> {dataPoints.toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">Status:</span>
                                    <span className="text-green-600 ml-1">✅ Ready</span>
                                </div>
                            </div>

                            {/* Main Chart */}
                            <div className="mb-6">
                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                    <canvas
                                        ref={candlestickChartRef}
                                        className="w-full"
                                        style={{
                                            minHeight: '500px',
                                            maxHeight: '500px'
                                        }}
                                    />
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                {/* Stock Statistics */}
                {stockStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-lg p-4 border-l-4 border-green-500 shadow-sm">
                            <div className="text-sm text-gray-600">Current Price</div>
                            <div className="text-xl font-bold text-gray-900">
                                Rp {stockStats.currentPrice.toLocaleString('id-ID')}
                            </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500 shadow-sm">
                            <div className="text-sm text-gray-600">Change</div>
                            <div className={`text-xl font-bold ${stockStats.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {stockStats.change >= 0 ? '+' : ''}Rp {stockStats.change.toLocaleString('id-ID')}
                            </div>
                            <div className={`text-sm ${stockStats.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ({stockStats.changePercent >= 0 ? '+' : ''}{stockStats.changePercent.toFixed(2)}%)
                            </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500 shadow-sm">
                            <div className="text-sm text-gray-600">High</div>
                            <div className="text-xl font-bold text-gray-900">
                                Rp {stockStats.high.toLocaleString('id-ID')}
                            </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border-l-4 border-orange-500 shadow-sm">
                            <div className="text-sm text-gray-600">Low</div>
                            <div className="text-xl font-bold text-gray-900">
                                Rp {stockStats.low.toLocaleString('id-ID')}
                            </div>
                        </div>
                    </div>
                )}

                {/* Volume Summary */}
                {stockStats && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">📊 Volume Summary</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded p-3">
                                <div className="text-xs text-gray-500">Average Volume</div>
                                <div className="text-lg font-bold text-gray-900">
                                    {(stockStats.avgVolume / 1000000).toFixed(1)}M
                                </div>
                            </div>
                            <div className="bg-white rounded p-3">
                                <div className="text-xs text-gray-500">Total Volume</div>
                                <div className="text-lg font-bold text-gray-900">
                                    {(stockStats.totalVolume / 1000000).toFixed(1)}M
                                </div>
                            </div>
                            <div className="bg-white rounded p-3">
                                <div className="text-xs text-gray-500">Trading Days</div>
                                <div className="text-lg font-bold text-gray-900">
                                    {dataPoints} Days
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Company Info */}
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded mb-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-blue-700">{companyInfo}</p>
                        </div>
                    </div>
                </div>

                {/* Technical Indicators Legend */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        📊 Technical Indicators Guide
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-3">
                            <div className="flex items-center mb-2">
                                <div className="w-4 h-0.5 bg-purple-500 mr-2"></div>
                                <strong className="text-purple-600">SMA</strong>
                            </div>
                            <p className="text-xs text-gray-600">Simple Moving Average - Trend direction</p>
                        </div>
                        <div className="bg-white rounded-lg p-3">
                            <div className="flex items-center mb-2">
                                <div className="w-4 h-0.5 bg-orange-500 mr-2"></div>
                                <strong className="text-orange-600">EMA</strong>
                            </div>
                            <p className="text-xs text-gray-600">Exponential Moving Average - Recent price weight</p>
                        </div>
                        <div className="bg-white rounded-lg p-3">
                            <div className="flex items-center mb-2">
                                <div className="w-4 h-0.5 bg-green-500 mr-2"></div>
                                <strong className="text-green-600">MACD</strong>
                            </div>
                            <p className="text-xs text-gray-600">Momentum and trend changes</p>
                        </div>
                        <div className="bg-white rounded-lg p-3">
                            <div className="flex items-center mb-2">
                                <div className="w-4 h-0.5 bg-red-500 mr-2"></div>
                                <strong className="text-red-600">Bollinger Bands</strong>
                            </div>
                            <p className="text-xs text-gray-600">Volatility and price levels</p>
                        </div>
                        <div className="bg-white rounded-lg p-3">
                            <div className="flex items-center mb-2">
                                <div className="w-4 h-0.5 bg-yellow-500 mr-2"></div>
                                <strong className="text-yellow-600">Fibonacci</strong>
                            </div>
                            <p className="text-xs text-gray-600">Support and resistance levels</p>
                        </div>
                        <div className="bg-white rounded-lg p-3">
                            <div className="flex items-center mb-2">
                                <div className="w-4 h-3 bg-blue-500 mr-2 rounded-sm"></div>
                                <strong className="text-blue-600">Volume</strong>
                            </div>
                            <p className="text-xs text-gray-600">Trading activity (Right Axis)</p>
                        </div>
                    </div>
                </div>

                {/* Features Info */}
                <div className="bg-gradient-to-r from-gray-50 to-indigo-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        🚀 Advanced Trading Features
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="flex items-center mb-2">
                                <span className="text-2xl mr-2">📈</span>
                                <strong className="text-green-600">Technical Analysis</strong>
                            </div>
                            <p className="text-sm text-gray-600">5 major indicators with customizable parameters</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="flex items-center mb-2">
                                <span className="text-2xl mr-2">🔍</span>
                                <strong className="text-blue-600">Interactive Zoom</strong>
                            </div>
                            <p className="text-sm text-gray-600">Mouse wheel and pinch-to-zoom support</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="flex items-center mb-2">
                                <span className="text-2xl mr-2">📊</span>
                                <strong className="text-purple-600">Real-time Data</strong>
                            </div>
                            <p className="text-sm text-gray-600">Live IDX stock data from PostgreSQL</p>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="flex items-center mb-2">
                                <span className="text-2xl mr-2">📱</span>
                                <strong className="text-indigo-600">Mobile Friendly</strong>
                            </div>
                            <p className="text-sm text-gray-600">Responsive design for all devices</p>
                        </div>
                    </div>
                </div>

                {/* Usage Instructions */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                    <div className="flex items-start">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h4 className="text-sm font-medium text-yellow-800">How to Use</h4>
                            <div className="mt-2 text-sm text-yellow-700">
                                <p>• Select a stock symbol from the dropdown</p>
                                <p>• Choose your preferred time period</p>
                                <p>• Toggle technical indicators ON/OFF as needed</p>
                                <p>• Use mouse wheel to zoom in/out, click and drag to pan</p>
                                <p>• Hover over data points for detailed information</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockChart;
