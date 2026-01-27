// server/routes/payments.js
const express = require("express");
const router = express.Router();
const { authenticateToken: authMiddleware } = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware").roleMiddleware;
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const paymentService = require("../services/paymentService");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/payments');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'payment-' + uniqueSuffix + extension);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and PDF files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// POST /payments/upload - Upload payment proof
router.post("/upload", authMiddleware, upload.single('buktiTransfer'), async (req, res) => {
  try {
    const { planId, notes } = req.body;
    const userId = req.user.id;
    const file = req.file;

    // Validate required fields
    if (!planId) {
      return res.status(400).json({
        error: "planId diperlukan"
      });
    }

    if (!file) {
      return res.status(400).json({
        error: "File bukti transfer diperlukan"
      });
    }

    // Validate plan exists
    const plans = [
      { id: 'plan_1m', name: '1 Bulan', months: 1, price: 50000, discountPct: 0, quota: 100 },
      { id: 'plan_3m', name: '3 Bulan', months: 3, price: 135000, discountPct: 10, quota: 350 },
      { id: 'plan_6m', name: '6 Bulan', months: 6, price: 240000, discountPct: 20, quota: 750 },
      { id: 'plan_12m', name: '12 Bulan', months: 12, price: 420000, discountPct: 30, quota: 1600 },
      { id: 'basic' },
      { id: 'advance' }
    ];

    const planExists = plans.some(p => p.id === planId);
    if (!planExists) {
      return res.status(400).json({
        error: "Paket tidak ditemukan"
      });
    }

    // Save to database
    const filePath = file.path.replace(/\\/g, '/'); // Normalize path for database
    const query = `
      INSERT INTO payments (user_id, plan_id, file_path, notes, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;

    const values = [userId, planId, filePath, notes || '', 'PENDING'];
    const result = await db.query(query, values);

    console.log(`Payment uploaded: User ${userId} uploaded proof for plan ${planId}`);

    res.json({
      success: true,
      message: "Bukti transfer berhasil diupload! Menunggu verifikasi admin.",
      paymentId: result.rows[0].id
    });

  } catch (error) {
    console.error("Error uploading payment:", error);

    // Delete uploaded file if database operation failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: "Gagal upload bukti transfer"
    });
  }
});

// GET /payments/all - Get all payments (admin only)
router.get("/all", authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT p.*, u.email as user_email, u.username as user_name
      FROM payments p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `;

    const result = await db.query(query);
    res.json(result.rows);

  } catch (error) {
    console.error("Error getting all payments:", error);
    res.status(500).json({
      error: "Gagal mengambil data pembayaran"
    });
  }
});

// POST /payments/update-status - Update payment status (admin only)
router.post("/update-status", authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { id, status } = req.body;

    if (!id || !status) {
      return res.status(400).json({
        error: "id dan status diperlukan"
      });
    }

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        error: "Status tidak valid. Gunakan APPROVED atau REJECTED"
      });
    }

    const query = `
      UPDATE payments
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await db.query(query, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Pembayaran tidak ditemukan"
      });
    }

    console.log(`Payment ${id} status updated to ${status} by admin ${req.user.id}`);

    res.json({
      success: true,
      message: `Status pembayaran berhasil diubah menjadi ${status}`,
      payment: result.rows[0]
    });

  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({
      error: "Gagal mengupdate status pembayaran"
    });
  }
});

// GET /payments/status - Get payment status for user
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT id, plan_id, status, notes, created_at
      FROM payments
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.json({
        status: null,
        message: "Belum ada pembayaran yang diupload"
      });
    }

    const payment = result.rows[0];
    res.json({
      status: payment.status,
      planId: payment.plan_id,
      notes: payment.notes,
      createdAt: payment.created_at,
      paymentId: payment.id
    });

  } catch (error) {
    console.error("Error getting payment status:", error);
    res.status(500).json({
      error: "Gagal mengambil status pembayaran"
    });
  }
});

// GET /api/plans - Get available subscription plans
router.get("/plans", async (req, res) => {
  try {
    console.log('[Payments] Fetching subscription plans');

    const plans = await paymentService.getPlans();

    res.json({
      success: true,
      plans: plans,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Payments] Error fetching subscription plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription plans',
      message: 'An error occurred while loading subscription plans. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/plans/order - Create subscription order
router.post("/plans/order", authMiddleware, async (req, res) => {
  try {
    const { planId, amount } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!planId || !amount) {
      return res.status(400).json({
        success: false,
        error: "planId and amount are required"
      });
    }

    // Validate amount is positive
    if (parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount",
        message: "Amount must be greater than 0"
      });
    }

    console.log(`[Payments] Creating subscription order for user ${userId}, plan ${planId}, amount ${amount}`);

    const order = await paymentService.createOrder(userId, planId, parseFloat(amount));

    res.json({
      success: true,
      message: "Subscription order created successfully",
      order: order,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Payments] Error creating subscription order for user ${req.user.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription order',
      message: 'An error occurred while creating your subscription order. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/plans/instructions - Get payment instructions
router.get("/plans/instructions", async (req, res) => {
  try {
    console.log('[Payments] Fetching payment instructions');

    const instructions = paymentService.getPaymentInstructions();

    res.json({
      success: true,
      instructions: instructions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Payments] Error fetching payment instructions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment instructions',
      message: 'An error occurred while loading payment instructions. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/plans/orders - Get user's subscription orders
router.get("/plans/orders", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[Payments] Fetching subscription orders for user ${userId}`);

    const orders = await paymentService.getUserOrders(userId);

    res.json({
      success: true,
      orders: orders,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Payments] Error fetching subscription orders for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription orders',
      message: 'An error occurred while loading your subscription orders. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;