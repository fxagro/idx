import React, { useState, useEffect } from "react";
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

export default function SimpleCandlestickChart({ symbol = 'BBCA', market = 'idx', data: propData = null }) {
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
   }, [symbol, market, propData]);

   const fetchData = async () => {
     setLoading(true);
     try {
       const response = await api.get(`/stocks/price/${symbol}?market=${market}&days=30`);
       setData(response.data);
     } catch (err) {
       console.error('Failed to fetch stock data:', err);
       setData(null);
     } finally {
       setLoading(false);
     }
   };

   if (loading) return <div>Loading simple chart...</div>;
   if (safeLength(history) === 0) return <div>No candlestick data available for {symbol}.</div>;

  // Prepare candlestick data with safe operations
  const candlestickData = safeMap(history, h => ({
    x: safeGet(h, 'date'),
    o: safeGet(h, 'open'),
    h: safeGet(h, 'high'),
    l: safeGet(h, 'low'),
    c: safeGet(h, 'close'),
  }));

  const chartData = {
    datasets: [
      {
        label: 'Candlestick',
        data: candlestickData,
        type: 'candlestick',
        color: {
          up: '#00ff00',
          down: '#ff0000',
          unchanged: '#999999',
        },
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
        text: `${symbol} - Simple Candlestick (30 Days, ${market.toUpperCase()})`,
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
          text: 'Price (Rp)',
        },
      },
      x: {
        type: 'category',
        title: {
          display: true,
          text: 'Date',
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