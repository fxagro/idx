# TradingView Super (TVS) Component Documentation

## Overview

The **TradingView Super (TVS)** component (`tvs.jsx`) is an advanced React-based financial charting component that provides a TradingView-like experience for Indonesian stock market analysis. Built on top of Chart.js with historical data from API, this component offers professional-grade technical analysis tools with stable, static chart rendering.

## 🚀 Key Features

### ✅ Core Features Implemented

#### 📊 **Advanced Charting**
- **Multiple Chart Types**: Candlestick and Line charts
- **Multi-Market Support**: IDX (Indonesian) and US stock markets
- **Historical Data Mode**: Static historical data from API (WebSocket disabled for stability)
- **Interactive Zoom & Pan**: Mouse wheel and touch gesture support
- **Multi-Timeframe Support**: 1m, 5m, 15m, 30m, 1H, 2H, 4H, 1D, 1W, 1M, 3M, 6M, YTD, 1Y, ALL
- **Volume Display**: Integrated volume bars with price correlation

#### 📈 **Technical Indicators**
- **Trend Indicators**: SMA, EMA with multiple periods
- **Momentum Indicators**: RSI, MACD, Stochastic Oscillator
- **Volatility Indicators**: Bollinger Bands, ATR, CCI
- **Volume Indicators**: Williams %R
- **Price Levels**: Fibonacci Retracement with key levels (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%)
- **Advanced Patterns**: Ichimoku Cloud, ADX, Parabolic SAR

#### 🎨 **Interactive Drawing Tools**
- **Trend Lines**: Click and drag to draw trend lines
- **Horizontal Lines**: Support and resistance levels
- **Vertical Lines**: Time-based markers
- **Rectangles**: Price range highlights
- **Fibonacci Retracements**: Technical level analysis
- **Arrow Tools**: Directional indicators

#### 👥 **Multi-Symbol Analysis**
- **Symbol Comparison**: Overlay multiple stocks on same chart
- **Cross-Market Analysis**: Compare IDX and US stocks simultaneously
- **Correlation Analysis**: Visual comparison of price movements
- **Color-coded Legends**: Distinct colors for each symbol

#### 📋 **Watchlist & Screener**
- **Personal Watchlist**: Save favorite stocks with alerts
- **Stock Screener**: Filter by volume, price change, sector
- **Real-time Updates**: Live data for watchlist items

#### 💼 **Trading Simulation**
- **Virtual Portfolio**: 100M IDR starting balance
- **Order Management**: Buy/Sell orders with market/limit types
- **Position Tracking**: Real-time P&L calculation
- **Trade History**: Complete transaction records

#### 🔬 **Strategy Backtesting**
- **MA Crossover Strategy**: Moving average based trading
- **RSI Divergence**: Momentum-based signals
- **Bollinger Band Mean Reversion**: Volatility strategies
- **Performance Metrics**: Win rate, Sharpe ratio, max drawdown

#### 🌙 **Enhanced UI/UX**
- **Dark/Light Theme**: Toggle between themes
- **Responsive Design**: Mobile and desktop optimized
- **Crosshair Mode**: Precise price and time tracking
- **Error Boundaries**: Graceful error handling
- **Performance Monitoring**: Real-time performance metrics

#### 🔧 **User Settings**
- **Persistent Storage**: localStorage for user preferences
- **Customizable Layout**: Show/hide volume, grid, indicators
- **Animation Control**: Enable/disable chart animations
- **Default Parameters**: Configurable indicator settings

## 🛠 Technical Architecture

### Dependencies Used
```javascript
// Core dependencies
"react": "^18.2.0"
"chart.js": "^4.5.0"
"chartjs-chart-financial": "^0.2.1"
"chartjs-plugin-zoom": "^2.0.1"
"chartjs-plugin-annotation": "^3.0.1"
"socket.io-client": "^4.8.1"

// UI Enhancement
"react-select": "^5.10.2"
"tailwindcss": "^3.4.4"
```

### Component Structure
```
tvs.jsx
├── State Management (useState, useEffect, useMemo)
├── WebSocket Integration (Real-time data)
├── Chart Rendering (Chart.js integration)
├── Technical Indicators (Calculation functions)
├── Drawing Tools (Interactive annotations)
├── Trading Simulation (Portfolio management)
├── Backtesting Engine (Strategy testing)
├── UI Components (Sidebar, toolbar, settings)
└── Error Handling (Error boundaries)
```

## 📖 Usage Guide

### Basic Implementation
```jsx
import TradingViewSuperChart from './pages/tvs';

// Use in your React application
function App() {
  return (
    <div className="App">
      <TradingViewSuperChart />
    </div>
  );
}
```

### Market Selection Feature
```jsx
// The component now supports both IDX and US markets
<TradingViewSuperChart />

// Features:
// - Market selection dropdown (IDX/US)
// - Combined symbol list with market labels
// - Automatic endpoint selection
// - Cross-market comparison
// - Market-specific data fetching
```

### Component Props
The component is self-contained and doesn't require external props. All configuration is handled through internal state and user settings.

## 🎯 Feature Deep Dive

### Multi-Market Support (NEW)
The TradingView Super component now supports both Indonesian (IDX) and US stock markets with seamless switching and cross-market analysis.

**Key Features:**
- **Market Selection**: Toggle between IDX and US markets via dropdown
- **Combined Symbol List**: Unified symbol selection with market labels
- **Cross-Market Comparison**: Compare stocks across different markets
- **Automatic Endpoints**: Dynamic API endpoint selection based on market
- **Fallback Handling**: Graceful degradation when US endpoints unavailable

**Implementation:**
```javascript
// Market selection state
const [marketType, setMarketType] = useState('IDX');

// Dynamic endpoint selection
const endpoint = marketType === 'US' ? '/stocks/usa/candlestick' : '/stocks/candlestick';

// Combined symbols with market labels
const getCombinedSymbols = () => {
  const combined = [];
  symbols.forEach(symbol => combined.push({ symbol, market: 'IDX' }));
  usSymbols.forEach(symbol => combined.push({ symbol, market: 'US' }));
  return combined;
};
```

**UI Components:**
- Market selection dropdown in toolbar
- Symbol dropdown with market labels (e.g., "AAPL (US)", "BBCA (IDX)")
- Watchlist showing market type for each symbol
- Comparison tools working across markets

### Real-Time Data Integration
```javascript
// WebSocket connection with auto-reconnect
socketRef.current = io('http://localhost:5000', {
  transports: ['websocket', 'polling'],
  timeout: 20000,
  forceNew: true
});

// Real-time price updates
socketRef.current.on('price_update', (data) => {
  // Update chart with new price point
  setChartData(prevData => {
    const updated = [...prevData, newPoint];
    return updated.length > 100 ? updated.slice(-100) : updated;
  });
});
```

### Technical Indicators Implementation
```javascript
// Example: RSI Calculation
const calculateRSI = (data, period = 14) => {
  const rsi = [];
  const gains = [];
  const losses = [];

  // Calculate gains and losses
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }

  // Calculate RSI values
  // ... (full implementation in component)
};
```

### Drawing Tools System
```javascript
// Interactive drawing with click and drag
const handleChartClick = (event, elements) => {
  if (!drawingMode || !mainChartInstance.current) return;

  const chart = mainChartInstance.current;
  const rect = chart.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // Convert pixel to data coordinates
  const xScale = chart.scales.x;
  const yScale = chart.scales.y;
  const dataX = xScale.getValueForPixel(x);
  const dataY = yScale.getValueForPixel(y);

  // Create annotation
  const newAnnotation = {
    id: Date.now(),
    type: drawingMode,
    start: drawStart,
    end: { x: dataX, y: dataY },
    color: drawingTools.find(t => t.id === drawingMode)?.color
  };
};
```

### Backtesting Engine
```javascript
// Strategy backtesting implementation
const runBacktest = async (strategy, startDate, endDate) => {
  // Simple MA crossover strategy
  let position = null;
  let balance = 100000000;

  for (let i = 20; i < validChartData.length; i++) {
    const sma20 = calculateSMA(pastData.map(d => d.close), 20);
    const sma50 = calculateSMA(pastData.map(d => d.close), 50);

    // Trading logic implementation
    // ... (full implementation in component)
  }
};
```

### Multi-Market Support
```javascript
// Market selection functionality
const [marketType, setMarketType] = useState('IDX');

// Dynamic endpoint selection
const endpoint = marketType === 'US' ? '/stocks/usa/candlestick' : '/stocks/candlestick';

// Combined symbols with market labels
const getCombinedSymbols = () => {
  const combined = [];
  symbols.forEach(symbol => combined.push({ symbol, market: 'IDX' }));
  usSymbols.forEach(symbol => combined.push({ symbol, market: 'US' }));
  return combined;
};

// Market-specific symbol display
options={getCombinedSymbols().map(s => ({
  value: s.symbol,
  label: `${s.symbol} (${s.market})`
}))}
```

## ⚙️ Configuration Options

### User Settings Structure
```javascript
const [userSettings, setUserSettings] = useState({
  indicators: {
    SMA: { enabled: true, periods: [20, 50] },
    EMA: { enabled: true, periods: [12, 26] },
    RSI: { enabled: true, period: 14 },
    MACD: { enabled: true, fast: 12, slow: 26, signal: 9 },
    BB: { enabled: true, period: 20, stdDev: 2 }
  },
  layout: {
    showVolume: true,
    showGrid: true,
    chartType: 'candlestick',
    crosshair: true,
    animations: true
  },
  trading: {
    defaultQuantity: 100,
    riskManagement: {
      maxPositionSize: 10000000,
      stopLossPercent: 5,
      takeProfitPercent: 10
    }
  }
});
```

## 📱 Responsive Design

### Mobile Optimizations
- **Touch Gestures**: Pinch-to-zoom support
- **Responsive Layout**: Adaptive sidebar and toolbar
- **Optimized Rendering**: Reduced data points on mobile
- **Touch-friendly Controls**: Larger buttons and selectors

### Desktop Features
- **Keyboard Shortcuts**: Quick navigation and tools
- **Multi-monitor Support**: Full-screen charting
- **Advanced Tooltips**: Detailed information display
- **Export Options**: Chart screenshots and data export

## 🔒 Error Handling

### Error Boundary Implementation
```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[TVS Chart] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallbackUI />;
    }
    return this.props.children;
  }
}
```

## 🚀 Performance Optimizations

### Data Management
- **Point Limiting**: Maximum 100-500 points based on timeframe
- **Throttled Updates**: WebSocket message throttling
- **Memoized Calculations**: Cached indicator values
- **Efficient Re-renders**: Optimized useEffect dependencies

### Memory Management
- **Chart Cleanup**: Proper Chart.js instance destruction
- **Event Listener Cleanup**: WebSocket and event cleanup
- **Garbage Collection**: Memory leak prevention

## 🌐 Internationalization

### Supported Languages
- **Indonesian (ID)**: Primary language
- **English (EN)**: Secondary language
- **Dynamic Switching**: Runtime language changes

### Translation Keys
```javascript
// Translation structure
{
  "tradingView": {
    "title": "TradingView Pro",
    "selectSymbol": "Select Symbol",
    "shareToX": "Share to X",
    "toggleTheme": "Toggle Theme",
    "toggleLanguage": "Toggle Language"
  }
}
```

## 🔧 Development Guide

### File Structure
```
client/src/pages/
├── tvs.jsx              # Main component file
├── TVS-README.md        # This documentation
├── ChartJS.jsx          # Original component (preserved)
└── TV.jsx               # Intermediate version
```

### Adding New Features

#### 1. New Technical Indicator
```javascript
// Add calculation function
const calculateNewIndicator = (data, params) => {
  // Implementation
};

// Add to indicators config
case 'NEW_INDICATOR':
  result[`NEW_INDICATOR_${params.period}`] = calculateNewIndicator(
    data.map(d => d.close),
    params.period
  );
  break;
```

#### 2. New Drawing Tool
```javascript
// Add to drawingTools array
{
  id: 'newtool',
  label: 'New Tool',
  icon: '🛠',
  color: '#COLOR'
}

// Add annotation type in chart config
case 'newtool':
  return {
    type: 'line', // or other annotation type
    // configuration
  };
```

## 📊 API Integration

### Required Endpoints
```javascript
// IDX Stock symbols
GET /stocks/symbols

// IDX Historical data
GET /stocks/candlestick?symbol={symbol}&timeframe={timeframe}

// US Stock symbols (NEW)
GET /stocks/usa/symbols

// US Historical data (NEW)
GET /stocks/usa/candlestick?symbol={symbol}&timeframe={timeframe}

// Real-time WebSocket (DISABLED)
ws://localhost:5000
```

### Data Format Expected
```javascript
// Candlestick data format
{
  trade_date: "2024-01-01",
  open: 1000,
  high: 1050,
  low: 950,
  close: 1025,
  volume: 1000000
}

// WebSocket price update
{
  symbol: "BBCA",
  price: 1025,
  volume: 50000,
  timestamp: "2024-01-01T10:30:00Z"
}
```

## 🐛 Troubleshooting

### Common Issues

#### Chart Not Rendering
```javascript
// Check console for errors
console.log('[TVS] Chart data:', validChartData);
console.log('[TVS] Chart ref:', mainChartRef.current);

// Verify data format
const sampleData = validChartData.slice(0, 3);
console.log('[TVS] Sample data format:', sampleData);
```

#### WebSocket Connection Issues
```javascript
// Check connection status
console.log('[TVS] WebSocket connected:', isConnected);
console.log('[TVS] Socket instance:', socketRef.current);

// Verify server endpoint
// Ensure server is running on port 5000
```

#### Performance Issues
```javascript
// Monitor data points
console.log('[TVS] Data points:', validChartData.length);

// Check rendering frequency
console.log('[TVS] Chart renders:', renderCount);
```

## 🔄 Version History

### v1.0.0 - Historical Data Release
- ✅ Complete TradingView-like interface
- ✅ Historical data mode (WebSocket disabled for stability)
- ✅ 13+ technical indicators including Fibonacci Retracement
- ✅ Interactive drawing tools
- ✅ Multi-market support (IDX & US stocks)
- ✅ Multi-symbol comparison across markets
- ✅ Trading simulation & backtesting
- ✅ Dark/light theme support
- ✅ Responsive design
- ✅ Error handling and performance optimization

## 🤝 Contributing

### Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### Code Style
- **ESLint**: Standard React/JSX rules
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks
- **Conventional Commits**: Commit message format

## 📄 License

This component is part of the IDXGPT project and follows the same licensing terms.

## 🆘 Support

For issues, questions, or feature requests:
1. Check existing documentation
2. Review console logs for error messages
3. Verify API endpoints are accessible
4. Test with sample data if needed

---

**Built with ❤️ by Klikcode Team**
**Enhanced TradingView-like experience for Indonesian stock market analysis**