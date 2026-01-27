import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { safeArray, safeMap, safeLength, safeGet } from '../utils/safeData';
import {
  Network,
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  User,
  ArrowDown,
  ArrowRight,
  Eye,
  EyeOff
} from 'lucide-react';

const UserNetworkPage = () => {
  const { t } = useTranslation();
  const [showEarnings, setShowEarnings] = useState(true);

  // Fetch user network
  const { data: network, isLoading: networkLoading } = useQuery({
    queryKey: ['user-network'],
    queryFn: () => api.get('/affiliate/network').then(res => res.data),
    refetchInterval: 60000 // Refetch every minute
  });

  // Fetch commission history
  const { data: commissionHistory, isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ['commission-history'],
    queryFn: () => api.get('/affiliate/commissions').then(res => safeArray(res.data)),
    refetchInterval: 60000
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const NetworkNode = ({ user, level = 0 }) => {
    const hasChildren = user.downlines && user.downlines.length > 0;

    return (
      <div className="relative">
        {/* User Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <div className="bg-blue-100 p-1.5 rounded-full flex-shrink-0">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-gray-900 text-sm truncate">{user.username}</h4>
                <p className="text-xs text-gray-500 truncate" title={user.email}>{user.email}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-gray-400">Lv.{level}</span>
                  <span className="text-xs text-gray-400">
                    {formatDate(user.created_at)}
                  </span>
                </div>
              </div>
            </div>

            {showEarnings && (
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-semibold text-green-600">
                  {formatCurrency(user.total_earned)}
                </div>
                <div className="text-xs text-gray-500">Earned</div>
              </div>
            )}
          </div>
        </div>

        {/* Connection Line */}
        {hasChildren && (
          <div className="flex">
            <div className="w-6 flex justify-center">
              <div className="w-px h-3 bg-gray-300"></div>
            </div>
            <div className="flex-1">
              {user.downlines.map((downline, index) => (
                <div key={downline.id} className="relative">
                  {/* Horizontal line for multiple children */}
                  {index > 0 && (
                    <div className="absolute -top-1.5 left-3 w-3 h-px bg-gray-300"></div>
                  )}
                  <NetworkNode user={downline} level={level + 1} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1" role="heading" aria-level="1">{t('network.title')}</h1>
          <p className="text-sm text-gray-600">{t('network.subtitle')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8" role="region" aria-label="Network Statistics">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow-sm border border-blue-200 hover:shadow-lg transition-all duration-300 transform hover:scale-105 cursor-pointer group" role="article" aria-label="Total referrals statistic">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-blue-700 mb-1">{t('network.stats.totalReferrals')}</p>
                <p className="text-2xl font-bold text-blue-900" aria-label={`${network?.total_referrals || 0} total referrals`}>
                  {network?.total_referrals || 0}
                </p>
                <p className="text-xs text-blue-600 mt-1">All time referrals</p>
              </div>
              <div className="bg-blue-600 p-3 rounded-lg group-hover:bg-blue-700 transition-colors">
                <Users className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl shadow-sm border border-green-200 hover:shadow-lg transition-all duration-300 transform hover:scale-105 cursor-pointer group" role="article" aria-label="Direct referrals statistic">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-green-700 mb-1">{t('network.stats.directReferrals')}</p>
                <p className="text-2xl font-bold text-green-900" aria-label={`${network?.direct_referrals || 0} direct referrals`}>
                  {network?.direct_referrals || 0}
                </p>
                <p className="text-xs text-green-600 mt-1">Level 1 referrals</p>
              </div>
              <div className="bg-green-600 p-3 rounded-lg group-hover:bg-green-700 transition-colors">
                <User className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-sm border border-purple-200 hover:shadow-lg transition-all duration-300 transform hover:scale-105 cursor-pointer group" role="article" aria-label="Total earnings statistic">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-purple-700 mb-1">{t('network.stats.totalEarnings')}</p>
                <p className="text-2xl font-bold text-purple-900" aria-label={`Total earnings: ${formatCurrency(network?.total_earned)}`}>
                  {formatCurrency(network?.total_earned)}
                </p>
                <p className="text-xs text-purple-600 mt-1">Lifetime earnings</p>
              </div>
              <div className="bg-purple-600 p-3 rounded-lg group-hover:bg-purple-700 transition-colors">
                <DollarSign className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl shadow-sm border border-orange-200 hover:shadow-lg transition-all duration-300 transform hover:scale-105 cursor-pointer group" role="article" aria-label="Monthly earnings statistic">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-orange-700 mb-1">{t('network.stats.thisMonth')}</p>
                <p className="text-2xl font-bold text-orange-900" aria-label={`Monthly earnings: ${formatCurrency(network?.monthly_earned)}`}>
                  {formatCurrency(network?.monthly_earned)}
                </p>
                <p className="text-xs text-orange-600 mt-1">Current month</p>
              </div>
              <div className="bg-orange-600 p-3 rounded-lg group-hover:bg-orange-700 transition-colors">
                <TrendingUp className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowEarnings(!showEarnings)}
              className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {showEarnings ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="text-sm">
                {showEarnings ? t('network.buttons.hideEarnings') : t('network.buttons.showEarnings')}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Network Tree */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center space-x-2">
                <Network className="h-5 w-5 text-blue-600" />
                <span>{t('network.sections.referralNetwork')}</span>
              </h2>
            </div>
            <div className="p-4">
              {networkLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : network?.downlines?.length > 0 ? (
                <div className="max-h-80 overflow-y-auto">
                  {network.downlines.map((user) => (
                    <NetworkNode key={user.id} user={user} level={1} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">{t('network.emptyStates.noReferrals')}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {t('network.emptyStates.shareReferralLink')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Commission History */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-green-600" />
                <span>{t('network.sections.commissionHistory')}</span>
              </h2>
            </div>
            <div className="p-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : historyError ? (
                <div className="text-center py-12">
                  <div className="text-red-500 mb-3">⚠️</div>
                  <p className="text-red-600 font-medium">Failed to load commission history</p>
                  <p className="text-sm text-red-400 mt-1">Please try again later</p>
                </div>
              ) : safeLength(commissionHistory) > 0 ? (
                <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto">
                  {safeMap(commissionHistory, (commission) => (
                    <div key={safeGet(commission, 'id', Math.random())} className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200 hover:shadow-md transition-all duration-200 transform hover:scale-102">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                        <div className="flex items-center space-x-3">
                          <div className="bg-green-600 p-2 rounded-lg flex-shrink-0">
                            <DollarSign className="h-4 w-4 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 text-sm truncate">
                              {safeGet(commission, 'referral_username', '-')}
                            </p>
                            <p className="text-xs text-gray-600">
                              {safeGet(commission, 'created_at') ? formatDate(commission.created_at) : '-'}
                            </p>
                          </div>
                        </div>

                        <div className="text-center">
                          <p className="text-lg font-bold text-green-600">
                            +{formatCurrency(safeGet(commission, 'amount', 0))}
                          </p>
                          <p className="text-xs text-gray-500">Commission earned</p>
                        </div>

                        <div className="text-right">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-semibold">
                            Level {safeGet(commission, 'level', 1)}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {safeGet(commission, 'level', 1) === 1 ? 'Direct referral' : 'Indirect referral'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No commission history available</p>
                  <p className="text-sm text-gray-400 mt-1">Commissions will appear here once earned</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* How it Works */}
        <div className="mt-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Network className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-blue-900">{t('network.howItWorks.title')}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex items-start space-x-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-lg">1</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-blue-900 text-base mb-2">{t('network.howItWorks.directReferrals.title')}</h4>
                <p className="text-sm text-blue-700 leading-relaxed">
                  {t('network.howItWorks.directReferrals.description')}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-lg">2</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-green-900 text-base mb-2">{t('network.howItWorks.multiLevel.title')}</h4>
                <p className="text-sm text-green-700 leading-relaxed">
                  {t('network.howItWorks.multiLevel.description')}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-lg">3</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-purple-900 text-base mb-2">{t('network.howItWorks.monthlyPayouts.title')}</h4>
                <p className="text-sm text-purple-700 leading-relaxed">
                  {t('network.howItWorks.monthlyPayouts.description')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNetworkPage;