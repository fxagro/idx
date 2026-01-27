# Dashboard Component

## Overview

The Dashboard component is the main user interface for the stock trading and analysis application. It serves as a comprehensive hub that provides users with real-time market data, portfolio management, affiliate tracking, and various analytical tools.

## Features

### 🔐 User Authentication & Profile
- Displays user information and subscription details
- Shows AI quota usage with visual indicators
- Role-based access control (admin, premium, user)
- Password change functionality

### 📊 Portfolio Management
- Real-time portfolio summary with cash balance, holdings value, and total portfolio value
- Quick navigation to full portfolio view
- Loading states for portfolio data

### 🤝 Affiliate System
- Total referrals tracking (L1 and L2 levels)
- Commission earnings display
- Recent commissions table with monthly breakdown
- Integration with affiliate dashboard

### 📈 Real-time Stock Analysis
- Interactive candlestick charts with multiple views
- Stock watchlist with clickable stock selection
- Toggle between real-time and static chart views
- Support for IDX and US markets

### 🏆 Market Data
- Top gainers and losers display
- Market overview with index data
- IDX heatmap visualization
- Real-time stock price updates via WebSocket

### 🔧 Traditional Analysis Tools
- Command-based analysis system:
  - `/fundamental` - Fundamental analysis data
  - `/analisa` - Technical analysis summary
  - `/teknikal` - Technical charts with price trends
  - `/berita` - Latest news and updates
- Dynamic result display based on command type

## Architecture

### State Management

```javascript
const [state, setState] = useState({
  // User Data
  me: null,                    // User profile information
  tx: [],                      // Transaction history
  portfolio: null,             // Portfolio holdings

  // Analysis
  command: "fundamental",      // Selected analysis command
  kode: "",                    // Stock code input
  market: "idx",               // Market selection (idx/us)
  result: null,                // Analysis results
  loading: false,              // Loading state for analysis

  // UI Controls
  selectedStock: "BBCA",       // Currently selected stock
  selectedMarket: "idx",       // Selected market for charts
  showRealTimeChart: true,     // Chart visibility toggle

  // Password Management
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  passwordError: "",
  passwordLoading: false,

  // Loading States
  profileLoading: true,
  txLoading: true,
  portfolioLoading: true,
  affiliateLoading: true,

  // Affiliate Data
  affiliateData: null,
  commissions: []
});
```

### Component Structure

```
Dashboard
├── Header Section
│   └── Welcome message with user info
├── Quick Stats Cards (3 columns)
│   ├── AI Quota Card
│   ├── Total Referrals Card
│   └── Recent Commissions Card
├── Quick Actions Grid
│   ├── AI Analysis, My Network, Admin Panel, Portfolio buttons
│   └── Recent Commissions Table
├── Portfolio Summary
│   ├── Cash balance, holdings value, total portfolio value
│   └── Navigation to full portfolio
├── Real-time Stock Analysis
│   ├── Stock watchlist (left column)
│   └── Candlestick charts (right column, toggleable)
├── Top Gainers & Losers
├── Market Overview
└── Traditional Analysis Tools
    ├── Command selector, stock code input, market selector
    ├── Run analysis button
    └── Dynamic result display
```

## Dependencies

### External Libraries
- **React**: Core UI framework
- **react-router-dom**: Navigation and routing
- **react-i18next**: Internationalization
- **recharts**: Chart components for technical analysis
- **Tailwind CSS**: Styling framework

### Internal Components
- `CandlestickChart`: Advanced candlestick visualization
- `SimpleCandlestickChart`: Simplified chart view
- `IDXCandlestickDashboard`: IDX-specific dashboard
- `IDXHeatmap`: Market heatmap visualization
- `StockWatchlist`: Interactive stock selection
- `TopGainers`: Market performance display
- `MarketOverview`: Market index overview

### Services
- `api`: HTTP client for API calls
- `socketService`: WebSocket connection for real-time data

## API Integration

### Endpoints Used
- `GET /me` - User profile and quota information
- `GET /me/transactions` - Transaction history
- `GET /portfolio/holdings` - Portfolio data
- `GET /affiliate/dashboard` - Affiliate statistics
- `GET /affiliate/commissions` - Commission data
- `POST /run-command` - Execute analysis commands
- `POST /auth/change-password` - Password updates

