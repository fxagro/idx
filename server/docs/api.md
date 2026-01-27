# 📖 IDXGPT API Documentation

## 📋 Overview

Comprehensive API documentation for the IDXGPT stock analysis application, providing institutional-grade financial tools through RESTful APIs and real-time WebSocket connections.

### 🌟 Key Features
- **Real-time Stock Data**: Live Indonesian (IDX) and US market data
- **AI-Powered Analysis**: Advanced stock analysis using OpenRouter API
- **Virtual Trading**: Simulated trading with realistic price simulation
- **Affiliate System**: Multi-level referral and commission tracking
- **Admin Dashboard**: Complete user and system management
- **WebSocket Support**: Real-time price updates and notifications

### 🚀 Latest Updates (v1.2.0)
- **Enhanced Virtual Trading**: Realistic price simulation with gap detection
- **Advanced Order Types**: Market and limit orders with IDX fee structure
- **Gap Detection System**: Automatic price gap monitoring and notifications
- **Comprehensive Quota Management**: Centralized AI quota tracking
- **Redis Caching**: High-performance caching for market data
- **Payment Integration**: Manual payment processing with BCA instructions

---

## 🔐 Authentication System

All protected endpoints require authentication via JWT tokens in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### 🔑 Authentication Endpoints

## 🔐 Authentication

All API endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 📊 Stock Analysis Endpoints

### POST /api/stocks/ai-analyze

AI-powered stock analysis with instant markdown rendering.

**Request Body:**
```json
{
  "symbol": "BRMS",
  "market": "idx",
  "question": "Predict tomorrow's price"
}
```

**Response:**
```json
{
  "success": true,
  "symbol": "BRMS",
  "market": "idx",
  "question": "Predict tomorrow's price",
  "analysis": {
    "technical": "# Technical Analysis for BRMS\n\n## Trend Analysis\n- **Current Trend**: Bullish\n- **Volatility Level**: Moderate\n- **Recent Performance**: Strong upward momentum\n\n## Price Action Summary\n- **Latest Price**: Rp 1,000\n- **Data Points Analyzed**: 8 trading days\n- **Market Sentiment**: Positive\n\n## Key Indicators\n- **Recommendation**: Buy\n- **Confidence Level**: Medium\n- **Risk Assessment**: Moderate volatility\n\n## Trading Considerations\n1. Monitor volume patterns for confirmation\n2. Watch for support/resistance levels\n3. Consider overall market conditions\n4. Use stop-loss orders for risk management\n\n> *This analysis is based on recent trading data and should be used in conjunction with other research methods.*",
    "fundamental": {
      "eps": 0,
      "per": 0,
      "pbv": 0,
      "roe": 0,
      "dividend_yield": 0
    },
    "sentiment": "positive",
    "recommendation": "Buy",
    "price_prediction": "Expected range: Rp 980 - Rp 1,020",
    "confidence": "medium"
  },
  "timestamp": "2025-09-20T17:48:15.984Z"
}
```

**Features:**
- **Markdown Rendering**: Technical analysis rendered as formatted markdown
- **Responsive Design**: Supports desktop (max-width 800px) and mobile (auto-wrapping)
- **Instant Analysis**: Mock analysis engine provides immediate results
- **Structured Data**: Fundamental analysis as JSON, technical analysis as markdown

**Error Response:**
```json
{
  "error": "Analysis failed",
  "message": "Unable to generate analysis for the specified symbol"
}
```

## 👤 User Management Endpoints

### GET /api/users/profile

Get user profile information and subscription status.

**Authentication:** Required (JWT token)

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+1234567890",
  "subscription_status": "Paid",
  "subscription_expiry": "2025-12-31T23:59:59.999Z",
  "api_usage": 45,
  "api_limit": 1000,
  "is_admin": false,
  "created_at": "2025-01-15T10:30:00.000Z"
}
```

**Features:**
- **Profile Information**: Complete user profile data
- **Subscription Status**: Current subscription tier and expiry
- **API Usage Tracking**: Real-time usage statistics
- **Admin Flag**: Indicates if user has admin privileges

### GET /api/admin/users

Get all users (admin only).

**Authentication:** Required (JWT token + admin privileges)

**Response:**
```json
[
  {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+1234567890",
    "subscription_status": "Paid",
    "subscription_expiry": "2025-12-31T23:59:59.999Z",
    "api_usage": 45,
    "api_limit": 1000,
    "is_admin": false,
    "created_at": "2025-01-15T10:30:00.000Z"
  }
]
```

**Admin Features:**
- **User Management**: View all registered users
- **Subscription Monitoring**: Track subscription statuses
- **Usage Analytics**: Monitor API usage across all users

### PUT /api/admin/users/:id

Update user subscription details (admin only).

**Authentication:** Required (JWT token + admin privileges)

**Request Body:**
```json
{
  "api_limit": 2000,
  "subscription_expiry": "2025-12-31T23:59:59.999Z"
}
```

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+1234567890",
  "subscription_status": "Paid",
  "subscription_expiry": "2025-12-31T23:59:59.999Z",
  "api_usage": 45,
  "api_limit": 2000,
  "is_admin": false,
  "created_at": "2025-01-15T10:30:00.000Z"
}
```

**Admin Features:**
- **API Limit Management**: Adjust user API limits
- **Subscription Extension**: Modify subscription expiry dates
- **User Control**: Administrative control over user accounts

## 📈 Stock Data Endpoints

### GET /api/stocks/price/:symbol

Get current and historical price data for a specific stock symbol.

**Parameters:**
- `symbol` (path): Stock symbol (e.g., BBCA, BRMS)
- `market` (query, optional): Market type (idx, us) - defaults to idx
- `days` (query, optional): Number of days of historical data - defaults to 30

**Response:**
```json
{
  "symbol": "BRMS",
  "market": "IDX",
  "current": {
    "price": 152.0,
    "date": "2025-09-20",
    "volume": 1000000,
    "high": 155.0,
    "low": 145.0,
    "open": 150.0,
    "sma20": 148.5,
    "rsi14": 52.3
  },
  "history": [
    {
      "date": "2025-09-20",
      "open": 150.0,
      "high": 155.0,
      "low": 145.0,
      "close": 152.0,
      "volume": 1000000,
      "sma20": 148.5,
      "rsi14": 52.3
    }
  ]
}
```

### GET /api/stocks/idx/candlestick

Get candlestick chart data for IDX stocks.

**Parameters:**
- `symbol` (query): Stock symbol (required)
- `range` (query, optional): Time range (1M, 3M, 6M, YTD, ALL) - defaults to 1M

### GET /api/stocks/search/:query

Search for stocks by symbol or company name.

**Parameters:**
- `query` (path): Search term
- `market` (query, optional): Market filter (idx, us)
- `limit` (query, optional): Maximum results - defaults to 10

### GET /api/stocks/idx/top-gainers

Get top gaining stocks from IDX.

**Parameters:**
- `limit` (query, optional): Number of results - defaults to 10
- `date` (query, optional): Specific trading date

### GET /api/stocks/idx/top-losers

Get top losing stocks from IDX.

**Parameters:**
- `limit` (query, optional): Number of results - defaults to 10
- `date` (query, optional): Specific trading date

### 🚀 Enhanced Virtual Trading API (v1.2.0)

#### GET /api/stocks/virtual/portfolio
Get user's virtual portfolio with enhanced P&L tracking.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "portfolio": {
    "stocks": [
      {
        "symbol": "BBCA",
        "quantity": 100,
        "average_price": 9000,
        "current_price": 9500,
        "market_value": 950000,
        "total_investment": 900000,
        "unrealized_gain_loss": 50000,
        "unrealized_gain_loss_percent": 5.56,
        "company_name": "Bank Central Asia Tbk.",
        "sector": "Banking"
      }
    ],
    "summary": {
      "total_value": 2270000,
      "total_investment": 1700000,
      "total_gain_loss": 570000,
      "total_gain_loss_percent": 33.53,
      "top_performers": ["BBCA", "TLKM"],
      "worst_performers": ["ASII"]
    }
  }
}
```

#### POST /api/stocks/virtual/buy
Execute virtual buy order with enhanced features.

**Authentication:** Required

**Request Body:**
```json
{
  "symbol": "BBCA",
  "quantity": 100,
  "orderType": "market",
  "limitPrice": 8450  // Optional, for limit orders
}
```

**Response:**
```json
{
  "success": true,
  "orderType": "market",
  "symbol": "BBCA",
  "quantity": 100,
  "executionPrice": 8500,
  "marketPrice": 8500,
  "fee": 16.15,
  "totalCost": 850016.15,
  "remainingBalance": 99999983.85,
  "orderId": "order_123456",
  "timestamp": "2025-01-24T02:56:22.009Z"
}
```

#### POST /api/stocks/virtual/sell
Execute virtual sell order with enhanced features.

**Authentication:** Required

**Request Body:**
```json
{
  "symbol": "BBCA",
  "quantity": 100,
  "orderType": "limit",
  "limitPrice": 8550
}
```

#### GET /api/stocks/virtual/history
Get enhanced transaction history with comprehensive details.

**Authentication:** Required

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `symbol` (optional): Filter by stock symbol

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": 1,
      "symbol": "BBCA",
      "type": "BUY",
      "quantity": 100,
      "price": 9000,
      "total_amount": 900000,
      "fee": 1710,
      "order_type": "market",
      "execution_price": 9000,
      "transaction_date": "2025-01-24T02:56:22.009Z",
      "company_name": "Bank Central Asia Tbk."
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

### 🚨 Gap Detection System API (v1.2.0)

#### GET /api/stocks/gaps/detect
Get gap detection analysis for specific symbols.

**Query Parameters:**
- `symbols` (required): Comma-separated list of stock symbols
- `threshold` (optional): Gap threshold percentage (default: 2.0)

**Response:**
```json
{
  "success": true,
  "gaps": [
    {
      "symbol": "BRMS",
      "gapSize": 3.16,
      "gapType": "gap_up",
      "severity": "medium",
      "previousClose": 150.0,
      "currentOpen": 154.74,
      "affectedOrders": [],
      "suggestedActions": [
        "review_buy_limit_orders",
        "consider_gap_fill_reversal"
      ],
      "educationalNote": "Large gap up detected. Gaps often fill within the first 30 minutes of trading."
    }
  ]
}
```

#### WebSocket Events for Gap Detection
```javascript
// Subscribe to gap notifications
socket.emit('subscribe_gaps', { symbols: ['BBCA', 'BRMS'] });

// Listen for gap detection events
socket.on('gap_detected', (gapData) => {
  console.log('Gap detected:', gapData);
  // Show notification to user
});

// Listen for gap impact analysis
socket.on('gap_impact', (impactData) => {
  console.log('Gap impact analysis:', impactData);
  // Update affected orders
});
```

## 🔧 Technical Details

### Response Format
All API responses follow a consistent format:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-09-20T17:48:15.984Z"
}
```

### Error Handling
Error responses include detailed error information:
```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message",
  "details": { ... }
}
```

### Rate Limiting
- **Standard endpoints**: 100 requests per minute
- **AI analysis endpoint**: 10 requests per minute
- **Heavy endpoints**: 50 requests per minute
- **User management endpoints**: 60 requests per minute
- **Admin endpoints**: 30 requests per minute (admin only)

### Data Sources
- **Stock Data**: PostgreSQL database with 158,926+ records
- **AI Analysis**: Mock analysis engine with real database integration
- **Real-time Updates**: Price simulator with 30-second intervals

## 🚀 Usage Examples

### cURL Examples
```bash
# AI Analysis
curl -X POST http://localhost:5000/api/stocks/ai-analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{"symbol":"BRMS","market":"idx","question":"Predict tomorrow price"}'

# Stock Price Data
curl "http://localhost:5000/api/stocks/price/BRMS?days=30"

# Top Gainers
curl "http://localhost:5000/api/stocks/idx/top-gainers?limit=5"

# User Profile
curl -X GET http://localhost:5000/api/users/profile \
  -H "Authorization: Bearer <your-jwt-token>"

# Admin - Get All Users
curl -X GET http://localhost:5000/api/admin/users \
  -H "Authorization: Bearer <admin-jwt-token>"

# Admin - Update User Subscription
curl -X PUT http://localhost:5000/api/admin/users/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -d '{"api_limit": 2000, "subscription_expiry": "2025-12-31T23:59:59.999Z"}'
```

