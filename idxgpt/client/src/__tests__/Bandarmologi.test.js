import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Bandarmologi from '../components/Bandarmologi';
import api from '../utils/api';

// Mock the API module
jest.mock('../utils/api');
const mockApi = api;

// Mock Chart.js components
jest.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="mock-chart">Chart Component</div>
}));

// Mock Chart.js registration
jest.mock('chart.js', () => ({
  Chart: {
    register: jest.fn()
  },
  CategoryScale: jest.fn(),
  LinearScale: jest.fn(),
  BarElement: jest.fn(),
  Title: jest.fn(),
  Tooltip: jest.fn(),
  Legend: jest.fn()
}));

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 0,
      cacheTime: 0,
    },
  },
});

const renderWithProviders = (component) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {component}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Bandarmologi Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders form inputs correctly', () => {
    renderWithProviders(<Bandarmologi />);

    expect(screen.getByText('Bandarmologi - Broker Analysis')).toBeInTheDocument();
    expect(screen.getByLabelText(/Stock Symbol/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Days/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analyze/i })).toBeInTheDocument();
  });

  test('form inputs have correct default values', () => {
    renderWithProviders(<Bandarmologi />);

    const symbolInput = screen.getByLabelText(/Stock Symbol/i);
    const daysInput = screen.getByLabelText(/Days/i);

    expect(symbolInput.value).toBe('BBCA');
    expect(daysInput.value).toBe('30');
  });

  test('allows user to change form inputs', () => {
    renderWithProviders(<Bandarmologi />);

    const symbolInput = screen.getByLabelText(/Stock Symbol/i);
    const dateInput = screen.getByLabelText(/Date/i);
    const daysInput = screen.getByLabelText(/Days/i);

    fireEvent.change(symbolInput, { target: { value: 'HDFA' } });
    fireEvent.change(dateInput, { target: { value: '2025-01-15' } });
    fireEvent.change(daysInput, { target: { value: '60' } });

    expect(symbolInput.value).toBe('HDFA');
    expect(dateInput.value).toBe('2025-01-15');
    expect(daysInput.value).toBe('60');
  });

  test('displays loading state when analyzing', async () => {
    // Mock API call that takes time to resolve
    mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    const symbolInput = screen.getByLabelText(/Stock Symbol/i);

    fireEvent.change(symbolInput, { target: { value: 'BBCA' } });
    fireEvent.click(analyzeButton);

    // Button should show loading state
    expect(screen.getByRole('button', { name: /Analyzing/i })).toBeInTheDocument();
    expect(analyzeButton).toBeDisabled();
  });

  test('renders broker data table on successful API call', async () => {
    const mockData = {
      symbol: 'BBCA',
      period: { start_date: '2025-01-01', end_date: '2025-01-30', days: 30 },
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
        },
        {
          kode_broker: 'YU',
          nama_broker: 'Foreign Broker',
          jenis_broker: 'asing',
          buy_freq: 80,
          buy_vol: 500000,
          buy_avg: 2520,
          buy_percent: 12.7,
          sell_freq: 200,
          sell_vol: 1200000,
          sell_avg: 2510,
          sell_percent: 30.4,
          net_vol: -700000
        }
      ],
      stock_info: { penutupan: 2500, selisih: 50, sebelumnya: 2450 }
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('MNC Sekuritas')).toBeInTheDocument();
    });

    // Check if stock info is displayed
    expect(screen.getByText('Stock Information')).toBeInTheDocument();
    expect(screen.getByText('Closing Price:')).toBeInTheDocument();
    expect(screen.getByText('Rp 2,500')).toBeInTheDocument();

    // Check if broker data is displayed
    expect(screen.getByText('Broker Analysis Results (2 brokers)')).toBeInTheDocument();
    expect(screen.getByText('XL')).toBeInTheDocument();
    expect(screen.getByText('YU')).toBeInTheDocument();
    expect(screen.getByText('🟩 lokal retail')).toBeInTheDocument();
    expect(screen.getByText('🟥 asing')).toBeInTheDocument();

    // Check if chart is rendered
    expect(screen.getByTestId('mock-chart')).toBeInTheDocument();
  });

  test('displays error message on API failure', async () => {
    const errorMessage = 'Invalid stock symbol';
    mockApi.get.mockRejectedValue({
      response: { data: { message: errorMessage } }
    });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch broker analysis data/i)).toBeInTheDocument();
    });
  });

  test('handles form submission with different parameters', async () => {
    const mockData = {
      symbol: 'HDFA',
      period: { start_date: '2025-01-01', end_date: '2025-01-15', days: 15 },
      bandar_data: [],
      stock_info: { penutupan: 1500, selisih: -25, sebelumnya: 1525 }
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const symbolInput = screen.getByLabelText(/Stock Symbol/i);
    const dateInput = screen.getByLabelText(/Date/i);
    const daysInput = screen.getByLabelText(/Days/i);
    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });

    fireEvent.change(symbolInput, { target: { value: 'HDFA' } });
    fireEvent.change(dateInput, { target: { value: '2025-01-15' } });
    fireEvent.change(daysInput, { target: { value: '15' } });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/stocks/bandar?symbol=HDFA&days=15&date=2025-01-15');
    });
  });

  test('shows no data message when no brokers found', async () => {
    const mockData = {
      symbol: 'INVALID',
      period: { start_date: '2025-01-01', end_date: '2025-01-30', days: 30 },
      bandar_data: [],
      stock_info: null
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('No broker data available. Try adjusting your search parameters.')).toBeInTheDocument();
    });
  });

  test('validates required fields', () => {
    renderWithProviders(<Bandarmologi />);

    const symbolInput = screen.getByLabelText(/Stock Symbol/i);
    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });

    // Clear the symbol field
    fireEvent.change(symbolInput, { target: { value: '' } });

    expect(symbolInput).toBeRequired();
    expect(analyzeButton).not.toBeDisabled(); // Button should still work, validation is handled by React Query
  });

  test('handles days input validation', () => {
    renderWithProviders(<Bandarmologi />);

    const daysInput = screen.getByLabelText(/Days/i);

    fireEvent.change(daysInput, { target: { value: '0' } });
    expect(daysInput.value).toBe('0');

    fireEvent.change(daysInput, { target: { value: '365' } });
    expect(daysInput.value).toBe('365');

    fireEvent.change(daysInput, { target: { value: '366' } });
    expect(daysInput.value).toBe('366'); // HTML5 validation allows this, but API will handle it
  });

  test('converts symbol to uppercase', () => {
    renderWithProviders(<Bandarmologi />);

    const symbolInput = screen.getByLabelText(/Stock Symbol/i);

    fireEvent.change(symbolInput, { target: { value: 'bbca' } });

    expect(symbolInput.value).toBe('BBCA');
  });

  test('renders chart only when data is available', async () => {
    const mockData = {
      symbol: 'BBCA',
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
      stock_info: { penutupan: 2500, selisih: 50, sebelumnya: 2450 }
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByTestId('mock-chart')).toBeInTheDocument();
      expect(screen.getByText('Net Volume by Broker')).toBeInTheDocument();
    });
  });

  test('renders view type dropdown when data is available', async () => {
    const mockData = {
      symbol: 'BBCA',
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
      stock_info: { penutupan: 2500, selisih: 50, sebelumnya: 2450 }
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Table View')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  test('switches between default and detailed table views', async () => {
    const mockData = {
      symbol: 'BBCA',
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
      stock_info: { penutupan: 2500, selisih: 50, sebelumnya: 2450 }
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Table View')).toBeInTheDocument();
    });

    const viewSelect = screen.getByRole('combobox');
    expect(viewSelect).toHaveValue('default');

    // Switch to detailed view
    fireEvent.change(viewSelect, { target: { value: 'detailed' } });
    expect(viewSelect).toHaveValue('detailed');

    // Check if detailed table is rendered
    await waitFor(() => {
      expect(screen.getByText('Detailed Broker Analysis')).toBeInTheDocument();
      expect(screen.getByText('Net Val')).toBeInTheDocument();
    });
  });

  test('sorts data by Net Vol (positive to negative)', async () => {
    const mockData = {
      symbol: 'BBCA',
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
          net_vol: 200000 // Buy Vol - Sell Vol = 1000000 - 800000 = 200000
        },
        {
          kode_broker: 'YU',
          nama_broker: 'Foreign Broker',
          jenis_broker: 'asing',
          buy_freq: 80,
          buy_vol: 500000,
          buy_avg: 2520,
          buy_percent: 12.7,
          sell_freq: 200,
          sell_vol: 1200000,
          sell_avg: 2510,
          sell_percent: 30.4,
          net_vol: -700000 // Buy Vol - Sell Vol = 500000 - 1200000 = -700000
        },
        {
          kode_broker: 'AA',
          nama_broker: 'BUMN Securities',
          jenis_broker: 'bumn',
          buy_freq: 200,
          buy_vol: 1500000,
          buy_avg: 2490,
          buy_percent: 38.2,
          sell_freq: 90,
          sell_vol: 600000,
          sell_avg: 2500,
          sell_percent: 15.2,
          net_vol: 900000 // Buy Vol - Sell Vol = 1500000 - 600000 = 900000
        }
      ],
      stock_info: { penutupan: 2500, selisih: 50, sebelumnya: 2450 }
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Table View')).toBeInTheDocument();
    });

    // Switch to detailed view to see the sorting
    const viewSelect = screen.getByRole('combobox');
    fireEvent.change(viewSelect, { target: { value: 'detailed' } });

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // First row should be AA (900000), then XL (200000), then YU (-700000)
      expect(rows[1]).toHaveTextContent('AA');
      expect(rows[2]).toHaveTextContent('XL');
      expect(rows[3]).toHaveTextContent('YU');
    });
  });

  test('calculates Net Val correctly based on Net Vol sign', async () => {
    const mockData = {
      symbol: 'BBCA',
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
          net_vol: 200000 // Buy Vol - Sell Vol = 1000000 - 800000 = 200000
        },
        {
          kode_broker: 'YU',
          nama_broker: 'Foreign Broker',
          jenis_broker: 'asing',
          buy_freq: 80,
          buy_vol: 500000,
          buy_avg: 2520,
          buy_percent: 12.7,
          sell_freq: 200,
          sell_vol: 1200000,
          sell_avg: 2510,
          sell_percent: 30.4,
          net_vol: -700000 // Buy Vol - Sell Vol = 500000 - 1200000 = -700000
        }
      ],
      stock_info: { penutupan: 2500, selisih: 50, sebelumnya: 2450 }
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Table View')).toBeInTheDocument();
    });

    // Switch to detailed view to see Net Val calculations
    const viewSelect = screen.getByRole('combobox');
    fireEvent.change(viewSelect, { target: { value: 'detailed' } });

    await waitFor(() => {
      // XL has positive Net Vol, so Net Val should be net_vol * buy_avg = 200000 * 2500 = 500,000,000
      expect(screen.getByText('500,000,000')).toBeInTheDocument();

      // YU has negative Net Vol, so Net Val should be net_vol * sell_avg = -700000 * 2510 = -1,757,000,000
      expect(screen.getByText('-1,757,000,000')).toBeInTheDocument();
    });
  });

  test('applies correct color coding for Net Vol', async () => {
    const mockData = {
      symbol: 'BBCA',
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
          net_vol: 200000 // Buy Vol - Sell Vol = 1000000 - 800000 = 200000
        },
        {
          kode_broker: 'YU',
          nama_broker: 'Foreign Broker',
          jenis_broker: 'asing',
          buy_freq: 80,
          buy_vol: 500000,
          buy_avg: 2520,
          buy_percent: 12.7,
          sell_freq: 200,
          sell_vol: 1200000,
          sell_avg: 2510,
          sell_percent: 30.4,
          net_vol: -700000 // Buy Vol - Sell Vol = 500000 - 1200000 = -700000
        },
        {
          kode_broker: 'AA',
          nama_broker: 'BUMN Securities',
          jenis_broker: 'bumn',
          buy_freq: 200,
          buy_vol: 1500000,
          buy_avg: 2490,
          buy_percent: 38.2,
          sell_freq: 90,
          sell_vol: 600000,
          sell_avg: 2500,
          sell_percent: 15.2,
          net_vol: 900000 // Buy Vol - Sell Vol = 1500000 - 600000 = 900000
        }
      ],
      stock_info: { penutupan: 2500, selisih: 50, sebelumnya: 2450 }
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Table View')).toBeInTheDocument();
    });

    // Switch to detailed view to see color coding
    const viewSelect = screen.getByRole('combobox');
    fireEvent.change(viewSelect, { target: { value: 'detailed' } });

    await waitFor(() => {
      const rows = screen.getAllByRole('row');

      // Check for green background (positive Net Vol)
      expect(rows[1]).toHaveClass('bg-green-500');
      expect(rows[2]).toHaveClass('bg-green-500');

      // Check for red background (negative Net Vol)
      expect(rows[3]).toHaveClass('bg-red-500');
    });
  });

  test('displays broker type indicators correctly', async () => {
    const mockData = {
      symbol: 'BBCA',
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
        },
        {
          kode_broker: 'YU',
          nama_broker: 'Foreign Broker',
          jenis_broker: 'asing',
          buy_freq: 80,
          buy_vol: 500000,
          buy_avg: 2520,
          buy_percent: 12.7,
          sell_freq: 200,
          sell_vol: 1200000,
          sell_avg: 2510,
          sell_percent: 30.4,
          net_vol: -700000
        },
        {
          kode_broker: 'AA',
          nama_broker: 'BUMN Securities',
          jenis_broker: 'bumn',
          buy_freq: 200,
          buy_vol: 1500000,
          buy_avg: 2490,
          buy_percent: 38.2,
          sell_freq: 90,
          sell_vol: 600000,
          sell_avg: 2500,
          sell_percent: 15.2,
          net_vol: 900000
        }
      ],
      stock_info: { penutupan: 2500, selisih: 50, sebelumnya: 2450 }
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Table View')).toBeInTheDocument();
    });

    // Switch to detailed view to see broker indicators
    const viewSelect = screen.getByRole('combobox');
    fireEvent.change(viewSelect, { target: { value: 'detailed' } });

    await waitFor(() => {
      // Check for broker type indicators
      expect(screen.getByText('🟩 XL')).toBeInTheDocument(); // lokal retail
      expect(screen.getByText('🟥 YU')).toBeInTheDocument(); // asing
      expect(screen.getByText('🟨 AA')).toBeInTheDocument(); // bumn
    });
  });

  test('renders comprehensive stock info from saham_data', async () => {
    const mockData = {
      symbol: 'BBCA',
      period: { start_date: '2025-08-21', end_date: '2025-09-20', days: 30 },
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
        closing_price: 7100,
        change: 225,
        change_percent: 3.27,
        previous: 6875,
        high: 7475,
        low: 6700,
        average_volume: 12700000,
        total_volume: 292400000,
        trading_days: 23
      },
      total_brokers: 1
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Stock Information')).toBeInTheDocument();
      expect(screen.getByText('Current Price')).toBeInTheDocument();
      expect(screen.getByText('Rp 7,100')).toBeInTheDocument();
      expect(screen.getByText('Change')).toBeInTheDocument();
      expect(screen.getByText('+Rp 225')).toBeInTheDocument();
      expect(screen.getByText('(3.27%)')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Rp 7,475')).toBeInTheDocument();
      expect(screen.getByText('Low')).toBeInTheDocument();
      expect(screen.getByText('Rp 6,700')).toBeInTheDocument();
      expect(screen.getByText('Average Volume:')).toBeInTheDocument();
      expect(screen.getByText('12,700,000')).toBeInTheDocument();
      expect(screen.getByText('Total Volume:')).toBeInTheDocument();
      expect(screen.getByText('292,400,000')).toBeInTheDocument();
      expect(screen.getByText('Trading Days:')).toBeInTheDocument();
      expect(screen.getByText('23 Days')).toBeInTheDocument();
    });
  });

  test('renders fallback when saham_data is empty', async () => {
    const mockData = {
      symbol: 'BBCA',
      period: { start_date: '2025-08-21', end_date: '2025-09-20', days: 30 },
      bandar_data: [],
      stock_info: {
        closing_price: 0,
        change: 0,
        change_percent: 0,
        previous: 0,
        high: 0,
        low: 0,
        average_volume: 0,
        total_volume: 0,
        trading_days: 0
      },
      total_brokers: 0
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Stock Information')).toBeInTheDocument();
      expect(screen.getByText('Current Price')).toBeInTheDocument();
      expect(screen.getByText('Rp 0')).toBeInTheDocument();
      expect(screen.getByText('Stock data not available for the selected period. Using latest available data.')).toBeInTheDocument();
    });
  });

  test('calculates change percentage correctly when previous price is zero', async () => {
    const mockData = {
      symbol: 'BBCA',
      period: { start_date: '2025-08-21', end_date: '2025-09-20', days: 30 },
      bandar_data: [],
      stock_info: {
        closing_price: 7100,
        change: 225,
        change_percent: 0, // Should be calculated as 0 when previous is 0
        previous: 0,
        high: 7475,
        low: 6700,
        average_volume: 12700000,
        total_volume: 292400000,
        trading_days: 23
      },
      total_brokers: 0
    };

    mockApi.get.mockResolvedValue({ data: mockData });

    renderWithProviders(<Bandarmologi />);

    const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('(0.00%)')).toBeInTheDocument();
    });
  });
});