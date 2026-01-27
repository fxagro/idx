import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Bandarmologi from '../components/Bandarmologi';

export default function BandarmologiPage() {
  const { t } = useTranslation();

  useEffect(() => {
    // Update document title
    document.title = `${t('bandarmologi.title')} - Broker Analysis | IDX GPT`;

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Analyze Indonesian stock broker trading patterns with advanced Bandarmologi tools. Get insights into broker behavior, trading volumes, and market movements.');
    }

    // Scroll to top when component mounts
    window.scrollTo(0, 0);
  }, [t]);

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Page Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('bandarmologi.title')}</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {t('bandarmologi.subtitle')}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm text-gray-500">{t('bandarmologi.descriptions.analysisPeriod')}</div>
                  <div className="text-sm font-medium text-gray-900">{t('bandarmologi.descriptions.realTime')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    {t('bandarmologi.descriptions.aboutBandarmologi')}
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      {t('bandarmologi.descriptions.aboutBandarmologiText')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bandarmologi Component */}
          <Bandarmologi />

          {/* Page Footer */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-500">
                {t('bandarmologi.descriptions.dataSource')} {' '}
                <a
                  href="https://bisnis-it.com/saham"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-500 font-medium"
                >
                  {t('bandarmologi.descriptions.dataSourceLink')}
                </a>
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {t('bandarmologi.descriptions.dataSourceDesc')}
              </p>
            </div>
          </div>
        </main>
      </div>
  );
}