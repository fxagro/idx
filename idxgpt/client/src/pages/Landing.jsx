import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Landing() {
  const { t } = useTranslation();
  const faqs = [
    {
      q: "What is myTradeX?",
      a: "myTradeX is an AI-powered trading platform that provides stock analysis, technical indicators, sentiment analysis, and bandarmology in one comprehensive application.",
    },
    {
      q: t("landing.faq.questions.supportedStocks"),
      a: t("landing.faq.questions.supportedStocksAnswer"),
    },
    {
      q: t("landing.faq.questions.subscription"),
      a: t("landing.faq.questions.subscriptionAnswer"),
    },
    {
      q: t("landing.faq.questions.telegram"),
      a: t("landing.faq.questions.telegramAnswer"),
    },
  ];

  const aiMethods = [
    { t: "Linear Regression", d: "Prediski AI, tren (Naik/Turun/Stabil), confidence interval dari volatilitas.", c: "border-green-500" },
    { t: "EMA Trend (12/26)", d: "Bandingkan EMA12 vs EMA26, sinyal tren 1 hari ke depan.", c: "border-yellow-500" },
    { t: "MACD (12,26,9)", d: "MACD Line vs Signal Line, gunakan histogram untuk prediksi pendek.", c: "border-red-500" },
    { t: "Support & Resistance", d: "Level pivot dari high/low/close 30 hari.", c: "border-green-500" },
    { t: "Bollinger Bands", d: "BB(20,2) untuk Overbought/Oversold/Netral.", c: "border-yellow-500" },
    { t: "Stochastic (14,3)", d: "%K/%D untuk momentum & timing entry.", c: "border-red-500" },
    { t: "VWAP (14)", d: "Posisi harga vs harga rata-rata berbobot volume.", c: "border-green-500" },
    { t: "Fibonacci", d: "Retracement 23.6–78.6% dari range 30 hari.", c: "border-yellow-500" },
    { t: "GARCH(1,1)", d: "Estimasi volatilitas untuk band kepercayaan.", c: "border-red-500" },
    { t: "XGBoost", d: "Fitur Lag, EMA12, Volume, RSI, Volatility, High, Low untuk prediksi 5 hari.", c: "border-green-500" },
    { t: "ARIMA(5,1,0)", d: "Model time-series untuk horizon 5 hari.", c: "border-yellow-500" },
    { t: "LSTM (2-layer)", d: "Sequence 30 hari (MinMaxScaler) untuk prediksi multi-step.", c: "border-red-500" },
    { t: "Random Forest", d: "Regressor dengan fitur teknikal & volatilitas.", c: "border-green-500" },
  ];

  const botFeatures = [
    { t: "Top Movers", d: "Top 30 Gainers/Losers/Active/Transaction.", i: "📈" },
    { t: "Foreign Flow", d: "FA, FS, Net Buy/Sell asing.", i: "🌍" },
    { t: "Bandarmology IDX", d: "Lacak akumulasi & distribusi broker.", i: "🎯" },
    { t: "Broker Ranking", d: "Ranking broker & saham favoritnya.", i: "🏦" },
    { t: "Index & Sector", d: "IHSG, LQ45, IDX30 & sektor unggulan.", i: "📊" },
    { t: "Fundamental & Screener", d: "EPS, PER, PBV, ROE, DY + filter undervalue.", i: "📚" },
    { t: "Teknikal & Pola", d: "RSI, MACD, MA, volume, candlestick.", i: "📉" },
    { t: "Sentimen AI", d: "Berita & X (Twitter) → Positif/Netral/Negatif.", i: "🤖" },
  ];

  // ======================
  //  Modal Zoomable Images
  // ======================
  const [selectedImg, setSelectedImg] = useState(null);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [start, setStart] = useState({ x: 0, y: 0 });

  const MIN_SCALE = 0.2;
  const MAX_SCALE = 5;
  const ZOOM_STEP = 0.2;

  const openImage = (img) => {
    setSelectedImg(img);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  const closeImage = () => {
    setSelectedImg(null);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, s + ZOOM_STEP));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, s - ZOOM_STEP));

  // drag to pan when zoomed in
  const onMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const onMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({ x: e.clientX - start.x, y: e.clientY - start.y });
  };
  const onMouseUp = () => setIsDragging(false);

  // Wheel zoom (optional, buttons remain the primary control)
  const onWheel = (e) => {
    if (!selectedImg) return;
    e.preventDefault();
    if (e.deltaY < 0) setScale((s) => Math.min(MAX_SCALE, +(s + ZOOM_STEP).toFixed(3)));
    else setScale((s) => Math.max(MIN_SCALE, +(s - ZOOM_STEP).toFixed(3)));
  };

  // ESC to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeImage();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImg]);

  // Reusable zoomable <img>
  const ZoomableImage = ({ src, alt, className }) => (
    <img
      src={src}
      alt={alt}
      className={`${className || ""} cursor-pointer`}
      onClick={() => openImage(src)}
      loading="lazy"
    />
  );

  return (
    <div className="bg-gradient-to-b from-green-50 via-yellow-50 to-red-50">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium bg-white shadow">
          <span className="text-green-600">{t("landing.hero.badge")}</span>
        </div>
        <h1 className="mt-6 text-4xl sm:text-5xl font-black tracking-tight text-gray-900">
          {t("landing.hero.title")}
        </h1>
        <p className="mt-4 text-lg text-gray-700 max-w-3xl mx-auto">
          {t("landing.hero.subtitle")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="https://bisnis-it.com/saham" target="_blank" className="px-6 py-3 rounded-xl shadow bg-green-600 text-white hover:bg-green-700 transition">{t("landing.hero.cta.primary")}</Link>
          <Link to="https://bisnis-it.com/fesim" className="px-6 py-3 rounded-xl shadow bg-yellow-500 text-gray-900 hover:bg-yellow-600 transition">{t("landing.hero.cta.secondary")}</Link>
          <a href="https://t.me/Bjb_sinyalbot" target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-xl shadow bg-white border hover:bg-gray-50 transition">{t("landing.hero.cta.telegram")}</a>
        </div>
        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
          <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">{t("landing.hero.trust.stocks")}</span>
          <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">{t("landing.hero.trust.prediction")}</span>
          <span className="px-3 py-1 rounded-full bg-red-100 text-red-700">{t("landing.hero.trust.bandarmology")}</span>
        </div>

        {/* Stock Data Horizontal Cards */}
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <div className="px-4 py-2 rounded-lg bg-green-500 text-white font-bold shadow">
            <span className="text-lg">+1.8%</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-blue-500 text-white font-semibold shadow">
            <span className="text-sm">Signal Log</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-yellow-500 text-gray-900 font-semibold shadow">
            <span className="text-sm">Medium</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-purple-500 text-white font-semibold shadow">
            <span className="text-sm">Accumulation</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold shadow">
            <span className="text-sm">Net Buy</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-cyan-500 text-white font-semibold shadow">
            <span className="text-sm">Foreign Flow</span>
          </div>
        </div>
      </section>

      {/* Produk Unggulan */}
      <section className="bg-yellow-50/70 border-y border-yellow-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-3xl font-extrabold text-yellow-700 text-center">{t("landing.features.title")}</h2>
          <p className="mt-3 text-center text-gray-700 max-w-3xl mx-auto">{t("landing.features.subtitle")}</p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { t: t("landing.features.items.aiPrediction"), d: t("landing.features.items.aiPredictionDesc") },
              { t: t("landing.features.items.technical"), d: t("landing.features.items.technicalDesc") },
              { t: t("landing.features.items.sentiment"), d: t("landing.features.items.sentimentDesc") },
              { t: t("landing.features.items.backtest"), d: t("landing.features.items.backtestDesc") },
            ].map((x, i) => (
              <div key={i} className="p-5 bg-white rounded-2xl shadow border border-yellow-100">
                <div className="font-semibold text-yellow-700">{x.t}</div>
                <p className="mt-2 text-sm text-gray-600">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

       {/* InvestPro Assistant Chrome Extension */}
       <section className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 py-16 px-4">
         <div className="max-w-7xl mx-auto">
           <div className="text-center mb-12">
             <h3 className="text-3xl font-bold text-gray-900 mb-4">📈 InvestPro Assistant - AI-Powered Trading & Investment Tools</h3>
             <p className="text-lg text-gray-700 max-w-3xl mx-auto">A comprehensive Chrome extension for investors and traders, providing AI-powered market analysis for Stocks, Forex, Crypto, and Commodities.</p>
           </div>

           {/* Market Categories */}
           <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
             <h4 className="text-2xl font-bold text-gray-900 mb-6 text-center">🎯 Market Categories</h4>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               <div className="text-center p-4 rounded-xl bg-green-50 border-2 border-green-200 hover:border-green-400 transition">
                 <div className="text-4xl mb-3">📊</div>
                 <div className="font-semibold text-green-700 mb-2">Stocks</div>
                 <div className="text-sm text-gray-600">Equity market analysis (AAPL, TSLA, NVDA, etc.)</div>
               </div>
               <div className="text-center p-4 rounded-xl bg-blue-50 border-2 border-blue-200 hover:border-blue-400 transition">
                 <div className="text-4xl mb-3">💱</div>
                 <div className="font-semibold text-blue-700 mb-2">Forex</div>
                 <div className="text-sm text-gray-600">Currency pair analysis (EUR/USD, GBP/USD, etc.)</div>
               </div>
               <div className="text-center p-4 rounded-xl bg-purple-50 border-2 border-purple-200 hover:border-purple-400 transition">
                 <div className="text-4xl mb-3">₿</div>
                 <div className="font-semibold text-purple-700 mb-2">Crypto</div>
                 <div className="text-sm text-gray-600">Digital asset analysis (BTC, ETH, SOL, etc.)</div>
               </div>
               <div className="text-center p-4 rounded-xl bg-yellow-50 border-2 border-yellow-200 hover:border-yellow-400 transition">
                 <div className="text-4xl mb-3">🪙</div>
                 <div className="font-semibold text-yellow-700 mb-2">Commodities</div>
                 <div className="text-sm text-gray-600">Gold, Oil, Natural Gas, and more</div>
               </div>
             </div>
           </div>

           {/* Analysis Types */}
           <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
             <h4 className="text-2xl font-bold text-gray-900 mb-6 text-center">🔍 Analysis Types</h4>
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               {/* Technical Analysis */}
               <div className="p-6 rounded-xl bg-gradient-to-b from-blue-50 to-blue-100">
                 <h5 className="text-xl font-semibold text-blue-800 mb-4">📉 Technical Analysis</h5>
                 <ul className="space-y-2 text-sm text-gray-700">
                   <li>• Trend Analysis - Support/Resistance, Trendlines</li>
                   <li>• Indicators - RSI, MACD, Moving Averages, Bollinger Bands</li>
                   <li>• Chart Patterns - Head & Shoulders, Triangles, Wedges</li>
                   <li>• Candlestick Patterns - Doji, Hammer, Engulfing</li>
                   <li>• Fibonacci - Retracement & Extension levels</li>
                   <li>• Volume Analysis - OBV, Volume Profile</li>
                 </ul>
               </div>
               {/* Fundamental Analysis */}
               <div className="p-6 rounded-xl bg-gradient-to-b from-green-50 to-green-100">
                 <h5 className="text-xl font-semibold text-green-800 mb-4">📋 Fundamental Analysis</h5>
                 <ul className="space-y-2 text-sm text-gray-700">
                   <li>• Financials - Revenue, Earnings, P/E Ratio</li>
                   <li>• Valuation - DCF, Intrinsic Value</li>
                   <li>• Economic Data - GDP, Inflation, Interest Rates</li>
                   <li>• Market Sentiment - Fear & Greed Index</li>
                   <li>• Ownership - Insider Trading, Institutional Holdings</li>
                   <li>• Competitive Analysis - SWOT, Industry Comparison</li>
                 </ul>
               </div>
               {/* News Analysis */}
               <div className="p-6 rounded-xl bg-gradient-to-b from-purple-50 to-purple-100">
                 <h5 className="text-xl font-semibold text-purple-800 mb-4">📰 News Analysis</h5>
                 <ul className="space-y-2 text-sm text-gray-700">
                   <li>• Breaking News - Market-moving events</li>
                   <li>• Earnings Reports - Quarterly results analysis</li>
                   <li>• Regulatory Updates - Policy & legal developments</li>
                   <li>• Macro Events - Global economic events</li>
                 </ul>
               </div>
             </div>
           </div>

           {/* Customization Options */}
           <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
             <h4 className="text-2xl font-bold text-gray-900 mb-6 text-center">🎛️ Customization Options</h4>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                 <div className="font-semibold text-gray-800 mb-2">Timeframes</div>
                 <div className="text-sm text-gray-600">1M, 5M, 15M, 1H, 4H, 1D, 1W, 1M</div>
               </div>
               <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                 <div className="font-semibold text-gray-800 mb-2">Risk Profiles</div>
                 <div className="text-sm text-gray-600">Conservative, Moderate, Aggressive</div>
               </div>
               <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                 <div className="font-semibold text-gray-800 mb-2">Analysis Depth</div>
                 <div className="text-sm text-gray-600">Quick Overview to Comprehensive Deep Dive</div>
               </div>
               <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                 <div className="font-semibold text-gray-800 mb-2">Output Languages</div>
                 <div className="text-sm text-gray-600">English, Indonesian, Mandarin, Japanese, Spanish, Arabic</div>
               </div>
             </div>
           </div>

           {/* Additional Features */}
           <div className="bg-white rounded-2xl shadow-lg p-8">
             <h4 className="text-2xl font-bold text-gray-900 mb-6 text-center">📊 Additional Features</h4>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               <div className="text-center p-4 rounded-xl bg-yellow-50 border-2 border-yellow-200">
                 <div className="text-3xl mb-2">📍</div>
                 <div className="font-semibold text-yellow-700 mb-1">Entry/Exit Points</div>
                 <div className="text-sm text-gray-600">Specific price levels</div>
               </div>
               <div className="text-center p-4 rounded-xl bg-red-50 border-2 border-red-200">
                 <div className="text-3xl mb-2">🛡️</div>
                 <div className="font-semibold text-red-700 mb-1">Stop Loss/Take Profit</div>
                 <div className="text-sm text-gray-600">Risk management levels</div>
               </div>
               <div className="text-center p-4 rounded-xl bg-green-50 border-2 border-green-200">
                 <div className="text-3xl mb-2">📈</div>
                 <div className="font-semibold text-green-700 mb-1">Risk/Reward Ratio</div>
                 <div className="text-sm text-gray-600">Trade evaluation</div>
               </div>
               <div className="text-center p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
                 <div className="text-3xl mb-2">📏</div>
                 <div className="font-semibold text-blue-700 mb-1">Position Sizing</div>
                 <div className="text-sm text-gray-600">Based on risk profile</div>
               </div>
             </div>
           </div>
         </div>
       </section>

        {/* AIScore Saham IDX Direct */}
        <section className="bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 py-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h3 className="text-3xl font-bold text-gray-900 mb-4">🎯 AIScore Saham IDX Direct</h3>
              <p className="text-lg text-gray-700 max-w-3xl mx-auto">Platform analisis AI khusus saham Indonesia dengan data real-time dari IDX Direct. Dapatkan skor analitis, prediksi, dan rekomendasi saham secara instan.</p>
            </div>

            {/* Feature Cards */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
              <h4 className="text-2xl font-bold text-gray-900 mb-6 text-center">⚡ Fitur Utama AIScore Saham</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="text-center p-4 rounded-xl bg-green-50 border-2 border-green-200 hover:border-green-400 transition">
                  <div className="text-4xl mb-3">🤖</div>
                  <div className="font-semibold text-green-700 mb-2">AI Scoring</div>
                  <div className="text-sm text-gray-600">Skor analitis berbasis Machine Learning untuk setiap saham</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-blue-50 border-2 border-blue-200 hover:border-blue-400 transition">
                  <div className="text-4xl mb-3">📊</div>
                  <div className="font-semibold text-blue-700 mb-2">Data IDX Direct</div>
                  <div className="text-sm text-gray-600">Data real-time dan historis dari bursa Indonesia</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-purple-50 border-2 border-purple-200 hover:border-purple-400 transition">
                  <div className="text-4xl mb-3">🎯</div>
                  <div className="font-semibold text-purple-700 mb-2">Rekomendasi Saham</div>
                  <div className="text-sm text-gray-600">Saran beli/jual/tahan berdasarkan analisis mendalam</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-yellow-50 border-2 border-yellow-200 hover:border-yellow-400 transition">
                  <div className="text-4xl mb-3">📈</div>
                  <div className="font-semibold text-yellow-700 mb-2">Teknikal</div>
                  <div className="text-sm text-gray-600">Indikator teknikal lengkap dan pattern recognition</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-red-50 border-2 border-red-200 hover:border-red-400 transition">
                  <div className="text-4xl mb-3">📋</div>
                  <div className="font-semibold text-red-700 mb-2">Fundamental</div>
                  <div className="text-sm text-gray-600">Analisis laporan keuangan dan valuasi saham</div>
                </div>
                <div className="text-center p-4 rounded-xl bg-cyan-50 border-2 border-cyan-200 hover:border-cyan-400 transition">
                  <div className="text-4xl mb-3">⚡</div>
                  <div className="font-semibold text-cyan-700 mb-2">Cepat & Akurat</div>
                  <div className="text-sm text-gray-600">Hasil analisis dalam hitungan detik</div>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="text-center">
              <a 
                href="https://saham.mytriv.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-500 text-white font-semibold rounded-xl shadow-lg hover:opacity-90 transition text-lg"
              >
                🚀 Buka AIScore Saham 
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </a>
              <p className="mt-4 text-sm text-gray-600">Buka di tab baru • Gratis akses sementara</p>
            </div>
          </div>
        </section>

       {/* Metode Analisis AI */}
       <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
         <h3 className="text-2xl font-bold text-center text-gray-900">Metode Analisis & Prediksi</h3>
         <p className="text-center text-gray-600 mt-2">Dari indikator klasik hingga Deep Learning — semuanya dalam satu platform.</p>
         <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
           {aiMethods.map((m, i) => (
             <div key={i} className={`p-5 bg-white rounded-xl shadow border ${m.c}`}>
               <div className="font-semibold">{m.t}</div>
               <p className="mt-2 text-sm text-gray-600">{m.d}</p>
             </div>
           ))}
         </div>
       </section>

      {/* Sentimen & Sample Viz */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
        <div className="rounded-2xl p-6 bg-gradient-to-r from-red-50 via-yellow-50 to-green-50 border">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="md:w-1/2">
              <h3 className="text-xl font-bold text-gray-900">Analisis Sentimen Real-time</h3>
              <p className="mt-2 text-sm text-gray-700">Ambil 50 tweet terakhir, nilai dengan NLP → label Positif / Netral / Negatif. Pantau perubahan sentimen untuk timing entry/exit.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">Positif</span>
                <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">Netral</span>
                <span className="px-3 py-1 rounded-full bg-red-100 text-red-700">Negatif</span>
              </div>
            </div>
            {/* Simple sentiment bars (no external lib) */}
            <div className="md:w-1/2 w-full">
              <div className="space-y-3">
                {[{l:"Positif", c:"bg-green-500", w:"70%"},{l:"Netral", c:"bg-yellow-500", w:"20%"},{l:"Negatif", c:"bg-red-500", w:"10%"}].map((s, i) => (
                  <div key={i} className="w-full">
                    <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{s.l}</span><span>{s.w}</span></div>
                    <div className="h-3 bg-white rounded-full border overflow-hidden"><div className={`h-3 ${s.c}`} style={{width: s.w}} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fitur Bot IDXGPT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <h3 className="text-2xl font-bold text-center text-gray-900">Fitur Bot myTradeX</h3>
        <p className="text-center text-gray-600 mt-2">Semua analisa favorit trader Indonesia — tinggal ketik perintah di Telegram.</p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {botFeatures.map((f, i) => (
            <div key={i} className="p-5 bg-white rounded-xl shadow border hover:shadow-md transition">
              <div className="text-2xl mb-2">{f.i}</div>
              <div className="font-semibold">{f.t}</div>
              <p className="mt-1 text-sm text-gray-600">{f.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <a href="https://t.me/mytradex_bot" target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-xl shadow bg-white border hover:bg-gray-50 transition">Buka Bot Telegram</a>
        </div>
      </section>

      {/* Bandarmology IDX */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-2xl p-6 bg-white shadow border">
          <h3 className="text-2xl font-bold text-gray-900">📊 Bandarmology IDX — Lacak Pergerakan Smart Money</h3>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Akumulasi & Distribusi", desc: "Deteksi kapan bandar besar mulai mengakumulasi atau melepas saham.", color: "text-green-600" },
              { title: "Top Buyer & Seller", desc: "Pantau broker yang paling agresif membeli atau menjual.", color: "text-yellow-600" },
              { title: "Heatmap Saham", desc: "Visualisasi saham yang sedang dikendalikan bandar.", color: "text-red-600" },
            ].map((x, i) => (
              <div key={i} className="p-5 rounded-xl border bg-white">
                <div className={`font-semibold text-lg ${x.color}`}>{x.title}</div>
                <p className="text-sm text-gray-600 mt-2">{x.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/bandarmologi" className="px-6 py-3 bg-red-600 text-white rounded-xl shadow hover:bg-red-700 transition">Lihat Bandarmology IDX</Link>
          </div>
        </div>
      </section>

      {/* Galeri Chart IDXGPT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">📈 Output Grafik myTradeX</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { img: "/public/grf.jpg", alt: "Grafik OHLC" },
            { img: "/public/pgv.png", alt: "Price Graph Diary" },
            { img: "/public/cal.jpg", alt: "Kalender Perubahan Harga" },
            { img: "/public/index.jpg", alt: "Indeks Global" },
            { img: "/public/dbsaham.jpg", alt: "Database Saham" },
            { img: "/public/band.jpg", alt: "Bandarmology Table" },
          ].map((x, i) => (
            <div key={i} className="rounded-xl overflow-hidden shadow-lg border bg-white">
              <ZoomableImage src={x.img} alt={x.alt} className="w-full h-64 object-contain bg-gray-50" />
              <div className="p-3 text-center text-sm text-gray-700">{x.alt}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Simulasi Trading */}
      <section className="bg-green-50 border-t border-green-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Uji Strategi di Akun Virtual</h3>
              <p className="mt-2 text-gray-700">Backtest & forward test strategi Anda tanpa risiko. Mulai dari screening → entry → exit, lihat statistik performa sebelum eksekusi real.</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-700 list-disc list-inside">
                <li>Backtest historis (win rate, profit factor, max drawdown).</li>
                <li>Forward test paper-trade dengan kondisi pasar berjalan.</li>
                <li>Catatan trade journal & evaluasi otomatis.</li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/virtual-sim" className="px-6 py-3 rounded-xl shadow bg-green-600 text-white hover:bg-green-700 transition">Mulai Simulasi</Link>
                <Link to="/plans" className="px-6 py-3 rounded-xl shadow bg-white border hover:bg-gray-50 transition">Lihat Paket</Link>
              </div>
            </div>
            {/* Simple KPI cards */}
            <div className="grid grid-cols-2 gap-4">
              {[{l:"Win Rate (demo)",v:"64%",c:"bg-green-100 text-green-800"},{l:"Profit Factor",v:"1.8",c:"bg-yellow-100 text-yellow-800"},{l:"Max DD",v:"-7.5%",c:"bg-red-100 text-red-800"},{l:"Trades",v:"124",c:"bg-white text-gray-800 border"}].map((k,i)=> (
                <div key={i} className={`p-5 rounded-xl shadow ${k.c} ${k.c.includes('border')? 'border' : ''}`}>
                  <div className="text-sm">{k.l}</div>
                  <div className="mt-1 text-2xl font-extrabold">{k.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <h3 className="text-2xl font-bold mb-6 text-center text-gray-900">❓ Frequently Asked Questions</h3>
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <div key={i} className="p-5 border rounded-xl bg-white shadow-sm">
              <div className="font-semibold">{f.q}</div>
              <div className="text-sm text-gray-600 mt-1">{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      {/* WOW Factor Section */}
      <section className="bg-gradient-to-r from-green-100 via-yellow-100 to-red-100 py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">🚀 Strategi Quant Eksklusif – Hasil Backtest</h2>
          <p className="text-gray-700 max-w-3xl mx-auto mb-10">
            Kami menggabungkan <span className="font-semibold">AI</span> +
            <span className="font-semibold"> Quantitative Trading ala Jim Simons </span>
            untuk menghasilkan strategi semi-HFT. Berikut hasil backtest salah satu strategi tim kami pada saham IDX sejak 2010.
            Konsisten, stabil, dan luar biasa!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <ZoomableImage src="/equity_account1_2010-01-01_to_2014-12-31.png" alt="Backtest 2010-2014" className="rounded" />
            <p className="mt-2 text-sm text-gray-600">Equity Curve 2010–2014</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ZoomableImage src="/equity_account1_2015-01-01_to_2019-12-31.png" alt="Backtest 2015-2019" className="rounded" />
            <p className="mt-2 text-sm text-gray-600">Equity Curve 2015–2019</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ZoomableImage src="/equity_account1_2020-01-01_to_2023-12-31.png" alt="Backtest 2020-2023" className="rounded" />
            <p className="mt-2 text-sm text-gray-600">Equity Curve 2020–2023</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ZoomableImage src="/equity_account1_2024-01-01_to_2025-08-25.png" alt="Backtest 2024-2025" className="rounded" />
            <p className="mt-2 text-sm text-gray-600">Equity Curve 2024–2025</p>
          </div>
        </div>
      </section>

      {/* WOW Factor Section 2 */}
      <section className="bg-gradient-to-r from-green-100 via-yellow-100 to-red-100 py-16 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <ZoomableImage src="/equity_account2_2010-01-01_to_2014-12-31.png" alt="Backtest 2010-2014" className="rounded" />
            <p className="mt-2 text-sm text-gray-600">Equity Curve 2010–2014</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ZoomableImage src="/equity_account2_2015-01-01_to_2019-12-31.png" alt="Backtest 2015-2019" className="rounded" />
            <p className="mt-2 text-sm text-gray-600">Equity Curve 2015–2019</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ZoomableImage src="/equity_account2_2020-01-01_to_2023-12-31.png" alt="Backtest 2020-2023" className="rounded" />
            <p className="mt-2 text-sm text-gray-600">Equity Curve 2020–2023</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ZoomableImage src="/equity_account2_2024-01-01_to_2025-08-25.png" alt="Backtest 2024-2025" className="rounded" />
            <p className="mt-2 text-sm text-gray-600">Equity Curve 2024–2025</p>
          </div>
        </div>
      </section>

      {/* WOW Factor Section 3 */}
      <section className="bg-gradient-to-r from-green-100 via-yellow-100 to-red-100 py-16 px-4">
        <div className="max-w-6xl mx-auto text-center"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-4">
            <ZoomableImage src="/equity_account3_2010-01-01_to_2014-12-31.png" alt="Backtest 2010-2014" className="rounded" />
            <p className="mt-2 text-sm text-gray-600">Equity Curve 2010–2014</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ZoomableImage src="/equity_account3_2015-01-01_to_2019-12-31.png" alt="Backtest 2015-2019" className="rounded" />
            <p className="mt-2 text-sm text-gray-600">Equity Curve 2015–2019</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ZoomableImage src="/equity_account3_2020-01-01_to_2023-12-31.png" alt="Backtest 2020-2023" className="rounded" />
            <p className="mt-2 text-sm text-gray-600">Equity Curve 2020–2023</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <ZoomableImage src="/equity_account3_2024-01-01_to_2025-08-25.png" alt="Backtest 2024-2025" className="rounded" />
            <p className="mt-2 text-sm text-gray-600">Equity Curve 2024–2025</p>
          </div>
        </div>

        {/* WOW Faktor - Backtest Summary */}
        <section className="max-w-6xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">📊 Hasil Backtest Strategi Quant myTradeX</h2>
          <p className="text-center text-gray-600 max-w-3xl mx-auto mb-8">
            Menggunakan pendekatan ala <span className="font-semibold">Jim Simons Medallion Fund</span>,
            strategi kami diuji sejak 2010 hingga 2025. Hasil backtest menunjukkan performa konsisten
            dengan return tahunan yang stabil, profit factor positif, dan drawdown terkontrol.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-xl shadow">
              <thead className="bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Periode</th>
                  <th className="px-4 py-3 text-center">Jumlah Trade</th>
                  <th className="px-4 py-3 text-center">Return Tahunan</th>
                  <th className="px-4 py-3 text-center">Profit Factor</th>
                  <th className="px-4 py-3 text-center">Max DD</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { period: "2010–2014", trades: "12,345", yearly: "78%", pf: "1.85", dd: "-12%" },
                  { period: "2015–2019", trades: "15,678", yearly: "71%", pf: "2.10", dd: "-9%" },
                  { period: "2020–2023", trades: "10,234", yearly: "64%", pf: "1.75", dd: "-11%" },
                  { period: "2024–2025", trades: "4,567", yearly: "69%", pf: "2.25", dd: "-7%" },
                ].map((row, i) => (
                  <tr key={i} className="border-t text-gray-700">
                    <td className="px-4 py-3 font-semibold">{row.period}</td>
                    <td className="px-4 py-3 text-center">{row.trades}</td>
                    <td className="px-4 py-3 text-center text-green-600">{row.yearly}</td>
                    <td className="px-4 py-3 text-center">{row.pf}</td>
                    <td className="px-4 py-3 text-center text-red-600">{row.dd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-10 text-center">
            <a href="https://t.me/mytradex_bot" target="_blank" rel="noopener noreferrer" className="px-8 py-3 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 text-white font-semibold rounded-lg shadow hover:opacity-90 transition">
              🚀 Gabung Group VIP & Pelajari Strategi Kami
            </a>
          </div>
        </section>

          <button onClick={() => (window.location.href = '/plans')} className="mt-10 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow text-lg font-semibold">
          Gabung Group VIP myTradeX & Pelajari Strateginya
        </button>
      </section>

{/* Footer */}
<footer className="border-t bg-gray-50">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
    {/* Brand */}
    <div>
      <h3 className="text-xl font-bold text-gray-900">myTradeX</h3>
      <p className="mt-2 text-sm text-gray-600">
        Platform AI Trading Indonesia — analisa fundamental, teknikal, sentimen, dan bandarmologi dalam satu aplikasi.
      </p>
    </div>

    {/* Navigation */}
    <div>
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Navigasi</h4>
      <ul className="space-y-2 text-sm">
        <li><Link to="/about" className="text-gray-600 hover:text-gray-900">Tentang Kami</Link></li>
        <li><Link to="/faq" className="text-gray-600 hover:text-gray-900">FAQ</Link></li>
        <li><Link to="/plans" className="text-gray-600 hover:text-gray-900">Paket & Harga</Link></li>
        <li><Link to="/blog" className="text-gray-600 hover:text-gray-900">Blog</Link></li>
      </ul>
    </div>

    {/* Legal */}
    <div>
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Legal</h4>
      <ul className="space-y-2 text-sm">
        <li><Link to="/privacy" className="text-gray-600 hover:text-gray-900">Privacy Policy</Link></li>
        <li><Link to="/terms" className="text-gray-600 hover:text-gray-900">Terms & Conditions</Link></li>
      </ul>
    </div>

{/* Apps */}
<div>
  <h4 className="text-sm font-semibold text-gray-900 mb-3">Aplikasi</h4>
  <div className="flex flex-col gap-3">
    <a
      href="#"
      className="w-36"
      title="Google Play (Under Development)"
    >
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
        alt="Google Play"
        className="w-full"
      />
    </a>
    <a
      href="#"
      className="w-36"
      title="App Store (Under Development)"
    >
      <img
        src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
        alt="App Store"
        className="w-full"
      />
    </a>
  </div>
</div>
</div>

  {/* Bottom Bar */}
  <div className="border-t mt-8 py-6 text-center text-sm text-gray-500">

  </div>
</footer>


      {/* Global Image Modal */}
      {selectedImg && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onWheel={onWheel}
          onClick={closeImage}
        >
          <div className="relative max-w-[95vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div
              className={`overflow-hidden rounded-xl select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              onMouseDown={onMouseDown}
            >
              <img
                src={selectedImg}
                alt="Preview"
                className="max-h-[90vh] max-w-[95vw] block transition-transform duration-150"
                style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
                draggable={false}
              />
            </div>
            {/* Controls */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <button onClick={zoomOut} className="px-3 py-2 bg-white/90 rounded-full shadow hover:bg-white" aria-label="Zoom out">−</button>
              <button onClick={zoomIn} className="px-3 py-2 bg-white/90 rounded-full shadow hover:bg-white" aria-label="Zoom in">+</button>
              <button onClick={closeImage} className="px-3 py-2 bg-red-600 text-white rounded-full shadow hover:bg-red-700" aria-label="Close">×</button>
            </div>
            {/* Scale indicator */}
            <div className="absolute bottom-3 right-3 text-xs bg-black/60 text-white px-2 py-1 rounded">
              {Math.round(scale * 100)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
