import React, { useState, useEffect } from "react";
import api from "../utils/api";

export default function IDXHeatmap() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchHeatmapData();
  }, []);

  const fetchHeatmapData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [trendingRes, gainersRes, losersRes] = await Promise.all([
        api.get("/stocks/trending?limit=20"),
        api.get("/stocks/idx/top-gainers?limit=10"),
        api.get("/stocks/idx/top-losers?limit=10")
      ]);

      // Combine and unique stocks, prioritize gainers/losers for change data
      const allStocks = new Map();

      trendingRes.data.trending.forEach(stock => {
        allStocks.set(stock.symbol, { ...stock, changePercent: stock.changePercent, type: 'trending' });
      });

      gainersRes.data.gainers.forEach(stock => {
        allStocks.set(stock.symbol, { ...stock, changePercent: stock.changePercent, type: 'gainer' });
      });

      losersRes.data.losers.forEach(stock => {
        allStocks.set(stock.symbol, { ...stock, changePercent: stock.changePercent, type: 'loser' });
      });

      setStocks(Array.from(allStocks.values()).slice(0, 50)); // Limit to 50 for heatmap
    } catch (err) {
      setError("Failed to fetch heatmap data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4 text-center">Loading heatmap...</div>;
  if (error) return <div className="p-4 text-red-500 text-center">{error}</div>;

  // Color based on changePercent
  const getColorClass = (change) => {
    if (change > 5) return "bg-green-500";
    if (change > 0) return "bg-green-300";
    if (change < -5) return "bg-red-500";
    if (change < 0) return "bg-red-300";
    return "bg-gray-300";
  };

  const getTextClass = (change) => {
    if (change > 0) return "text-green-700";
    if (change < 0) return "text-red-700";
    return "text-gray-700";
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold text-xl mb-4">🔥 IDX Heatmap</h3>
      <div className="grid grid-cols-10 gap-1">
        {stocks.map((stock, index) => (
          <div key={stock.symbol} className="aspect-square rounded relative">
            <div className={`w-full h-full rounded ${getColorClass(stock.changePercent)}`}></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
              <div className={`text-xs font-bold ${getTextClass(stock.changePercent)}`}>
                {stock.symbol}
              </div>
              <div className={`text-xs ${getTextClass(stock.changePercent)}`}>
                {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-xs text-gray-500">
        Green: Gainers | Red: Losers | Gray: Neutral | Click to view details (extendable)
      </div>
    </div>
  );
}