### Real-time Updates
- WebSocket connection for live stock price updates
- Automatic reconnection handling
- Real-time portfolio value updates

## User Interactions

### Stock Selection
1. Users can select stocks from the watchlist
2. Selection updates both the stock code input and chart display
3. Supports both IDX and US market stocks

### Analysis Commands
1. Select analysis type from dropdown
2. Enter stock code (auto-uppercase)
3. Choose market (IDX/US)
4. Execute command to get results
5. Results displayed based on command type:
   - **Fundamental**: Tabular data display
   - **Analisa**: Formatted text summary
   - **Teknikal**: Line chart with price trends
   - **Berita**: News items list

### Password Management
1. Enter current password
2. Provide new password (minimum 8 characters)
3. Confirm new password
4. Validation with error handling
5. Success confirmation

## Responsive Design

### Breakpoints
- **Mobile**: Single column layout, stacked cards
- **Tablet**: 2-column grid for stats cards
- **Desktop**: 3-column layout with full feature set

### Key Responsive Features
- Grid layouts adapt to screen size
- Chart containers resize appropriately
- Tables become horizontally scrollable on mobile
- Button layouts stack vertically on smaller screens

## Error Handling

### Loading States
- Individual loading indicators for each data section
- Skeleton loaders for better UX
- Graceful fallbacks for failed API calls

### Error Display
- Password change errors
- Analysis command errors
- API failure handling with user-friendly messages
- Fallback data for missing information

### Data Validation
- Null checks for user data
- Safe property access with fallbacks
- Commission data validation
- Portfolio data verification

## Performance Optimizations

### Data Loading
- Parallel API calls for user data
- Efficient state updates
- Minimal re-renders through proper state management

### Memory Management
- Proper cleanup of WebSocket connections
- Component unmount handling
- Efficient event listener management

### Chart Performance
- Conditional rendering of heavy chart components
- Toggle functionality to reduce DOM complexity
- Optimized re-rendering of chart data

## Security Considerations

### Authentication
- Protected routes and API calls
- Secure password change with validation
- Role-based feature access

### Data Protection
- No sensitive data in client-side storage
- API-based data fetching
- Secure WebSocket connections

## Accessibility

### ARIA Labels
- Proper labeling for screen readers
- Semantic HTML structure
- Keyboard navigation support

### Visual Design
- High contrast ratios
- Consistent color schemes
- Responsive text sizing
- Clear visual hierarchy

## Testing Considerations

### Component Testing
- State management testing
- API integration testing
- Error handling scenarios
- Responsive design testing

### User Journey Testing
- Stock selection workflow
- Analysis command execution
- Password change process
- Navigation between sections

## Future Enhancements

### Potential Improvements
- Advanced filtering options for analysis results
- Customizable dashboard layouts
- Enhanced chart types and indicators
- Real-time notifications for portfolio changes
- Advanced affiliate analytics
- Mobile app synchronization

### Performance Optimizations
- Virtual scrolling for large datasets
- Chart data caching
- Progressive loading of components
- Service worker for offline functionality

## Troubleshooting

### Common Issues
1. **Charts not loading**: Check WebSocket connection and API endpoints
2. **Portfolio data missing**: Verify portfolio API and user permissions
3. **Affiliate data errors**: Check affiliate system configuration
4. **Analysis commands failing**: Validate stock codes and market selection

### Debug Information
- Console logs for API calls and state changes
- Loading state indicators
- Error messages for user feedback
- Network request monitoring

## Related Components

- `App.jsx` - Main application routing
- `Header.jsx` - Navigation and user menu
- `AIPage.jsx` - AI analysis interface
- `AdminPage.jsx` - Administrative functions
- `UserNetworkPage.jsx` - Network management
- `VirtualTrading` components - Portfolio management

## Dependencies Graph

```
Dashboard
├── External Libraries
│   ├── React (hooks, state management)
│   ├── react-router-dom (navigation)
│   ├── react-i18next (translations)
│   ├── recharts (charts)
│   └── Tailwind CSS (styling)
├── Internal Components
│   ├── CandlestickChart
│   ├── SimpleCandlestickChart
│   ├── IDXCandlestickDashboard
│   ├── IDXHeatmap
│   ├── StockWatchlist
│   ├── TopGainers
│   └── MarketOverview
└── Services
    ├── api (HTTP client)
    └── socketService (WebSocket)