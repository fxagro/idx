import { render, screen, fireEvent } from '@testing-library/react';
import AIPage from '../AIPage';
import api from '../../utils/api';
import { BrowserRouter } from 'react-router-dom';

jest.mock('../../utils/api');

const MockAIPage = () => (
  <BrowserRouter>
    <AIPage />
  </BrowserRouter>
);

test('renders markdown and wraps text responsively', async () => {
  api.post.mockResolvedValue({
    data: {
      analysis: {
        technical: `# Technical Analysis for BRMS

## Trend Analysis
- **Current Trend**: Bullish
- **Volatility Level**: Moderate
- **Recent Performance**: Strong upward momentum

## Price Action Summary
- **Latest Price**: Rp 1,000
- **Data Points Analyzed**: 8 trading days
- **Market Sentiment**: Positive

## Key Indicators
- **Recommendation**: Buy
- **Confidence Level**: Medium
- **Risk Assessment**: Moderate volatility

## Trading Considerations
1. Monitor volume patterns for confirmation
2. Watch for support/resistance levels
3. Consider overall market conditions`,
        fundamental: { error: 'No fundamental data' },
        sentiment: 'positive',
        recommendation: 'Buy',
        price_prediction: 'Expected range: Rp 980 - Rp 1,020',
        confidence: 'medium'
      },
    },
  });

  render(<MockAIPage />);

  // Fill out the form
  fireEvent.change(screen.getByPlaceholderText(/stock symbol/i), {
    target: { value: 'BRMS' }
  });
  fireEvent.click(screen.getByText(/analyze/i));

  // Wait for the analysis to load
  await screen.findByText(/Technical Analysis for BRMS/i);
  await screen.findByText(/No fundamental data/i);
  await screen.findByText(/Expected range: Rp 980 - Rp 1,020/i);

  // Check that markdown is rendered properly
  expect(screen.getByText(/Current Trend/)).toBeInTheDocument();
  expect(screen.getByText(/Strong upward momentum/)).toBeInTheDocument();
  expect(screen.getByText(/Monitor volume patterns/)).toBeInTheDocument();

  // Check that the container has responsive classes
  const container = screen.getByText(/Technical Analysis for BRMS/i).closest('.break-words');
  expect(container).toHaveClass('break-words');
});

test('displays error message on API failure', async () => {
  api.post.mockRejectedValue({
    response: { data: { error: 'Analysis failed' } }
  });

  render(<MockAIPage />);

  fireEvent.change(screen.getByPlaceholderText(/stock symbol/i), {
    target: { value: 'INVALID' }
  });
  fireEvent.click(screen.getByText(/analyze/i));

  await screen.findByText(/Analysis failed/i);
});

test('shows loading state during analysis', () => {
  api.post.mockImplementation(() => new Promise(() => {})); // Never resolves

  render(<MockAIPage />);

  fireEvent.change(screen.getByPlaceholderText(/stock symbol/i), {
    target: { value: 'BRMS' }
  });
  fireEvent.click(screen.getByText(/analyze/i));

  expect(screen.getByText(/Analyzing.../i)).toBeInTheDocument();
  expect(screen.getByText(/analyze/i)).toBeDisabled();
});