### JavaScript/Axios Example
```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});

// AI Analysis
const analysis = await api.post('/stocks/ai-analyze', {
  symbol: 'BRMS',
  market: 'idx',
  question: 'Predict tomorrow price'
});

// Stock Data
const priceData = await api.get('/stocks/price/BRMS', {
  params: { days: 30 }
});

// User Profile
const profile = await api.get('/users/profile');

// Admin - Get All Users
const users = await api.get('/admin/users');

// Admin - Update User Subscription
const updatedUser = await api.put('/admin/users/1', {
  api_limit: 2000,
  subscription_expiry: '2025-12-31T23:59:59.999Z'
});
```

## 📱 Frontend Integration

The AI analysis endpoint is designed to work seamlessly with the React frontend:

1. **Markdown Rendering**: Technical analysis renders as formatted markdown
2. **Responsive Design**: Automatically adapts to desktop and mobile screens
3. **Error Handling**: Comprehensive error handling with user-friendly messages
4. **Loading States**: Built-in loading indicators during analysis

## 📊 Dashboard Layout & Features

### Dashboard Structure
The dashboard has been restructured with the following layout:

#### Top Section (Responsive: 2 columns on desktop, 1 column on mobile)
- **👤 Profile**: User personal information display
- **📊 Subscription Status**: Current plan, expiry date, and API usage tracking
- **🔐 Password Change**: Secure password update with modal interface
- **📋 Transaction History**: Recent transaction overview with scrollable list

#### Bottom Section (Responsive: 2 columns on desktop, 1 column on mobile)
- **💼 Portfolio**: Portfolio management system integration
- **📈 Real-time Stock Analysis**: Live stock monitoring with WebSocket connectivity
- **🏆 Top Gainers & Losers**: Market movers tracking with interactive selection
- **🔥 IDX Heatmap**: Visual market overview with color-coded performance
- **📊 Traditional Analysis Tools**: Candlestick charts and technical indicators

### Key Features
- **Responsive Design**: Optimized for desktop (1024px) and mobile (320px) devices
- **Real-time Updates**: WebSocket integration for live price updates
- **Interactive Components**: Clickable stock symbols for detailed analysis
- **Modal Interfaces**: Password change functionality with form validation
- **API Integration**: All endpoints (/me, /me/transactions, /portfolio/holdings, /run-command) fully functional
- **No Regressions**: Login, dashboard, and AI analysis features work without issues

##  Recent Updates

### Version 1.3.0 - Dashboard Restructuring
- **Dashboard Layout Restructure**: Reorganized dashboard with Profil, Status Langganan, Ganti Password, and Riwayat Transaksi at the top
- **Enhanced User Experience**: Improved responsive design for desktop (1024px) and mobile (320px)
- **Password Management**: Added secure password change functionality with modal interface
- **Transaction History**: Integrated transaction history display in dashboard
- **Component Integration**: Successfully integrated all existing components (Portfolio, StockWatchlist, TopGainers, IDXHeatmap, CandlestickChart)
- **API Validation**: Confirmed all API endpoints (/me, /me/transactions, /portfolio/holdings, /run-command) are functional
- **WebSocket Validation**: Verified real-time stock price updates and market summary functionality
- **No Regressions**: Confirmed login, dashboard, and AI analysis features work without issues

### Version 1.2.0
- **User Profile System**: Added comprehensive user profile and subscription management
- **Admin Panel**: Added administrative controls for user management and system monitoring
- **API Usage Tracking**: Implemented real-time API usage monitoring and limits
- **Subscription Tiers**: Support for Free (100 API calls) and Paid (1000+ API calls) tiers
- **Role-Based Access Control**: JWT-based authentication with admin privileges

### Version 1.1.0
- **AI Analysis Page**: Added instant AI-powered stock analysis
- **Markdown Support**: GitHub-flavored markdown rendering
- **Responsive Design**: Mobile-first responsive layout
- **Mock Analysis Engine**: Fast, reliable analysis without external API dependencies

### Version 1.0.0
- **Core API**: Basic stock data endpoints
- **Authentication**: JWT-based authentication system
- **Real-time Data**: Live price updates and notifications