const { getPool } = require('../db');
const nodemailer = require('nodemailer');

// Create subscription order with email notification
const createOrder = async (userId, planId, amount) => {
  try {
    console.log(`[PaymentService] Creating subscription order for user ${userId}, plan ${planId}, amount ${amount}`);

    const query = `
      INSERT INTO subscriptions (user_id, plan_id, amount, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING id
    `;

    const db = getPool();
    const result = await db.query(query, [userId, planId, amount]);

    console.log(`[PaymentService] Successfully created subscription order ${result.rows[0].id} for user ${userId}`);

    // Send email notification
    try {
      await sendOrderConfirmationEmail(userId, planId, amount);
      console.log(`[PaymentService] Order confirmation email sent to user ${userId}`);
    } catch (emailError) {
      console.error(`[PaymentService] Failed to send confirmation email to user ${userId}:`, emailError);
      // Don't fail the order creation if email fails
    }

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

// Get subscription plans
const getPlans = async () => {
  try {
    console.log('[PaymentService] Fetching subscription plans');

    const plans = [
      {
        id: 'basic',
        name: 'Basic',
        price: 50000,
        quota: 10,
        benefits: ['Kuota AI 10x/bulan', 'Analisis Dasar']
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 100000,
        quota: 50,
        benefits: ['Kuota AI 50x/bulan', 'Analisis Premium', 'Data Real-time']
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 200000,
        quota: 100,
        benefits: ['Kuota AI 100x/bulan', 'Akses Broker Data', 'Analisis Lanjutan', 'Support Prioritas']
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 250000,
        quota: 1000,
        benefits: ['Kuota AI 1000x/bulan', 'Akses Broker Data', 'Analisis Lanjutan', 'Support Prioritas', 'API Access', 'Custom Integration']
      }
    ];

    console.log(`[PaymentService] Successfully fetched ${plans.length} subscription plans`);

    return plans;
  } catch (error) {
    console.error('[PaymentService] Error fetching subscription plans:', error);
    throw new Error('Failed to fetch subscription plans');
  }
};

// Get user's subscription orders
const getUserOrders = async (userId) => {
  try {
    console.log(`[PaymentService] Fetching subscription orders for user ${userId}`);

    const query = `
      SELECT id, plan_id, amount, status, proof_path, created_at
      FROM subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    const db = getPool();
    const result = await db.query(query, [userId]);

    console.log(`[PaymentService] Successfully fetched ${result.rows.length} subscription orders for user ${userId}`);

    return result.rows.map(row => ({
      id: row.id,
      plan_id: row.plan_id,
      amount: parseFloat(row.amount),
      status: row.status,
      proof_path: row.proof_path,
      created_at: row.created_at
    }));
  } catch (error) {
    console.error(`[PaymentService] Error fetching subscription orders for user ${userId}:`, error);
    throw new Error('Failed to fetch subscription orders');
  }
};

// Update subscription status (for admin use)
const updateOrderStatus = async (orderId, status, proofPath = null) => {
  try {
    console.log(`[PaymentService] Updating subscription order ${orderId} status to ${status}`);

    const query = `
      UPDATE subscriptions
      SET status = $1, proof_path = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const db = getPool();
    const result = await db.query(query, [status, proofPath, orderId]);

    if (result.rows.length === 0) {
      throw new Error('Subscription order not found');
    }

    console.log(`[PaymentService] Successfully updated subscription order ${orderId} status to ${status}`);

    return result.rows[0];
  } catch (error) {
    console.error(`[PaymentService] Error updating subscription order ${orderId}:`, error);
    throw new Error('Failed to update subscription order status');
  }
};

// Send order confirmation email
const sendOrderConfirmationEmail = async (userId, planId, amount) => {
  try {
    console.log(`[PaymentService] Sending order confirmation email to user ${userId}`);

    // Get user email
    const db = getPool();
    const userQuery = 'SELECT email FROM users WHERE id = $1';
    const userResult = await db.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const userEmail = userResult.rows[0].email;

    // Get plan details
    const plans = getPlans();
    const plan = plans.find(p => p.id === planId);

    if (!plan) {
      throw new Error('Plan not found');
    }

    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mail.mytriv.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'idx@mytriv.com',
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || 'idx@mytriv.com',
      to: userEmail,
      subject: 'Konfirmasi Pesanan Paket AI Saham',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">AI Saham Platform</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Konfirmasi Pesanan Paket</p>
          </div>

          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px; text-align: center;">✅ Pesanan Berhasil Dibuat</h2>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="color: #333; margin-bottom: 15px;">Detail Pesanan:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Paket:</td>
                  <td style="padding: 8px 0; color: #333;">${plan.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Kuota AI:</td>
                  <td style="padding: 8px 0; color: #333;">${plan.quota}x per bulan</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Jumlah:</td>
                  <td style="padding: 8px 0; color: #333; font-size: 18px; font-weight: bold;">Rp ${amount.toLocaleString('id-ID')}</td>
                </tr>
              </table>
            </div>

            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2196f3;">
              <h3 style="color: #1976d2; margin-bottom: 15px;">�🏦 Instruksi Pembayaran:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Bank:</td>
                  <td style="padding: 8px 0; color: #333; font-family: monospace;">BCA</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">No. Rekening:</td>
                  <td style="padding: 8px 0; color: #333; font-family: monospace; font-size: 16px; font-weight: bold;">00132000048716</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Atas Nama:</td>
                  <td style="padding: 8px 0; color: #333;">Agus Rochman</td>
                </tr>
              </table>
            </div>

            <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
              <h4 style="color: #f57c00; margin-bottom: 10px;">⚠️ Catatan Penting:</h4>
              <ul style="color: #f57c00; margin: 0; padding-left: 20px;">
                <li>Transfer sesuai dengan jumlah paket yang dipilih</li>
                <li>Cantumkan ID pesanan dalam berita transfer</li>
                <li>Upload bukti transfer setelah pembayaran</li>
                <li>Bukti akan diverifikasi dalam 1-2 hari kerja</li>
                <li>Kirim bukti ke support@ai-saham.com jika diperlukan</li>
              </ul>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; margin-bottom: 10px;">Terima kasih telah memilih AI Saham Platform!</p>
              <p style="color: #999; font-size: 12px;">Email ini dikirim otomatis, mohon tidak membalas email ini.</p>
            </div>
          </div>
        </div>
      `,
      text: `
AI SAHAM PLATFORM - KONFIRMASI PESANAN

Pesanan paket berhasil dibuat!

DETAIL PESANAN:
- Paket: ${plan.name}
- Kuota AI: ${plan.quota}x per bulan
- Jumlah: Rp ${amount.toLocaleString('id-ID')}

INSTRUKSI PEMBAYARAN:
- Bank: BCA
- No. Rekening: 00132000048716
- Atas Nama: Agus Rochman

CATATAN PENTING:
- Transfer sesuai dengan jumlah paket yang dipilih
- Cantumkan ID pesanan dalam berita transfer
- Upload bukti transfer setelah pembayaran
- Bukti akan diverifikasi dalam 1-2 hari kerja
- Kirim bukti ke support@ai-saham.com jika diperlukan

Terima kasih telah memilih AI Saham Platform!
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);
    console.log(`[PaymentService] Order confirmation email sent successfully to ${userEmail}`);

  } catch (error) {
    console.error(`[PaymentService] Error sending order confirmation email to user ${userId}:`, error);
    throw new Error('Failed to send confirmation email');
  }
};

// Get payment instructions
const getPaymentInstructions = () => {
  return {
    bank_name: 'BCA',
    account_number: '00132000048716',
    account_holder: 'Agus Rochman',
    instructions: [
      'Transfer sesuai dengan paket yang dipilih',
      'Upload bukti transfer setelah pembayaran',
      'Bukti transfer akan diverifikasi dalam 1-2 hari kerja',
      'Setelah verifikasi, paket akan diaktivasi',
      'Kirim bukti transfer ke support@ai-saham.com jika diperlukan'
    ]
  };
};

module.exports = {
  createOrder,
  getPlans,
  getUserOrders,
  updateOrderStatus,
  getPaymentInstructions,
  sendOrderConfirmationEmail
};