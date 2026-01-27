import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

export default function Plans() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const nav = useNavigate();

  const handlePlanSelection = (planId) => {
    setIsNavigating(true);
    const token = localStorage.getItem('token');
    if (token) {
      // User is authenticated, redirect to dashboard
      nav(`/dashboard?planId=${planId}`);
    } else {
      // User is not authenticated, redirect to register
      nav(`/register?planId=${planId}`);
    }
    // Reset loading state after a short delay
    setTimeout(() => setIsNavigating(false), 1000);
  };

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        console.log("Fetching plans from API...");
        const response = await api.get("/plans");
        console.log("Plans API response:", response);

        // More robust array checking
        const plansData = response.data;
        if (Array.isArray(plansData)) {
          console.log(`Successfully loaded ${plansData.length} plans`);
          setPlans(plansData);
        } else if (plansData && typeof plansData === 'object' && plansData.plans && Array.isArray(plansData.plans)) {
          console.log(`Successfully loaded ${plansData.plans.length} plans from nested object`);
          setPlans(plansData.plans);
        } else {
          console.warn("API response is not an array, setting empty array:", plansData);
          setPlans([]);
        }
      } catch (error) {
        console.error("Failed to fetch plans:", error);
        console.error("Error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        // Set empty array on error to prevent map error
        setPlans([]);
      }
    };

    fetchPlans();
  }, []);

  const categories = [
    {
      id: "basic",
      name: t("plans.categories.basic.name"),
      price: 50000,
      desc: t("plans.categories.basic.description"),
      perks: t("plans.categories.basic.perks", { returnObjects: true }),
      color: "border-green-500",
    },
    {
      id: "advance",
      name: t("plans.categories.advance.name"),
      price: 300000,
      desc: t("plans.categories.advance.description"),
      perks: t("plans.categories.advance.perks", { returnObjects: true }),
      color: "border-yellow-500",
      highlight: true,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <h2 className="text-3xl font-bold mb-10 text-center">{t("plans.title")}</h2>

      {/* Kategori (Basic & Advance) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {categories.map((c) => (
          <div
            key={c.id}
            className={`relative bg-white rounded-2xl shadow-lg border-2 ${c.color} flex flex-col`}
          >
            {c.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-gray-900 text-xs font-bold px-3 py-1 rounded-full shadow">
                {t("plans.categories.advance.popular")}
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
                onClick={() => handlePlanSelection(c.id)}
                disabled={isNavigating}
                className={`mt-6 w-full rounded-lg px-4 py-2 font-medium text-white transition ${
                  isNavigating
                    ? "opacity-50 cursor-not-allowed"
                    : c.highlight
                      ? "bg-yellow-500 hover:bg-yellow-600"
                      : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {isNavigating ? t("plans.buttons.processing") : t("plans.buttons.selectPlan")}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Paket Durasi */}
      <h3 className="text-2xl font-bold mb-6 text-center">
        {t("plans.durationPlans.title")}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        {Array.isArray(plans) && plans.length > 0 ? (
          plans.map((p) => (
            <div
              key={p?.id || Math.random()}
              className="bg-white rounded-xl shadow p-6 flex flex-col border hover:shadow-md transition"
            >
              <div className="text-xl font-semibold">{p?.name || 'Unnamed Plan'}</div>
              <div className="mt-2 text-gray-600">{p?.months || 0} {t("plans.durationPlans.months")}</div>
              <div className="mt-4 text-2xl font-bold">
                Rp {(p?.price || 0).toLocaleString("id-ID")}
              </div>
              {p?.discountPct > 0 && (
                <div className="text-green-600 text-sm mt-1">
                  {t("plans.durationPlans.discount", { percentage: p.discountPct })}
                </div>
              )}
              <div className="text-sm text-gray-500 mt-2">
                {t("plans.durationPlans.quota", { count: p?.quota || 0 })}
              </div>
              <button
                onClick={() => handlePlanSelection(p?.id)}
                disabled={isNavigating}
                className={`mt-auto rounded-lg px-4 py-2 transition ${
                  isNavigating
                    ? "bg-gray-400 cursor-not-allowed text-gray-600"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {isNavigating ? t("plans.buttons.processing") : t("plans.durationPlans.selectPlan")}
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center text-gray-500 py-8">
            {t("plans.durationPlans.noPlans")}
          </div>
        )}
      </div>

{/* Investor Club Eksklusif */}
<section className="mt-20 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white rounded-2xl shadow-2xl p-10 border-4 border-green-400">
  <h3 className="text-3xl font-bold text-center mb-6">{t("plans.investorClub.title")}</h3>
  <p className="text-center text-gray-300 max-w-3xl mx-auto mb-8" dangerouslySetInnerHTML={{ __html: t("plans.investorClub.description") }}>
  </p>

  {/* Benefit Investor Club */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
    <ul className="space-y-3">
      {t("plans.investorClub.benefits.list", { returnObjects: true }).map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
    <ul className="space-y-3">
      {t("plans.investorClub.benefits.list2", { returnObjects: true }).map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  </div>

  {/* Owner & Track Record */}
  <div className="bg-gray-800 rounded-xl p-6 shadow-inner max-w-5xl mx-auto">
    <h4 className="text-2xl font-bold text-green-400 mb-4">{t("plans.investorClub.profile.title")}</h4>
    <p className="text-gray-300 mb-3" dangerouslySetInnerHTML={{ __html: t("plans.investorClub.profile.description") }}>
    </p>
    <ul className="list-disc list-inside space-y-2 text-gray-300">
      {t("plans.investorClub.profile.experience", { returnObjects: true }).map((item, i) => (
        <li key={i} dangerouslySetInnerHTML={{ __html: item }}></li>
      ))}
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
      {t("plans.investorClub.cta")}
    </a>
    <p className="mt-3 text-xs text-gray-400">
      {t("plans.investorClub.note")}
    </p>
  </div>
</section>

    </div>
  );
}
