import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../components/Header';
import { AuthProvider } from '../context/auth.jsx';

// Mock the useAuth hook
const mockUseAuth = jest.fn();
jest.mock('../hooks/useAuth.jsx', () => ({
  useAuth: () => mockUseAuth()
}));

describe('Header Component', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
  });

  test('renders Bandarmologi menu when logged in', () => {
    // Mock useAuth to return authenticated user
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </MemoryRouter>
    );

    // Check if Bandarmologi menu is visible
    expect(screen.getByText('Bandarmologi')).toBeInTheDocument();

    // Check if the link has correct href
    const bandarmologiLink = screen.getByText('Bandarmologi');
    expect(bandarmologiLink.closest('a')).toHaveAttribute('href', '/bandarmologi');
  });

  test('does not render Bandarmologi menu when not logged in', () => {
    // Mock useAuth to return unauthenticated user
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </MemoryRouter>
    );

    // Check if Bandarmologi menu is not visible
    expect(screen.queryByText('Bandarmologi')).not.toBeInTheDocument();
  });

  test('renders all authenticated user menu items when logged in', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </MemoryRouter>
    );

    // Check all authenticated menu items are present
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Charts')).toBeInTheDocument();
    expect(screen.getByText('Bandarmologi')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  test('renders login/register menu items when not logged in', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </MemoryRouter>
    );

    // Check login/register items are present
    expect(screen.getByText('Register')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();

    // Check authenticated items are not present
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Charts')).not.toBeInTheDocument();
    expect(screen.queryByText('Bandarmologi')).not.toBeInTheDocument();
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  test('calls clearToken and clears user state on logout', () => {
    // Mock setUser function
    const mockSetUser = jest.fn();

    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false,
      setUser: mockSetUser
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </MemoryRouter>
    );

    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);

    // Verify setUser was called with null to clear authentication
    expect(mockSetUser).toHaveBeenCalledWith(null);

    // Verify localStorage.removeItem was called
    expect(localStorage.removeItem).toHaveBeenCalledWith('token');
  });

  test('has correct styling and structure', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });

    const { container } = render(
      <MemoryRouter>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </MemoryRouter>
    );

    // Check main header element
    const header = container.querySelector('header');
    expect(header).toHaveClass('bg-white', 'shadow-sm', 'sticky', 'top-0', 'z-50');

    // Check header container
    const headerDiv = header.querySelector('div');
    expect(headerDiv).toHaveClass('max-w-6xl', 'mx-auto', 'flex', 'justify-between', 'items-center', 'px-4', 'py-3');

    // Check navigation element
    const nav = headerDiv.querySelector('nav');
    expect(nav).toHaveClass('flex', 'items-center', 'gap-4');
  });

  test('logo links to home page', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </MemoryRouter>
    );

    const logoLink = screen.getByText('IDXGPT');
    expect(logoLink.closest('a')).toHaveAttribute('href', '/');
  });

  test('Plans link is always visible', () => {
    // Test when logged in
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });
    const { rerender } = render(
      <MemoryRouter>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('Plans')).toBeInTheDocument();

    // Test when not logged in
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });
    rerender(
      <MemoryRouter>
        <AuthProvider>
          <Header />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('Plans')).toBeInTheDocument();
  });
});