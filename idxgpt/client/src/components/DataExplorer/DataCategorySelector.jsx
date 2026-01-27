import React from 'react';
import { useTranslation } from 'react-i18next';

const DataCategorySelector = ({
  categories,
  selectedCategory,
  onCategoryChange,
  isWatchlistMode,
  onWatchlistToggle
}) => {
  const { t } = useTranslation();

  const getCategoryColor = (color) => {
    const colorMap = {
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      purple: 'bg-purple-100 text-purple-800 border-purple-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      teal: 'bg-teal-100 text-teal-800 border-teal-200'
    };
    return colorMap[color] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getCategoryHoverColor = (color) => {
    const colorMap = {
      blue: 'hover:bg-blue-200',
      green: 'hover:bg-green-200',
      orange: 'hover:bg-orange-200',
      purple: 'hover:bg-purple-200',
      yellow: 'hover:bg-yellow-200',
      indigo: 'hover:bg-indigo-200',
      teal: 'hover:bg-teal-200'
    };
    return colorMap[color] || 'hover:bg-gray-200';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {t('dataExplorer.categories.title', 'Data Categories')}
      </h3>

      {/* Watchlist Toggle */}
      <div className="mb-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={isWatchlistMode}
            onChange={(e) => onWatchlistToggle(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
          />
          <span className="ml-2 text-sm font-medium text-gray-700">
            {t('dataExplorer.categories.watchlistMode', 'Watchlist Only')}
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-1">
          {t('dataExplorer.categories.watchlistModeDesc', 'Show only symbols in your watchlist')}
        </p>
      </div>

      {/* Category List */}
      <div className="space-y-2">
        {Object.entries(categories).map(([key, category]) => (
          <button
            key={key}
            onClick={() => onCategoryChange(key)}
            className={`w-full text-left px-3 py-3 rounded-lg border transition-all duration-200 ${
              selectedCategory === key
                ? `${getCategoryColor(category.color)} ${getCategoryHoverColor(category.color)} shadow-sm`
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-xl mr-3">{category.icon}</span>
                <div>
                  <div className="font-medium text-sm">
                    {t(`dataExplorer.categories.${key}`, category.label)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {t(`dataExplorer.categories.${key}Desc`, `${category.label} data`)}
                  </div>
                </div>
              </div>
              {selectedCategory === key && (
                <div className="w-2 h-2 bg-current rounded-full opacity-60"></div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          {t('dataExplorer.categories.quickStats', 'Quick Stats')}
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-600">
              {t('dataExplorer.categories.totalCategories', 'Categories')}:
            </span>
            <span className="font-medium">{Object.keys(categories).length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">
              {t('dataExplorer.categories.selected', 'Selected')}:
            </span>
            <span className="font-medium">
              {t(`dataExplorer.categories.${selectedCategory}`, categories[selectedCategory]?.label)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">
              {t('dataExplorer.categories.watchlistMode', 'Watchlist')}:
            </span>
            <span className={`font-medium ${isWatchlistMode ? 'text-green-600' : 'text-gray-400'}`}>
              {isWatchlistMode ? 'On' : 'Off'}
            </span>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start">
          <span className="text-blue-500 text-sm mr-2">💡</span>
          <div className="text-xs text-blue-700">
            <p className="font-medium mb-1">
              {t('dataExplorer.categories.helpTitle', 'Navigation Tips')}
            </p>
            <p>
              {t('dataExplorer.categories.helpDesc', 'Click on any category to explore its data. Use the search bar to filter results.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataCategorySelector;