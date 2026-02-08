const { pool } = require('./config/db');

pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' AND table_name = \'subscriptions\';')
    .then(res => {
        console.log('Subscriptions table exists:', res.rows.length > 0);
        console.log('Table details:', res.rows);
    })
    .catch(err => {
        console.error('Error:', err);
    })
    .finally(() => {
        // No need to end the pool, it's a persistent connection pool
        console.log('Check completed');
    });
