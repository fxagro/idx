const winston = require('winston');
const chalk = require('chalk');

// Winston logger for production file logging
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-saham-server' },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
  ],
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  winstonLogger.add(new winston.transports.Console({
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

// Enhanced console logger utility with emojis and colors for development
const consoleLogger = {
  // Info messages - general information
  info: (message, meta = null) => {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(chalk.blue(`[${timestamp}] ℹ️ ${message}${metaStr}`));
  },

  // Success messages - operations completed successfully
  success: (message, meta = null) => {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(chalk.green(`[${timestamp}] ✅ ${message}${metaStr}`));
  },

  // Warning messages - something unexpected but not critical
  warn: (message, meta = null) => {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(chalk.yellow(`[${timestamp}] ⚠️ ${message}${metaStr}`));
  },

  // Error messages - critical errors that need attention
  error: (message, meta = null) => {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.error(chalk.red(`[${timestamp}] ❌ ${message}${metaStr}`));
  },

  // Debug messages - detailed information for debugging
  debug: (message, meta = null) => {
    if (process.env.LOG_LEVEL === 'debug') {
      const timestamp = new Date().toISOString();
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
      console.debug(chalk.gray(`[${timestamp}] 🔍 ${message}${metaStr}`));
    }
  },

  // Request logging - specific for HTTP requests
  request: (method, url, statusCode, duration) => {
    const statusColor = statusCode >= 400 ? chalk.red : statusCode >= 300 ? chalk.yellow : chalk.green;
    const methodColor = method === 'GET' ? chalk.blue :
                       method === 'POST' ? chalk.green :
                       method === 'PUT' ? chalk.yellow :
                       method === 'DELETE' ? chalk.red : chalk.white;

    console.log(`${methodColor(method)} ${url} ${statusColor(statusCode)} ${chalk.gray(`(${duration}ms)`)}`);
  },

  // Database operations logging
  db: (operation, table, duration, meta = null) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(chalk.cyan(`[${new Date().toISOString()}] 🗄️ ${operation} ${table} (${duration}ms)${metaStr}`));
  },

  // Authentication logging
  auth: (action, user, status, meta = null) => {
    const statusEmoji = status === 'success' ? '🔐' : '🚫';
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(chalk.magenta(`[${new Date().toISOString()}] ${statusEmoji} ${action} - ${user}${metaStr}`));
  }
};

// Export both loggers
module.exports = winstonLogger;
module.exports.console = consoleLogger;