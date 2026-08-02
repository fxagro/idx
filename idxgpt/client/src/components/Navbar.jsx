import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useTranslation } from 'react-i18next';
import { LogOut, ChevronDown, BarChart3, TrendingUp, TrendingDown, Activity, Brain, Target, DollarSign, Users, FileText, Network, Globe, Wallet, Briefcase, LayoutDashboard, Database, Microscope, Zap, User, Settings, Star, Building2 } from 'lucide-react';
import { useState } from 'react';

const Navbar = () => {
  const { user, loading, setUser } = useAuth();
  const { t, i18n } = useTranslation();
  const [openDropdown, setOpenDropdown] = useState(null);

  // Debug logging
  console.log('[Navbar] Render:', {
    user: user ? {
      id: user.id,
      email: user.email,
      role: user.role,
      ai_quota: user.ai_quota
    } : null,
    loading,
    isAuthenticated: !!user,
    timestamp: new Date().toISOString()
  });

  // Debug Virtual Trading menu visibility
  console.log('[Navbar] Virtual Trading Menu Visibility:', {
    isAuthenticated: !!user,
    userEmail: user?.email,
    userRole: user?.role,
    shouldShowVirtualTradingMenus: !!user,
    userId: user?.id,
    virtualSaldo: user?.virtual_saldo,
    timestamp: new Date().toISOString()
  });

  // Enhanced debug logging for Virtual Trading menus
  console.log('[Navbar] Virtual Trading Debug:', {
    userExists: !!user,
    userId: user?.id,
    userEmail: user?.email,
    userRole: user?.role,
    loadingState: loading,
    isAuthenticated: !!user,
    virtualTradingMenuShouldRender: !!user && !loading,
    timestamp: new Date().toISOString()
  });

  // Debug language switcher
  console.log('[Navbar] Language switcher debug:', {
    i18nLanguage: i18n.language,
    userExists: !!user,
    loading,
    switcherShouldRender: true // Always render for all users
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const toggleDropdown = (dropdown) => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown);
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setOpenDropdown(null);
  };

  if (loading) {
    console.log('[Navbar] Loading state, showing loading indicator');
    return <div className="p-4 text-white">Loading...</div>;
  }

  return (
    <nav className="sticky top-0 z-50 w-full bg-blue-600 text-white shadow-lg transition-all duration-200 border-b border-blue-500/20">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link
              to="/dashboard"
              className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
              data-testid="dashboard-menu"
              aria-label="Go to Dashboard"
            >
              <BarChart3 size={20} className="flex-shrink-0" />
              <span className="font-bold text-lg">myTradeX</span>
            </Link>
          </div>

          {/* Responsive Navigation */}
          <div className="hidden md:flex xl:hidden items-center space-x-1">
            {/* Dashboard Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('dashboard')}
                className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                <LayoutDashboard size={16} className="flex-shrink-0" />
                <span className="text-sm font-medium">Dashboard</span>
                <ChevronDown size={14} className="flex-shrink-0" />
              </button>
              {openDropdown === 'dashboard' && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-xl z-50 border border-gray-200 animate-in fade-in-0 zoom-in-95 duration-200">
                  <div className="py-2">
                    <Link to="/dashboard" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <BarChart3 size={14} className="flex-shrink-0" />
                      <span>Dashboard</span>
                    </Link>
                    <Link to="/dashboard-v2" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <LayoutDashboard size={14} className="flex-shrink-0" />
                      <span>Dashboard V2</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Market Data - Simplified for medium screens */}
            <Link to="/stocks" className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200">
              <Database size={16} className="flex-shrink-0" />
              <span className="text-sm font-medium">Market</span>
            </Link>

            {/* AI Analysis */}
            <Link to="/ai" className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200">
              <Brain size={16} className="flex-shrink-0" />
              <span className="text-sm font-medium">AI</span>
            </Link>

            {/* Advanced Tools Dropdown - Show on larger medium screens */}
            <div className="relative hidden lg:block">
              <button
                onClick={() => toggleDropdown('advanced')}
                className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                <Star size={16} className="flex-shrink-0" />
                <span className="text-sm font-medium">Advanced</span>
                <ChevronDown size={14} className="flex-shrink-0" />
              </button>
              {openDropdown === 'advanced' && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-slate-600 animate-in fade-in-0 zoom-in-95 duration-200 backdrop-blur-sm">
                  <div className="py-2">
                    <Link to="/bandarmologi" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <Users size={14} className="flex-shrink-0" />
                      <span>Bandarmologi</span>
                    </Link>
                    <Link to="/bandarmologi-premium" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors text-yellow-600 font-semibold">
                      <Star size={14} className="flex-shrink-0" />
                      <span>Bandarmologi Premium</span>
                    </Link>
                    <Link to="/broker" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <Building2 size={14} className="flex-shrink-0" />
                      <span>Broker Analysis</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Navigation (1280px+) */}
          <div className="hidden xl:flex items-center space-x-1">
            {/* Dashboard Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('dashboard')}
                className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
                data-testid="dashboard-menu"
              >
                <LayoutDashboard size={16} className="flex-shrink-0" />
                <span className="text-sm font-medium">Dashboard</span>
                <ChevronDown size={14} className="flex-shrink-0" />
              </button>
              {openDropdown === 'dashboard' && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white text-gray-800 rounded-lg shadow-xl z-50 border border-gray-200 animate-in fade-in-0 zoom-in-95 duration-200">
                  <div className="py-2">
                    <Link to="/dashboard" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <BarChart3 size={14} className="flex-shrink-0" />
                      <span>Dashboard</span>
                    </Link>
                    <Link to="/dashboard-v2" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <LayoutDashboard size={14} className="flex-shrink-0" />
                      <span>Dashboard V2</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Market Data Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('marketData')}
                className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
                data-testid="market-data-menu"
              >
                <Database size={16} className="flex-shrink-0" />
                <span className="text-sm font-medium">Market Data</span>
                <ChevronDown size={14} className="flex-shrink-0" />
              </button>
              {openDropdown === 'marketData' && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white text-gray-800 rounded-lg shadow-xl z-50 border border-gray-200 animate-in fade-in-0 zoom-in-95 duration-200">
                  <div className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock Data</div>
                    <Link to="/stocks" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <BarChart3 size={14} className="flex-shrink-0" />
                      <span>Stock List</span>
                    </Link>
                    <Link to="/watchlist" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <Target size={14} className="flex-shrink-0" />
                      <span>Watchlist</span>
                    </Link>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Market Lists</div>
                    <Link to="/top-gainers" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <TrendingUp size={14} className="flex-shrink-0" />
                      <span>Top Gainers</span>
                    </Link>
                    <Link to="/top-losers" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <TrendingDown size={14} className="flex-shrink-0" />
                      <span>Top Losers</span>
                    </Link>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Market Overview</div>
                    <Link to="/market/indeks" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <BarChart3 size={14} className="flex-shrink-0" />
                      <span>Indeks IDX</span>
                    </Link>
                    <Link to="/market/broker" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <Briefcase size={14} className="flex-shrink-0" />
                      <span>Broker Summary</span>
                    </Link>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data Explorer</div>
                    <Link to="/openbbdataexplorer" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <Database size={14} className="flex-shrink-0" />
                      <span>OpenBB Data Explorer</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Analysis Tools Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('analysis')}
                className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
                data-testid="analysis-menu"
              >
                <Microscope size={16} className="flex-shrink-0" />
                <span className="text-sm font-medium">Analysis</span>
                <ChevronDown size={14} className="flex-shrink-0" />
              </button>
              {openDropdown === 'analysis' && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white text-gray-800 rounded-lg shadow-xl z-50 border border-gray-200 animate-in fade-in-0 zoom-in-95 duration-200">
                  <div className="py-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">AI Analysis</div>
                    <Link to="/ai" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <Brain size={14} className="flex-shrink-0" />
                      <span>AI Analysis</span>
                    </Link>
                    <Link to="/ai-v2" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <Zap size={14} className="flex-shrink-0" />
                      <span>AI Analysis V2</span>
                    </Link>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Technical Analysis</div>
                    <Link to="/technical" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <Activity size={14} className="flex-shrink-0" />
                      <span>Technical Analysis</span>
                    </Link>
                    <Link to="/chartjs" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <BarChart3 size={14} className="flex-shrink-0" />
                      <span>Charts</span>
                    </Link>
                    <Link to="/tvs" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <BarChart3 size={14} className="flex-shrink-0" />
                      <span>Chart V2</span>
                    </Link>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fundamental Analysis</div>
                    <Link to="/fundamental" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <DollarSign size={14} className="flex-shrink-0" />
                      <span>Fundamental Analysis</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Tools Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('advanced')}
                className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
                data-testid="advanced-menu"
              >
                <Star size={16} className="flex-shrink-0" />
                <span className="text-sm font-medium">Advanced</span>
                <ChevronDown size={14} className="flex-shrink-0" />
              </button>
              {openDropdown === 'advanced' && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-slate-600 animate-in fade-in-0 zoom-in-95 duration-200 backdrop-blur-sm">
                  <div className="py-2">
                    <Link to="/bandarmologi" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <Users size={14} className="flex-shrink-0" />
                      <span>Bandarmologi</span>
                    </Link>
                    <Link to="/bandarmologi-premium" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors text-yellow-600 font-semibold">
                      <Star size={14} className="flex-shrink-0" />
                      <span>Bandarmologi Premium</span>
                    </Link>
                    <Link to="/broker" className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors">
                      <Building2 size={14} className="flex-shrink-0" />
                      <span>Broker Analysis</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-2">
            {/* Language Switcher */}
            <div className="relative">
              {(() => {
                console.log('[Navbar] Language switcher rendering:', {
                  i18nLanguage: i18n.language,
                  englishText: t('common.english'),
                  indonesianText: t('common.indonesian'),
                  userAuthenticated: !!user,
                  userEmail: user?.email,
                  timestamp: new Date().toISOString()
                });
                return null;
              })()}
              <button
                onClick={() => toggleDropdown('language')}
                className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
                data-testid="language-switcher"
                aria-label={t('common.language')}
              >
                <Globe size={16} className="flex-shrink-0" />
                <span className="text-sm hidden sm:inline font-medium">
                  {i18n.language === 'en' ? t('common.english') : t('common.indonesian')}
                </span>
                <ChevronDown size={14} className="flex-shrink-0" />
              </button>
              {openDropdown === 'language' && (
                <div className="absolute top-full right-0 mt-2 w-36 bg-white text-gray-800 rounded-lg shadow-xl z-50 border border-gray-200 animate-in fade-in-0 zoom-in-95 duration-200">
                  <div className="py-2">
                    <button
                      onClick={() => changeLanguage('en')}
                      className={`flex items-center space-x-3 px-4 py-2 text-sm w-full text-left hover:bg-gray-100 transition-colors ${
                        i18n.language === 'en' ? 'bg-blue-50 text-blue-600' : ''
                      }`}
                    >
                      <span>{t('common.english')}</span>
                      {i18n.language === 'en' && <span className="text-blue-600">✓</span>}
                    </button>
                    <button
                      onClick={() => changeLanguage('id')}
                      className={`flex items-center space-x-3 px-4 py-2 text-sm w-full text-left hover:bg-gray-100 transition-colors ${
                        i18n.language === 'id' ? 'bg-blue-50 text-blue-600' : ''
                      }`}
                    >
                      <span>{t('common.indonesian')}</span>
                      {i18n.language === 'id' && <span className="text-blue-600">✓</span>}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {user ? (
              <>
                <Link
                  to="/network"
                  className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
                  data-testid="network-menu"
                >
                  <Network size={16} className="flex-shrink-0" />
                  <span className="text-sm hidden md:inline font-medium">{t('navbar.myNetwork')}</span>
                </Link>

                {/* Virtual Trading Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => toggleDropdown('virtualTrading')}
                    className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
                    data-testid="virtual-trading-menu"
                    aria-label={t('navbar.virtualTrading')}
                  >
                    <Wallet size={16} className="flex-shrink-0" />
                    <span className="text-sm hidden md:inline font-medium">{t('navbar.virtualTrading')}</span>
                    <ChevronDown size={14} className="flex-shrink-0" />
                  </button>
                  {openDropdown === 'virtualTrading' && (
                    <div className="absolute top-full left-0 mt-2 w-52 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-slate-600 animate-in fade-in-0 zoom-in-95 duration-200 backdrop-blur-sm">
                      <div className="py-2">
                        <Link
                          to="/virtual-trading"
                          className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
                          data-testid="virtual-trading-link"
                        >
                          <Wallet size={14} className="flex-shrink-0" />
                          <span>{t('navbar.virtualTrading')}</span>
                        </Link>
                        <Link
                          to="/virtual-trading/portfolio"
                          className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
                          data-testid="portfolio-link"
                        >
                          <BarChart3 size={14} className="flex-shrink-0" />
                          <span>{t('navbar.portfolio')}</span>
                        </Link>
                        <Link
                          to="/virtual-trading/history"
                          className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
                          data-testid="history-link"
                        >
                          <FileText size={14} className="flex-shrink-0" />
                          <span>{t('navbar.history')}</span>
                        </Link>
                        <Link
                          to="/virtual-trading/history"
                          className="flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors"
                          data-testid="trade-confirmation-link"
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                          <span>Trade Confirmation</span>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Debug logging for Virtual Trading links */}
                {(() => {
                  console.log('[Navbar] Virtual Trading menus rendered for user:', {
                    email: user?.email,
                    role: user?.role,
                    id: user?.id,
                    virtualSaldo: user?.virtual_saldo,
                    isAuthenticated: !!user,
                    timestamp: new Date().toISOString()
                  });
                  return null;
                })()}

                {/* Debug logging for Market Overview menu */}
                {(() => {
                  console.log('[Navbar] Market Overview menu rendered for user:', {
                    email: user?.email,
                    role: user?.role,
                    id: user?.id,
                    isAuthenticated: !!user,
                    timestamp: new Date().toISOString()
                  });
                  return null;
                })()}

                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 text-sm font-medium"
                    data-testid="admin-menu"
                  >
                    {t('navbar.adminPanel')}
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105"
                  data-testid="logout-button"
                >
                  <LogOut size={16} className="flex-shrink-0" />
                  <span className="text-sm hidden md:inline font-medium">{t('navbar.logout')}</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 text-sm font-medium"
                  data-testid="login-menu"
                >
                  {t('navbar.login')}
                </Link>
                <Link
                  to="/register"
                  className="hover:bg-blue-700 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 text-sm font-medium"
                  data-testid="register-menu"
                >
                  {t('navbar.register')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button - Show on mobile and tablet */}
          <div className="md:flex xl:hidden">
            <button
              onClick={() => toggleDropdown('mobile')}
              className="xl:hidden hover:bg-blue-700 p-2 rounded-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              data-testid="mobile-menu-button"
              aria-label="Open mobile menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {openDropdown === 'mobile' && (
              <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-slate-600 animate-in slide-in-from-top-2 fade-in-0 zoom-in-95 duration-300 max-h-96 overflow-y-auto backdrop-blur-sm">
                <div className="py-2">
                  {/* Dashboard Section */}
                  <div className="px-3 py-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <LayoutDashboard size={16} className="flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-700">Dashboard</span>
                    </div>
                    <div className="ml-5 space-y-1">
                      <Link to="/dashboard" className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors rounded">
                        <BarChart3 size={14} className="flex-shrink-0" />
                        <span>Dashboard</span>
                      </Link>
                      <Link to="/dashboard-v2" className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors rounded">
                        <LayoutDashboard size={14} className="flex-shrink-0" />
                        <span>Dashboard V2</span>
                      </Link>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 my-2"></div>

                  {/* Market Data Section */}
                  <div className="px-3 py-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <Database size={16} className="flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-700">Market Data</span>
                    </div>
                    <div className="ml-5 space-y-2">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Stock Data</div>
                        <div className="space-y-1">
                          <Link to="/stocks" className="flex items-center space-x-2 px-3 py-1 text-sm hover:bg-gray-100 transition-colors rounded">
                            <BarChart3 size={12} className="flex-shrink-0" />
                            <span>Stock List</span>
                          </Link>
                          <Link to="/watchlist" className="flex items-center space-x-2 px-3 py-1 text-sm hover:bg-gray-100 transition-colors rounded">
                            <Target size={12} className="flex-shrink-0" />
                            <span>Watchlist</span>
                          </Link>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Market Lists</div>
                        <div className="space-y-1">
                          <Link to="/top-gainers" className="flex items-center space-x-2 px-3 py-1 text-sm hover:bg-gray-100 transition-colors rounded">
                            <TrendingUp size={12} className="flex-shrink-0" />
                            <span>Top Gainers</span>
                          </Link>
                          <Link to="/top-losers" className="flex items-center space-x-2 px-3 py-1 text-sm hover:bg-gray-100 transition-colors rounded">
                            <TrendingDown size={12} className="flex-shrink-0" />
                            <span>Top Losers</span>
                          </Link>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Market Overview</div>
                        <div className="space-y-1">
                          <Link to="/market/indeks" className="flex items-center space-x-2 px-3 py-1 text-sm hover:bg-gray-100 transition-colors rounded">
                            <BarChart3 size={12} className="flex-shrink-0" />
                            <span>Indeks IDX</span>
                          </Link>
                          <Link to="/market/broker" className="flex items-center space-x-2 px-3 py-1 text-sm hover:bg-gray-100 transition-colors rounded">
                            <Briefcase size={12} className="flex-shrink-0" />
                            <span>Broker Summary</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 my-2"></div>

                  {/* Analysis Section */}
                  <div className="px-3 py-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <Microscope size={16} className="flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-700">Analysis</span>
                    </div>
                    <div className="ml-5 space-y-2">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">AI Analysis</div>
                        <div className="space-y-1">
                          <Link to="/ai" className="flex items-center space-x-2 px-3 py-1 text-sm hover:bg-gray-100 transition-colors rounded">
                            <Brain size={12} className="flex-shrink-0" />
                            <span>AI Analysis</span>
                          </Link>
                          <Link to="/ai-v2" className="flex items-center space-x-2 px-3 py-1 text-sm hover:bg-gray-100 transition-colors rounded">
                            <Zap size={12} className="flex-shrink-0" />
                            <span>AI Analysis V2</span>
                          </Link>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Technical Analysis</div>
                        <div className="space-y-1">
                          <Link to="/technical" className="flex items-center space-x-2 px-3 py-1 text-sm hover:bg-gray-100 transition-colors rounded">
                            <Activity size={12} className="flex-shrink-0" />
                            <span>Technical Analysis</span>
                          </Link>
                          <Link to="/chartjs" className="flex items-center space-x-2 px-3 py-1 text-sm hover:bg-gray-100 transition-colors rounded">
                            <BarChart3 size={12} className="flex-shrink-0" />
                            <span>Charts</span>
                          </Link>
                          <Link to="/tvs" className="flex items-center space-x-2 px-3 py-1 text-sm hover:bg-gray-100 transition-colors rounded">
                            <BarChart3 size={12} className="flex-shrink-0" />
                            <span>Chart V2</span>
                          </Link>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fundamental Analysis</div>
                        <div className="space-y-1">
                          <Link to="/fundamental" className="flex items-center space-x-2 px-3 py-1 text-sm hover:bg-gray-100 transition-colors rounded">
                            <DollarSign size={12} className="flex-shrink-0" />
                            <span>Fundamental Analysis</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 my-2"></div>

                  {/* Advanced Tools Section */}
                  <div className="px-3 py-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <Star size={16} className="flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-700">Advanced Tools</span>
                    </div>
                    <div className="ml-5 space-y-1">
                      <Link to="/bandarmologi" className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors rounded">
                        <Users size={14} className="flex-shrink-0" />
                        <span>Bandarmologi</span>
                      </Link>
                      <Link to="/bandarmologi-premium" className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors rounded text-yellow-600 font-semibold">
                        <Star size={14} className="flex-shrink-0" />
                        <span>Bandarmologi Premium</span>
                      </Link>
                      <Link to="/broker" className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors rounded">
                        <Building2 size={14} className="flex-shrink-0" />
                        <span>Broker Analysis</span>
                      </Link>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 my-2"></div>

                  {/* Trading Section */}
                  <div className="px-3 py-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <Wallet size={16} className="flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-700">Trading</span>
                    </div>
                    <div className="ml-5 space-y-1">
                      <Link to="/virtual-trading" className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors rounded">
                        <Wallet size={14} className="flex-shrink-0" />
                        <span>Virtual Trading</span>
                      </Link>
                      <Link to="/virtual-trading/portfolio" className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors rounded">
                        <BarChart3 size={14} className="flex-shrink-0" />
                        <span>Portfolio</span>
                      </Link>
                      <Link to="/virtual-trading/history" className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors rounded">
                        <FileText size={14} className="flex-shrink-0" />
                        <span>History</span>
                      </Link>
                      <Link to="/virtual-trading/history" className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors rounded">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        <span>Trade Confirmation</span>
                      </Link>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 my-2"></div>

                  {/* Community Section */}
                  <div className="px-3 py-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <Network size={16} className="flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-700">Community</span>
                    </div>
                    <div className="ml-5 space-y-1">
                      <Link to="/network" className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors rounded">
                        <Network size={14} className="flex-shrink-0" />
                        <span>My Network</span>
                      </Link>
                      {user?.role === 'admin' && (
                        <Link to="/admin" className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors rounded">
                          <User size={14} className="flex-shrink-0" />
                          <span>Admin Panel</span>
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 my-2"></div>

                  {/* Language Section */}
                  <div className="px-3 py-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <Globe size={16} className="flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-700">Language</span>
                    </div>
                    <div className="ml-5 space-y-1">
                      <button
                        onClick={() => changeLanguage('en')}
                        className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg hover:bg-gray-100 transition-colors ${
                          i18n.language === 'en' ? 'bg-blue-50 text-blue-600' : ''
                        }`}
                      >
                        <span>English</span>
                        {i18n.language === 'en' && <span className="text-blue-600">✓</span>}
                      </button>
                      <button
                        onClick={() => changeLanguage('id')}
                        className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg hover:bg-gray-100 transition-colors ${
                          i18n.language === 'id' ? 'bg-blue-50 text-blue-600' : ''
                        }`}
                      >
                        <span>Indonesia</span>
                        {i18n.language === 'id' && <span className="text-blue-600">✓</span>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
export default Navbar;
