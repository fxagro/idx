import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative inline-flex items-center justify-center w-12 h-6 rounded-full transition-all duration-300 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-100
        ${isDark 
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/25' 
          : 'bg-gradient-to-r from-yellow-400 to-orange-400 shadow-lg shadow-yellow-500/25'
        }
        hover:scale-110 active:scale-95
      `}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Toggle ball */}
      <div
        className={`
          absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 ease-in-out transform
          ${isDark 
            ? 'translate-x-6 bg-white shadow-md' 
            : 'translate-x-0.5 bg-white shadow-md'
          }
          hover:shadow-lg
        `}
      >
        {/* Icon inside the toggle ball */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isDark ? (
            // Moon icon for dark mode
            <svg 
              className="w-3 h-3 text-indigo-600 transition-transform duration-300" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" 
                clipRule="evenodd" 
              />
            </svg>
          ) : (
            // Sun icon for light mode
            <svg 
              className="w-3 h-3 text-yellow-500 transition-transform duration-300" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" 
                clipRule="evenodd" 
              />
            </svg>
          )}
        </div>
      </div>

      {/* Background gradient effect */}
      <div
        className={`
          absolute inset-0 rounded-full transition-opacity duration-300
          ${isDark 
            ? 'bg-gradient-to-r from-indigo-400/20 to-purple-400/20' 
            : 'bg-gradient-to-r from-yellow-300/20 to-orange-300/20'
          }
        `}
      />

      {/* Sparkle effects for visual appeal */}
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          className={`
            absolute w-1 h-1 rounded-full transition-all duration-500
            ${isDark 
              ? 'bg-white/60 top-1 left-2 animate-pulse' 
              : 'bg-yellow-200/80 top-1 left-1 animate-pulse'
            }
          `}
          style={{ animationDelay: '0s' }}
        />
        <div
          className={`
            absolute w-0.5 h-0.5 rounded-full transition-all duration-500
            ${isDark 
              ? 'bg-white/40 bottom-1 right-2 animate-pulse' 
              : 'bg-orange-200/60 bottom-1 right-1 animate-pulse'
            }
          `}
          style={{ animationDelay: '0.5s' }}
        />
      </div>
    </button>
  );
}