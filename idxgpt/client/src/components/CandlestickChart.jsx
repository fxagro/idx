import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import api from "../utils/api";
import { safeArray, safeLength, safeMap, safeGet } from "../utils/safeData";
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
} from 'chart.js';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import { Chart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  CandlestickController,
  CandlestickElement
);

export default function CandlestickChart({ symbol = 'BBCA', market = 'idx', days = 60, data: propData = null }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Use prop data if provided, otherwise use internal state
  const currentData = propData || data;
  const history = safeArray(safeGet(currentData, 'history'));

  useEffect(() => {
    if (!propData) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [symbol, market, days, propData]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/stocks/price/${symbol}?market=${market}&days=${days}`);
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch stock data:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>{t('messages.loadingChart')}</div>;
  if (safeLength(history) === 0) return <div>{t('messages.noDataForSymbol')} {symbol}.</div>;

  // Prepare candlestick data
  const candlestickData = safeMap(history, h => ({
    x: safeGet(h, 'date'),
    o: safeGet(h, 'open'),
    h: safeGet(h, 'high'),
    l: safeGet(h, 'low'),
    c: safeGet(h, 'close'),
  }));

  // Prepare SMA line data
  const smaData = safeMap(history, h => ({
    x: safeGet(h, 'date'),
    y: safeGet(h, 'sma20') || null,
  })).filter(d => d.y !== null);

  // Prepare RSI data (for subchart, but here as line on main for simplicity; can separate if needed)
  const rsiData = safeMap(history, h => ({
    x: safeGet(h, 'date'),
    y: safeGet(h, 'rsi14') || null,
  })).filter(d => d.y !== null);

  const chartData = {
    datasets: [
      {
        label: t('analysis.candlestick'),
        data: candlestickData,
        type: 'candlestick',
        color: {
          up: '#00ff00',
          down: '#ff0000',
          unchanged: '#999999',
        },
      },
      {
        label: t('analysis.sma20'),
        data: smaData,
        type: 'line',
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: false,
        tension: 0.1,
      },
      {
        label: t('analysis.rsi14'),
        data: rsiData,
        type: 'line',
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        yAxisID: 'y1',
        fill: false,
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    stacked: false,
    plugins: {
      title: {
        display: true,
        text: `${symbol} - ${t('charts.candlestick')} (${market.toUpperCase()})`,
      },
      legend: {
        display: true,
        position: 'top',
      },
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: t('charts.price'),
        },
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: {
          drawOnChartArea: false,
        },
        title: {
          display: true,
          text: t('analysis.rsi'),
        },
        min: 0,
        max: 100,
      },
      x: {
        type: 'category',
        title: {
          display: true,
          text: t('charts.date'),
        },
        ticks: {
          autoSkip: false,
          maxTicksLimit: 30,
          maxRotation: 45,
        },
      },
    },
  };

  return <Chart type="candlestick" data={chartData} options={options} />;
}