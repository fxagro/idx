const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get list of all brokers
router.get('/list', async (req, res) => {
  try {
    // Use hardcoded broker codes since broker_data_all view has permission issues
    const brokerCodes = [
      'ad', 'af', 'ag', 'ah', 'ai', 'ak', 'an', 'ao', 'ap', 'ar', 'at', 'az',
      'bb', 'bf', 'bk', 'bq', 'br', 'bs', 'cc', 'cd', 'cp', 'dd', 'dh', 'dp',
      'dr', 'du', 'dx', 'el', 'ep', 'es', 'fo', 'fs', 'fz', 'ga', 'gi', 'gr',
      'gw', 'hd', 'hp', 'ic', 'id', 'if', 'ih', 'ii', 'in', 'ip', 'it', 'iu',
      'jb', 'ki', 'kk', 'kz', 'lg', 'ls', 'mg', 'mi', 'mu', 'ni', 'od', 'ok',
      'pc', 'pd', 'pf', 'pg', 'pi', 'po', 'pp', 'ps', 'qa', 'rb', 'rf', 'rg',
      'ro', 'rs', 'rx', 'sa', 'sf', 'sh', 'sq', 'ss', 'tf', 'tp', 'ts', 'xa',
      'xc', 'xl', 'yb', 'yj', 'yo', 'yp', 'yu', 'zp', 'zr'
    ];

    const brokers = brokerCodes.map(code => ({
      code: code.toUpperCase(),
      name: code.toUpperCase()
    }));

    res.json({ brokers });
  } catch (error) {
    console.error('Error fetching brokers list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;