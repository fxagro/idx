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
  const dbModule = require("./db");
  pool = dbModule.getPool();
  logger.info('Database module loaded successfully');
} catch (error) {
  logger.error('Failed to load database module:', error.message);
  // Create a mock pool for development
  pool = {
    query: async () => {
      throw new Error('Database not available');
    }
  };
}

// Services
const { testOpenRouterConnection } = require("./services/openRouterService");

const app = express();
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
    "https://14a16c21071b.ngrok-free.app",
    /.*\.ngrok\.io$/,
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

// Routes are handled by their respective routers with their own middleware

// Routes are handled by their respective routers with their own middleware
// The priceSimulator is already initialized above

// Start price simulation
priceSimulator.start();

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('🛑 SIGTERM received, shutting down gracefully...');
  priceSimulator.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('🛑 SIGINT received, shutting down gracefully...');
  priceSimulator.stop();
  process.exit(0);
});

// Graceful port handling with fallback
const PORT = process.env.PORT || 5000;

const serverInstance = app.listen(PORT, async () => {
  logger.info(`✅ Server ready on port ${PORT}`);
  logger.info(`🚀 OpenBB routes mounted successfully`);

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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      logger.info('✅ Users table created/verified successfully');
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
});

serverInstance.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.warn(`⚠️ Port ${PORT} is already in use, trying port ${PORT + 1}`);
    const newPort = PORT + 1;
    app.listen(newPort, () => {
      logger.info(`✅ Server ready on port ${newPort}`);
      logger.info(`🚀 OpenBB routes mounted successfully`);
    });
  } else {
    logger.error(`❌ Server error on port ${PORT}:`, error.message);
    process.exit(1);
  }
});
