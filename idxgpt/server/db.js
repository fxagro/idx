// Legacy db.js file - DEPRECATED
// Use server/config/db.js instead
// This file is kept for backward compatibility during transition

const { pool } = require('./config/db');
module.exports = { pool };
