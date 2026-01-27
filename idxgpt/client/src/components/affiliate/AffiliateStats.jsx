import React from 'react';
import {
  Users,
  DollarSign,
  BarChart3
} from 'lucide-react';

export default function AffiliateStats({ stats }) {
  const statCards = [
    {
      title: 'Total Referrals',
      value: stats.total_referrals.total,
      icon: Users,
      color: 'bg-blue-500',
      description: `${stats.total_referrals.level_1} Level 1, ${stats.total_referrals.level_2} Level 2`
    },
    {
      title: 'Total Commissions',
      value: `$${stats.total_commissions.total.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-green-500',
      description: `Level 1: $${stats.total_commissions.level_1.toFixed(2)}, Level 2: $${stats.total_commissions.level_2.toFixed(2)}`
    },
    {
      title: 'Level 1 Referrals',
      value: stats.total_referrals.level_1,
      icon: Users,
      color: 'bg-purple-500',
      description: 'Direct referrals'
    },
    {
      title: 'Level 2 Referrals',
      value: stats.total_referrals.level_2,
      icon: BarChart3,
      color: 'bg-orange-500',
      description: 'Referrals from your Level 1'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statCards.map((stat, index) => (
        <div key={index} className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
            </div>
            <div className={`${stat.color} p-3 rounded-lg`}>
              <stat.icon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}