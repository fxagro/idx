import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import AffiliateLink from '../components/affiliate/AffiliateLink';
import AffiliateStats from '../components/affiliate/AffiliateStats';
import AffiliateHistoryTable from '../components/affiliate/AffiliateHistoryTable';
import AffiliateReports from '../components/affiliate/AffiliateReports';

export default function AffiliateDashboard() {
  const [referralLink, setReferralLink] = useState('');

  // Fetch affiliate dashboard data
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['affiliateDashboard'],
    queryFn: async () => {
      const response = await api.get('/affiliate/dashboard');
      return response.data.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
    onSuccess: (data) => {
      if (data.referral_link) {
        setReferralLink(`${window.location.origin}/register?ref=${data.referral_link}`);
      }
    }
  });

  // Generate new referral link
  const handleGenerateLink = async () => {
    try {
      const response = await api.post('/affiliate/generate-link');
      const { referral_link } = response.data;
      setReferralLink(referral_link);
      refetch(); // Refetch dashboard data to update stats
    } catch (error) {
      console.error('Failed to generate referral link:', error);
      alert('Failed to generate referral link. Please try again.');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error loading affiliate dashboard
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error.response?.data?.error || 'An unexpected error occurred'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Affiliate Program</h1>
          <p className="mt-2 text-gray-600">
            Earn commissions by referring new users to our platform. Share your unique referral link and start earning today!
          </p>
        </div>

        {/* Stats Section */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : dashboardData ? (
          <AffiliateStats stats={dashboardData} />
        ) : null}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Referral Link */}
          <div className="lg:col-span-1">
            <AffiliateLink
              referralLink={referralLink}
              onGenerateLink={handleGenerateLink}
            />
          </div>

          {/* Right Column - History */}
          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-4 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </div>
              </div>
            ) : dashboardData ? (
              <>
                <AffiliateHistoryTable
                  history={dashboardData.history}
                  loading={isLoading}
                />
                <AffiliateReports
                  stats={dashboardData}
                  history={dashboardData.history}
                />
              </>
            ) : null}
          </div>
        </div>

        {/* Commission Information */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            How Commissions Work
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <div>
              <h4 className="font-medium mb-1">Level 1 Commissions (40%)</h4>
              <p>Earn 40% commission when someone signs up using your direct referral link.</p>
            </div>
            <div>
              <h4 className="font-medium mb-1">Level 2 Commissions (20%)</h4>
              <p>Earn 20% commission when someone referred by your Level 1 referrals signs up.</p>
            </div>
          </div>
          <div className="mt-4 text-sm text-blue-700">
            <p>
              <strong>Example:</strong> If you refer User A, and User A refers User B:
            </p>
            <ul className="list-disc list-inside mt-1 ml-4">
              <li>You earn 40% commission from User A's subscription</li>
              <li>You earn 20% commission from User B's subscription</li>
              <li>User A earns 40% commission from User B's subscription</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}