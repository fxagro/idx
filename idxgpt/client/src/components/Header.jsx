import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { useTranslation } from "react-i18next";
import ThemeToggle from "./ThemeToggle";
import { ChevronDown, LayoutDashboard, Database, Microscope, Star, Wallet, Network, User, BarChart3, Target, TrendingUp, TrendingDown, Activity, Brain, Zap, DollarSign, Building2, FileText, Menu, X } from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { i18n, t } = useTranslation();
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const languageMenuRef = useRef(null);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate("/"); // setelah logout balik ke landing page
  };

  const changeLanguage = (language) => {
    i18n.changeLanguage(language);
    setIsLanguageMenuOpen(false);
  };

  const toggleLanguageMenu = () => {
    setIsLanguageMenuOpen(!isLanguageMenuOpen);
  };

  const toggleDropdown = (dropdown) => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target)) {
        setIsLanguageMenuOpen(false);
      }
      // Close all dropdowns if clicking outside
      if (!event.target.closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-white dark:bg-slate-800 shadow-sm dark:shadow-lg sticky top-0 z-50 border-b border-gray-200 dark:border-slate-700 transition-colors duration-300">
      <div className="max-w-6xl mx-auto flex justify-between items-center px-4 py-3">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold text-indigo-600 dark:text-indigo-400 transition-colors duration-300">
          myTradeX
        </Link>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMobileMenu}
          className="xl:hidden p-2 rounded-md text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden xl:flex items-center gap-2">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Language Switcher */}
          <div className="relative" ref={languageMenuRef}>
            <button
              onClick={toggleLanguageMenu}
              className="flex items-center gap-1 px-2 py-1 text-sm text-gray-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 0a9 9 0 01-9-9m9 9a9 9 0 00-9 9m9-9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <span className="hidden sm:inline">{i18n.language === 'en' ? 'EN' : 'ID'}</span>
            </button>

            {isLanguageMenuOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-slate-800 rounded-md shadow-lg dark:shadow-xl border border-gray-200 dark:border-slate-600 z-50">
                <div className="py-1">
                  <button
                    onClick={() => changeLanguage('en')}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${
                      i18n.language === 'en' ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-slate-300'
                    }`}
                  >
                    🇺🇸 English
                  </button>
                  <button
                    onClick={() => changeLanguage('id')}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${
                      i18n.language === 'id' ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-slate-300'
                    }`}
                  >
                    🇮🇩 Indonesia
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Organized Navigation Dropdowns */}
          {user ? (
            <>
              {/* Dashboard Dropdown */}
              <div className="relative dropdown-container">
                <button
                  onClick={() => toggleDropdown('dashboard')}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                >
                  <LayoutDashboard size={16} className="flex-shrink-0" />
                  <span className="hidden sm:inline">Dashboard</span>
                  <ChevronDown size={14} className="flex-shrink-0" />
                </button>
                {openDropdown === 'dashboard' && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-slate-600 animate-in fade-in-0 zoom-in-95 duration-200">
                    <div className="py-2">
                      <Link to="/dashboard" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <BarChart3 size={14} className="flex-shrink-0" />
                        <span>Dashboard</span>
                      </Link>
                      <Link to="/dashboard-v2" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <LayoutDashboard size={14} className="flex-shrink-0" />
                        <span>Dashboard V2</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Market Data Dropdown */}
              <div className="relative dropdown-container">
                <button
                  onClick={() => toggleDropdown('marketData')}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                >
                  <Database size={16} className="flex-shrink-0" />
                  <span className="hidden sm:inline">Market Data</span>
                  <ChevronDown size={14} className="flex-shrink-0" />
                </button>
                {openDropdown === 'marketData' && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-slate-600 animate-in fade-in-0 zoom-in-95 duration-200">
                    <div className="py-2">
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Stock Data</div>
                      <Link to="/stocks" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <BarChart3 size={14} className="flex-shrink-0" />
                        <span>Stock List</span>
                      </Link>
                      <Link to="/watchlist" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <Target size={14} className="flex-shrink-0" />
                        <span>Watchlist</span>
                      </Link>
                      <div className="border-t border-gray-200 dark:border-slate-600 my-2"></div>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Market Lists</div>
                      <Link to="/top-gainers" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <TrendingUp size={14} className="flex-shrink-0" />
                        <span>Top Gainers</span>
                      </Link>
                      <Link to="/top-losers" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <TrendingDown size={14} className="flex-shrink-0" />
                        <span>Top Losers</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Analysis Dropdown */}
              <div className="relative dropdown-container">
                <button
                  onClick={() => toggleDropdown('analysis')}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                >
                  <Microscope size={16} className="flex-shrink-0" />
                  <span className="hidden sm:inline">Analysis</span>
                  <ChevronDown size={14} className="flex-shrink-0" />
                </button>
                {openDropdown === 'analysis' && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-slate-600 animate-in fade-in-0 zoom-in-95 duration-200">
                    <div className="py-2">
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">AI Analysis</div>
                      <Link to="/ai" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <Brain size={14} className="flex-shrink-0" />
                        <span>AI Analysis</span>
                      </Link>
                      <Link to="/ai-v2" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <Zap size={14} className="flex-shrink-0" />
                        <span>AI Analysis V2</span>
                      </Link>
                      <div className="border-t border-gray-200 dark:border-slate-600 my-2"></div>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Technical Analysis</div>
                      <Link to="/technical" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <Activity size={14} className="flex-shrink-0" />
                        <span>Technical Analysis</span>
                      </Link>
                      <Link to="/chartjs" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <BarChart3 size={14} className="flex-shrink-0" />
                        <span>Charts</span>
                      </Link>
                      <div className="border-t border-gray-200 dark:border-slate-600 my-2"></div>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Fundamental Analysis</div>
                      <Link to="/fundamental" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <DollarSign size={14} className="flex-shrink-0" />
                        <span>Fundamental Analysis</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Tools Dropdown */}
              <div className="relative dropdown-container">
                <button
                  onClick={() => toggleDropdown('advanced')}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                >
                  <Star size={16} className="flex-shrink-0" />
                  <span className="hidden sm:inline">Advanced</span>
                  <ChevronDown size={14} className="flex-shrink-0" />
                </button>
                {openDropdown === 'advanced' && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-slate-600 animate-in fade-in-0 zoom-in-95 duration-200">
                    <div className="py-2">
                      <Link to="/bandarmologi" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <FileText size={14} className="flex-shrink-0" />
                        <span>Bandarmologi</span>
                      </Link>
                      <Link to="/bandarmologi-premium" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-yellow-600 dark:text-yellow-400 font-semibold">
                        <Star size={14} className="flex-shrink-0" />
                        <span>Bandarmologi Premium</span>
                      </Link>
                      <Link to="/sniper-lens" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <Target size={14} className="flex-shrink-0" />
                        <span>Sniper Lens</span>
                      </Link>
                      <Link to="/broker" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <Building2 size={14} className="flex-shrink-0" />
                        <span>Broker Analysis</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Trading Dropdown */}
              <div className="relative dropdown-container">
                <button
                  onClick={() => toggleDropdown('trading')}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                >
                  <Wallet size={16} className="flex-shrink-0" />
                  <span className="hidden sm:inline">Trading</span>
                  <ChevronDown size={14} className="flex-shrink-0" />
                </button>
                {openDropdown === 'trading' && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-slate-600 animate-in fade-in-0 zoom-in-95 duration-200">
                    <div className="py-2">
                      <Link to="/virtual-trading" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <Wallet size={14} className="flex-shrink-0" />
                        <span>Virtual Trading</span>
                      </Link>
                      <Link to="/virtual-trading/portfolio" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <BarChart3 size={14} className="flex-shrink-0" />
                        <span>Portfolio</span>
                      </Link>
                      <Link to="/virtual-trading/history" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <FileText size={14} className="flex-shrink-0" />
                        <span>History</span>
                      </Link>
                      <Link to="/virtual-trading/history" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        <span>Trade Confirmation</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Community Dropdown */}
              <div className="relative dropdown-container">
                <button
                  onClick={() => toggleDropdown('community')}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                >
                  <Network size={16} className="flex-shrink-0" />
                  <span className="hidden sm:inline">Community</span>
                  <ChevronDown size={14} className="flex-shrink-0" />
                </button>
                {openDropdown === 'community' && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-slate-600 animate-in fade-in-0 zoom-in-95 duration-200">
                    <div className="py-2">
                      <Link to="/network" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                        <Network size={14} className="flex-shrink-0" />
                        <span>My Network</span>
                      </Link>
                      {user.role === 'admin' && (
                        <Link to="/admin" className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                          <User size={14} className="flex-shrink-0" />
                          <span>Admin Panel</span>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Link to="/plans" className="text-gray-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700">
                Plans
              </Link>

              <button
                onClick={handleLogout}
                className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/plans" className="text-gray-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700">
                Plans
              </Link>
              <Link
                to="/register"
                className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 dark:hover:bg-green-800 transition-colors"
              >
                Register
              </Link>
              <Link
                to="/login"
                className="px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 dark:hover:bg-indigo-800 transition-colors"
              >
                Login
              </Link>
            </>
          )}
        </nav>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="xl:hidden bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 max-h-[80vh] overflow-y-auto">
          <nav className="flex flex-col px-4 py-3 gap-2">
            {/* Mobile Theme Toggle & Language */}
            <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-slate-700">
              <span className="text-sm text-gray-600 dark:text-slate-400">Theme</span>
              <ThemeToggle />
            </div>

            {/* Mobile Language Switcher */}
            <div className="py-2 border-b border-gray-200 dark:border-slate-700">
              <span className="text-sm text-gray-600 dark:text-slate-400 mb-2 block">Language</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { changeLanguage('en'); closeMobileMenu(); }}
                  className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                    i18n.language === 'en' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  🇺🇸 English
                </button>
                <button
                  onClick={() => { changeLanguage('id'); closeMobileMenu(); }}
                  className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                    i18n.language === 'id' 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                  }`}
                >
                  🇮🇩 Indonesia
                </button>
              </div>
            </div>

            {user ? (
              <>
                {/* Mobile Dashboard */}
                <div className="py-2 border-b border-gray-200 dark:border-slate-700">
                  <span className="text-sm font-semibold text-gray-900 dark:text-slate-200 mb-2 block">Dashboard</span>
                  <Link to="/dashboard" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <BarChart3 size={16} /> Dashboard
                  </Link>
                  <Link to="/dashboard-v2" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <LayoutDashboard size={16} /> Dashboard V2
                  </Link>
                </div>

                {/* Mobile Market Data */}
                <div className="py-2 border-b border-gray-200 dark:border-slate-700">
                  <span className="text-sm font-semibold text-gray-900 dark:text-slate-200 mb-2 block">Market Data</span>
                  <Link to="/stocks" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <BarChart3 size={16} /> Stock List
                  </Link>
                  <Link to="/watchlist" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <Target size={16} /> Watchlist
                  </Link>
                  <Link to="/top-gainers" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <TrendingUp size={16} /> Top Gainers
                  </Link>
                  <Link to="/top-losers" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <TrendingDown size={16} /> Top Losers
                  </Link>
                </div>

                {/* Mobile Analysis */}
                <div className="py-2 border-b border-gray-200 dark:border-slate-700">
                  <span className="text-sm font-semibold text-gray-900 dark:text-slate-200 mb-2 block">Analysis</span>
                  <Link to="/ai" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <Brain size={16} /> AI Analysis
                  </Link>
                  <Link to="/ai-v2" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <Zap size={16} /> AI Analysis V2
                  </Link>
                  <Link to="/technical" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <Activity size={16} /> Technical Analysis
                  </Link>
                  <Link to="/chartjs" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <BarChart3 size={16} /> Charts
                  </Link>
                  <Link to="/fundamental" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <DollarSign size={16} /> Fundamental Analysis
                  </Link>
                </div>

                {/* Mobile Advanced */}
                <div className="py-2 border-b border-gray-200 dark:border-slate-700">
                  <span className="text-sm font-semibold text-gray-900 dark:text-slate-200 mb-2 block">Advanced</span>
                  <Link to="/bandarmologi" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <FileText size={16} /> Bandarmologi
                  </Link>
                  <Link to="/bandarmologi-premium" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <Star size={16} /> Bandarmologi Premium
                  </Link>
                  <Link to="/sniper-lens" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <Target size={16} /> Sniper Lens
                  </Link>
                  <Link to="/broker" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <Building2 size={16} /> Broker Analysis
                  </Link>
                </div>

                {/* Mobile Trading */}
                <div className="py-2 border-b border-gray-200 dark:border-slate-700">
                  <span className="text-sm font-semibold text-gray-900 dark:text-slate-200 mb-2 block">Trading</span>
                  <Link to="/virtual-trading" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <Wallet size={16} /> Virtual Trading
                  </Link>
                  <Link to="/virtual-trading/portfolio" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <BarChart3 size={16} /> Portfolio
                  </Link>
                  <Link to="/virtual-trading/history" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <FileText size={16} /> History
                  </Link>
                  <Link to="/virtual-trading/history" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> 
                    Trade Confirmation
                  </Link>
                </div>

                {/* Mobile Community */}
                <div className="py-2 border-b border-gray-200 dark:border-slate-700">
                  <span className="text-sm font-semibold text-gray-900 dark:text-slate-200 mb-2 block">Community</span>
                  <Link to="/network" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                    <Network size={16} /> My Network
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                      <User size={16} /> Admin Panel
                    </Link>
                  )}
                </div>

                {/* Mobile Plans & Logout */}
                <div className="py-2">
                  <Link to="/plans" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md mb-2">
                    Plans
                  </Link>
                  <button
                    onClick={() => { handleLogout(); closeMobileMenu(); }}
                    className="w-full px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/plans" onClick={closeMobileMenu} className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md">
                  Plans
                </Link>
                <Link to="/register" onClick={closeMobileMenu} className="flex items-center justify-center gap-3 px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700 dark:hover:bg-green-800 transition-colors">
                  Register
                </Link>
                <Link to="/login" onClick={closeMobileMenu} className="flex items-center justify-center gap-3 px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 dark:hover:bg-indigo-800 transition-colors">
                  Login
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
