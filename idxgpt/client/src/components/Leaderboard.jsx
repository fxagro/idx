import React, { useState, useEffect } from "react";
import api from "../utils/api";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await api.get("/portfolio/leaderboard?limit=10");
      setLeaderboard(response.data.leaderboard);
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading leaderboard...</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-semibold text-xl mb-4">🏆 Leaderboard</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Rank</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">User</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Portfolio Value</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Balance</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Holdings Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leaderboard.map((user, index) => (
              <tr key={index} className={index === 0 ? "bg-yellow-50" : ""}>
                <td className="px-4 py-2 text-sm font-bold #{index === 0 ? 'text-yellow-600' : 'text-gray-900'}">
                  #{user.rank}
                </td>
                <td className="px-4 py-2 text-sm text-gray-900">{user.email}</td>
                <td className="px-4 py-2 text-sm font-medium text-green-600">Rp {user.portfolioValue.toLocaleString("id-ID")}</td>
                <td className="px-4 py-2 text-sm text-gray-900">Rp {user.balance.toLocaleString("id-ID")}</td>
                <td className="px-4 py-2 text-sm text-blue-600">Rp {user.holdingsValue.toLocaleString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {leaderboard.length === 0 && (
        <p className="text-gray-500 text-center mt-4">No leaderboard data available.</p>
      )}
    </div>
  );
}