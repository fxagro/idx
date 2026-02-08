// Load environment variables FIRST before any other modules
require("dotenv").config({ path: '.env' });

const express = require("express");
const cors = require("cors");
const path = require("path");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const { createServer } = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const winston = require("winston");
const PriceSimulator = require("./services/priceSimulator");

// Import new modular structure
const apiRoutes = require("./routes");
const responseMiddleware = require("./utils/response");
const errorHandler = require("./middleware/errorHandler");

// Create logs directory if it doesn't exist
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs');
}

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'stock-dashboard-api' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({
      filename: './logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({
      filename: './logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    // Write cron job logs to separate file
    new winston.transports.File({
      filename: './logs/cron.log',
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ],
});

// If we're not in production then log to the console with a simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        return `[${timestamp}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
      })
    )
  }));
}

// Make logger available globally
global.logger = logger;

// PostgreSQL setup with fallback
let pool;
try {
  // Try to load the database module with proper error handling
  const dbConfig = require("./config/db");
  pool = dbConfig.getPool();
  logger.info('Database module loaded successfully');
} catch (error) {
  logger.error('Failed to load database module:', {
    message: error.message,
    stack: error.stack
  });
  // Create a mock pool for development with fallback
  pool = {
    query: async (text, params) => {
      logger.warn('Mock pool query called:', { text, params });
      // Return empty results for read operations to allow basic functionality
      if (text.toLowerCase().startsWith('select')) {
        return { rows: [] };
      }
      // For write operations, just acknowledge
      if (text.toLowerCase().startsWith('insert') || text.toLowerCase().startsWith('update') || text.toLowerCase().startsWith('delete')) {
        return { rowCount: 0 };
      }
      // For other operations, return basic response
      return { rows: [] };
    },
    connect: async () => {
      return {
        query: async (text, params) => {
          logger.warn('Mock pool connect query called:', { text, params });
          return { rows: [] };
        },
        release: () => {}
      };
    }
  };
}

// Services
const { testOpenRouterConnection } = require("./services/openRouterService");

// Create Express app
const app = express();

// Create HTTP server
const server = createServer(app);

// CORS Configuration - Single source of truth
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000",
    "http://192.168.0.1:5173",
    "http://192.168.0.1:5174",
    "http://192.168.0.1:3000",
    "http://172.10.10.110:5173",
    "http://172.10.10.110:5174",
    "http://172.10.10.110:3000",
    "http://172.51.1.55:5173",
    "http://172.51.1.55:5174",
    "http://172.51.1.55:3000",
    "https://idx.mytriv.com",
    "https://www.idx.mytriv.com",
    process.env.CLIENT_URL
  ].filter(Boolean), // Remove any undefined values
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

// Apply CORS middleware FIRST, before any routes
app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options("*", cors(corsOptions));

// IMPORTANT: Handle socket.io requests BEFORE any other middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/socket.io/') || req.headers['upgrade'] === 'websocket') {
    logger.info('Socket.io request detected:', req.path);
    return next();
  }
  next();
});

// Configure body parser - MUST come before routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
logger.info('Body parser configured');

// Create Socket.io instance FIRST
const io = new Server(server, {
  cors: corsOptions,
  path: '/socket.io/'
});

// Initialize price simulator with io instance
const priceSimulator = new PriceSimulator(io);

// Health check endpoint - MUST come before routes
app.get("/api/test", (req, res) => {
  logger.info('Health check endpoint accessed');
  res.json({ status: "ok", message: "Server running fine" });
});

// Root endpoint
app.get("/", (req, res) => {
  logger.info('Root endpoint accessed');
  res.send('IDX Server is running');
});

// Health check endpoint
app.get("/health", (req, res) => {
  logger.info('Health check endpoint accessed');
  res.send('OK');
});

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(morgan("dev"));

// Add unified response helper
app.use(responseMiddleware);

