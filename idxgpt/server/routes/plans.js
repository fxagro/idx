// server/routes/plans.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const paymentService = require("../services/paymentService");

// GET /api/plans - Get available subscription plans
router.get("/", async (req, res) => {
  try {
    console.log('[Plans] Fetching subscription plans');

    const plans = await paymentService.getPlans();

    res.json({
      success: true,
      plans: plans,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Plans] Error fetching subscription plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription plans',
      message: 'An error occurred while loading subscription plans. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/plans/order - Create subscription order
router.post("/order", auth, async (req, res) => {
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

    console.log(`[Plans] Creating subscription order for user ${userId}, plan ${planId}, amount ${amount}`);

    const order = await paymentService.createOrder(userId, planId, parseFloat(amount));

    res.json({
      success: true,
      message: "Subscription order created successfully",
      order: order,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Plans] Error creating subscription order for user ${req.user.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription order',
      message: 'An error occurred while creating your subscription order. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/plans/instructions - Get payment instructions
router.get("/instructions", async (req, res) => {
  try {
    console.log('[Plans] Fetching payment instructions');

    const instructions = paymentService.getPaymentInstructions();

    res.json({
      success: true,
      instructions: instructions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Plans] Error fetching payment instructions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment instructions',
      message: 'An error occurred while loading payment instructions. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/plans/orders - Get user's subscription orders
router.get("/orders", auth, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`[Plans] Fetching subscription orders for user ${userId}`);

    const orders = await paymentService.getUserOrders(userId);

    res.json({
      success: true,
      orders: orders,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Plans] Error fetching subscription orders for user ${userId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription orders',
      message: 'An error occurred while loading your subscription orders. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
});

// Legacy endpoint - Request a plan subscription (deprecated)
router.post("/request", auth, async (req, res) => {
  try {
    const { planId, userId } = req.body;

    if (!planId || !userId) {
      return res.status(400).json({
        error: "planId dan userId diperlukan"
      });
    }

    // Validate plan exists
    const plans = await paymentService.getPlans();
    const planExists = plans.find(p => p.id === planId);
    if (!planExists) {
      return res.status(400).json({
        error: "Paket tidak ditemukan"
      });
    }

    // Here you would typically:
    // 1. Store the plan request in database
    // 2. Send notification to admin
    // 3. Send confirmation email to user

    console.log(`Plan request received: User ${userId} requested plan ${planId}`);

    res.json({
      success: true,
      message: "Permintaan paket berhasil dikirim. Tim kami akan menghubungi Anda dalam 24 jam."
    });

  } catch (error) {
    console.error("Error processing plan request:", error);
    res.status(500).json({
      error: "Gagal memproses permintaan paket"
    });
  }
});

module.exports = router;
