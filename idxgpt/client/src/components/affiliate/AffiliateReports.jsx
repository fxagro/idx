import React from 'react';
import { BarChart2, Download, FileText } from 'lucide-react';
import { saveAs } from 'file-saver';

const AffiliateReports = ({ stats, history }) => {
  const downloadReport = () => {
    const report = [
      'Affiliate Report',
      `Generated on: ${new Date().toLocaleDateString()}`,
      '',
      '=== STATISTICS ===',
      `Total Referrals: ${stats.total_referrals.level_1 + stats.total_referrals.level_2}`,
      `Level 1 Referrals: ${stats.total_referrals.level_1}`,
      `Level 2 Referrals: ${stats.total_referrals.level_2}`,
      `Total Commissions: $${stats.total_commissions.toFixed(2)}`,
      '',
      '=== REFERRAL HISTORY ===',
      ...history.map((item, index) => {
        const date = new Date(item.created_at).toLocaleDateString();
        const commission = item.total_commission ? `$${item.total_commission.toFixed(2)}` : '$0.00';
        return `${index + 1}. ${date} - ${item.referred_name || 'Unknown User'} (${item.referred_email}) - Level ${item.level} - ${commission}`;
      }),
      '',
      '=== COMMISSION BREAKDOWN ===',
      `Level 1 Commissions: $${stats.total_commissions.level_1.toFixed(2)}`,
      `Level 2 Commissions: $${stats.total_commissions.level_2.toFixed(2)}`,
    ].join('\n');

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `affiliate_report_${new Date().toISOString().split('T')[0]}.txt`);
  };

  const downloadCSV = () => {
    const headers = ['Date', 'Referred User', 'Email', 'Level', 'Commission'];
    const csvData = [
      headers.join(','),
      ...history.map((item) => {
        const date = new Date(item.created_at).toLocaleDateString();
        const name = (item.referred_name || 'Unknown User').replace(/,/g, '');
        const email = item.referred_email.replace(/,/g, '');
        const commission = item.total_commission ? item.total_commission.toFixed(2) : '0.00';
        return `"${date}","${name}","${email}","${item.level}","$${commission}"`;
      })
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `affiliate_report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <BarChart2 className="h-6 w-6 text-indigo-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Reports & Analytics</h2>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={downloadReport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            data-testid="download-report"
          >
            <FileText className="h-4 w-4 mr-2" />
            Text Report
          </button>
          <button
            onClick={downloadCSV}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            data-testid="download-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            CSV Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-1">Total Referrals</h3>
          <p className="text-2xl font-bold text-blue-600">
            {stats.total_referrals.level_1 + stats.total_referrals.level_2}
          </p>
          <p className="text-xs text-blue-700">
            {stats.total_referrals.level_1} Level 1, {stats.total_referrals.level_2} Level 2
          </p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-green-900 mb-1">Total Earnings</h3>
          <p className="text-2xl font-bold text-green-600">
            ${stats.total_commissions.toFixed(2)}
          </p>
          <p className="text-xs text-green-700">
            All time commissions
          </p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-purple-900 mb-1">Level 1 Rate</h3>
          <p className="text-2xl font-bold text-purple-600">
            {stats.total_referrals.level_1 > 0
              ? ((stats.total_commissions.level_1 / stats.total_referrals.level_1) * 100).toFixed(1)
              : '0.0'}%
          </p>
          <p className="text-xs text-purple-700">
            Conversion rate
          </p>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-orange-900 mb-1">Avg. Commission</h3>
          <p className="text-2xl font-bold text-orange-600">
            ${(stats.total_referrals.total > 0
              ? stats.total_commissions / stats.total_referrals.total
              : 0).toFixed(2)}
          </p>
          <p className="text-xs text-orange-700">
            Per referral
          </p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Performance Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600">This Month</p>
            <p className="font-semibold text-gray-900">
              {history.filter(item => {
                const itemDate = new Date(item.created_at);
                const now = new Date();
                return itemDate.getMonth() === now.getMonth() &&
                       itemDate.getFullYear() === now.getFullYear();
              }).length} referrals
            </p>
          </div>
          <div>
            <p className="text-gray-600">This Week</p>
            <p className="font-semibold text-gray-900">
              {history.filter(item => {
                const itemDate = new Date(item.created_at);
                const now = new Date();
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return itemDate >= weekAgo;
              }).length} referrals
            </p>
          </div>
          <div>
            <p className="text-gray-600">Best Day</p>
            <p className="font-semibold text-gray-900">
              {(() => {
                const dayCounts = {};
                history.forEach(item => {
                  const day = new Date(item.created_at).toDateString();
                  dayCounts[day] = (dayCounts[day] || 0) + 1;
                });
                const bestDay = Object.entries(dayCounts).sort(([,a], [,b]) => b - a)[0];
                return bestDay ? `${bestDay[1]} referrals` : 'No data';
              })()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AffiliateReports;