// Debug endpoint to test JSON parsing - ONLY in development mode
if (process.env.NODE_ENV === 'development') {
  app.post("/api/debug", (req, res) => {
    logger.debug("Debug - Raw body:", req.rawBody);
    logger.debug("Debug - Body:", req.body);
    logger.debug("Debug - Headers:", req.headers);
    res.json({
      rawBody: req.rawBody,
      body: req.body,
      headers: req.headers
    });
  });
}

// Middleware
const authMiddleware = require("./middleware/authMiddleware");
const apiUsageMiddleware = require("./middleware/apiUsage");
const { apiLimiter } = require('./middleware/rateLimiter');

// WebSocket connection handling
io.on("connection", (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Handle stock subscription
  socket.on("subscribe_stock", (data) => {
    const { symbol, market = 'idx' } = data;
    const room = `${symbol}_${market}`;
    socket.join(room);
    logger.info(`Client ${socket.id} subscribed to ${room}`);

    // Add symbol to simulator for real-time updates
    priceSimulator.addSymbol(symbol);

    // Send current price immediately
    const currentPrice = priceSimulator.getCurrentPrice(symbol);
    if (currentPrice) {
      socket.emit("price_update", currentPrice);
    }
  });

  // Handle stock unsubscription
  socket.on("unsubscribe_stock", (data) => {
    const { symbol, market = 'idx' } = data;
    const room = `${symbol}_${market}`;
    socket.leave(room);
    logger.info(`Client ${socket.id} unsubscribed from ${room}`);
  });

  // Send current market summary
  socket.on("get_market_summary", () => {
    const prices = priceSimulator.getAllPrices();
    const marketSummary = {
      totalStocks: prices.length,
      gainers: prices.filter(s => s.change > 0).length,
      losers: prices.filter(s => s.change < 0).length,
      timestamp: new Date()
    };
    socket.emit("market_summary", marketSummary);
  });

  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Make io available globally for broadcasting price updates
global.io = io;

// Mount all API routes using the new modular structure
// IMPORTANT: This must come AFTER socket.io setup
app.use("/api", apiRoutes);

logger.info('🚀 All API routes mounted successfully');

// Serve static files from the client build
const clientPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientPath)) {
  app.use(express.static(clientPath));
  logger.info('✅ Client static files mounted from:', clientPath);
} else {
  logger.warn('⚠️ Client build not found at:', clientPath);
}

