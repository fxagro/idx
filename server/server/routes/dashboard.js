const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboardService');
const { authenticateToken } = require('../middleware/authMiddleware');

// Apply authentication middleware to all dashboard routes
router.use(authenticateToken);

// GET /api/dashboard/summary - Get comprehensive dashboard summary
router.get('/summary', async (req, res) => {
  try {
    console.log(`[Dashboard] Fetching dashboard summary for user ${req.user.id}`);

    const summary = await dashboardService.getDashboardSummary(req.user.id);

    console.log(`[Dashboard] Successfully sent dashboard summary for user ${req.user.id}`);

    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Dashboard] Error fetching dashboard summary for user ${req.user.id}:`, error);

    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      message: 'An error occurred while loading your dashboard. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/dashboard/portfolio-allocation - Get portfolio allocation data for charts
router.get('/portfolio-allocation', async (req, res) => {
  try {
    console.log(`[Dashboard] Fetching portfolio allocation for user ${req.user.id}`);

    const allocation = await dashboardService.getPortfolioAllocation(req.user.id);

    console.log(`[Dashboard] Successfully sent portfolio allocation for user ${req.user.id}`);

    res.json({
      success: true,
      data: allocation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Dashboard] Error fetching portfolio allocation for user ${req.user.id}:`, error);

    res.status(500).json({
      success: false,
      error: 'Failed to fetch portfolio allocation',
      message: 'An error occurred while loading portfolio allocation data. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;