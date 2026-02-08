import React, { useState, useEffect, useRef } from 'react';
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
  TimeScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import socketService from '../utils/socket';
import api from '../utils/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const StockChart = ({ symbol, market = 'idx' }) => {
  const { t } = useTranslation();
  const [priceData, setPriceData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const chartRef = useRef(null);

  // Initialize WebSocket connection
  useEffect(() => {
    socketService.connect();
    setIsConnected(socketService.isConnected());

    const checkConnection = setInterval(() => {
      setIsConnected(socketService.isConnected());
    }, 1000);

    return () => {
      clearInterval(checkConnection);
    };
  }, []);

  // Load historical data and subscribe to real-time updates
  useEffect(() => {
    if (!symbol) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load historical data
        const response = await api.get(`/stocks/price/${symbol}`, {
          params: { market, days: 30 }
        });

        const { current, history } = response.data;
        
        // Initialize price data with historical data
        const initialData = history.map(item => ({
          time: new Date(item.date).toLocaleTimeString(),
          price: item.close,
          volume: item.volume,
          timestamp: new Date(item.date)
        }));

        setPriceData(initialData);
        setCurrentPrice(current);

        // Subscribe to real-time updates
        if (socketService.isConnected()) {
          socketService.subscribeToStock(symbol, market, handlePriceUpdate);
        }

      } catch (err) {
        console.error('Error loading stock data:', err);
        setError(`Failed to load data for ${symbol}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Cleanup subscription on unmount or symbol change
    return () => {
      if (socketService.isConnected()) {
        socketService.unsubscribeFromStock(symbol, market, handlePriceUpdate);
      }
    };
  }, [symbol, market]);

  const handlePriceUpdate = (data) => {
    console.log('📈 Price update:', data);
    
    setCurrentPrice(prev => ({
      ...prev,
      price: data.price,
      volume: data.volume,
      change: data.change,
      changePercent: data.changePercent
    }));

    // Add new data point
    setPriceData(prev => {
      const newDataPoint = {
        time: new Date(data.timestamp).toLocaleTimeString(),
        price: data.price,
        volume: data.volume,
        timestamp: new Date(data.timestamp)
      };

      const updated = [...prev, newDataPoint];
      
      // Keep only last 50 points to avoid memory issues
      return updated.slice(-50);
    });
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 750,
      easing: 'easeInOutQuad'
    },
    interaction: {
      intersect: false,
      mode: 'index'
    },
    plugins: {
      legend: {
        position: 'top',
        display: false
      },
      title: {
        display: true,
        text: `${symbol} - ${t('charts.realTimePrice')}`,
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: '#4f46e5',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            return [
              `${t('charts.price').replace(' (Rp)', '')}: Rp ${context.parsed.y.toLocaleString()}`,
              `${t('charts.time')}: ${context.label}`
            ];
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: t('charts.time')
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: t('charts.price')
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          callback: function(value) {
            return 'Rp ' + value.toLocaleString();
          }
        }
      }
    }
  };

  const chartData = {
    labels: priceData.map(item => item.time),
    datasets: [
      {
        label: symbol,
        data: priceData.map(item => item.price),
        borderColor: currentPrice?.change >= 0 ? '#10b981' : '#ef4444',
        backgroundColor: currentPrice?.change >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: currentPrice?.change >= 0 ? '#10b981' : '#ef4444',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4
      }
    ]
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold">{t('ui.errorLoadingChart')}</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header with current price info */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">{symbol}</h3>
          <p className="text-sm text-gray-500">{market.toUpperCase()} {t('charts.market')}</p>
        </div>
        
        {currentPrice && (
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-800">
              Rp {currentPrice.price?.toLocaleString()}
            </div>
            <div className={`text-sm font-medium ${
              currentPrice.change >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {currentPrice.change >= 0 ? '+' : ''}
              {currentPrice.change?.toFixed(2)} ({currentPrice.changePercent?.toFixed(2)}%)
            </div>
          </div>
        )}
      </div>

      {/* Connection status */}
      <div className="flex justify-between items-center mb-4 text-sm">
        <div className={`flex items-center ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
          <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          {isConnected ? t('charts.liveUpdates') : t('charts.disconnected')}
        </div>
        <div className="text-gray-500">
          {priceData.length > 0 && `${priceData.length} ${t('charts.dataPoints')}`}
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <Line ref={chartRef} options={chartOptions} data={chartData} />
      </div>

      {/* Volume info */}
      {currentPrice?.volume && (
        <div className="mt-4 text-sm text-gray-600">
          {t('charts.volume')}: {currentPrice.volume?.toLocaleString() || '0'} {t('charts.shares')}
        </div>
      )}
    </div>
  );
};

export default StockChart;