// SPA fallback - serve index.html for client-side routing
// This must come AFTER API routes
app.get('*', (req, res, next) => {
  // Don't interfere with API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
    return next();
  }
  
  // Check if client build exists
  if (fs.existsSync(clientPath)) {
    const indexPath = path.join(clientPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  
  // If no client build, show a message
  res.send('IDX Server API is running. Frontend build not found.');
});

// Global error handler (must be last)
app.use(errorHandler);

// PORT declaration - single source of truth
const PORT = process.env.PORT || 5000;

// Test database connection with retry logic
const testDB = async () => {
  let retries = 3;
  while (retries--) {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (e) {
      logger.warn('DB connection retry attempt', {
        retry: 3 - retries,
        error: e.message,
        code: e.code,
        detail: e.detail || 'No detail'
      });
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  return false;
};

// Bootstrap function - wraps all startup logic
async function bootstrap() {
  // Test database connection and create users table on startup
  try {
    const dbConnected = await testDB();
    if (dbConnected) {
      logger.info('✅ Database connected successfully');

      // Auto-create users table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          phone VARCHAR(50),
          role VARCHAR(50) DEFAULT 'user',
          subscription_expiry TIMESTAMP,
          api_usage INTEGER DEFAULT 0,
          api_limit INTEGER DEFAULT 100,
          ai_quota INTEGER DEFAULT 10,
          ai_usage INTEGER DEFAULT 0,
          referral_code VARCHAR(50),
          virtual_saldo DECIMAL(15, 2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      logger.info('✅ Users table created/verified successfully');

      // Auto-create user_sessions table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_jti VARCHAR(255) UNIQUE NOT NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          location VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_revoked BOOLEAN DEFAULT FALSE,
          expires_at TIMESTAMP NOT NULL
        )
      `);
      logger.info('✅ User sessions table created/verified successfully');

      // Create indexes for user_sessions table
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_token_jti ON user_sessions(token_jti);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_is_revoked ON user_sessions(is_revoked);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
      `);
      logger.info('✅ User sessions indexes created/verified successfully');

      // Add avatar column to users table if it doesn't exist
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'avatar'
          ) THEN
            ALTER TABLE users ADD COLUMN avatar TEXT;
          END IF;
        END $$
      `);

      // Add auth_method column to users table if it doesn't exist
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'auth_method'
          ) THEN
            ALTER TABLE users ADD COLUMN auth_method VARCHAR(50) DEFAULT 'password';
          END IF;
        END $$
      `);

      // Add updated_at column to users table if it doesn't exist
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'updated_at'
          ) THEN
            ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          END IF;
        END $$
      `);

      // Add ai_usage column to users table if it doesn't exist
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'ai_usage'
          ) THEN
            ALTER TABLE users ADD COLUMN ai_usage INTEGER DEFAULT 0;
          END IF;
        END $$
      `);

      // Add referral_code column to users table if it doesn't exist
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'referral_code'
          ) THEN
            ALTER TABLE users ADD COLUMN referral_code VARCHAR(50);
          END IF;
        END $$
      `);

      // Add virtual_saldo column to users table if it doesn't exist
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'virtual_saldo'
          ) THEN
            ALTER TABLE users ADD COLUMN virtual_saldo DECIMAL(15, 2) DEFAULT 0;
          END IF;
        END $$
      `);

      logger.info('✅ Users table columns verified successfully');
    } else {
      logger.error('❌ Database connection failed after all retries');
    }
  } catch (error) {
    logger.error('❌ Database connection or table creation failed', {
      stack: error.stack,
      code: error.code,
      message: error.message,
      detail: error.detail || 'No detail',
      hint: error.hint,
      position: error.position,
      internalPosition: error.internalPosition,
      internalQuery: error.internalQuery,
      where: error.where,
      schema: error.schema,
      table: error.table,
      column: error.column,
      dataType: error.dataType,
      constraint: error.constraint,
      file: error.file,
      line: error.line,
      routine: error.routine,
      severity: error.severity
    });
  }

  // Test OpenRouter API connection on startup
  try {
    const isConnected = await testOpenRouterConnection();
    if (isConnected) {
      logger.info(`✅ OpenRouter API connection verified successfully`);
    } else {
      logger.error(`❌ OpenRouter API connection failed - AI analysis may not work properly`);
    }
  } catch (error) {
    logger.error(`❌ Error testing OpenRouter API connection:`, error.message);
  }

  // Test Redis connection on startup (skip in development mode)
  if (process.env.NODE_ENV === 'development') {
    logger.info('🔧 Dev mode: Skipping Redis, using in-memory only');
  } else {
    try {
      const Redis = require('ioredis');
      const client = new Redis({ host: '127.0.0.1', port: 6379 });
      await client.ping();
      logger.info('✅ Redis IPv4 connected successfully');
      client.quit();
    } catch (error) {
      logger.warn('⚠️ Redis connection failed, using in-memory fallback:', error.message);
    }
  }
}

// Start server listening
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server is running on port ${PORT}`);
  logger.info(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
  
  // Start price simulation AFTER server is listening
  priceSimulator.start();
  logger.info('📈 Price simulator started');
  
  // Run bootstrap async function
  bootstrap().catch(error => {
    logger.error('❌ Bootstrap failed:', error);
  });
});

// Server error handler
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`❌ Port ${PORT} is already in use. Please stop the process using this port.`);
    process.exit(1);
  } else {
    logger.error(`❌ Server error on port ${PORT}:`, error.message);
    process.exit(1);
  }
});

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  logger.info(`🛑 ${signal} received, shutting down gracefully...`);
  
  // Stop price simulator
  priceSimulator.stop();
  logger.info('📈 Price simulator stopped');
  
  // Close Socket.IO
  io.close(() => {
    logger.info('🔌 Socket.IO closed');
  });
  
  // Close HTTP server
  server.close(() => {
    logger.info('🌐 HTTP server closed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
