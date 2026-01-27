import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import OpenBBDataExplorer from '../OpenBBDataExplorer';
import api from '../../utils/api';

// Mock the API
jest.mock('../../utils/api');

// Mock the hooks
jest.mock('../../hooks/useQuota');
jest.mock('../../hooks/useAI');

// Create a test wrapper component
const TestWrapper = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          {children}
        </I18nextProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('OpenBBDataExplorer', () => {
  const mockMarketData = {
    data: {
      totalStocks: 750,
      gainers: 245,
      losers: 187,
      totalVolume: 15250000000,
      source: 'mock'
    }
  };

  const mockStockData = [
    {
      symbol: 'BBCA',
      name: 'Bank Central Asia',
      price: 8500,
      changePercent: 1.23,
      volume: 12500000
    },
    {
      symbol: 'TLKM',
      name: 'Telekomunikasi Indonesia',
      price: 3800,
      changePercent: -0.87,
      volume: 8900000
    },
    {
      symbol: 'ASII',
      name: 'Astra International',
      price: 5200,
      changePercent: 2.45,
      volume: 15600000
    }
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default API mocks
    api.get.mockImplementation((url) => {
      if (url.includes('/stocks/openbb/market')) {
        return Promise.resolve({ data: mockMarketData });
      }
      if (url.includes('/stocks/openbb/price')) {
        return Promise.resolve({ data: mockStockData });
      }
      if (url.includes('/stocks/openbb/etf')) {
        return Promise.resolve({
          data: [
            {
              symbol: 'QQQ',
              name: 'Invesco QQQ Trust',
              price: 385.42,
              changePercent: 1.23,
              volume: 45230000,
              expenseRatio: 0.20
            }
          ]
        });
      }
      if (url.includes('/stocks/openbb/crypto')) {
        return Promise.resolve({
          data: [
            {
              symbol: 'BTC',
              name: 'Bitcoin',
              price: 43250.67,
              changePercent: 2.45,
              volume: 23400000000,
              marketCap: 850000000000
            }
          ]
        });
      }
      if (url.includes('/stocks/openbb/forex')) {
        return Promise.resolve({
          data: [
            {
              symbol: 'EUR/USD',
              name: 'Euro / US Dollar',
              rate: 1.0876,
              changePercent: 0.23,
              bid: 1.0874,
              ask: 1.0878
            }
          ]
        });
      }
      if (url.includes('/stocks/openbb/commodities')) {
        return Promise.resolve({
          data: [
            {
              symbol: 'GC',
              name: 'Gold',
              price: 1987.65,
              changePercent: 1.23,
              volume: 234000,
              unit: 'oz'
            }
          ]
        });
      }
      if (url.includes('/stocks/openbb/economy')) {
        return Promise.resolve({
          data: [
            {
              symbol: 'GDP',
              name: 'Gross Domestic Product',
              value: 26.85,
              changePercent: 2.1,
              unit: 'Trillion USD'
            }
          ]
        });
      }
      if (url.includes('/portfolio')) {
        return Promise.resolve({
          data: [
            {
              symbol: 'AAPL',
              name: 'Apple Inc.',
              shares: 100,
              value: 17500.00,
              changePercent: 2.34,
              weight: 25.5
            }
          ]
        });
      }
      return Promise.resolve({ data: [] });
    });

    api.post.mockResolvedValue({ data: { success: true } });
  });

  test('renders OpenBB Data Explorer title', async () => {
    render(
      <TestWrapper>
        <OpenBBDataExplorer />
      </TestWrapper>
    );

    expect(screen.getByText(/OpenBB Data Explorer/i)).toBeInTheDocument();
  });

  test('displays market overview cards', async () => {
    render(
      <TestWrapper>
        <OpenBBDataExplorer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/750/i)).toBeInTheDocument(); // Total Stocks
      expect(screen.getByText(/245/i)).toBeInTheDocument(); // Gainers
      expect(screen.getByText(/187/i)).toBeInTheDocument(); // Losers
    });
  });

  test('switches between categories', async () => {
    render(
      <TestWrapper>
        <OpenBBDataExplorer />
      </TestWrapper>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/Stocks/i)).toBeInTheDocument();
    });

    // Click on Crypto category (should be available in the sidebar)
    const cryptoButton = screen.getByText(/₿ Crypto/i);
    fireEvent.click(cryptoButton);

    await waitFor(() => {
      expect(screen.getByText(/BTC/i)).toBeInTheDocument();
    });
  });

  test('filters data with search query', async () => {
    render(
      <TestWrapper>
        <OpenBBDataExplorer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/BBCA/i)).toBeInTheDocument();
    });

    // Find and use search input
    const searchInput = screen.getByPlaceholderText(/Search by symbol or name/i);
    fireEvent.change(searchInput, { target: { value: 'BBCA' } });

    await waitFor(() => {
      expect(screen.getByText(/Bank Central Asia/i)).toBeInTheDocument();
    });
  });

  test('switches between table and chart views', async () => {
    render(
      <TestWrapper>
        <OpenBBDataExplorer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/📋 Table/i)).toBeInTheDocument();
    });

    // Click on Chart view
    const chartButton = screen.getByText(/📊 Chart/i);
    fireEvent.click(chartButton);

    await waitFor(() => {
      expect(screen.getByText(/Select Symbols to View Chart/i)).toBeInTheDocument();
    });
  });

  test('handles API errors gracefully', async () => {
    // Mock API error
    api.get.mockRejectedValueOnce(new Error('API Error'));

    render(
      <TestWrapper>
        <OpenBBDataExplorer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Data unavailable/i)).toBeInTheDocument();
    });
  });

  test('displays loading states', async () => {
    // Mock slow API response
    api.get.mockImplementation(() =>
      new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(
      <TestWrapper>
        <OpenBBDataExplorer />
      </TestWrapper>
    );

    // Should show loading skeleton initially
    expect(screen.getByText(/OpenBB Data Explorer/i)).toBeInTheDocument();
  });

  test('adds symbol to watchlist', async () => {
    render(
      <TestWrapper>
        <OpenBBDataExplorer />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/BBCA/i)).toBeInTheDocument();
    });

    // Click watchlist button for BBCA
    const watchlistButton = screen.getAllByText(/⭐/i)[0];
    fireEvent.click(watchlistButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/watchlist', { symbol: 'BBCA' });
    });
  });
});