import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const Stocks = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStocks();
  }, []);

  const fetchStocks = async () => {
    try {
      setLoading(true);
      console.log('Fetching stocks from API...');
      const response = await api.get('/stocks');
      console.log('Stocks response:', response.data);
      
      if (response.data.success) {
        setStocks(response.data.data);
      } else {
        throw new Error('Failed to fetch stocks');
      }
    } catch (err) {
      console.error('Error fetching stocks:', err);
      setError(err.message);
      
      // Fallback to mock data
      setStocks([
        { symbol: 'BBCA', name: 'Bank Central Asia Tbk.', market: 'IDX' },
        { symbol: 'TLKM', name: 'Telkom Indonesia Tbk.', market: 'IDX' },
        { symbol: 'ASII', name: 'Astra International Tbk.', market: 'IDX' },
        { symbol: 'BMRI', name: 'Bank Mandiri Tbk.', market: 'IDX' },
        { symbol: 'BBNI', name: 'Bank Negara Indonesia Tbk.', market: 'IDX' },
        { symbol: 'ADRO', name: 'Adaro Energy Indonesia Tbk.', market: 'IDX' },
        { symbol: 'ANTM', name: 'Aneka Tambang Tbk.', market: 'IDX' },
        { symbol: 'BRMS', name: 'Barito Renewables Energy Tbk.', market: 'IDX' },
        { symbol: 'BSDE', name: 'Bumi Serpong Damai Tbk.', market: 'IDX' },
        { symbol: 'CPIN', name: 'Charoen Pokphand Indonesia Tbk.', market: 'IDX' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStockData = async (symbol) => {
    try {
      setLoading(true);
      console.log(`Fetching data for stock: ${symbol}`);
      const response = await api.get(`/stocks/price/${symbol}`);
      console.log('Stock data response:', response.data);
      setStockData(response.data);
      setSelectedStock(symbol);
    } catch (err) {
      console.error('Error fetching stock data:', err);
      setError(err.message);
      
      // Generate mock data for demonstration
      const mockData = generateMockStockData(symbol);
      setStockData(mockData);
      setSelectedStock(symbol);
    } finally {
      setLoading(false);
    }
  };

  const generateMockStockData = (symbol) => {
    const basePrice = symbol === 'BBCA' ? 8500 : 
                     symbol === 'TLKM' ? 3800 : 
                     symbol === 'ASII' ? 5200 : 4000;
    const data = [];
    const now = new Date();
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const variation = (Math.random() - 0.5) * 0.04;
      const price = basePrice * (1 + variation * (30 - i) / 30);
      
      data.push({
        date: date.toISOString().split('T')[0],
        price: Math.round(price),
        volume: Math.floor(1000000 + Math.random() * 10000000)
      });
    }
    
    return {
      symbol,
      data,
      current: data[data.length - 1],
      change: ((data[data.length - 1].price - data[0].price) / data[0].price * 100).toFixed(2)
    };
  };

  const filteredStocks = stocks.filter(stock => 
    stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stock.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && stocks.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Stocks Market</h1>
          <div className="flex justify-center items-center h-64">
            <div className="text-xl">Loading stocks data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Stocks Market</h1>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}
        
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search stocks by symbol or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
        
        {/* Stocks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {filteredStocks.map((stock) => (
            <div
              key={stock.symbol}
              onClick={() => fetchStockData(stock.symbol)}
              className={`p-4 bg-gray-800 rounded-lg cursor-pointer transition-colors ${
                selectedStock === stock.symbol ? 'ring-2 ring-blue-500' : 'hover:bg-gray-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">{stock.symbol}</h3>
                  <p className="text-gray-400 text-sm">{stock.name}</p>
                </div>
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                  {stock.market}
                </span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Stock Chart */}
        {selectedStock && stockData && (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                {selectedStock} - {stockData.change}%
              </h2>
              <div className="text-right">
                <p className="text-3xl font-bold text-green-400">
                  Rp {stockData.current?.price?.toLocaleString()}
                </p>
                <p className="text-gray-400">
                  {stockData.current?.date}
                </p>
              </div>
            </div>
            
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stockData.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF' }}
                    tickFormatter={(value) => `Rp ${(value / 1000).toFixed(1)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [`Rp ${value.toLocaleString()}`, 'Price']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('id-ID')}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stocks;
