import React, { useState, useEffect } from "react";
import api from "../utils/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Sector
} from "recharts";

export default function Portfolio() {
  const [balance, setBalance] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [history, setHistory] = useState([]);
  const [profitChartData, setProfitChartData] = useState([]);
  const [sectorData, setSectorData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [buySymbol, setBuySymbol] = useState("");
  const [buyQuantity, setBuyQuantity] = useState("");
  const [sellSymbol, setSellSymbol] = useState("");
  const [sellQuantity, setSellQuantity] = useState("");
  const [buyLoading, setBuyLoading] = useState(false);
  const [sellLoading, setSellLoading] = useState(false);

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const fetchPortfolio = async () => {
    setLoading(true);
    setError(null);
    try {
      const [balanceRes, holdingsRes, historyRes] = await Promise.all([
        api.get("/portfolio/balance"),
        api.get("/portfolio/holdings"),
        api.get("/portfolio/history")
      ]);
      setBalance(balanceRes.data);
      setHoldings(holdingsRes.data.holdings);
      setHistory(historyRes.data);

      // Process profit chart data (cumulative P&L from transactions)
      let cumulativePnL = 0;
      const chartData = historyRes.data.map(tx => {
        let pnl = 0;
        if (tx.type === 'sell') {
          pnl = tx.total_amount - (tx.quantity * tx.price); // Approximate realized P&L
        } else if (tx.type === 'buy') {
          pnl = -tx.total_amount; // Cost as negative
        }
        cumulativePnL += pnl;
        return {
          date: new Date(tx.timestamp).toLocaleDateString('id-ID'),
          pnl: cumulativePnL,
          amount: tx.total_amount
        };
      }).reverse(); // Oldest first for line chart
      setProfitChartData(chartData);

      // Process sector diversification
      const sectorMap = {};
      holdingsRes.data.holdings.forEach(h => {
        const sector = h.sector || 'Unknown';
        sectorMap[sector] = (sectorMap[sector] || 0) + (h.currentValue || 0);
      });
      const sectorArray = Object.entries(sectorMap).map(([name, value]) => ({ name, value }));
      setSectorData(sectorArray);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch portfolio");
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (e) => {
    e.preventDefault();
    if (!buySymbol || !buyQuantity) return;
    setBuyLoading(true);
    try {
      await api.post("/portfolio/buy", {
        symbol: buySymbol.toUpperCase(),
        quantity: parseFloat(buyQuantity)
      });
      setBuySymbol("");
      setBuyQuantity("");
      fetchPortfolio(); // Refresh
    } catch (err) {
      setError(err.response?.data?.error || "Buy failed");
    } finally {
      setBuyLoading(false);
    }
  };

  const handleSell = async (e) => {
    e.preventDefault();
    if (!sellSymbol || !sellQuantity) return;
    setSellLoading(true);
    try {
      await api.post("/portfolio/sell", {
        symbol: sellSymbol.toUpperCase(),
        quantity: parseFloat(sellQuantity)
      });
      setSellSymbol("");
      setSellQuantity("");
      fetchPortfolio(); // Refresh
    } catch (err) {
      setError(err.response?.data?.error || "Sell failed");
    } finally {
      setSellLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading portfolio...</div>;
  if (error) return <div className="p-8 text-red-500 text-center">{error}</div>;

  const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  const portfolioValue = (balance?.balance || 0) + totalValue;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">
      {/* Portfolio Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold text-xl mb-4">💼 Portfolio Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">Rp {balance?.balance?.toLocaleString("id-ID") || 0}</div>
            <div className="text-sm text-gray-500">Cash Balance</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">Rp {totalValue.toLocaleString("id-ID")}</div>
            <div className="text-sm text-gray-500">Holdings Value</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-600">Rp {portfolioValue.toLocaleString("id-ID")}</div>
            <div className="text-sm text-gray-500">Total Portfolio</div>
          </div>
        </div>
      </div>

      {/* Trading Forms */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Buy Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-lg mb-4">📈 Buy Shares</h3>
          <form onSubmit={handleBuy} className="space-y-4">
            <input
              type="text"
              placeholder="Symbol (e.g., BBCA)"
              value={buySymbol}
              onChange={(e) => setBuySymbol(e.target.value.toUpperCase())}
              className="w-full p-2 border rounded"
              required
            />
            <input
              type="number"
              placeholder="Quantity"
              value={buyQuantity}
              onChange={(e) => setBuyQuantity(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
              required
            />
            <button
              type="submit"
              disabled={buyLoading}
              className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {buyLoading ? "Processing..." : "Buy"}
            </button>
          </form>
        </div>

        {/* Sell Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-lg mb-4">📉 Sell Shares</h3>
          <form onSubmit={handleSell} className="space-y-4">
            <input
              type="text"
              placeholder="Symbol (e.g., BBCA)"
              value={sellSymbol}
              onChange={(e) => setSellSymbol(e.target.value.toUpperCase())}
              className="w-full p-2 border rounded"
              required
            />
            <input
              type="number"
              placeholder="Quantity"
              value={sellQuantity}
              onChange={(e) => setSellQuantity(e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
              required
            />
            <button
              type="submit"
              disabled={sellLoading}
              className="w-full py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              {sellLoading ? "Processing..." : "Sell"}
            </button>
          </form>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold text-lg mb-4">📊 Holdings</h3>
        {holdings.length === 0 ? (
          <p className="text-gray-500">No holdings yet. Start buying stocks!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Symbol</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Company</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Sector</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Quantity</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Avg Price</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Current Price</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Value</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {holdings.map((holding, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 text-sm font-medium">{holding.symbol}</td>
                    <td className="px-4 py-2 text-sm">{holding.companyName}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{holding.sector}</td>
                    <td className="px-4 py-2 text-sm">{holding.quantity.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm">Rp {holding.avg_price.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-2 text-sm">Rp {holding.currentPrice.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-2 text-sm">Rp {holding.currentValue.toLocaleString("id-ID")}</td>
                    <td className={`px-4 py-2 text-sm font-medium ${
                      holding.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {holding.unrealizedPnl >= 0 ? '+' : ''}Rp {holding.unrealizedPnl.toLocaleString("id-ID")}
                      <br />
                      <span className="text-xs">({holding.unrealizedPnlPercent.toFixed(2)}%)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];