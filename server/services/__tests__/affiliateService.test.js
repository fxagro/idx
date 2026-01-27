// server/services/__tests__/affiliateService.test.js
const AffiliateService = require('../affiliateService');
const pool = require('../../db');

describe('AffiliateService', () => {
  beforeEach(() => {
    // Mock the database pool
    jest.clearAllMocks();
  });

  describe('generateUniqueCode', () => {
    test('should generate a unique 16-character hexadecimal code', () => {
      const code = AffiliateService.generateUniqueCode();

      expect(code).toMatch(/^[A-F0-9]{16}$/);
      expect(code.length).toBe(16);
    });

    test('should generate different codes on multiple calls', () => {
      const code1 = AffiliateService.generateUniqueCode();
      const code2 = AffiliateService.generateUniqueCode();

      expect(code1).not.toBe(code2);
    });
  });

  describe('generateReferralLink', () => {
    test('should generate and save a new referral link', async () => {
      const mockUserId = 1;
      const mockCode = 'A1B2C3D4E5F6789A';

      // Mock crypto.randomBytes
      jest.spyOn(require('crypto'), 'randomBytes').mockReturnValue({
        toString: () => mockCode
      });

      // Mock database queries
      const mockQuery = jest.fn();
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // No existing link
        .mockResolvedValueOnce({ rows: [] }) // Code is unique
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert successful

      pool.query = mockQuery;

      const result = await AffiliateService.generateReferralLink(mockUserId);

      expect(result).toBe(mockCode);
      expect(mockQuery).toHaveBeenCalledTimes(4);
    });

    test('should return existing referral link if user already has one', async () => {
      const mockUserId = 1;
      const existingCode = 'EXISTING12345678';

      const mockQuery = jest.fn();
      mockQuery.mockResolvedValueOnce({
        rows: [{ referral_link: existingCode }]
      });

      pool.query = mockQuery;

      const result = await AffiliateService.generateReferralLink(mockUserId);

      expect(result).toBe(existingCode);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDashboardData', () => {
    test('should return complete dashboard data', async () => {
      const mockUserId = 1;
      const mockQuery = jest.fn();

      // Mock all the database queries
      mockQuery
        .mockResolvedValueOnce({ rows: [{ referral_link: 'TEST1234567890AB' }] })
        .mockResolvedValueOnce({ rows: [{ level_1_referrals: 2, level_2_referrals: 1 }] })
        .mockResolvedValueOnce({ rows: [{ level_1_commissions: 80, level_2_commissions: 20 }] })
        .mockResolvedValueOnce({ rows: [
          {
            referred_user_id: 2,
            referred_email: 'user2@test.com',
            referred_name: 'User 2',
            level: 1,
            created_at: '2024-01-01T00:00:00Z',
            total_commission: 40
          }
        ]});

      pool.query = mockQuery;

      const result = await AffiliateService.getDashboardData(mockUserId);

      expect(result).toHaveProperty('referral_link');
      expect(result).toHaveProperty('total_referrals');
      expect(result).toHaveProperty('total_commissions');
      expect(result).toHaveProperty('history');
      expect(result.total_referrals.total).toBe(3);
      expect(result.total_commissions.total).toBe(100);
    });
  });

  describe('processCommission', () => {
    test('should process commission correctly for Level 1 and Level 2', async () => {
      const mockSaleId = 1;
      const mockReferredUserId = 2;
      const mockAmount = 100;

      const mockQuery = jest.fn();
      mockQuery
        .mockResolvedValueOnce({ rows: [{ referrer_user_id: 1, level: 1, id: 1 }] }) // Referral data
        .mockResolvedValueOnce({ rows: [{ level_1_commission_rate: 40 }] }) // Settings
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Insert Level 1 commission
        .mockResolvedValueOnce({ rows: [{ referrer_user_id: 3 }] }) // Level 2 referrer
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }); // Insert Level 2 commission

      pool.query = mockQuery;

      // Mock global.io for Socket.io
      global.io = { emit: jest.fn() };

      const result = await AffiliateService.processCommission(mockSaleId, mockReferredUserId, mockAmount);

      expect(result.success).toBe(true);
      expect(result.level_1_commission).toBe(40);
      expect(result.level_2_commission).toBe(20);
      expect(mockQuery).toHaveBeenCalledTimes(6);
    });

    test('should return error if no referral found', async () => {
      const mockSaleId = 1;
      const mockReferredUserId = 999;
      const mockAmount = 100;

      const mockQuery = jest.fn();
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No referral found

      pool.query = mockQuery;

      const result = await AffiliateService.processCommission(mockSaleId, mockReferredUserId, mockAmount);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No referral found for user');
    });
  });

  describe('getAffiliateSettings', () => {
    test('should return current affiliate settings', async () => {
      const mockSettings = {
        id: 1,
        level_1_commission_rate: 40.00,
        level_2_commission_rate: 20.00,
        updated_at: '2024-01-01T00:00:00Z',
        updated_by: 1
      };

      const mockQuery = jest.fn();
      mockQuery.mockResolvedValueOnce({ rows: [mockSettings] });

      pool.query = mockQuery;

      const result = await AffiliateService.getAffiliateSettings();

      expect(result).toEqual(mockSettings);
    });
  });

  describe('updateAffiliateSettings', () => {
    test('should update affiliate settings', async () => {
      const mockLevel1Rate = 50.00;
      const mockAdminUserId = 1;

      const mockQuery = jest.fn();
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert successful

      pool.query = mockQuery;

      const result = await AffiliateService.updateAffiliateSettings(mockLevel1Rate, mockAdminUserId);

      expect(result.success).toBe(true);
      expect(result.level_1_rate).toBe(50.00);
      expect(result.level_2_rate).toBe(25.00);
    });
  });

  describe('handleReferralSignup', () => {
    test('should handle referral signup correctly', async () => {
      const mockReferralCode = 'TEST1234567890AB';
      const mockNewUserId = 5;

      const mockQuery = jest.fn();
      mockQuery
        .mockResolvedValueOnce({ rows: [{ referrer_user_id: 1, level: 1 }] }) // Valid referral
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Insert successful

      pool.query = mockQuery;

      const result = await AffiliateService.handleReferralSignup(mockReferralCode, mockNewUserId);

      expect(result.success).toBe(true);
      expect(result.referrer_user_id).toBe(1);
      expect(result.level).toBe(2); // Should be Level 2 since referrer is Level 1
    });

    test('should throw error for invalid referral code', async () => {
      const mockReferralCode = 'INVALIDCODE';
      const mockNewUserId = 5;

      const mockQuery = jest.fn();
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Invalid referral

      pool.query = mockQuery;

      await expect(
        AffiliateService.handleReferralSignup(mockReferralCode, mockNewUserId)
      ).rejects.toThrow('Invalid referral code');
    });

    test('should throw error if user tries to refer themselves', async () => {
      const mockReferralCode = 'TEST1234567890AB';
      const mockNewUserId = 1; // Same as referrer

      const mockQuery = jest.fn();
      mockQuery.mockResolvedValueOnce({ rows: [{ referrer_user_id: 1, level: 1 }] });

      pool.query = mockQuery;

      await expect(
        AffiliateService.handleReferralSignup(mockReferralCode, mockNewUserId)
      ).rejects.toThrow('Cannot refer yourself');
    });
  });
});