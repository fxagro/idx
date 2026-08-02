const pool = require('../db');
const nodemailer = require('nodemailer');

const createOrder = async (userId, planId, amount) => {
  try {
    console.log(`[PaymentService] Creating subscription order for user ${userId}, plan ${planId}, amount ${amount}`);

    const query = `
      INSERT INTO subscriptions (user_id, plan_id, amount, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id
    `;

    const result = await pool.query(query, [userId, planId, amount]);
    console.log(`[PaymentService] Successfully created subscription order ${result.rows[0].id} for user ${userId}`);

    return {
      id: result.rows[0].id,
      user_id: userId,
      plan_id: planId,
      amount: amount,
      status: 'pending',
      created_at: new Date()
    };
  } catch (error) {
    console.error(`[PaymentService] Error creating subscription order for user ${userId}:`, error);
    throw new Error('Failed to create subscription order');
  }
};

const getPlans = async () => {
  try {
    console.log('[PaymentService] Fetching subscription plans');

    const plans = [
      {
        id: 'free',
        name: 'Free',
        price: 0,
        period: 'Free',
        benefits: [
          'Akses Telegram',
          'Harga delay data EOD (H-1)',
          'Akses web terbatas'
        ]
      },
      {
        id: 'basic',
        name: 'Basic',
        price: 60000,
        priceOption3Months: 149000,
        period: '/bulan atau Rp 149.000 / 3 bulan',
        popular: true,
        benefits: [
          'Akses Telegram',
          'BSJP Scanner',
          'Sinyal Trading Harian',
          'Berita IDX',
          'Kalender Event IDX',
          'Notifikasi & Alert',
          'Watchlist',
          'Analisa Mendalam',
          'Early Buy Radar',
          'Export CSV/PDF',
          'Screener Custom',
          'Bandarmology',
          'Peta Jaringan Insider',
          'Orderbook Live',
          'Virtual Trading saldo s/d 1 Miliar'
        ]
      },
      {
        id: 'lifetime',
        name: 'Lifetime',
        price: 500000,
        period: 'Sekali Bayar (Lifetime)',
        benefits: [
          'Akses Telegram',
          'Harga Realtime',
          'Akses Web Penuh',
          'Virtual Trading',
          'Semua Fitur Basic + Akses Seumur Hidup'
        ]
      }
    ];

    console.log(`[PaymentService] Successfully fetched ${plans.length} subscription plans`);
    return plans;
  } catch (error) {
    console.error('[PaymentService] Error fetching subscription plans:', error);
    throw new Error('Failed to fetch subscription plans');
  }
};

const getUserOrders = async (userId) => {
  try {
    const query = `
      SELECT id, plan_id, amount, status, proof_path, created_at
      FROM subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error(`[PaymentService] Error fetching subscription orders for user ${userId}:`, error);
    throw new Error('Failed to fetch subscription orders');
  }
};

module.exports = {
  createOrder,
  getPlans,
  getUserOrders
};
