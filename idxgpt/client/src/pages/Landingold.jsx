import React from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  const faqs = [
    {
      q: "Apa itu IDXGPT?",
      a: "IDXGPT adalah platform analisa saham berbasis AI yang menggabungkan data fundamental, teknikal, sentimen, dan prediksi machine learning.",
    },
    {
      q: "Saham apa saja yang didukung?",
      a: "IDXGPT mendukung semua saham di Bursa Efek Indonesia (IDX) serta 1000+ saham Amerika.",
    },
    {
      q: "Bagaimana cara berlangganan?",
      a: "Bulanan, 3 bulan, 6 bulan, atau 1 tahun. Mulai dari Rp50.000/bulan.",
    },
    {
      q: "Apakah bisa diakses lewat Telegram?",
      a: "Ya, terhubung langsung ke bot Telegram untuk analisa cepat dari ponsel.",
    },
  ];

  const aiMethods = [
    { t: "Linear Regression", d: "Prediksi 5 hari, tren (Naik/Turun/Stabil), confidence interval dari volatilitas.", c: "border-green-500" },
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

  return (
    <div className="bg-gradient-to-b from-green-50 via-yellow-50 to-red-50">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium bg-white shadow">
          <span className="text-green-600">AI</span>
          <span className="text-yellow-600">Prediksi</span>
          <span className="text-red-600">Bandarmology</span>
        </div>
        <h1 className="mt-6 text-4xl sm:text-5xl font-black tracking-tight text-gray-900">
          IDXGPT — <span className="text-green-600">AI</span> <span className="text-yellow-600">Saham</span> <span className="text-red-600">Indonesia &</span><span className="text-blue-600"> USA</span>
        </h1>
        <p className="mt-4 text-lg text-gray-700 max-w-3xl mx-auto">
          Prediksi harga saham berbasis <span className="font-semibold">Machine Learning</span>,
          analisa <span className="font-semibold">Teknikal</span>, <span className="font-semibold">Fundamental</span>, & <span className="font-semibold">Sentimen</span>.
          Uji strategi di <span className="font-semibold">akun virtual</span> sebelum masuk pasar.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/ai-predict" className="px-6 py-3 rounded-xl shadow bg-green-600 text-white hover:bg-green-700 transition">Mulai Prediksi AI</Link>
          <Link to="/virtual-sim" className="px-6 py-3 rounded-xl shadow bg-yellow-500 text-gray-900 hover:bg-yellow-600 transition">Coba Trading Virtual</Link>
          <a href="https://t.me/idxgpt_bot" target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-xl shadow bg-white border hover:bg-gray-50 transition">Coba di Telegram</a>
        </div>
        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
          <span className="px-3 py-1 rounded-full bg-green-100 text-green-700">IDX & US Stocks</span>
          <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">Prediksi 5 Hari</span>
          <span className="px-3 py-1 rounded-full bg-red-100 text-red-700">Bandarmology IDX</span>
        </div>
      </section>

      {/* Produk Unggulan */}
      <section className="bg-yellow-50/70 border-y border-yellow-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-3xl font-extrabold text-yellow-700 text-center">Produk Unggulan: Prediksi & Analisis Saham Cerdas</h2>
          <p className="mt-3 text-center text-gray-700 max-w-3xl mx-auto">Gabungkan model ML (XGBoost/ARIMA/LSTM/Random Forest) + teknikal + fundamental + sentimen untuk rekomendasi yang solid.</p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { t: "🔮 Prediksi 5 Hari", d: "Multi-model ML + confidence interval dari volatilitas (GARCH)." },
              { t: "📈 Teknikal Komplit", d: "EMA, MACD, BB, Stochastic, VWAP, Fibonacci, S/R." },
              { t: "📰 Sentimen AI", d: "Berita & X (Twitter) → skor Pos/Net/Neg otomatis." },
              { t: "🧪 Backtest & Forward Test", d: "Uji strategi di akun virtual sebelum real trading." },
            ].map((x, i) => (
              <div key={i} className="p-5 bg-white rounded-2xl shadow border border-yellow-100">
                <div className="font-semibold text-yellow-700">{x.t}</div>
                <p className="mt-2 text-sm text-gray-600">{x.d}</p>
              </div>
            ))}
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
        <h3 className="text-2xl font-bold text-center text-gray-900">Fitur Bot IDXGPT</h3>
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
          <a href="https://t.me/idxgpt_bot" target="_blank" rel="noopener noreferrer" className="px-6 py-3 rounded-xl shadow bg-white border hover:bg-gray-50 transition">Buka Bot Telegram</a>
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
            <Link to="/bandarmology" className="px-6 py-3 bg-red-600 text-white rounded-xl shadow hover:bg-red-700 transition">Lihat Bandarmology IDX</Link>
          </div>
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
<h2 className="text-3xl font-bold text-gray-900 mb-4">
🚀 Strategi Quant Eksklusif – Hasil Backtest Dahsyat
</h2>
<p className="text-gray-700 max-w-3xl mx-auto mb-10">
Kami menggabungkan <span className="font-semibold">AI</span> +
<span className="font-semibold"> Quantitative Trading ala Jim Simons</span>
untuk menghasilkan strategi semi-HFT. Berikut hasil backtest salah satu strategi tim kami pada saham IDX sejak 2010.
Konsisten, stabil, dan luar biasa!
</p>
</div>


