import React, { useState, useEffect } from 'react';
import socketService from '../utils/socket';
import api from '../utils/api';

const StockWatchlist = ({ onSelectStock }) => {
  const [watchlist, setWatchlist] = useState([]);
  const [trending, setTrending] = useState([]);
  const [marketSummary, setMarketSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Default popular stocks for watchlist
  const defaultStocks = ['BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 'UNVR', 'ICBP', 'INDF'];

  useEffect(() => {
    loadInitialData();
    setupSocketListeners();

    return () => {
      // Cleanup socket listeners
      socketService.offMarketSummary(handleMarketSummary);
    };
  }, []);

  const loadInitialData = async () => {
    try {
      // Load trending stocks
      const trendingResponse = await api.get('/stocks/trending', {
        params: { market: 'idx', limit: 10 }
      });
      
      setTrending(trendingResponse.data.trending || []);
      
      // Set default watchlist
      setWatchlist(defaultStocks.map(symbol => ({ 
        symbol, 
        name: symbol,
        price: 0,
        change: 0,
        changePercent: 0 
      })));

    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    if (socketService.isConnected()) {
      socketService.onMarketSummary(handleMarketSummary);
    }
  };

  const handleMarketSummary = (summary) => {
    setMarketSummary(summary);
  };

  const handleSearch = async (term) => {
    setSearchTerm(term);
    
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await api.get(`/stocks/search/${term}`, {
        params: { market: 'idx', limit: 5 }
      });
      setSearchResults(response.data.results || []);
    } catch (error) {
      console.error('Error searching stocks:', error);
      setSearchResults([]);
    }
  };

  const addToWatchlist = (stock) => {
    const isAlreadyAdded = watchlist.some(item => item.symbol === stock.symbol);
    if (!isAlreadyAdded) {
      setWatchlist(prev => [...prev, { ...stock, price: 0, change: 0, changePercent: 0 }]);
      setSearchTerm('');
      setSearchResults([]);
    }
  };

  const removeFromWatchlist = (symbol) => {
    setWatchlist(prev => prev.filter(item => item.symbol !== symbol));
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Market Summary */}
      {marketSummary && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">📊 Market Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800">{marketSummary.totalStocks}</div>
              <div className="text-gray-600">Active Stocks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{marketSummary.gainers}</div>
              <div className="text-gray-600">Gainers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{marketSummary.losers}</div>
              <div className="text-gray-600">Losers</div>
            </div>
          </div>
        </div>
      )}

      {/* Search Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">🔍 Add to Watchlist</h3>
        <div className="relative">
          <input
            type="text"
            placeholder="Search stocks (e.g., BBCA, TLKM)"
            className="w-full border rounded-lg px-3 py-2 pr-10"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <div className="absolute right-3 top-2.5 text-gray-400">
            🔍
          </div>
        </div>
        
        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-2 border rounded-lg bg-white shadow-lg">
            {searchResults.map((stock) => (
              <div
                key={stock.symbol}
                className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                onClick={() => addToWatchlist(stock)}
              >
                <div className="font-medium">{stock.symbol}</div>
                <div className="text-sm text-gray-600">{stock.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Watchlist */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">⭐ My Watchlist</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {watchlist.map((stock) => (
            <div
              key={stock.symbol}
              className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelectStock?.(stock.symbol, 'idx')}
            >
              <div>
                <div className="font-medium">{stock.symbol}</div>
                <div className="text-sm text-gray-600">{stock.name}</div>
              </div>
              <div className="text-right">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromWatchlist(stock.symbol);
                  }}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trending Stocks */}
      <div>
        <h3 className="text-lg font-semibold mb-3">🔥 Trending</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {trending.slice(0, 8).map((stock) => (
            <div
              key={stock.symbol}
              className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelectStock?.(stock.symbol, 'idx')}
            >
              <div>
                <div className="font-medium">{stock.symbol}</div>
                <div className="text-xs text-gray-600">Vol: {stock.volume.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">
                  Rp {stock.price.toLocaleString()}
                </div>
                <div className={`text-xs ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StockWatchlist;