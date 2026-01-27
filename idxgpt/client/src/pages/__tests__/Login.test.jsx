import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../Login.jsx';
import api from '../../utils/api';
import { AuthProvider } from '../../context/auth.jsx';

jest.mock('../../utils/api');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

describe('Login', () => {
  beforeEach(() => {
    api.post.mockClear();
    api.get.mockClear();
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

  test('renders login form', () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.getByTestId('login-title')).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-button')).toBeInTheDocument();
  });

  test('submits login successfully', async () => {
    api.post.mockResolvedValue({ data: { token: 'mock-token' } });
    api.get.mockResolvedValue({ data: { id: 1, email: 'testuser1@demo.com', role: 'user' } });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'testuser1@demo.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByTestId('login-button'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'testuser1@demo.com',
        password: 'password123',
      });
      expect(localStorage.setItem).toHaveBeenCalledWith('token', 'mock-token');
      expect(api.get).toHaveBeenCalledWith('/me');
    });
  });

  test('displays error on login failure', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Invalid email or password' } } });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'testuser1@demo.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByTestId('login-button'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Invalid email or password');
    });
  });

  test('displays generic error on network failure', async () => {
    api.post.mockRejectedValue({ response: null });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'testuser1@demo.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByTestId('login-button'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Login failed');
    });
  });

  test('shows loading state during login', async () => {
    api.post.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: { token: 'mock-token' } }), 100)));
    api.get.mockResolvedValue({ data: { id: 1, email: 'testuser1@demo.com', role: 'user' } });

    render(
      <AuthProvider>
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      </AuthProvider>
    );

    fireEvent.change(screen.getByTestId('email-input'), { target: { value: 'testuser1@demo.com' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByTestId('login-button'));

    expect(screen.getByTestId('login-button')).toHaveTextContent('Loading...');
    expect(screen.getByTestId('login-button')).toBeDisabled();
  });
});