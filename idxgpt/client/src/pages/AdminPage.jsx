import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import { toast } from 'react-toastify';
import {
  Users,
  Settings,
  Network,
  Edit3,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Key,
  Hash,
  Wallet
} from 'lucide-react';

const AdminPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('users');
  const [editingUser, setEditingUser] = useState(null);
  const [l1Rate, setL1Rate] = useState(0.40);
  const [l2Rate, setL2Rate] = useState(0.20);
  const [editingPassword, setEditingPassword] = useState(null);
  const [editingReferralCode, setEditingReferralCode] = useState(null);
  const [editingVirtualBalance, setEditingVirtualBalance] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [referralCodeForm, setReferralCodeForm] = useState({ referralCode: '' });
  const [virtualBalanceForm, setVirtualBalanceForm] = useState({ virtualSaldo: 100000000 });
  const queryClient = useQueryClient();

  // Fetch users
  const { data: users, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      console.log('Fetching admin users...');
      try {
        const response = await api.get('/admin/users/affiliate');
        console.log('Fetched users:', response.data);
        return response.data;
      } catch (err) {
        console.error('Fetch users error:', err);
        console.error('Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
        throw err;
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  // Fetch commission settings
  const { data: commissionSettings } = useQuery({
    queryKey: ['commission-settings'],
    queryFn: () => api.get('/affiliate/commission-settings').then(res => res.data.settings),
    onSuccess: (data) => {
      if (data) {
        setL1Rate(data.l0_commission || 0.40);
        setL2Rate(data.l1_commission || 0.40);
      }
    }
  });

  // Update user quota mutation
  const updateQuotaMutation = useMutation({
    mutationFn: ({ userId, aiQuota }) =>
      api.post('/admin/updateQuota', { userId, aiQuota }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success('User quota updated successfully');
      setEditingUser(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update quota');
    }
  });

  // Update commission settings mutation
  const updateCommissionMutation = useMutation({
    mutationFn: ({ l1Rate, l2Rate }) =>
      api.post('/affiliate/commission-settings', { l1Rate, l2Rate }),
    onSuccess: () => {
      queryClient.invalidateQueries(['commission-settings']);
      toast.success('Commission settings updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update commission settings');
    }
  });

  // Update user password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }) =>
      api.post('/admin/updateUser', { userId, newPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success('Password updated successfully');
      setEditingPassword(null);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update password');
    }
  });

  // Update user referral code mutation
  const updateReferralCodeMutation = useMutation({
    mutationFn: ({ userId, referralCode }) =>
      api.post('/admin/updateUser', { userId, referralCode }),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success(`Referral code updated to: ${data.data.user.referral_code}`);
      setEditingReferralCode(null);
      setReferralCodeForm({ referralCode: '' });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update referral code');
    }
  });

  // Update user virtual balance mutation
  const updateVirtualBalanceMutation = useMutation({
    mutationFn: ({ userId, virtualSaldo }) =>
      api.post('/admin/updateVirtualSaldo', { userId, virtualSaldo }),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success(`Virtual balance updated to: ${data.data.user.virtual_saldo.toLocaleString('id-ID')} IDR`);
      setEditingVirtualBalance(null);
      setVirtualBalanceForm({ virtualSaldo: 100000000 });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update virtual balance');
    }
  });

  const handleQuotaUpdate = (userId, newQuota) => {
    if (newQuota < 0) {
      toast.error(t('admin.validation.quotaNegative'));
      return;
    }
    updateQuotaMutation.mutate({ userId, aiQuota: newQuota });
  };

  const handleCommissionUpdate = () => {
    if (l1Rate + l2Rate > 0.60) {
      toast.error(t('admin.validation.commissionExceed'));
      return;
    }
    updateCommissionMutation.mutate({ l1Rate, l2Rate });
  };

  const handlePasswordUpdate = (userId) => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error(t('admin.validation.passwordRequired'));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('admin.validation.passwordMismatch'));
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error(t('admin.validation.passwordMinLength'));
      return;
    }

    updatePasswordMutation.mutate({ userId, newPassword: passwordForm.newPassword });
  };

  const handleReferralCodeUpdate = (userId) => {
    if (!referralCodeForm.referralCode) {
      toast.error(t('admin.validation.referralCodeRequired'));
      return;
    }

    const referralRegex = /^[a-zA-Z0-9_-]{4,20}$/;
    if (!referralRegex.test(referralCodeForm.referralCode)) {
      toast.error(t('admin.validation.referralCodeFormat'));
      return;
    }

    updateReferralCodeMutation.mutate({ userId, referralCode: referralCodeForm.referralCode });
  };

  const handleVirtualBalanceUpdate = (userId) => {
    if (virtualBalanceForm.virtualSaldo < 0) {
      toast.error(t('admin.validation.virtualBalanceNegative'));
      return;
    }

    updateVirtualBalanceMutation.mutate({ userId, virtualSaldo: virtualBalanceForm.virtualSaldo });
  };

  const tabs = [
    { id: 'users', label: t('admin.tabs.userManagement'), icon: Users },
    { id: 'commissions', label: t('admin.tabs.commissionSettings'), icon: Settings },
    { id: 'network', label: t('admin.tabs.networkOverview'), icon: Network }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1" role="heading" aria-level="1">{t('admin.title')}</h1>
          <p className="text-sm text-gray-600">{t('admin.subtitle')}</p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            <div className="flex space-x-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-2 px-3 rounded-md font-medium text-sm flex items-center justify-center space-x-2 transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {activeTab === 'users' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{t('admin.sections.userManagement.title')}</h2>
                <div className="text-sm text-gray-500">
                  {users?.length || 0} {t('admin.sections.userManagement.users')}
                </div>
              </div>
              {usersError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <h3 className="text-sm font-medium text-red-800">Error Loading Users</h3>
                      <p className="text-sm text-red-700 mt-1">
                        {usersError.response?.data?.message || usersError.message || 'Failed to load users'}
                      </p>
                      <p className="text-xs text-red-600 mt-1">
                        Status: {usersError.response?.status || 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading users...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-1 gap-4">
                    {users?.map((user) => (
                      <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          {/* User Info */}
                          <div className="space-y-2">
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900">{user.username}</h3>
                              <p className="text-xs text-gray-500 truncate" title={user.email}>{user.email}</p>
                            </div>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </span>
                          </div>

                          {/* AI Quota */}
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('admin.tables.users.aiQuota')}
                            </label>
                            {editingUser?.id === user.id ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={editingUser.quota}
                                  onChange={(e) => setEditingUser({
                                    ...editingUser,
                                    quota: parseInt(e.target.value) || 0
                                  })}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                />
                                <button
                                  onClick={() => handleQuotaUpdate(user.id, editingUser.quota)}
                                  className="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-50 transition-colors"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setEditingUser(null)}
                                  className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-semibold text-gray-900">{user.ai_quota}</span>
                                <button
                                  onClick={() => setEditingUser({ id: user.id, quota: user.ai_quota })}
                                  className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Virtual Balance */}
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('admin.tables.users.virtualBalance')}
                            </label>
                            {editingVirtualBalance?.id === user.id ? (
                              <div className="space-y-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="1000000"
                                  value={virtualBalanceForm.virtualSaldo}
                                  onChange={(e) => setVirtualBalanceForm({
                                    ...virtualBalanceForm,
                                    virtualSaldo: parseFloat(e.target.value) || 0
                                  })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                  placeholder="Enter amount"
                                />
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleVirtualBalanceUpdate(user.id)}
                                    className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors text-sm font-medium"
                                  >
                                    {t('admin.buttons.update')}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingVirtualBalance(null);
                                      setVirtualBalanceForm({ virtualSaldo: 100000000 });
                                    }}
                                    className="flex-1 bg-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors text-sm font-medium"
                                  >
                                    {t('admin.buttons.cancel')}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-semibold text-gray-900">
                                  {user.virtual_saldo ? user.virtual_saldo.toLocaleString('id-ID') : '100,000,000'} IDR
                                </span>
                                <button
                                  onClick={() => setEditingVirtualBalance({ id: user.id })}
                                  className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                  <Wallet className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Referral Code */}
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {t('admin.tables.users.referralCode')}
                            </label>
                            {editingReferralCode?.id === user.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={referralCodeForm.referralCode}
                                  onChange={(e) => setReferralCodeForm({
                                    ...referralCodeForm,
                                    referralCode: e.target.value
                                  })}
                                  placeholder="Enter code"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                />
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleReferralCodeUpdate(user.id)}
                                    className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors text-sm font-medium"
                                  >
                                    {t('admin.buttons.update')}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingReferralCode(null);
                                      setReferralCodeForm({ referralCode: '' });
                                    }}
                                    className="flex-1 bg-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors text-sm font-medium"
                                  >
                                    {t('admin.buttons.cancel')}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                                  {user.referral_code || 'Not set'}
                                </span>
                                <button
                                  onClick={() => setEditingReferralCode({ id: user.id })}
                                  className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                                >
                                  <Hash className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Stats & Actions */}
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-center">
                              <div>
                                <div className="text-lg font-bold text-blue-600">{user.referral_count || 0}</div>
                                <div className="text-xs text-gray-500">{t('admin.tables.users.referrals')}</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold text-green-600">${Number(user.total_earned || 0).toFixed(2)}</div>
                                <div className="text-xs text-gray-500">{t('admin.tables.users.totalEarned')}</div>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-sm font-medium">
                                {t('admin.buttons.view')}
                              </button>
                              <button
                                onClick={() => setEditingPassword({ id: user.id })}
                                className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors text-sm font-medium"
                              >
                                <Key className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Password Edit Modal */}
              {editingPassword && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-md transform scale-100 animate-in zoom-in-95 duration-300">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <Key className="h-5 w-5 text-blue-600" />
                          </div>
                          <h3 id="password-modal-title" className="text-xl font-bold text-gray-900">{t('admin.modals.changePassword.title')}</h3>
                        </div>
                        <button
                          onClick={() => {
                            setEditingPassword(null);
                            setPasswordForm({ newPassword: '', confirmPassword: '' });
                          }}
                          className="text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100 p-2"
                          aria-label="Close modal"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="new-password">
                            {t('admin.modals.changePassword.newPassword')}
                          </label>
                          <input
                            id="new-password"
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({
                              ...passwordForm,
                              newPassword: e.target.value
                            })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
                            placeholder={t('admin.placeholders.newPassword')}
                            aria-describedby="password-help"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="confirm-password">
                            {t('admin.modals.changePassword.confirmPassword')}
                          </label>
                          <input
                            id="confirm-password"
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({
                              ...passwordForm,
                              confirmPassword: e.target.value
                            })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-sm"
                            placeholder={t('admin.placeholders.confirmPassword')}
                            aria-describedby="password-help"
                          />
                        </div>
                        <div id="password-help" className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-start space-x-2">
                            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-blue-700">
                              <p className="font-medium mb-1">{t('admin.validation.passwordMinLength')}</p>
                              <p>• Must be at least 6 characters long</p>
                              <p>• Should contain letters and numbers</p>
                              <p>• Case sensitive</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-3 pt-4">
                          <button
                            onClick={() => handlePasswordUpdate(editingPassword.id)}
                            disabled={updatePasswordMutation.isLoading}
                            className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 focus:scale-105 font-semibold"
                            aria-describedby="update-button-help"
                          >
                            {updatePasswordMutation.isLoading ? (
                              <div className="flex items-center justify-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>{t('admin.buttons.updating')}</span>
                              </div>
                            ) : (
                              t('admin.buttons.updatePassword')
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setEditingPassword(null);
                              setPasswordForm({ newPassword: '', confirmPassword: '' });
                            }}
                            className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200 transform hover:scale-105 focus:scale-105 font-semibold"
                            aria-describedby="cancel-button-help"
                          >
                            {t('admin.buttons.cancel')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'commissions' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{t('admin.sections.commissionSettings.title')}</h2>
                <div className="text-sm text-gray-500">
                  {t('admin.sections.commissionSettings.subtitle')}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* L0 Commission Card */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-blue-600 p-2 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <label className="text-base font-bold text-blue-900">
                        {t('admin.commissionSettings.l0Rate')}
                      </label>
                      <p className="text-sm text-blue-700">{t('admin.commissionSettings.directReferral')}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <input
                      type="number"
                      min="0"
                      max="0.6"
                      step="0.01"
                      value={l1Rate}
                      onChange={(e) => setL1Rate(parseFloat(e.target.value) || 0)}
                      className="flex-1 px-4 py-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg font-semibold"
                    />
                    <div className="text-right">
                      <span className="text-2xl font-bold text-blue-600">
                        {(l1Rate * 100).toFixed(0)}%
                      </span>
                      <p className="text-xs text-blue-500">of subscription</p>
                    </div>
                  </div>
                </div>

                {/* L1 Commission Card */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200 shadow-sm hover:shadow-md transition-all duration-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-green-600 p-2 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <label className="text-base font-bold text-green-900">
                        {t('admin.commissionSettings.l1Rate')}
                      </label>
                      <p className="text-sm text-green-700">{t('admin.commissionSettings.secondLevel')}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <input
                      type="number"
                      min="0"
                      max="0.6"
                      step="0.01"
                      value={l2Rate}
                      onChange={(e) => setL2Rate(parseFloat(e.target.value) || 0)}
                      className="flex-1 px-4 py-3 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 text-lg font-semibold"
                    />
                    <div className="text-right">
                      <span className="text-2xl font-bold text-green-600">
                        {(l2Rate * 100).toFixed(0)}%
                      </span>
                      <p className="text-xs text-green-500">of subscription</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Commission Display */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-600 p-2 rounded-lg">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-lg font-bold text-blue-900">
                        {t('admin.commissionSettings.totalRate')}
                      </span>
                      <p className="text-sm text-blue-700">Combined commission per subscription</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-bold text-blue-600">
                      {(l1Rate + l2Rate) * 100}%
                    </span>
                    <p className="text-sm text-blue-500">of subscription value</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="w-full bg-blue-200 rounded-full h-3 shadow-inner">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 shadow-sm ${
                        l1Rate + l2Rate > 0.60 ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'
                      }`}
                      style={{ width: `${Math.min((l1Rate + l2Rate) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-700 font-medium">
                      {t('admin.commissionSettings.maxAllowed')}
                    </span>
                    <span className={`font-bold ${l1Rate + l2Rate > 0.60 ? 'text-red-600' : 'text-green-600'}`}>
                      {l1Rate + l2Rate > 0.60 ? '⚠️ Exceeded' : '✅ Within limits'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {l1Rate + l2Rate > 0.60 && (
                <div className="bg-red-50 rounded-lg p-3 mb-4 border border-red-200">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-800">
                      {t('admin.validation.commissionExceed')}
                    </span>
                  </div>
                </div>
              )}

              {/* Update Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleCommissionUpdate}
                  disabled={updateCommissionMutation.isLoading || l1Rate + l2Rate > 0.60}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{updateCommissionMutation.isLoading ? t('admin.buttons.updating') : t('admin.buttons.updateSettings')}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">{t('admin.sections.networkOverview.title')}</h2>
                <div className="text-sm text-gray-500">
                  {t('admin.sections.networkOverview.subtitle')}
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-blue-600 font-medium">{t('admin.networkStats.totalUsers')}</p>
                      <p className="text-lg font-bold text-blue-800">{users?.length || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="flex items-center space-x-2">
                    <Network className="h-4 w-4 text-green-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-green-600 font-medium">{t('admin.networkStats.totalReferrals')}</p>
                      <p className="text-lg font-bold text-green-800">
                        {users?.reduce((sum, user) => sum + (user.referral_count || 0), 0) || 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-purple-600 font-medium">{t('admin.networkStats.totalCommissions')}</p>
                      <p className="text-lg font-bold text-purple-800">
                        ${Number(users?.reduce((sum, user) => sum + (user.total_earned || 0), 0) || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Commission Structure */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-base font-semibold mb-3 text-gray-900">{t('admin.commissionStructure.title')}</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 px-3 bg-white rounded border border-gray-200">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">{t('admin.commissionStructure.l0Commission')}</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">
                      {(l1Rate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-white rounded border border-gray-200">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-700">{t('admin.commissionStructure.l1Commission')}</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">
                      {(l2Rate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{t('admin.commissionStructure.totalPerSubscription')}:</span>
                      <span className="text-base font-bold text-gray-900">
                        {((l1Rate + l2Rate) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t('admin.commissionStructure.maxAllowed')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;