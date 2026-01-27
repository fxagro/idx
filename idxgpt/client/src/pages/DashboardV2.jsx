import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import useQuota from "../hooks/useQuota";

// Mock data for the component
const mockData = {
  user: {
    id: 1,
    username: "john_doe",
    email: "john@example.com",
    role: "premium",
    ai_quota: 75,
    subscription: {
      plan: "Premium",
      status: "active",
      expires_at: "2025-12-31"
    }
  },
  portfolio: {
    balance: 50000000,
    totalHoldingsValue: 150000000,
    portfolioValue: 200000000,
    holdings: [
      { symbol: "BBCA", shares: 100, avgPrice: 9000, currentPrice: 9500 },
      { symbol: "BMRI", shares: 200, avgPrice: 6500, currentPrice: 6800 }
    ]
  },
  affiliate: {
    totalReferrals: 25,
    l1Count: 15,
    l2Count: 10,
    totalEarned: 2500000
  },
  commissions: [
    { month: "2025-01", total_earned: 500000, commission_count: 5 },
    { month: "2024-12", total_earned: 750000, commission_count: 8 },
    { month: "2024-11", total_earned: 300000, commission_count: 3 }
  ],
  watchlist: [
    { symbol: "BBCA", name: "Bank Central Asia", price: 9500, change: 2.5, market: "idx" },
    { symbol: "BMRI", name: "Bank Mandiri", price: 6800, change: -1.2, market: "idx" },
    { symbol: "ASII", name: "Astra International", price: 5200, change: 1.8, market: "idx" },
    { symbol: "TLKM", name: "Telkom Indonesia", price: 3200, change: 0.5, market: "idx" }
  ],
  gainers: [
    { symbol: "ABBA", name: "Mahaka Media", price: 125, change: 25.0, volume: 1000000 },
    { symbol: "FIRE", name: "Alfa Energi Investama", price: 180, change: 20.0, volume: 500000 },
    { symbol: "NICK", name: "Charnic Capital", price: 220, change: 18.5, volume: 750000 }
  ],
  losers: [
    { symbol: "WINS", name: "Wintermar Offshore", price: 85, change: -15.0, volume: 2000000 },
    { symbol: "BALI", name: "Bali Towerindo", price: 450, change: -12.5, volume: 300000 },
    { symbol: "ZONE", name: "Mega Perintis", price: 320, change: -10.2, volume: 800000 }
  ],
  heatmap: [
    { symbol: "BBCA", change: 2.5, sector: "Banking" },
    { symbol: "BMRI", change: -1.2, sector: "Banking" },
    { symbol: "BBNI", change: 1.8, sector: "Banking" },
    { symbol: "ASII", change: 3.2, sector: "Automotive" },
    { symbol: "TLKM", change: 0.5, sector: "Telecommunication" },
    { symbol: "UNVR", change: -0.8, sector: "Consumer Goods" }
  ],
  analysisResults: {
    fundamental: {
      "Market Cap": "Rp 1.2T",
      "P/E Ratio": "15.2x",
      "P/B Ratio": "2.1x",
      "ROE": "13.8%",
      "Dividend Yield": "3.2%"
    },
    teknikal: {
      labels: ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05"],
      prices: [8500, 8700, 8900, 9200, 9500],
      output: "Technical Analysis: Strong upward trend with support at 9000"
    },
    analisa: {
      summary: "Analisis saham BBCA menunjukkan fundamental yang kuat dengan pertumbuhan yang stabil. Saham ini cocok untuk investor jangka panjang dengan profil risiko moderat."
    },
    berita: {
      items: [
        { title: "BBCA Laporan Kinerja Q4 2024", date: "2025-01-15" },
        { title: "Bank BCA Ekspansi Digital Banking", date: "2025-01-10" },
        { title: "Rating BBCA Ditingkatkan ke AAA", date: "2025-01-05" }
      ]
    }
  }
};

