import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Zap, Star, ShieldCheck } from "lucide-react";

const PLAN_ICONS = {
  free: <Zap className="w-6 h-6" />,
  basic: <Star className="w-6 h-6" />,
  lifetime: <ShieldCheck className="w-6 h-6" />,
};

const PLAN_COLORS = {
  free: {
    border: "border-gray-300",
    badge: "bg-gray-100 text-gray-800",
    icon: "text-gray-500",
    btn: "bg-gray-700 hover:bg-gray-800",
    ring: "ring-gray-300",
  },
  basic: {
    border: "border-blue-500",
    badge: "bg-blue-100 text-blue-800",
    icon: "text-blue-500",
    btn: "bg-blue-600 hover:bg-blue-700",
    ring: "ring-blue-300",
  },
  lifetime: {
    border: "border-purple-600",
    badge: "bg-purple-100 text-purple-800",
    icon: "text-purple-600",
    btn: "bg-purple-700 hover:bg-purple-800",
    ring: "ring-purple-300",
  },
};

const DEFAULT_PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "Free",
    benefits: [
      "Akses Telegram",
      "Harga delay data EOD (H-1)",
      "Akses web terbatas"
    ]
  },
  {
    id: "basic",
    name: "Basic",
    price: 60000,
    priceOption3Months: 149000,
    period: "/bulan atau Rp 149.000 / 3 bulan",
    popular: true,
    benefits: [
      "Akses Telegram",
      "BSJP Scanner",
      "Sinyal Trading Harian",
      "Berita IDX",
      "Kalender Event IDX",
      "Notifikasi & Alert",
      "Watchlist",
      "Analisa Mendalam",
      "Early Buy Radar",
      "Export CSV/PDF",
      "Screener Custom",
      "Bandarmology",
      "Peta Jaringan Insider",
      "Orderbook Live",
      "Virtual Trading saldo s/d 1 Miliar"
    ]
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: 500000,
    period: "Sekali Bayar (Lifetime)",
    benefits: [
      "Akses Telegram",
      "Harga Realtime",
      "Akses Web Penuh",
      "Virtual Trading",
      "Semua Fitur Basic + Akses Seumur Hidup"
    ]
  }
];

const MIDTRANS_CLIENT_KEY = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || "Mid-client-GoYgVjSubyFrC4bR";

function loadMidtransScript() {
  return new Promise((resolve) => {
    if (window.snap) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key", MIDTRANS_CLIENT_KEY);
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Plans() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await api.get("/plans");
        const plansData = response.data;
        if (Array.isArray(plansData) && plansData.length > 0) {
          setPlans(plansData);
        } else if (plansData?.plans && Array.isArray(plansData.plans) && plansData.plans.length > 0) {
          setPlans(plansData.plans);
        }
      } catch (error) {
        console.error("Failed to fetch plans, using fallback:", error);
      } finally {
        setLoading(false);
      }
    };
    loadMidtransScript();
    fetchPlans();
  }, []);

  const handlePayment = async (planId) => {
    if (planId === "free") {
      window.open("https://t.me/idxgpt_bot", "_blank");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      nav(`/register?planId=${planId}`);
      return;
    }

    setProcessingId(planId);

    try {
      const plan = plans.find((p) => p.id === planId);
      if (!plan) return;

      const orderRes = await api.post("/plans/order", {
        planId: planId,
        amount: plan.price,
      });

      if (!orderRes.data?.success || !orderRes.data?.order?.id) {
        alert("Gagal membuat pesanan. Silakan coba lagi.");
        setProcessingId(null);
        return;
      }

      const orderId = orderRes.data.order.id;

      const snapRes = await api.post("/payment/create-snap-token", {
        plan_id: planId,
        order_id: orderId,
      });

      if (!snapRes.data?.success) {
        alert("Gagal memproses pembayaran. Silakan coba lagi.");
        setProcessingId(null);
        return;
      }

      if (snapRes.data.is_mock) {
        alert(snapRes.data.message || "Mode demo: Midtrans belum dikonfigurasi.");
        nav("/dashboard");
        setProcessingId(null);
        return;
      }

      window.snap.pay(snapRes.data.token, {
        onSuccess: (result) => {
          nav("/dashboard?payment=success");
        },
        onPending: (result) => {
          nav("/dashboard?payment=pending");
        },
        onError: (result) => {
          alert("Pembayaran gagal. Silakan coba lagi.");
          setProcessingId(null);
        },
        onClose: () => {
          setProcessingId(null);
        },
      });
    } catch (error) {
      console.error("Payment error:", error);
      alert("Terjadi kesalahan. Silakan coba lagi.");
      setProcessingId(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-extrabold text-gray-900 mb-3">
          📦 Paket Langganan
        </h2>
        <p className="text-gray-500 text-lg max-w-xl mx-auto">
          Pilih paket yang paling sesuai dengan kebutuhan trading Anda
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const colors = PLAN_COLORS[plan.id] || PLAN_COLORS.basic;
          const isPopular = plan.popular || plan.id === "basic";
          const isLoading = processingId === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-md border-2 flex flex-col transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${colors.border} ${
                isPopular ? `ring-2 ${colors.ring}` : ""
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md tracking-wide">
                  TERPOPULER
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`${colors.icon}`}>
                    {PLAN_ICONS[plan.id] || <Zap className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  </div>
                </div>

                <div className="mb-5">
                  <div className="text-3xl font-extrabold text-gray-900">
                    {plan.price === 0 ? "Free" : `Rp ${plan.price.toLocaleString("id-ID")}`}
                  </div>
                  <div className="text-sm text-gray-500 font-medium">
                    {plan.id === "basic" ? (
                      <div>
                        <div>/bulan</div>
                        <div className="text-xs text-blue-600 font-semibold mt-0.5">atau Rp 149.000 / 3 bulan</div>
                      </div>
                    ) : (
                      <div>{plan.period || (plan.price === 0 ? "Free Access" : "/bulan")}</div>
                    )}
                  </div>
                </div>

                <ul className="space-y-2.5 text-sm text-gray-600 flex-1 mb-6">
                  {(plan.benefits || []).map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      <span className="leading-tight">{benefit}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePayment(plan.id)}
                  disabled={isLoading}
                  className={`w-full rounded-xl py-3 text-sm font-semibold text-white shadow transition ${
                    isLoading ? "opacity-50 cursor-not-allowed bg-gray-400" : colors.btn
                  }`}
                >
                  {isLoading ? "Memproses..." : plan.id === "free" ? "Akses Telegram" : "Bayar Sekarang"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-16 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-blue-800 mb-2">Metode Pembayaran</h3>
          <p className="text-sm text-gray-600">Dukungan pembayaran otomatis via QRIS, Bank Transfer (BCA, Mandiri, BNI, BRI), & E-Wallet.</p>
        </div>
      </div>
    </div>
  );
}
