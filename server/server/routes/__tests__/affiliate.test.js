// server/routes/__tests__/affiliate.test.js
const request = require('supertest');
const express = require('express');
const affiliateRouter = require('../affiliate');
const AffiliateService = require('../../services/affiliateService');

const app = express();
app.use(express.json());
app.use('/api/affiliate', affiliateRouter);

// Mock the auth middleware
jest.mock('../../middleware/auth', () => {
  return jest.fn((req, res, next) => {
    // Mock authenticated admin user
    req.user = { id: 1, email: 'agro@demo.com' };
    next();
  });
});

// Mock the validation middleware
jest.mock('../../middleware/validation', () => ({
  validate: () => (req, res, next) => next()
}));

// Mock the database
jest.mock('../../db', () => ({
  query: jest.fn()
}));

const pool = require('../../db');

describe('Affiliate API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/affiliate/dashboard', () => {
    test('should return affiliate dashboard data', async () => {
      const mockDashboardData = {
        referral_link: 'TEST1234567890AB',
        total_referrals: { level_1: 2, level_2: 1, total: 3 },
        total_commissions: { level_1: 80, level_2: 20, total: 100 },
        history: []
      };

      AffiliateService.getDashboardData = jest.fn().mockResolvedValue(mockDashboardData);

      const response = await request(app)
        .get('/api/affiliate/dashboard')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockDashboardData
      });
    });

    test('should handle errors gracefully', async () => {
      AffiliateService.getDashboardData = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/affiliate/dashboard')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to get affiliate dashboard data'
      });
    });
  });

  describe('POST /api/affiliate/generate-link', () => {
    test('should generate a new referral link', async () => {
      const mockReferralCode = 'NEW1234567890AB';
      AffiliateService.generateReferralLink = jest.fn().mockResolvedValue(mockReferralCode);

      const response = await request(app)
        .post('/api/affiliate/generate-link')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        referral_code: mockReferralCode,
        referral_link: expect.stringContaining(mockReferralCode)
      });
    });

    test('should handle errors gracefully', async () => {
      AffiliateService.generateReferralLink = jest.fn().mockRejectedValue(new Error('Generation failed'));

      const response = await request(app)
        .post('/api/affiliate/generate-link')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to generate referral link'
      });
    });
  });

  describe('PUT /api/affiliate/settings', () => {
    test('should update commission rates for admin', async () => {
      const updateData = { level_1_commission_rate: 50.00 };
      const mockResult = { success: true, level_1_rate: 50.00, level_2_rate: 25.00 };

      AffiliateService.updateAffiliateSettings = jest.fn().mockResolvedValue(mockResult);

      // Mock admin user check
      pool.query = jest.fn().mockResolvedValue({
        rows: [{ email: 'agro@demo.com' }]
      });

      const response = await request(app)
        .put('/api/affiliate/settings')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Commission rates updated successfully',
        data: mockResult
      });
    });

    test('should reject non-admin users', async () => {
      const updateData = { level_1_commission_rate: 50.00 };

      // Mock non-admin user
      pool.query = jest.fn().mockResolvedValue({
        rows: [{ email: 'regular@example.com' }]
      });

      const response = await request(app)
        .put('/api/affiliate/settings')
        .send(updateData)
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'Admin access required'
      });
    });
  });

  describe('GET /api/affiliate/settings', () => {
    test('should return affiliate settings for admin', async () => {
      const mockSettings = {
        id: 1,
        level_1_commission_rate: 40.00,
        level_2_commission_rate: 20.00,
        updated_at: '2024-01-01T00:00:00Z'
      };

      AffiliateService.getAffiliateSettings = jest.fn().mockResolvedValue(mockSettings);

      // Mock admin user check
      pool.query = jest.fn().mockResolvedValue({
        rows: [{ email: 'agro@demo.com' }]
      });

      const response = await request(app)
        .get('/api/affiliate/settings')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockSettings
      });
    });

    test('should reject non-admin users', async () => {
      // Mock non-admin user
      pool.query = jest.fn().mockResolvedValue({
        rows: [{ email: 'regular@example.com' }]
      });

      const response = await request(app)
        .get('/api/affiliate/settings')
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'Admin access required'
      });
    });
  });

  describe('POST /api/affiliate/signup/:referralCode', () => {
    test('should validate valid referral code', async () => {
      const referralCode = 'VALID1234567890AB';

      pool.query = jest.fn().mockResolvedValue({
        rows: [{ referrer_user_id: 1, level: 1 }]
      });

      const response = await request(app)
        .post(`/api/affiliate/signup/${referralCode}`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Referral code is valid',
        data: {
          referrer_user_id: 1,
          level: 1
        }
      });
    });

    test('should reject invalid referral code', async () => {
      const referralCode = 'INVALID1234567890';

      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post(`/api/affiliate/signup/${referralCode}`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid referral code'
      });
    });
  });

  describe('GET /api/affiliate/stats', () => {
    test('should return affiliate statistics for admin', async () => {
      const mockStats = {
        total_affiliates: 5,
        total_referred_users: 10,
        total_referrals: 15,
        total_commissions_paid: 500.00,
        level_1_referrals: 10,
        level_2_referrals: 5
      };

      const mockTopAffiliates = [
        { id: 1, name: 'Admin', email: 'agro@demo.com', total_referrals: 5, total_earned: 200.00 }
      ];

      // Mock admin user check
      pool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ email: 'agro@demo.com' }] })
        .mockResolvedValueOnce({ rows: [mockStats] })
        .mockResolvedValueOnce({ rows: mockTopAffiliates });

      const response = await request(app)
        .get('/api/affiliate/stats')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          overview: mockStats,
          top_affiliates: mockTopAffiliates
        }
      });
    });

    test('should reject non-admin users', async () => {
      // Mock non-admin user
      pool.query = jest.fn().mockResolvedValue({
        rows: [{ email: 'regular@example.com' }]
      });

      const response = await request(app)
        .get('/api/affiliate/stats')
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'Admin access required'
      });
    });
  });
});