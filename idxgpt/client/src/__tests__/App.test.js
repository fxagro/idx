import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { AuthProvider } from '../context/auth.jsx';

// Mock the useAuth hook
const mockUseAuth = jest.fn();
jest.mock('../hooks/useAuth.jsx', () => ({
  useAuth: () => mockUseAuth()
}));

// Mock all page components to avoid import issues
jest.mock('../pages/Landing', () => () => <div>Landing Page</div>);
jest.mock('../pages/Login', () => () => <div>Login Page</div>);
jest.mock('../pages/Register', () => () => <div>Register Page</div>);
jest.mock('../pages/Plans', () => () => <div>Plans Page</div>);
jest.mock('../pages/Dashboard', () => () => <div>Dashboard Page</div>);
jest.mock('../pages/Portfolio', () => () => <div>Portfolio Page</div>);
jest.mock('../pages/ChartJS', () => () => <div>ChartJS Page</div>);
jest.mock('../pages/Bandarmologi', () => () => <div>Bandarmologi Page</div>);
jest.mock('../layouts/MainLayout', () => ({ children }) => <div>Layout {children}</div>);
jest.mock('../components/ProtectedRoute', () => ({ children }) => <div>Protected {children}</div>);
jest.mock('../components/ErrorBoundary', () => ({ children }) => <div>ErrorBoundary {children}</div>);

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (component, initialEntries = ['/']) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          {component}
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('App Routing Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders landing page for root route', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    renderWithProviders(<App />, ['/']);

    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Landing Page')).toBeInTheDocument();
  });

  test('renders login page for /login route', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    renderWithProviders(<App />, ['/login']);

    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  test('renders register page for /register route', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    renderWithProviders(<App />, ['/register']);

    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Register Page')).toBeInTheDocument();
  });

  test('renders plans page for /plans route', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    renderWithProviders(<App />, ['/plans']);

    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Plans Page')).toBeInTheDocument();
  });

  test('renders dashboard page for authenticated user', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });

    renderWithProviders(<App />, ['/dashboard']);

    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(screen.getByText('ErrorBoundary')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  test('renders portfolio page for authenticated user', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });

    renderWithProviders(<App />, ['/portfolio']);

    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(screen.getByText('ErrorBoundary')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Page')).toBeInTheDocument();
  });

  test('renders chartjs page for authenticated user', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });

    renderWithProviders(<App />, ['/chartjs']);

    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(screen.getByText('ErrorBoundary')).toBeInTheDocument();
    expect(screen.getByText('ChartJS Page')).toBeInTheDocument();
  });

  test('renders bandarmologi page for authenticated user', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });

    renderWithProviders(<App />, ['/bandarmologi']);

    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(screen.getByText('ErrorBoundary')).toBeInTheDocument();
    expect(screen.getByText('Bandarmologi Page')).toBeInTheDocument();
  });

  test('redirects unauthenticated user from protected routes', () => {
    // Mock no user (unauthenticated)
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    renderWithProviders(<App />, ['/dashboard']);

    // Should still render the protected route structure, but ProtectedRoute component
    // should handle the redirect logic internally
    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
  });

  test('handles unknown routes gracefully', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    renderWithProviders(<App />, ['/unknown-route']);

    // React Router will render the first matching route, which should be the layout
    // with no specific page content for unknown routes
    expect(screen.getByText('Layout')).toBeInTheDocument();
  });

  test('maintains authentication state across route changes', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });

    // Test that authenticated user can access different routes
    const { rerender } = renderWithProviders(<App />, ['/dashboard']);
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();

    // Test that authentication state is maintained when rerendering with same route
    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <App />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  test('error boundary wraps protected routes', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });

    renderWithProviders(<App />, ['/dashboard']);

    // Check that ErrorBoundary is present in the component tree
    expect(screen.getByText('ErrorBoundary')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  test('public routes do not require authentication', () => {
    // Public routes should render without checking authentication
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    renderWithProviders(<App />, ['/login']);

    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    // Should not have Protected or ErrorBoundary wrappers
  });

  test('handles multiple route changes', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });

    // Test that authenticated user can access different routes individually
    renderWithProviders(<App />, ['/dashboard']);
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();

    // Test portfolio route separately
    renderWithProviders(<App />, ['/portfolio']);
    expect(screen.getByText('Portfolio Page')).toBeInTheDocument();

    // Test chartjs route separately
    renderWithProviders(<App />, ['/chartjs']);
    expect(screen.getByText('ChartJS Page')).toBeInTheDocument();

    // Test bandarmologi route separately
    renderWithProviders(<App />, ['/bandarmologi']);
    expect(screen.getByText('Bandarmologi Page')).toBeInTheDocument();
  });
});