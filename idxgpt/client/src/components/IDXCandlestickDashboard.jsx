import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import Plot from 'react-plotly.js';

export default function IDXCandlestickDashboard() {
  const [symbols, setSymbols] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState('BBCA');
  const [timeRange, setTimeRange] = useState('1M');
  const [chartData, setChartData] = useState({ data: [], company_name: '', data_points: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSymbols();
  }, []);

  useEffect(() => {
    if (selectedSymbol) {
      fetchChartData();
    }
  }, [selectedSymbol, timeRange]);

  const fetchSymbols = async () => {
    try {
      const response = await api.get('/stocks/idx/symbols');
      setSymbols(response.data.symbols.map(s => ({ label: s, value: s })));
    } catch (err) {
      console.error('Failed to fetch symbols:', err);
      setError('Failed to load symbols');
    }
  };

  const fetchChartData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/stocks/idx/candlestick', {
        params: { symbol: selectedSymbol, range: timeRange }
      });
      setChartData(response.data);
    } catch (err) {
      console.error('Failed to fetch chart data:', err);
      setError('Failed to load chart data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-xl mb-4">IDX Candlestick Dashboard</h3>
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-xl mb-4">IDX Candlestick Dashboard</h3>
        <div className="text-red-500 text-center">{error}</div>
      </div>
    );
  }

  const { data, company_name, data_points } = chartData;

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-xl mb-4">IDX Candlestick Dashboard</h3>
        <div className="text-gray-500 text-center">Tidak ada data untuk simbol ini / range ini.</div>
      </div>
    );
  }

  const candlestickTrace = [{
    x: data.map(d => d.trade_date),
    open: data.map(d => d.open),
    high: data.map(d => d.high),
    low: data.map(d => d.low),
    close: data.map(d => d.close),
    type: 'candlestick',
    name: 'Candlestick',
    increasing: { line: { color: '#00ff00' } },
    decreasing: { line: { color: '#ff0000' } }
  }];

  const volumeTrace = [{
    x: data.map(d => d.trade_date),
    y: data.map(d => d.volume),
    type: 'bar',
    name: 'Volume',
    marker: { color: 'lightblue' }
  }];

  const layout = {
    title: `${selectedSymbol} - ${company_name}`,
    showlegend: false,
    height: 500,
    autosize: true,
    paper_bgcolor: 'white',
    plot_bgcolor: 'white',
    xaxis: { title: 'Trade Date' },
    yaxis: { title: 'Price' },
    yaxis2: { title: 'Volume', side: 'right', overlaying: 'y' },
    xaxis_rangeslider_visible: false,
    template: 'plotly_white'
  };

  const config = { responsive: true };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold text-xl mb-4">IDX Candlestick Dashboard</h3>
      
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <select
          value={selectedSymbol}
          onChange={(e) => setSelectedSymbol(e.target.value)}
          className="border p-2 rounded flex-1"
        >
          {symbols.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="border p-2 rounded flex-1"
        >
          <option value="1M">1 Month</option>
          <option value="3M">3 Months</option>
          <option value="6M">6 Months</option>
          <option value="YTD">YTD</option>
          <option value="ALL">All</option>
        </select>
      </div>
      
      <Plot
        data={[...candlestickTrace, ...volumeTrace]}
        layout={layout}
        config={config}
        style={{ width: '100%', height: 500 }}
        useResizeHandler={true}
      />
      
      <div className="text-sm text-gray-500 mt-2">
        Data Points: {data_points}
      </div>
    </div>
  );
}