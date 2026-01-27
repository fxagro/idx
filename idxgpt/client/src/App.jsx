import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import MainLayout from './layouts/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import ErrorBoundary from './components/ErrorBoundary';
import AIPage from './components/AIPage';
import AIPageV2 from './components/AIPageV2';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Plans from './pages/Plans';
import Dashboard from './pages/Dashboard';
import DashboardPage from './components/DashboardPage';
import Portfolio from './pages/Portfolio';
import ChartJS from './pages/ChartJS';
import Bandarmologi from './pages/Bandarmologi';
import BandarmologiPremiumDashboard from './pages/BandarmologiPremiumDashboard';
import AdminPage from './pages/AdminPage';
import AdminPayments from './pages/AdminPayments';
import UserNetworkPage from './pages/UserNetworkPage';
import VirtualTradingPage from './pages/VirtualTradingPage';
import DashboardV2 from './pages/DashboardV2';
import OpenBBDashboard from './pages/OpenBBDashboard';
import OpenBBDataExplorer from './pages/OpenBBDataExplorer';
import PortfolioPage from './pages/PortfolioPage';
import HistoryPage from './pages/HistoryPage';
import MarketOverviewPage from './pages/MarketOverviewPage';
import TopGainersPage from './pages/TopGainersPage';
import TopLosersPage from './pages/TopLosersPage';
import TV from './pages/TV';
import TradingViewSuperChart from './pages/tvs';
import About from './pages/About';
import FAQ from './pages/FAQ';
import Blog from './pages/Blog';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import { useAuth } from './hooks/useAuth.jsx';
import { ThemeProvider } from './contexts/ThemeContext';

// Import translation files
import enTranslations from './locales/en.json';
import idTranslations from './locales/id.json';

// Initialize i18next with LanguageDetector
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations
      },
      id: {
        translation: idTranslations
      }
    },
    lng: localStorage.getItem('language') || 'en', // Default to English
    fallbackLng: 'en',
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'language',
      caches: ['localStorage']
    },
    interpolation: {
      escapeValue: false // React already escapes values
    },
    debug: import.meta.env.MODE === 'development',
    missingKeyHandler: (lng, ns, key, fallbackValue) => {
      console.warn(`[i18n] Missing translation key: ${key} in language: ${lng}`, {
        fallbackValue,
        namespace: ns,
        timestamp: new Date().toISOString()
      });
    }
  });

// Log i18next initialization
console.log('[i18n] Initialized with languages:', Object.keys(i18n.services.resourceStore.data));
console.log('[i18n] Current language:', i18n.language);
console.log('[i18n] Available namespaces:', i18n.services.resourceStore.data[i18n.language] ? Object.keys(i18n.services.resourceStore.data[i18n.language]) : 'none');

// Save language preference to localStorage when it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('language', lng);
  console.log(`[i18n] Language changed to: ${lng}`);
});

const App = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Log route changes for analytics
  useEffect(() => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        page_path: location.pathname,
      });
    }

    // Log to console for development
    console.log(`[Route] ${location.pathname}${location.search}`, {
      user: user?.email || 'anonymous',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    });
  }, [location, user]);

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <ThemeProvider>
      <MainLayout>
        <ErrorBoundary>
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/about" element={<About />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/dashboard-v2" element={
            <ProtectedRoute>
              <DashboardV2 />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <div data-testid="profile-page">Profile</div>
            </ProtectedRoute>
          } />
          <Route path="/portfolio" element={
            <ProtectedRoute>
              <Portfolio />
            </ProtectedRoute>
          } />
          <Route path="/chartjs" element={
            <ProtectedRoute>
              <ChartJS />
            </ProtectedRoute>
          } />
          <Route path="/bandarmologi" element={
            <ProtectedRoute>
              <Bandarmologi />
            </ProtectedRoute>
          } />
          <Route path="/bandarmologi-premium" element={
            <ProtectedRoute>
              <BandarmologiPremiumDashboard />
            </ProtectedRoute>
          } />
          <Route path="/ai" element={
            <ProtectedRoute>
              <AIPage />
            </ProtectedRoute>
          } />
          <Route path="/ai-v2" element={
            <ProtectedRoute>
              <AIPageV2 />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          } />
          <Route path="/admin/payments" element={
            <AdminRoute>
              <AdminPayments />
            </AdminRoute>
          } />
          <Route path="/network" element={
            <ProtectedRoute>
              <UserNetworkPage />
            </ProtectedRoute>
          } />
          <Route path="/virtual-trading" element={
            <ProtectedRoute>
              <VirtualTradingPage />
            </ProtectedRoute>
          } />
          <Route path="/virtual-trading/portfolio" element={
            <ProtectedRoute>
              <PortfolioPage />
            </ProtectedRoute>
          } />
          <Route path="/virtual-trading/history" element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          } />
          <Route path="/market/indeks" element={
            <ProtectedRoute>
              <MarketOverviewPage />
            </ProtectedRoute>
          } />
          <Route path="/market/broker" element={
            <ProtectedRoute>
              <MarketOverviewPage />
            </ProtectedRoute>
          } />
          <Route path="/top-gainers" element={
            <ProtectedRoute>
              <TopGainersPage />
            </ProtectedRoute>
          } />
          <Route path="/top-losers" element={
            <ProtectedRoute>
              <TopLosersPage />
            </ProtectedRoute>
          } />
          <Route path="/tv" element={
            <ProtectedRoute>
              <TradingViewSuperChart />
            </ProtectedRoute>
          } />
          <Route path="/tvs" element={
            <ProtectedRoute>
              <TradingViewSuperChart />
            </ProtectedRoute>
          } />
          <Route path="/openbb" element={
            <ProtectedRoute>
              <OpenBBDashboard />
            </ProtectedRoute>
          } />
          <Route path="/openbbdataexplorer" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <OpenBBDataExplorer />
              </ErrorBoundary>
            </ProtectedRoute>
          } />

          {/* Debug logging for TradingView route */}
          {(() => {
            console.log('[App.jsx] TradingView route configured:', {
              tv: '/tv',
              protected: true,
              timestamp: new Date().toISOString()
            });
            return null;
          })()}

          {/* Debug logging for Top Gainers/Losers routes */}
          {(() => {
            console.log('[App.jsx] Top Gainers/Losers routes configured:', {
              topGainers: '/top-gainers',
              topLosers: '/top-losers',
              bothProtected: true,
              timestamp: new Date().toISOString()
            });
            return null;
          })()}

          {/* Debug logging for route validation */}
          {(() => {
            console.log('[App.jsx] Virtual Trading routes configured:', {
              virtualTrading: '/virtual-trading',
              portfolio: '/virtual-trading/portfolio',
              history: '/virtual-trading/history',
              allProtected: true,
              timestamp: new Date().toISOString()
            });
            return null;
          })()}

          {/* Debug logging for Market Overview routes */}
          {(() => {
            console.log('[App.jsx] Market Overview routes configured:', {
              marketOverview: '/market/indeks',
              brokerTransactions: '/market/broker',
              allProtected: true,
              timestamp: new Date().toISOString()
            });
            return null;
          })()}
          </Routes>
        </ErrorBoundary>
      </MainLayout>
    </ThemeProvider>
  );
};
export default App;
