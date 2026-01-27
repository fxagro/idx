import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { affiliateAPI } from '../../utils/api';
import api from '../../utils/api';
import AdminNavbar from '../../components/AdminNavbar';
import {
  Settings,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Users,
  Link,
  Edit2,
  Save,
  X
} from 'lucide-react';

export default function AffiliateSettings() {
  const [level1Rate, setLevel1Rate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [newReferralCode, setNewReferralCode] = useState('');
  const queryClient = useQueryClient();

  // Fetch current affiliate settings
  const {
    data: settings,
    isLoading,
    error
  } = useQuery({
    queryKey: ['affiliateSettings'],
    queryFn: affiliateAPI.getSettings,
    onSuccess: (data) => {
      if (data) {
        setLevel1Rate(data.level_1_commission_rate.toString());
      }
    }
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: affiliateAPI.updateSettings,
    onSuccess: (response) => {
      setMessage({
        type: 'success',
        text: 'Affiliate settings updated successfully!'
      });
      queryClient.invalidateQueries({ queryKey: ['affiliateSettings'] });
      setIsSubmitting(false);

      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error) => {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to update settings'
      });
      setIsSubmitting(false);
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const rate = parseFloat(level1Rate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setMessage({
        type: 'error',
        text: 'Please enter a valid commission rate between 0 and 100'
      });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    updateSettingsMutation.mutate({
      level_1_commission_rate: rate
    });
  };

  const handleRateChange = (value) => {
    // Only allow numbers and decimal point
    const regex = /^\d*\.?\d*$/;
    if (regex.test(value) || value === '') {
      setLevel1Rate(value);
    }
  };

  // Fetch users data
  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
    refetch: refetchUsers
  } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const response = await api.get('/admin/users');
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useEffect(() => {
    if (usersData) {
      setUsers(usersData);
    }
  }, [usersData]);

  // Update referral code mutation
  const updateReferralCodeMutation = useMutation({
    mutationFn: async ({ userId, referralCode }) => {
      const response = await api.put(`/admin/users/${userId}/referral-code`, {
        referral_code: referralCode
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      setMessage({
        type: 'success',
        text: 'Referral code updated successfully!'
      });
      // Update local state
      setUsers(prev => prev.map(user =>
        user.id === variables.userId
          ? { ...user, referral_code: data.referral_link.split('ref=')[1] }
          : user
      ));
      setEditingUser(null);
      setNewReferralCode('');
      refetchUsers();
      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error) => {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Failed to update referral code'
      });
    }
  });

  const handleEditReferralCode = (user) => {
    setEditingUser(user.id);
    setNewReferralCode(user.referral_code || '');
  };

  const handleSaveReferralCode = (userId) => {
    const trimmedCode = newReferralCode.trim();

    if (!trimmedCode) {
      setMessage({
        type: 'error',
        text: 'Please enter a valid referral code'
      });
      return;
    }

    // Client-side validation for 6-50 characters, alphanumeric only
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    if (trimmedCode.length < 6) {
      setMessage({
        type: 'error',
        text: 'Referral code must be at least 6 characters long'
      });
      return;
    }

    if (trimmedCode.length > 50) {
      setMessage({
        type: 'error',
        text: 'Referral code cannot exceed 50 characters'
      });
      return;
    }

    if (!alphanumericRegex.test(trimmedCode)) {
      setMessage({
        type: 'error',
        text: 'Referral code must contain only letters and numbers'
      });
      return;
    }

    updateReferralCodeMutation.mutate({
      userId,
      referralCode: trimmedCode
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setNewReferralCode('');
  };

  const suggestReferralCode = (email) => {
    const name = email.split('@')[0].toUpperCase();
    return `REF_${name}_${Math.random().toString(36).substring(2, 6)}`;
  };

  const handleReferralCodeChange = (value) => {
    // Only allow alphanumeric characters
    const alphanumericRegex = /^[a-zA-Z0-9]*$/;
    if (alphanumericRegex.test(value) || value === '') {
      setNewReferralCode(value);
    }
  };

  const getReferralCodeValidation = (code) => {
    if (!code) return { isValid: false, message: '' };

    if (code.length < 6) {
      return { isValid: false, message: 'Must be at least 6 characters' };
    }

    if (code.length > 50) {
      return { isValid: false, message: 'Cannot exceed 50 characters' };
    }

    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    if (!alphanumericRegex.test(code)) {
      return { isValid: false, message: 'Only letters and numbers allowed' };
    }

    return { isValid: true, message: 'Valid referral code' };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error loading affiliate settings
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminNavbar />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center">
            <Settings className="h-8 w-8 text-indigo-600" />
            <div className="ml-3">
              <h1 className="text-3xl font-bold text-gray-900">Affiliate Settings</h1>
              <p className="text-gray-600">
                Configure commission rates for the affiliate program
              </p>
            </div>
          </div>
        </div>

        {/* Alert Message */}
        {message && (
          <div className={`mb-6 rounded-md p-4 ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex">
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-400" />
              )}
              <div className="ml-3">
                <p className={`text-sm font-medium ${
                  message.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {message.text}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Settings Form */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Commission Rates
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Set the commission rates for affiliate referrals. Level 2 rate is automatically calculated as half of Level 1 rate.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Level 1 Commission Rate */}
              <div>
                <label htmlFor="level1Rate" className="block text-sm font-medium text-gray-700 mb-2">
                  Level 1 Commission Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="level1Rate"
                    value={level1Rate}
                    onChange={(e) => handleRateChange(e.target.value)}
                    placeholder="40.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Commission rate for direct referrals (0-100%)
                </p>
              </div>

              {/* Level 2 Commission Rate (Read-only) */}
              <div>
                <label htmlFor="level2Rate" className="block text-sm font-medium text-gray-700 mb-2">
                  Level 2 Commission Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="level2Rate"
                    value={level1Rate ? (parseFloat(level1Rate) / 2).toFixed(2) : ''}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">%</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Automatically calculated as half of Level 1 rate
                </p>
              </div>
            </div>

            {/* Current Settings Info */}
            {settings && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex">
                  <DollarSign className="h-5 w-5 text-blue-400" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-800">
                      Current Settings
                    </h4>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>Level 1 Rate: {settings.level_1_commission_rate}%</p>
                      <p>Level 2 Rate: {settings.level_2_commission_rate}%</p>
                      <p className="text-xs mt-1">
                        Last updated: {new Date(settings.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || !level1Rate}
                className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  'Update Settings'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Referral Links Management */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <Users className="h-5 w-5 text-indigo-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">
                User Referral Links
              </h3>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              View and customize referral links for all users
            </p>
          </div>

          <div className="p-6">
            {usersLoading ? (
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : usersError ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">
                      Error loading users
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      {usersError.response?.data?.error || 'Failed to load user data'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Referral Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Referral Link
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {editingUser === user.id ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={newReferralCode}
                                onChange={(e) => handleReferralCodeChange(e.target.value)}
                                className={`w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 ${
                                  getReferralCodeValidation(newReferralCode).isValid
                                    ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                                    : newReferralCode.length > 0
                                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                                    : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                                }`}
                                placeholder="6-50 alphanumeric characters"
                                maxLength="50"
                              />
                              {newReferralCode && (
                                <p className={`text-xs ${
                                  getReferralCodeValidation(newReferralCode).isValid
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }`}>
                                  {getReferralCodeValidation(newReferralCode).message}
                                </p>
                              )}
                            </div>
                          ) : (
                            <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                              {user.referral_code || 'Not set'}
                            </code>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.referral_code ? (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                              {`${window.location.origin}/register?ref=${user.referral_code}`}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">No referral link</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {editingUser === user.id ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleSaveReferralCode(user.id)}
                                disabled={updateReferralCodeMutation.isPending}
                                className="text-green-600 hover:text-green-900 disabled:opacity-50"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEditReferralCode(user)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  const suggested = suggestReferralCode(user.email);
                                  setNewReferralCode(suggested);
                                  setEditingUser(user.id);
                                }}
                                className="text-blue-600 hover:text-blue-900 text-xs"
                                title="Suggest code based on email"
                              >
                                <Link className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {users.length === 0 && !usersLoading && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No users found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Information Panel */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            How Affiliate Commissions Work
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
            <div>
              <h4 className="font-medium mb-2">Level 1 Commissions</h4>
              <p>
                When a user signs up using a direct referral link, the referrer earns the Level 1 commission rate.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Level 2 Commissions</h4>
              <p>
                When a user signs up using a referral link from someone who was referred by the original referrer,
                both the original referrer and the direct referrer earn commissions.
              </p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-white rounded border">
            <h4 className="font-medium text-gray-900 mb-2">Example:</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• User A refers User B (Level 1) → User A earns 40%</li>
              <li>• User B refers User C (Level 2) → User A earns 20%, User B earns 40%</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}