<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="bg-white rounded-lg shadow p-4">
<img src="/equity_account1_2010-01-01_to_2014-12-31.png" alt="Backtest 2010-2014" className="rounded" />
<p className="mt-2 text-sm text-gray-600">Equity Curve 2010–2014</p>
</div>
<div className="bg-white rounded-lg shadow p-4">
<img src="/equity_account1_2015-01-01_to_2019-12-31.png" alt="Backtest 2015-2019" className="rounded" />
<p className="mt-2 text-sm text-gray-600">Equity Curve 2015–2019</p>
</div>
<div className="bg-white rounded-lg shadow p-4">
<img src="/equity_account1_2020-01-01_to_2023-12-31.png" alt="Backtest 2020-2023" className="rounded" />
<p className="mt-2 text-sm text-gray-600">Equity Curve 2020–2023</p>
</div>
<div className="bg-white rounded-lg shadow p-4">
<img src="/equity_account1_2024-01-01_to_2025-08-25.png" alt="Backtest 2024-2025" className="rounded" />
<p className="mt-2 text-sm text-gray-600">Equity Curve 2024–2025</p>


</div>
</div>
</section>

      {/* WOW Factor Section */}
      <section className="bg-gradient-to-r from-green-100 via-yellow-100 to-red-100 py-16 px-4">


<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="bg-white rounded-lg shadow p-4">
<img src="/equity_account2_2010-01-01_to_2014-12-31.png" alt="Backtest 2010-2014" className="rounded" />
<p className="mt-2 text-sm text-gray-600">Equity Curve 2010–2014</p>
</div>
<div className="bg-white rounded-lg shadow p-4">
<img src="/equity_account2_2015-01-01_to_2019-12-31.png" alt="Backtest 2015-2019" className="rounded" />
<p className="mt-2 text-sm text-gray-600">Equity Curve 2015–2019</p>
</div>
<div className="bg-white rounded-lg shadow p-4">
<img src="/equity_account2_2020-01-01_to_2023-12-31.png" alt="Backtest 2020-2023" className="rounded" />
<p className="mt-2 text-sm text-gray-600">Equity Curve 2020–2023</p>
</div>
<div className="bg-white rounded-lg shadow p-4">
<img src="/equity_account2_2024-01-01_to_2025-08-25.png" alt="Backtest 2024-2025" className="rounded" />
<p className="mt-2 text-sm text-gray-600">Equity Curve 2024–2025</p>


</div>
</div>

</section>

      {/* WOW Factor Section */}
      <section className="bg-gradient-to-r from-green-100 via-yellow-100 to-red-100 py-16 px-4">
<div className="max-w-6xl mx-auto text-center">


<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<div className="bg-white rounded-lg shadow p-4">
<img src="/equity_account3_2010-01-01_to_2014-12-31.png" alt="Backtest 2010-2014" className="rounded" />
<p className="mt-2 text-sm text-gray-600">Equity Curve 2010–2014</p>
</div>
<div className="bg-white rounded-lg shadow p-4">
<img src="/equity_account3_2015-01-01_to_2019-12-31.png" alt="Backtest 2015-2019" className="rounded" />
<p className="mt-2 text-sm text-gray-600">Equity Curve 2015–2019</p>
</div>
<div className="bg-white rounded-lg shadow p-4">
<img src="/equity_account3_2020-01-01_to_2023-12-31.png" alt="Backtest 2020-2023" className="rounded" />
<p className="mt-2 text-sm text-gray-600">Equity Curve 2020–2023</p>
</div>
<div className="bg-white rounded-lg shadow p-4">
<img src="/equity_account3_2024-01-01_to_2025-08-25.png" alt="Backtest 2024-2025" className="rounded" />
<p className="mt-2 text-sm text-gray-600">Equity Curve 2024–2025</p>


</div>
</div>




{/* WOW Faktor - Backtest Summary */}
<section className="max-w-6xl mx-auto px-4 py-16">
  <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
    📊 Hasil Backtest Strategi Quant IDXGPT
  </h2>
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
          { period: "2010–2014", trades: "12,345", yearly: "78%", pf: "1.85", dd: "-12%",},
          { period: "2015–2019", trades: "15,678", yearly: "71%", pf: "2.10", dd: "-9%",},
          { period: "2020–2023", trades: "10,234", yearly: "64%", pf: "1.75", dd: "-11%",},
          { period: "2024–2025", trades: "4,567", yearly: "69%", pf: "2.25", dd: "-7%",},
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
    <a
      href="https://t.me/idxgpt_vip"
      target="_blank"
      rel="noopener noreferrer"
      className="px-8 py-3 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 text-white font-semibold rounded-lg shadow hover:opacity-90 transition"
    >
      🚀 Gabung Group VIP & Pelajari Strategi Kami
    </a>
  </div>
</section>




<button
onClick={() => window.location.href = '/plans'}
className="mt-10 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow text-lg font-semibold"
>
Gabung Group VIP IDXGPT & Pelajari Strateginya
</button>
</div>
</section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-600">© {new Date().getFullYear()} IDXGPT. All rights reserved.</div>
          <div className="flex gap-4 text-sm">
            <Link to="/privacy" className="text-gray-600 hover:text-gray-900">Privacy</Link>
            <Link to="/terms" className="text-gray-600 hover:text-gray-900">Terms</Link>
            <a href="https://t.me/idxgpt_bot" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900">Telegram</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
