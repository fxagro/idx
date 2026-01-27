import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    api
      .get("/plans")
      .then((r) => setPlans(r.data))
      .catch(() => {});
  }, []);

  const categories = [
    {
      id: "basic",
      name: "Basic",
      price: 50000,
      desc: "Cocok untuk pemula yang ingin mencoba analisa AI.",
      perks: [
        "Akses AI Prediksi Saham IDX & US",
        "Masuk group umum IDXGPT",
      ],
      color: "border-green-500",
    },
    {
      id: "advance",
      name: "Advance",
      price: 300000,
      desc: "Untuk trader serius yang butuh layanan lengkap + mentoring.",
      perks: [
        "Semua fitur IDXGPT (AI, Sentimen, Bandarmology, Screener, dsb.)",
        "Masuk group umum IDXGPT",
        "Trading bareng langsung dengan ahli",
        "Group VIP + konsultasi langsung AI & ML",
        "Bersama membangun strategi trading otomatis (bot)",
      ],
      color: "border-yellow-500",
      highlight: true,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <h2 className="text-3xl font-bold mb-10 text-center">📦 Paket Langganan</h2>

      {/* Kategori (Basic & Advance) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {categories.map((c) => (
          <div
            key={c.id}
            className={`relative bg-white rounded-2xl shadow-lg border-2 ${c.color} flex flex-col`}
          >
            {c.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-gray-900 text-xs font-bold px-3 py-1 rounded-full shadow">
                Paling Populer
              </div>
            )}
            <div className="p-6 flex-1 flex flex-col">
              <h3 className="text-xl font-semibold text-gray-900">{c.name}</h3>
              <p className="mt-2 text-gray-600 text-sm">{c.desc}</p>
              <div className="mt-4 text-3xl font-extrabold text-gray-900">
                Rp {c.price.toLocaleString("id-ID")}{" "}
                <span className="text-base font-normal">/bulan</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm text-gray-700 flex-1">
                {c.perks.map((perk, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-600 mt-0.5" />
                    {perk}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => nav("/checkout?planId=" + c.id)}
                className={`mt-6 w-full rounded-lg px-4 py-2 font-medium text-white ${
                  c.highlight
                    ? "bg-yellow-500 hover:bg-yellow-600"
                    : "bg-green-600 hover:bg-green-700"
                } transition`}
              >
                Pilih Paket
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Paket Durasi */}
      <h3 className="text-2xl font-bold mb-6 text-center">
        Paket Berdasarkan Durasi
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {plans.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-xl shadow p-6 flex flex-col border hover:shadow-md transition"
          >
            <div className="text-xl font-semibold">{p.name}</div>
            <div className="mt-2 text-gray-600">{p.months} bulan</div>
            <div className="mt-4 text-2xl font-bold">
              Rp {p.price.toLocaleString("id-ID")}
            </div>
            {p.discountPct > 0 && (
              <div className="text-green-600 text-sm mt-1">
                Diskon {p.discountPct}%
              </div>
            )}
            <div className="text-sm text-gray-500 mt-2">
              Kuota API: {p.quota} panggilan
            </div>
            <button
              onClick={() => nav("/checkout?planId=" + p.id)}
              className="mt-auto bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-700 transition"
            >
              Pilih Paket
            </button>
          </div>
        ))}
      </div>

{/* Investor Club Eksklusif */}
<section className="mt-20 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white rounded-2xl shadow-2xl p-10 border-4 border-green-400">
  <h3 className="text-3xl font-bold text-center mb-6">💎 Investor Club</h3>
  <p className="text-center text-gray-300 max-w-3xl mx-auto mb-8">
    Eksklusif untuk pemilik dana <span className="font-semibold">≥ Rp1 Miliar</span>. 
    Bergabung dalam <span className="font-semibold">Investor Club IDXGPT</span> untuk membangun 
    <span className="text-green-400"> Hedge Fund</span> ala Medallion Fund. 
    Bersama kita mendirikan perusahaan efek & mengelola bisnis offline maupun online secara profesional.
  </p>

  {/* Benefit Investor Club */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
    <ul className="space-y-3">
      <li>🏦 Kerjasama membangun perusahaan Hedge Fund</li>
      <li>📑 Persiapan pendirian Perusahaan Efek</li>
      <li>🌍 Bisnis Online & Offline untuk pengelolaan dana</li>
    </ul>
    <ul className="space-y-3">
      <li>🤝 Partnership eksklusif dengan tim Quant</li>
      <li>🔒 Akses Prioritas & Governance Transparan</li>
      <li>🚀 Peluang profit skala institusi</li>
    </ul>
  </div>

  {/* Owner & Track Record */}
  <div className="bg-gray-800 rounded-xl p-6 shadow-inner max-w-5xl mx-auto">
    <h4 className="text-2xl font-bold text-green-400 mb-4">👤 Owner & Track Record</h4>
    <p className="text-gray-300 mb-3">
      Founder dan owner dari platform ini memiliki pengalaman lebih dari 
      <span className="font-semibold text-white"> 20 tahun</span> di bidang 
      <span className="font-semibold text-white"> Financial</span> dan 
      <span className="font-semibold text-white"> IT</span>.
    </p>
    <ul className="list-disc list-inside space-y-2 text-gray-300">
      <li>Berpengalaman bekerja di <span className="text-white font-medium">Perusahaan Efek</span> di Indonesia.</li>
      <li>Pemegang Sertifikasi TOGAF dan WPPE.</li>
      <li>Founder <a href="https://mytriv.com" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">mytriv.com</a> – aggregator & OTA global.</li>
      <li>Founder <a href="https://mytriv.net" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">mytriv.net</a> – perusahaan IT & developer ERP.</li>
      <li>Founder <a href="https://hepsia.biz" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">hepsia.biz</a> – perusahaan Cloud Hosting & Domain.</li>
      <li>Founder <a href="https://bisnis-it.com" target="_blank" rel="noopener noreferrer" className="text-green-400 underline">bisnis-it.com</a> – Blog Edukasi IT dan Bisnis.</li>
    </ul>
  </div>

  {/* CTA */}
  <div className="text-center">
    <a
      href="https://t.me/idxgpt_vip"
      target="_blank"
      rel="noopener noreferrer"
      className="px-8 py-3 bg-gradient-to-r from-green-500 via-yellow-400 to-red-500 text-white font-bold rounded-lg shadow hover:opacity-90 transition"
    >
      Bergabung Investor Club 💎
    </a>
    <p className="mt-3 text-xs text-gray-400">
      *Undangan khusus – hubungi tim untuk detail kerjasama.
    </p>
  </div>
</section>

    </div>
  );
}
