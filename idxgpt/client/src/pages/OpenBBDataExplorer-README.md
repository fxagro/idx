# OpenBB Data Explorer

A comprehensive financial data visualization and exploration tool built for the OpenBB Dashboard.

## Overview

The OpenBB Data Explorer provides users with an intuitive interface to browse, search, and visualize financial data from multiple sources including stocks, ETFs, cryptocurrencies, forex, commodities, economic indicators, and portfolio holdings.

## Features

### 🏠 Dashboard Integration
- Seamlessly integrated into the OpenBB Dashboard navigation
- Real-time market overview with key statistics
- Responsive design that works on desktop and mobile devices

### 📊 Data Categories
- **Stocks**: Indonesian and international stock data
- **ETFs**: Exchange-traded funds with expense ratios and performance metrics
- **Crypto**: Cryptocurrency prices, market caps, and 24h changes
- **Forex**: Currency exchange rates and trading data
- **Commodities**: Precious metals, energy, and industrial commodities
- **Economy**: Key economic indicators and government data
- **Portfolio**: Personal investment holdings and performance

### 🔍 Search & Filter
- Real-time search by symbol or company name
- Category-based filtering
- Watchlist integration for quick access to favorite instruments

### 📈 Visualization Options
- **Table View**: Sortable data tables with key metrics
- **Chart View**: Multiple chart types including:
  - Line charts for price trends
  - Area charts for volume visualization
  - Bar charts for comparison
  - Candlestick charts for technical analysis

### ⚡ Interactive Features
- Multi-symbol selection for comparison
- Timeframe selection (7, 30, 90, 180 days)
- Chart type switching
- Add to watchlist functionality
- Export capabilities (planned)

## Technical Implementation

### Architecture
- **Frontend**: React with TypeScript/JavaScript
- **State Management**: React Query for server state, useState for UI state
- **Styling**: Tailwind CSS for responsive design
- **Charts**: Recharts library for data visualization
- **Internationalization**: react-i18next for multi-language support

### Component Structure
```
OpenBBDataExplorer.jsx (Main Container)
├── DataCategorySelector.jsx (Sidebar Navigation)
├── DataExplorerTable.jsx (Tabular Data Display)
└── DataExplorerChart.jsx (Chart Visualizations)
```

### API Integration
- RESTful API endpoints for each data category
- JWT authentication for secure data access
- Caching strategies for improved performance
- Error handling and retry mechanisms

## Usage Guide

### Basic Navigation
1. **Select Category**: Use the sidebar to choose your data type
2. **Search**: Type in the search bar to filter results
3. **View Data**: Browse through the table view or switch to charts
4. **Select Symbols**: Click checkboxes to select multiple items for comparison
5. **Visualize**: Switch to chart view to see price trends and patterns

### Chart Features
- **Multi-Symbol Charts**: Compare up to 10 symbols simultaneously
- **Timeframes**: Choose from 7, 30, 90, or 180-day periods
- **Chart Types**: Switch between line, area, bar, and candlestick views
- **Interactive Tooltips**: Hover over data points for detailed information

### Data Table Features
- **Sortable Columns**: Click column headers to sort data
- **Selection**: Use checkboxes for multi-select operations
- **Actions**: Add symbols to watchlist or view detailed information
- **Responsive**: Horizontal scrolling on smaller screens

## API Endpoints

The Data Explorer uses the following API endpoints:

### Market Data
- `GET /api/stocks/openbb/market` - Market overview and statistics

### Category Data
- `GET /api/stocks/openbb/price` - Stock price data
- `GET /api/stocks/openbb/etf` - ETF information and metrics
- `GET /api/stocks/openbb/crypto` - Cryptocurrency data
- `GET /api/stocks/openbb/forex` - Forex rates and trading data
- `GET /api/stocks/openbb/commodities` - Commodities pricing
- `GET /api/stocks/openbb/economy` - Economic indicators
- `GET /api/portfolio` - Portfolio holdings

### Chart Data
- `GET /api/stocks/openbb/chart/:symbol?days=X` - Historical price data

### User Actions
- `POST /api/watchlist` - Add symbols to watchlist

## Security Features

- **Authentication**: All API requests require valid JWT tokens
- **Authorization**: Role-based access control for sensitive data
- **Input Validation**: Server-side validation of all user inputs
- **Rate Limiting**: API usage monitoring and throttling

## Performance Optimizations

- **Caching**: React Query caching for API responses
- **Lazy Loading**: Data loaded on-demand as users navigate
- **Pagination**: Large datasets split into manageable chunks
- **Memoization**: Expensive calculations cached with useMemo
- **Debouncing**: Search queries debounced to reduce API calls

## Error Handling

- **Network Errors**: Automatic retry with exponential backoff
- **API Errors**: User-friendly error messages with retry options
- **Loading States**: Skeleton screens during data fetching
- **Fallback Data**: Graceful degradation when APIs are unavailable

## Testing

### Unit Tests
- Component rendering and state management
- API integration and error handling
- User interaction and event handling

### Integration Tests
- End-to-end data flow from API to UI
- Category switching and search functionality
- Chart rendering and symbol selection

### Performance Tests
- Load time optimization
- Memory usage monitoring
- API response time tracking

## Future Enhancements

### Planned Features
- [ ] Real-time price updates via WebSocket
- [ ] Advanced technical indicators
- [ ] Custom date range selection
- [ ] Data export to CSV/Excel
- [ ] Portfolio performance tracking
- [ ] News integration for each symbol
- [ ] Social sentiment analysis
- [ ] Custom watchlist creation and management

### Technical Improvements
- [ ] GraphQL API integration
- [ ] Advanced caching strategies
- [ ] Progressive Web App (PWA) features
- [ ] Mobile app development
- [ ] Advanced analytics and insights

## Development

### Setup
1. Ensure all dependencies are installed
2. Start the development server
3. Navigate to `/data-explorer` route
4. Verify API endpoints are accessible

### Adding New Categories
1. Add category configuration to `DATA_CATEGORIES` constant
2. Create API endpoint in server routes
3. Update table column definitions
4. Add chart visualization support
5. Write tests for new functionality

### Customization
- Modify `DATA_CATEGORIES` to add/remove data sources
- Update color schemes in component files
- Customize chart types and options
- Add new table columns as needed

## Troubleshooting

### Common Issues
- **API Connection Errors**: Check server logs and network connectivity
- **Authentication Issues**: Verify JWT token validity
- **Performance Problems**: Monitor API response times and caching
- **Chart Rendering Issues**: Check data format and Recharts compatibility

### Debug Mode
Enable debug mode by setting `VITE_AI_DEBUG_MODE=true` in environment variables to see:
- API request/response details
- Component render counts
- State management debugging
- Performance metrics

## Contributing

When contributing to the Data Explorer:
1. Follow existing code patterns and conventions
2. Add appropriate error handling
3. Include unit and integration tests
4. Update documentation for new features
5. Ensure responsive design works on all screen sizes
6. Test with various data sizes and edge cases

## License

This component is part of the OpenBB Dashboard and follows the same licensing terms.