import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Bandarmologi from '../Bandarmologi';
import api from '../../utils/api';

// Mock the API module
jest.mock('../../utils/api', () => ({
  get: jest.fn()
}));

describe('Bandarmologi Component', () => {
  let queryClient;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
  });

  const renderWithQueryClient = (component) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  test('renders form inputs correctly', () => {
    renderWithQueryClient(<Bandarmologi />);

    // Check if form elements are present
    expect(screen.getByText('Bandarmologi - Broker Analysis')).toBeInTheDocument();
    expect(screen.getByLabelText(/Stock Symbol/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Days/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyze/i })).toBeInTheDocument();
  });

  test('form inputs have correct default values', () => {
    renderWithQueryClient(<Bandarmologi />);

    const symbolInput = screen.getByLabelText(/Stock Symbol/i);
    const daysInput = screen.getByLabelText(/Days/i);

    expect(symbolInput.value).toBe('BBCA');
    expect(daysInput.value).toBe('30');
  });

  test('allows user to change form inputs', () => {
    renderWithQueryClient(<Bandarmologi />);

    const symbolInput = screen.getByLabelText(/Stock Symbol/i);
    const daysInput = screen.getByLabelText(/Days/i);

    // Change symbol
    fireEvent.change(symbolInput, { target: { value: 'HDFA' } });
    expect(symbolInput.value).toBe('HDFA');

    // Change days
    fireEvent.change(daysInput, { target: { value: '60' } });
    expect(daysInput.value).toBe('60');
  });

  test('shows loading state when analyzing', async () => {
    // Mock API call
    api.get.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    renderWithQueryClient(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });

    // Click analyze button
    fireEvent.click(analyzeButton);

    // Check if loading state is shown
    expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    expect(analyzeButton).toBeDisabled();
  });

  test('displays broker data when API call succeeds', async () => {
    const mockResponse = {
      data: {
        symbol: 'BBCA',
        period: {
          start_date: '2025-01-01',
          end_date: '2025-01-30',
          days: 30
        },
        bandar_data: [
          {
            kode_broker: 'XL',
            nama_broker: 'MNC Sekuritas',
            jenis_broker: 'lokal retail',
            buy_freq: 150,
            buy_vol: 1000000,
            buy_avg: 2500,
            buy_percent: 25.5,
            sell_freq: 120,
            sell_vol: 800000,
            sell_avg: 2480,
            sell_percent: 20.3,
            net_vol: 200000
          }
        ],
        stock_info: {
          penutupan: 2500,
          selisih: 50,
          sebelumnya: 2450
        },
        total_brokers: 1
      }
    };

    api.get.mockResolvedValue(mockResponse);

    renderWithQueryClient(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    // Wait for API call to complete
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/stocks/bandar?symbol=BBCA&days=30');
    });

    // Check if data is displayed
    await waitFor(() => {
      expect(screen.getByText('MNC Sekuritas')).toBeInTheDocument();
      expect(screen.getByText('lokal retail')).toBeInTheDocument();
      expect(screen.getByText('200,000')).toBeInTheDocument(); // net_vol
    });
  });

  test('displays error message when API call fails', async () => {
    const errorMessage = 'Failed to fetch broker analysis data';
    api.get.mockRejectedValue({
      response: {
        data: { message: errorMessage }
      }
    });

    renderWithQueryClient(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  test('displays stock information when available', async () => {
    const mockResponse = {
      data: {
        symbol: 'BBCA',
        bandar_data: [],
        stock_info: {
          penutupan: 2500,
          selisih: 50,
          sebelumnya: 2450
        },
        total_brokers: 0
      }
    };

    api.get.mockResolvedValue(mockResponse);

    renderWithQueryClient(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    // Wait for stock info to be displayed
    await waitFor(() => {
      expect(screen.getByText('Stock Information')).toBeInTheDocument();
      expect(screen.getByText('Rp 2,500')).toBeInTheDocument();
      expect(screen.getByText('+50')).toBeInTheDocument();
    });
  });
});