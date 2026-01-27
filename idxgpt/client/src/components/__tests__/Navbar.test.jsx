import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../Navbar';
import { AuthProvider } from '../../context/auth.jsx';

// Mock the useAuth hook
const mockUseAuth = jest.fn();
jest.mock('../../hooks/useAuth.jsx', () => ({
  useAuth: () => mockUseAuth()
}));

describe('Navbar', () => {
  beforeEach(() => {
    mockUseAuth.mockClear();

    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
  });

  test('renders dashboard menu for all users', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Navbar />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('dashboard-menu')).toBeInTheDocument();
  });

  test('renders profile menu and logout button for authenticated users', () => {
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Navbar />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('profile-menu')).toBeInTheDocument();
    expect(screen.getByTestId('logout-button')).toBeInTheDocument();
  });

  test('does not render profile menu for unauthenticated users', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Navbar />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.queryByTestId('profile-menu')).not.toBeInTheDocument();
  });

  test('does not render affiliate menu and logout button for unauthenticated users', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Navbar />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.queryByTestId('affiliate-menu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('logout-button')).not.toBeInTheDocument();
  });

  test('renders dashboard menu for all users', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Navbar />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('dashboard-menu')).toBeInTheDocument();
  });

  test('shows loading state when loading is true', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <Navbar />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('handles logout click', () => {
    const mockSetUser = jest.fn();
    mockUseAuth.mockReturnValue({
      user: { role: 'user' },
      loading: false,
      setUser: mockSetUser
    });

    // Mock localStorage.getItem to return null (no token)
    window.localStorage.getItem.mockReturnValue(null);

    render(
      <MemoryRouter>
        <AuthProvider>
          <Navbar />
        </AuthProvider>
      </MemoryRouter>
    );

    const logoutButton = screen.getByTestId('logout-button');
    fireEvent.click(logoutButton);

    expect(window.localStorage.removeItem).toHaveBeenCalledWith('token');
    expect(mockSetUser).toHaveBeenCalledWith(null);
  });
});