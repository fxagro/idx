import React from "react";
import { useNavigate } from "react-router-dom";

export default function Pricing() {
  const navigate = useNavigate();
  const plans = [
    { id: "1m", label: "1 Bulan", price: 50000 },
    { id: "3m", label: "3 Bulan", price: 135000 },
    { id: "6m", label: "6 Bulan", price: 240000 },
    { id: "12m", label: "1 Tahun", price: 420000 }
  ];

  const subscribe = async (plan) => {
    const token = localStorage.getItem("token");
    const res = await fetch("http://localhost:5000/api/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ plan })
    });
    const data = await res.json();
    alert(data.message || "Berhasil!");
    navigate("/dashboard");
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Paket Langganan</h2>
      <div className="grid grid-cols-2 gap-4">
        {plans.map(p => (
          <div key={p.id} className="border p-4 rounded-lg shadow">
            <h3 className="font-bold">{p.label}</h3>
            <p className="text-lg">Rp {p.price.toLocaleString()}</p>
            <button
              onClick={() => subscribe(p.id)}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Langganan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}