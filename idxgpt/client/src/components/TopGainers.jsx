import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';

const TopGainers = ({ onSelectStock }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('gainers');
  const [selectedDate, setSelectedDate] = useState('latest');
  const [availableDates, setAvailableDates] = useState([]);
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load available dates
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const res = await api.get('/stocks/idx/dates');
        // Pastikan array dates berbentuk: [{ date: '2025-09-17', formatted: '17 Sep 2025' }, ...]
        setAvailableDates(res.data.dates || []);
      } catch (err) {
        console.error('Failed to load dates:', err);
      }
    };
    fetchDates();
  }, []);

  // Load data whenever tab or selectedDate changes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint =
          activeTab === 'gainers' ? '/stocks/idx/top-gainers' : '/stocks/idx/top-losers';
        // Kirim date hanya jika bukan latest
        const params = selectedDate !== 'latest' ? { limit: 15, date: selectedDate } : { limit: 15 };
        const res = await api.get(endpoint, { params });

        if (activeTab === 'gainers') setGainers(res.data?.gainers || []);
        else setLosers(res.data?.losers || []);
      } catch (err) {
        console.error(`Error loading ${activeTab}:`, err);
        setError(`Failed to load ${activeTab} data`);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeTab, selectedDate]);

  const handleStockClick = (stock) => {
    if (onSelectStock) onSelectStock(stock.symbol, 'idx');
  };

  const currentData = activeTab === 'gainers' ? gainers : losers;

  const formatVolume = (vol) => (vol > 0 ? `${t('navbar.volume')}: ${(vol / 1_000_000).toFixed(1)}M` : 'N/A');

  const getHeatColor = (value) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Tabs + Date Selector */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('gainers')}
            className={`px-4 py-2 rounded text-sm font-medium ${
              activeTab === 'gainers'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📈 {t('navbar.topGainers')}
          </button>
          <button
            onClick={() => setActiveTab('losers')}
            className={`px-4 py-2 rounded text-sm font-medium ${
              activeTab === 'losers'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📉 {t('navbar.topLosers')}
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">{t('common.date')}:</span>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded px-3 py-1 text-sm bg-white"
            disabled={loading}
          >
            <option value="latest">{t('navbar.latestDay')}</option>
            {availableDates.map((d) => (
              <option key={d.date} value={d.date}>{d.formatted}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stock List */}
      {loading && <div className="py-8 text-center">{t('common.loading')}</div>}
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      {!loading && !error && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {currentData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t('navbar.noDataAvailable')} {activeTab === 'gainers' ? t('navbar.topGainers') : t('navbar.topLosers')}
            </div>
          ) : (
            currentData.map((stock, index) => (
              <div
                key={stock.symbol}
                onClick={() => handleStockClick(stock)}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors bg-white"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold bg-gray-400">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{stock.symbol}</div>
                    <div className="text-xs text-gray-500 truncate max-w-32">{stock.company_name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-800">
                    Rp {parseFloat(stock.currentPrice || 0).toLocaleString()}
                  </div>
                  <div className={`text-sm font-bold ${getHeatColor(stock.changePercent)}`}>
                    {stock.changePercent >= 0 ? '+' : ''}{parseFloat(stock.changePercent || 0).toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">{formatVolume(stock.volume)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TopGainers;
