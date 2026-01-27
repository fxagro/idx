// Database configuration
const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const pool = new Pool({
  user: process.env.DB_USER || 'openpg',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'stock',
  password: process.env.DB_PASS || 'openpgpwd',
  port: process.env.DB_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: false,
});

// Enhanced error logging for pool events
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', {
    stack: err.stack,
    code: err.code,
    message: err.message,
    severity: err.severity,
    detail: err.detail,
    hint: err.hint,
    position: err.position,
    internalPosition: err.internalPosition,
    internalQuery: err.internalQuery,
    where: err.where,
    schema: err.schema,
    table: err.table,
    column: err.column,
    dataType: err.dataType,
    constraint: err.constraint,
    file: err.file,
    line: err.line,
    routine: err.routine
  });
});

// Log pool events for debugging
pool.on('connect', (client) => {
  console.log('New client connected to PostgreSQL');
});

pool.on('remove', (client) => {
  console.log('Client removed from pool');
});

module.exports = { pool };