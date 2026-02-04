# AI Saham - Stock Market Analysis Platform

AI Saham is a comprehensive stock market analysis platform that combines real-time market data, AI-powered insights, and virtual trading capabilities. The platform is designed to provide investors with tools for informed decision-making through advanced charting, technical analysis, and AI-driven stock predictions.

## 📊 Project Overview

**AI Saham** is a full-stack web application built with modern technologies to deliver a professional stock market analysis experience. Key features include:

- Real-time stock price tracking with WebSocket updates
- Advanced charting with technical indicators (SMA, RSI, candlestick patterns)
- AI-powered stock analysis and predictions
- Virtual trading simulation
- Portfolio management
- Market news and sentiment analysis
- Affiliate program management
- Admin dashboard with user management

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI library
- **Vite** - Fast build tool and dev server
- **React Router v6** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible UI components
- **Chart.js** & **Recharts** - Data visualization
- **Lightweight Charts** - Interactive financial charts
- **Plotly.js** - Advanced data visualization
- **Socket.IO Client** - Real-time communication
- **React Query** - Server state management
- **i18next** - Internationalization support
- **Playwright** - E2E testing

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **PostgreSQL** - Relational database
- **Redis** - Caching and session management
- **Socket.IO** - Real-time communication
- **JWT** - Authentication and authorization
- **bcrypt** - Password hashing
- **OpenAI API** - AI analysis capabilities
- **OpenBB API** - Financial data integration
- **yfinance** - Yahoo Finance integration
- **Winston** - Logging
- **Cron** - Scheduled tasks

### Database
- **PostgreSQL** - Primary database
- **Redis** - Caching layer
- **Migrations** - Database version control

## 🏗️ Architecture Analysis

### System Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Pages:                                               ││
│  │ - Landing, Login/Register, Plans                     ││
│  │ - Dashboard, Portfolio, Charting                     ││
│  │ - Virtual Trading, AI Analysis                       ││
│  │ - Admin Dashboard, User Management                   ││
│  └─────────────────────────────────────────────────────┘│
│  State Management: React Context, React Query            │
│  UI Components: Tailwind CSS, Radix UI                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    API Gateway                          │
│  CORS, Rate Limiting, Authentication                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Backend (Express)                     │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Routes:                                              ││
│  │ - /api/auth (Authentication)                         ││
│  │ - /api/stocks (Market Data)                          ││
│  │ - /api/ai (AI Analysis)                              ││
│  │ - /api/portfolio (Portfolio Management)              ││
│  │ - /api/virtual-trading (Simulation)                   ││
│  │ - /api/admin (Admin Operations)                       ││
│  │ - /api/affiliate (Affiliate Program)                  ││
│  └─────────────────────────────────────────────────────┘│
│  Services:                                              │
│  - AuthService (JWT, bcrypt)                            │
│  - OpenBBService (Financial Data)                       │
│  - AIService (AI Analysis)                              │
│  - PriceSimulator (WebSocket Updates)                   │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│    PostgreSQL DB     │      │        Redis         │
│  - User Data         │      │  - Caching           │
│  - Stock Data        │      │  - Sessions          │
│  - Portfolio Data    │      │  - Rate Limiting     │
│  - Payment Records   │      │                      │
└──────────────────────┘      └──────────────────────┘
```

## 🎯 Key Features

### 1. **Authentication & Authorization**
- JWT-based authentication
- Role-based access control (user, admin)
- Password hashing with bcrypt
- Token refresh mechanism
- Session management
- User profile management

### 2. **Market Data**
- Real-time stock prices via WebSocket
- Historical price data (1D, 1W, 1M, 3M, 6M, 1Y, ALL)
- Technical indicators: SMA, RSI, candlestick patterns
- Market indices (IHSG, LQ45, JII)
- Top gainers/losers tracking
- Stock search functionality

### 3. **AI Analysis**
- AI-powered stock analysis
- Price prediction models
- Sentiment analysis
- Risk assessment
- AI quota management

### 4. **Virtual Trading**
- Paper trading simulation
- Portfolio tracking
- Trade history
- Virtual balance management
- Performance analytics

### 5. **Charting & Visualization**
- Interactive candlestick charts
- Technical indicators overlays
- Multiple timeframes
- Chart comparison
- Export functionality (PDF, PNG)

### 6. **Admin Dashboard**
- User management
- Payment verification
- System analytics
- Role management
- Quota allocation

### 7. **Affiliate Program**
- Referral system
- Commission tracking
- Performance analytics
- Payout management

## 📈 Data Flow

### Market Data Collection
```
1. Frontend requests stock data
2. Backend fetches from OpenBB API or PostgreSQL
3. Data cached in Redis for performance
4. Response returned to frontend with metadata
5. Real-time updates via WebSocket connections
```

### AI Analysis Process
```
1. User requests AI analysis for stock
2. Backend verifies AI quota
3. Stock data retrieved from database
4. AI model processes data (technical indicators + machine learning)
5. Analysis result returned with visualizations
6. Quota usage updated
```

### Virtual Trading Transaction
```
1. User places virtual trade
2. Order validated against virtual balance
3. Transaction recorded in database
4. Portfolio updated
5. Real-time WebSocket update sent to frontend
6. Performance metrics recalculated
```

## 🛡️ Security Measures

### Authentication
- JWT tokens with short expiration
- Refresh token mechanism
- Token blacklisting for logout
- Password hashing with bcrypt (10 rounds)
- Rate limiting on login attempts

### Authorization
- Role-based access control (RBAC)
- Admin-only routes validation
- API key validation for sensitive operations

### Data Security
- Input validation and sanitization
- SQL injection protection (parameterized queries)
- XSS protection (React built-in)
- CORS configuration with allowed origins
- Data encryption in transit (HTTPS)

### API Security
- Rate limiting (express-rate-limit)
- API key authentication
- Request validation middleware
- Error handling with proper status codes

## 📊 Database Schema

### Core Tables
1. **users** - User profiles and authentication
2. **user_sessions** - Session management
3. **saham_data** - Stock price and volume data
4. **fundamental_data** - Financial statements and ratios
5. **portfolio** - User's holdings and transactions
6. **virtual_trading** - Paper trading records
7. **payments** - Subscription and payment history
8. **affiliate** - Referral and commission tracking
9. **audit_logs** - System activity logging
10. **ai_quota_audit** - AI usage tracking

### Indexes
- `idx_users_email` - For fast user lookup
- `idx_users_role` - For role-based queries
- `idx_audit_logs_actor` - For audit log filtering
- `idx_payments_user_id` - For payment tracking
- `idx_payments_status` - For status-based queries

## 🚀 Deployment Architecture

### Production Setup
```
┌─────────────────────────────────────────────────┐
│              Nginx Reverse Proxy                │
│  - SSL Termination                              │
│  - Load Balancing                               │
│  - Static File Serving                          │
└─────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│    Frontend (Vite)    │      │    Backend (Node.js)  │
│  - Build: npm run build│      │  - PM2 Process Mgmt  │
└──────────────────────┘      └──────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│    PostgreSQL 12+     │      │        Redis 6+      │
└──────────────────────┘      └──────────────────────┘
```

### Environment Variables
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - Token signing secret
- `OPENAI_API_KEY` - OpenAI integration
- `OPENBB_API_KEY` - Financial data API
- `CORS_ORIGIN` - Allowed frontend origins

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- npm or yarn

### Frontend Setup
```bash
cd client
npm install
cp .env.example .env
npm run dev
```

### Backend Setup
```bash
cd server
npm install
cp .env.example .env
npm run migrate
npm run dev
```

### Database Migration
```bash
cd server
npm run migrate
npm run seed
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/revoke` - Revoke token

### Stock Data Endpoints
- `GET /api/stocks/price/:symbol` - Current price
- `GET /api/stocks/openbb/price/:symbol` - OpenBB price data
- `GET /api/stocks/candlestick` - Historical data
- `GET /api/stocks/top-gainers` - Top gainers
- `GET /api/stocks/top-losers` - Top losers

### AI Analysis Endpoints
- `GET /api/stocks/openbb/forecast/:symbol` - ML forecast
- `GET /api/stocks/ai/quota` - AI quota info
- `POST /api/stocks/ai/consume` - Consume quota

### Portfolio Endpoints
- `GET /api/portfolio` - Get portfolio
- `POST /api/portfolio` - Add holding
- `PUT /api/portfolio/:id` - Update holding
- `DELETE /api/portfolio/:id` - Remove holding

## 🧪 Testing

### Frontend Tests
```bash
cd client
npm run test
npm run test:watch
```

### Backend Tests
```bash
cd server
npm run test
npm run test:watch
```

### E2E Tests
```bash
cd client
npm run test:e2e
```

## 📈 Performance Optimization

### Frontend Optimization
- Code splitting with React.lazy
- Image optimization
- Memoization for expensive calculations
- Debouncing and throttling
- Service worker for PWA

### Backend Optimization
- Redis caching
- Connection pooling
- Query optimization
- Compression middleware
- Load balancing

### Database Optimization
- Indexing strategy
- Query optimization
- Connection pooling
- Caching layers

## 🔄 CI/CD Pipeline

### Development Workflow
1. Feature branch creation
2. Code linting and testing
3. Pull request review
4. Automated testing
5. Production deployment

### Deployment Tools
- GitHub Actions for CI
- PM2 for process management
- Nginx for load balancing
- Let's Encrypt for SSL

## 📱 Responsive Design

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Design Principles
- Mobile-first approach
- Progressive enhancement
- Accessibility (WCAG 2.0 AA)
- Consistent spacing and typography

## 🌍 Localization

### Supported Languages
- English (en)
- Indonesian (id)

### Translation Files
- `client/src/locales/en.json`
- `client/src/locales/id.json`

## 🐛 Debugging & Monitoring

### Server Logging
- Winston logger with file and console transports
- Error tracking with stack traces
- Performance monitoring

### Frontend Debugging
- React DevTools
- Redux DevTools
- Browser DevTools
- Sentry error tracking

## 📝 Contributing Guidelines

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit pull request
5. Review and merge

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🤝 Support

For support, please:
1. Check the [FAQ](https://idx.mytriv.com/faq)
2. Review the [documentation](https://idx.mytriv.com/docs)
3. Create an issue on GitHub
4. Contact support via email

## 📊 Project Statistics

- **Frontend Components**: 50+
- **Backend Routes**: 20+
- **Database Tables**: 15+
- **Tests**: 100+
- **Languages**: 2 (English, Indonesian)

## 🚀 Future Enhancements

1. **Advanced AI Models** - More sophisticated prediction algorithms
2. **Social Features** - Community, forums, and shared portfolios
3. **Mobile Apps** - iOS and Android applications
4. **Advanced Charting** - More technical indicators
5. **Real Trading Integration** - Broker API connections
6. **Portfolio Analytics** - Advanced performance metrics
7. **Notification System** - Price alerts and market updates
8. **Machine Learning Models** - Custom ML models for prediction

## 🎯 Key Metrics

### User Engagement
- Daily active users (DAU)
- Monthly active users (MAU)
- Session duration
- Bounce rate

### Business Metrics
- Conversion rate
- Churn rate
- Average revenue per user (ARPU)
- Customer lifetime value (CLV)

### Performance Metrics
- Page load time
- API response time
- Error rates
- Server uptime

---

**AI Saham** is built with modern web technologies to provide a comprehensive stock market analysis platform. The architecture is designed for scalability, security, and performance, making it suitable for both individual investors and professional traders.