export default function DashboardV2() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { quota, loading: quotaLoading, error: quotaError } = useQuota();

  // Single useState object for all component state
  const [state, setState] = useState({
    // User and profile data
    me: mockData.user,
    portfolio: mockData.portfolio,
    affiliateData: mockData.affiliate,
    commissions: mockData.commissions,

    // Analysis state
    command: "fundamental",
    kode: "BBCA",
    market: "idx",
    result: null,
    loading: false,

    // UI state
    selectedStock: "BBCA",
    selectedMarket: "idx",
    showRealTimeChart: true,
    chartData: mockData.analysisResults.teknikal,

    // Loading states
    profileLoading: false,
    portfolioLoading: false,
    affiliateLoading: false
  });

  // Update state helper function
  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Event handlers
  const handleSelectStock = (symbol, market) => {
    updateState({
      selectedStock: symbol,
      selectedMarket: market,
      kode: symbol
    });
  };

  const toggleRealTimeView = () => {
    updateState({ showRealTimeChart: !state.showRealTimeChart });
  };

  const runCommand = async () => {
    updateState({ loading: true, result: null });

    // Simulate API call delay
    setTimeout(() => {
      const resultData = mockData.analysisResults[state.command];
      updateState({
        loading: false,
        result: resultData
      });
    }, 1000);
  };

  const handleChangePassword = () => {
    // Mock password change functionality
    alert(t('dashboard.alerts.passwordChanged', 'Password changed successfully'));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('dashboard.title', 'Dashboard')} v2.0
          </h1>
          <p className="text-gray-600">
            Welcome back, {state.me.username}! Your {state.me.subscription.plan} plan is {state.me.subscription.status}.
          </p>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* AI Quota Card */}
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.cards.aiQuota.title', 'AI Quota Usage')}
              </CardTitle>
              <div className="text-blue-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </CardHeader>
            <CardContent>
              {quotaLoading ? (
                <div className="space-y-2">
                  <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-2 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ) : quota ? (
                <>
                  <div className="text-2xl font-bold text-blue-600">
                    {quota.current_quota}/100
                  </div>
                  <Progress value={quota.current_quota} className="mt-2" />
                  <p className="text-xs text-gray-500 mt-2">
                    {100 - quota.current_quota} queries remaining
                  </p>
                  {quota.current_quota === 0 && (
                    <div className="mt-2 p-2 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded text-xs">
                      {t('ai.noQuota', 'Your AI quota has been used up.')}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-500">
                  {t('common.loading', 'Loading quota...')}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total Referrals Card */}
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.cards.referrals.title', 'Total Referrals')}
              </CardTitle>
              <div className="text-green-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {state.affiliateData.totalReferrals}
              </div>
              <p className="text-xs text-gray-500">
                {state.affiliateData.l1Count} L1, {state.affiliateData.l2Count} L2
              </p>
            </CardContent>
          </Card>

          {/* Recent Commissions Card */}
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('dashboard.cards.commissions.title', 'Recent Commissions')}
              </CardTitle>
              <div className="text-purple-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                Rp {state.affiliateData.totalEarned.toLocaleString('id-ID')}
              </div>
              <p className="text-xs text-gray-500">
                Total earned from referrals
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.sections.quickActions', 'Quick Actions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => navigate('/ai')}
                  className="flex items-center justify-center"
                >
                  <span className="mr-2">🤖</span>
                  AI Analysis
                </Button>
                <Button
                  onClick={() => navigate('/network')}
                  variant="outline"
                  className="flex items-center justify-center"
                >
                  <span className="mr-2">👥</span>
                  My Network
                </Button>
                {state.me.role === 'admin' && (
                  <Button
                    onClick={() => navigate('/admin')}
                    variant="outline"
                    className="flex items-center justify-center"
                  >
                    <span className="mr-2">⚙️</span>
                    Admin Panel
                  </Button>
                )}
                <Button
                  onClick={() => navigate('/virtual-trading/portfolio')}
                  variant="outline"
                  className="flex items-center justify-center"
                >
                  <span className="mr-2">💼</span>
                  Portfolio
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Commissions Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t('dashboard.sections.recentCommissions', 'Recent Commissions')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">{t('dashboard.tables.commissions.month', 'Month')}</th>
                      <th className="text-left py-2 font-medium">{t('dashboard.tables.commissions.amount', 'Amount')}</th>
                      <th className="text-left py-2 font-medium">{t('dashboard.tables.commissions.count', 'Count')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.commissions && state.commissions.length > 0 ? (
                      state.commissions.slice(0, 3).map((commission, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-2">
                            {new Date(commission.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-2 font-medium text-green-600">
                            Rp {commission.total_earned.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 text-gray-600">
                            {commission.commission_count}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="py-4 text-center text-gray-500">
                          No commission data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Portfolio Summary */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('dashboard.sections.portfolioSummary', 'Portfolio Summary')}</CardTitle>
            <Button
              onClick={() => navigate('/portfolio')}
              size="sm"
            >
              {t('dashboard.buttons.viewFullPortfolio', 'View Full Portfolio')}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  Rp {state.portfolio.balance.toLocaleString("id-ID")}
                </div>
                <div className="text-sm text-gray-600">{t('dashboard.portfolio.cash', 'Cash Balance')}</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  Rp {state.portfolio.totalHoldingsValue.toLocaleString("id-ID")}
                </div>
                <div className="text-sm text-gray-600">{t('dashboard.portfolio.holdings', 'Holdings Value')}</div>
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-lg">
                <div className="text-2xl font-bold text-indigo-600">
                  Rp {state.portfolio.portfolioValue.toLocaleString("id-ID")}
                </div>
                <div className="text-sm text-gray-600">{t('dashboard.portfolio.totalValue', 'Total Portfolio Value')}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Real-time Stock Analysis */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('dashboard.sections.realTimeAnalysis', 'Real-time Stock Analysis')}</CardTitle>
            <Button
              onClick={toggleRealTimeView}
              variant={state.showRealTimeChart ? "default" : "outline"}
              size="sm"
            >
              {state.showRealTimeChart ? t('dashboard.buttons.hideChart', 'Hide Chart') : t('dashboard.buttons.showChart', 'Show Chart')}
            </Button>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-6 ${state.showRealTimeChart ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
              {/* Stock Watchlist */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{t('dashboard.sections.stockWatchlist', 'Stock Watchlist')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {mockData.watchlist && mockData.watchlist.length > 0 ? (
                        mockData.watchlist.map((stock) => (
                          <div
                            key={stock.symbol}
                            onClick={() => handleSelectStock(stock.symbol, stock.market)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              state.selectedStock === stock.symbol
                                ? 'bg-blue-100 border border-blue-300'
                                : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-semibold">{stock.symbol}</div>
                                <div className="text-sm text-gray-600">{stock.name}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{stock.price.toLocaleString()}</div>
                                <div className={`text-sm ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {stock.change >= 0 ? '+' : ''}{stock.change}%
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-gray-500 py-4">
                          No watchlist data available
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Candlestick Chart */}
              {state.showRealTimeChart && (
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {state.selectedStock} - {state.selectedMarket.toUpperCase()}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={state.chartData && state.chartData.labels && state.chartData.prices ?
                          state.chartData.labels.map((d, i) => ({
                            date: d,
                            price: state.chartData.prices[i]
                          })) : []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="price" stroke="#4f46e5" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Gainers & Losers */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('dashboard.sections.topGainersLosers', 'Top Gainers & Losers')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="gainers" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="gainers">{t('dashboard.tabs.gainers', 'Top Gainers')}</TabsTrigger>
                <TabsTrigger value="losers">{t('dashboard.tabs.losers', 'Top Losers')}</TabsTrigger>
              </TabsList>
              <TabsContent value="gainers">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">{t('dashboard.tables.stocks.symbol', 'Symbol')}</th>
                        <th className="text-left py-2 font-medium">{t('dashboard.tables.stocks.name', 'Name')}</th>
                        <th className="text-left py-2 font-medium">{t('dashboard.tables.stocks.price', 'Price')}</th>
                        <th className="text-left py-2 font-medium">{t('dashboard.tables.stocks.change', 'Change')}</th>
                        <th className="text-left py-2 font-medium">{t('dashboard.tables.stocks.volume', 'Volume')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockData.gainers && mockData.gainers.length > 0 ? (
                        mockData.gainers.map((stock, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="py-2 font-medium">{stock.symbol}</td>
                            <td className="py-2">{stock.name}</td>
                            <td className="py-2">{stock.price}</td>
                            <td className="py-2 text-green-600">+{stock.change}%</td>
                            <td className="py-2">{stock.volume.toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="py-4 text-center text-gray-500">
                            No gainers data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              <TabsContent value="losers">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">{t('dashboard.tables.stocks.symbol', 'Symbol')}</th>
                        <th className="text-left py-2 font-medium">{t('dashboard.tables.stocks.name', 'Name')}</th>
                        <th className="text-left py-2 font-medium">{t('dashboard.tables.stocks.price', 'Price')}</th>
                        <th className="text-left py-2 font-medium">{t('dashboard.tables.stocks.change', 'Change')}</th>
                        <th className="text-left py-2 font-medium">{t('dashboard.tables.stocks.volume', 'Volume')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockData.losers && mockData.losers.length > 0 ? (
                        mockData.losers.map((stock, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="py-2 font-medium">{stock.symbol}</td>
                            <td className="py-2">{stock.name}</td>
                            <td className="py-2">{stock.price}</td>
                            <td className="py-2 text-red-600">{stock.change}%</td>
                            <td className="py-2">{stock.volume.toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="py-4 text-center text-gray-500">
                            No losers data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Market Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('dashboard.sections.marketOverview', 'Market Overview')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* IDX Heatmap */}
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('dashboard.sections.idxHeatmap', 'IDX Heatmap')}</h3>
                <div className="grid grid-cols-3 gap-2">
                 {mockData.heatmap && mockData.heatmap.length > 0 ? (
                   mockData.heatmap.map((item, index) => (
                     <div
                       key={index}
                       className={`p-3 rounded text-center text-sm font-medium ${
                         item.change > 0
                           ? 'bg-green-100 text-green-800'
                           : item.change < 0
                           ? 'bg-red-100 text-red-800'
                           : 'bg-gray-100 text-gray-800'
                       }`}
                     >
                       <div className="font-bold">{item.symbol}</div>
                       <div className={item.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                         {item.change > 0 ? '+' : ''}{item.change}%
                       </div>
                     </div>
                   ))
                 ) : (
                   <div className="col-span-3 text-center text-gray-500 py-4">
                     No heatmap data available
                   </div>
                 )}
                </div>
              </div>

              {/* Index Summary */}
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('dashboard.sections.indexSummary', 'Index Summary')}</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                    <span className="font-medium">IDX Composite</span>
                    <span className="text-blue-600 font-bold">7,245.67 (+1.23%)</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                    <span className="font-medium">LQ45</span>
                    <span className="text-green-600 font-bold">1,023.45 (+2.15%)</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                    <span className="font-medium">JII</span>
                    <span className="text-purple-600 font-bold">687.23 (+0.87%)</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Traditional Analysis Tools */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.sections.traditionalAnalysis', 'Traditional Analysis Tools')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
              <select
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={state.command}
                onChange={(e) => updateState({ command: e.target.value })}
              >
                <option value="fundamental">/fundamental</option>
                <option value="analisa">/analisa</option>
                <option value="teknikal">/teknikal</option>
                <option value="berita">/berita</option>
              </select>
              <input
                type="text"
                placeholder={t('dashboard.placeholders.stockCode', 'Stock Code')}
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={state.kode}
                onChange={(e) => updateState({ kode: e.target.value.toUpperCase() })}
              />
              <select
                className="border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={state.market}
                onChange={(e) => updateState({ market: e.target.value })}
              >
                <option value="idx">IDX</option>
                <option value="us">US</option>
              </select>
              <Button
                onClick={runCommand}
                disabled={state.loading}
                className="px-6 py-3"
              >
                {state.loading ? t('dashboard.buttons.loading', 'Loading...') : t('dashboard.buttons.runAnalysis', 'Run Analysis')}
              </Button>
            </div>

            {/* Dynamic Result Display */}
            {state.result && (
              <div className="mt-6">
                {state.command === "fundamental" && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm bg-white border border-gray-200 rounded-lg">
                      <thead className="bg-blue-600 text-white">
                        <tr>
                          {Object.keys(state.result).map((header, i) => (
                            <th key={i} className="px-4 py-3 text-left font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-gray-200">
                          {Object.values(state.result).map((value, i) => (
                            <td key={i} className="px-4 py-3">{value}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {state.command === "teknikal" && (
                  <div>
                    <div className="font-semibold mb-4">{state.result.output}</div>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={state.result && state.result.labels && state.result.prices ?
                        state.result.labels.map((d, i) => ({
                          date: d,
                          price: state.result.prices[i]
                        })) : []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="price" stroke="#4f46e5" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {state.command === "analisa" && (
                  <div className="bg-gray-50 rounded-lg p-4 text-sm border">
                    <pre className="whitespace-pre-wrap">{state.result.summary}</pre>
                  </div>
                )}

                {state.command === "berita" && (
                  <div className="space-y-3">
                    {state.result && state.result.items && state.result.items.length > 0 ? (
                      state.result.items.map((item, i) => (
                        <div key={i} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                          <div className="font-medium text-gray-900">{item.title}</div>
                          <div className="text-xs text-gray-500 mt-1">{item.date}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-gray-500 py-4">
                        No news data available
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}