// E2E Tests for Enhanced Dashboard
import { test, expect } from '@playwright/test';

test.describe('Enhanced Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display enhanced dashboard with all sections', async ({ page }) => {
    // Check header
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('p')).toContainText('Personalized overview');

    // Check profile and subscription status cards
    await expect(page.locator('text=Profile')).toBeVisible();
    await expect(page.locator('text=Subscription Status')).toBeVisible();

    // Check portfolio sections
    await expect(page.locator('text=Portfolio Snapshot')).toBeVisible();
    await expect(page.locator('text=Portfolio Performance')).toBeVisible();

    // Check market overview sections
    await expect(page.locator('text=Market Overview')).toBeVisible();
    await expect(page.locator('text=Top Brokers')).toBeVisible();

    // Check watchlist and top gainers/losers
    await expect(page.locator('text=Watchlist')).toBeVisible();

    // Check AI recommendations
    await expect(page.locator('text=AI Recommendations')).toBeVisible();

    // Check transaction history
    await expect(page.locator('text=Stock Transaction History')).toBeVisible();

    // Check educational tips
    await expect(page.locator('text=Educational Tips')).toBeVisible();
  });

  test('should display market overview with indices and brokers', async ({ page }) => {
    // Check market overview section
    await expect(page.locator('text=Major Indices')).toBeVisible();

    // Should show IHSG chart
    await expect(page.locator('text=IHSG Performance')).toBeVisible();

    // Should show top brokers section
    await expect(page.locator('text=Top Brokers')).toBeVisible();
  });

  test('should display transaction history table', async ({ page }) => {
    // Check transaction history section
    await expect(page.locator('text=Stock Transaction History')).toBeVisible();

    // Check table headers
    await expect(page.locator('text=Date')).toBeVisible();
    await expect(page.locator('text=Symbol')).toBeVisible();
    await expect(page.locator('text=Type')).toBeVisible();
    await expect(page.locator('text=Quantity')).toBeVisible();
    await expect(page.locator('text=Price')).toBeVisible();
    await expect(page.locator('text=Total')).toBeVisible();
  });

  test('should display enhanced AI recommendations', async ({ page }) => {
    // Check AI recommendations section
    await expect(page.locator('text=AI Recommendations')).toBeVisible();

    // Check for real-time analysis section
    await expect(page.locator('text=Real-time Market Analysis')).toBeVisible();

    // Check for stock recommendations
    await expect(page.locator('text=Stock Recommendations')).toBeVisible();

    // Check for quota display
    await expect(page.locator('text=Quota')).toBeVisible();
    await expect(page.locator('text=remaining')).toBeVisible();
  });

  test('should display portfolio performance chart', async ({ page }) => {
    // Check portfolio performance section
    await expect(page.locator('text=Portfolio Performance')).toBeVisible();

    // Check period buttons
    await expect(page.locator('text=1W')).toBeVisible();
    await expect(page.locator('text=1M')).toBeVisible();
  });

  test('should display educational tips carousel', async ({ page }) => {
    // Check educational tips section
    await expect(page.locator('text=Educational Tips')).toBeVisible();

    // Check for tip content
    await expect(page.locator('text=Diversifikasi Portofolio')).toBeVisible();
  });

  test('should handle profile editing', async ({ page }) => {
    // Click edit profile button
    await page.click('text=Edit Profile');

    // Check modal appears
    await expect(page.locator('text=Edit Profile')).toBeVisible();

    // Fill form
    await page.fill('input[type="email"]', 'newemail@example.com');
    await page.fill('input[type="text"]', 'newusername');

    // Cancel for now (don't actually submit)
    await page.click('text=Cancel');
  });

  test('should handle password change', async ({ page }) => {
    // Click change password button
    await page.click('text=Change Password');

    // Check modal appears
    await expect(page.locator('text=Change Password')).toBeVisible();

    // Cancel for now
    await page.click('text=Cancel');
  });

  test('should display two-column layout correctly', async ({ page }) => {
    // Check that sections are arranged in two-column layout
    const profileSection = page.locator('text=Profile').locator('..');
    const subscriptionSection = page.locator('text=Subscription Status').locator('..');

    // Both should be in the same row (two-column layout)
    const profileBox = await profileSection.boundingBox();
    const subscriptionBox = await subscriptionSection.boundingBox();

    if (profileBox && subscriptionBox) {
      // They should be approximately at the same vertical level (two-column layout)
      expect(Math.abs(profileBox.y - subscriptionBox.y)).toBeLessThan(50);
    }
  });

  test('should handle empty states gracefully', async ({ page }) => {
    // Check that empty states show appropriate messages
    await expect(page.locator('text=No portfolio data available')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Your watchlist is empty')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=No transactions yet')).toBeVisible({ timeout: 5000 });
  });

  test('should display enhanced market overview with IHSG chart', async ({ page }) => {
    // Check market overview section
    await expect(page.locator('text=Market Overview')).toBeVisible();

    // Check for IHSG chart section
    await expect(page.locator('text=IHSG Performance')).toBeVisible();

    // Check for major indices section
    await expect(page.locator('text=Major Indices')).toBeVisible();

    // Check for top brokers section
    await expect(page.locator('text=Top Brokers')).toBeVisible();

    // Verify chart loading state
    await expect(page.locator('text=Last updated')).toBeVisible();
  });

  test('should display subscription ordering with payment instructions', async ({ page }) => {
    // Check subscription status section
    await expect(page.locator('text=Subscription Status')).toBeVisible();

    // Check for subscription ordering section
    await expect(page.locator('text=Pemesanan Kuota')).toBeVisible();

    // Check for plan options
    await expect(page.locator('text=Basic')).toBeVisible();
    await expect(page.locator('text=Premium')).toBeVisible();
    await expect(page.locator('text=Pro')).toBeVisible();

    // Check for order buttons
    await expect(page.locator('text=Pesan')).toBeVisible({ timeout: 5000 });
  });

  test('should handle subscription order creation and modal', async ({ page }) => {
    // Click on a subscription plan order button
    await page.click('text=Pesan');

    // Check if modal appears (it should show payment instructions)
    await expect(page.locator('text=Order Successful')).toBeVisible({ timeout: 5000 });

    // Check for payment instructions in modal
    await expect(page.locator('text=Payment Instructions')).toBeVisible();
    await expect(page.locator('text=BCA')).toBeVisible();
    await expect(page.locator('text=00132000048716')).toBeVisible();
    await expect(page.locator('text=Agus Rochman')).toBeVisible();

    // Check for upload proof button
    await expect(page.locator('text=Upload Payment Proof')).toBeVisible();

    // Close modal
    await page.click('text=Close');
  });

  test('should display enhanced two-column layout correctly', async ({ page }) => {
    // Check that the main layout uses two-column grid
    const dashboardContainer = page.locator('.grid.grid-cols-1.lg\\:grid-cols-2');
    await expect(dashboardContainer).toBeVisible();

    // Check left column sections
    await expect(page.locator('text=Profile')).toBeVisible();
    await expect(page.locator('text=Subscription Status')).toBeVisible();
    await expect(page.locator('text=Portfolio Snapshot')).toBeVisible();

    // Check right column sections
    await expect(page.locator('text=Portfolio Performance')).toBeVisible();
    await expect(page.locator('text=Stock Transaction History')).toBeVisible();
    await expect(page.locator('text=Watchlist')).toBeVisible();

    // Verify responsive behavior (single column on mobile)
    const isMobile = await page.evaluate(() => window.innerWidth < 1024);
    if (isMobile) {
      // Should be single column on mobile
      await expect(page.locator('.grid-cols-1')).toBeVisible();
    }
  });

  test('should handle market overview data loading states', async ({ page }) => {
    // Check for loading spinner in market overview
    const loadingSpinner = page.locator('.animate-spin').first();
    await expect(loadingSpinner.or(page.locator('text=No market data available'))).toBeVisible();

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Should show either data or empty state message
    await expect(
      page.locator('text=No market data available').or(page.locator('text=No broker data available'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should handle subscription plans loading states', async ({ page }) => {
    // Check subscription section
    await expect(page.locator('text=Subscription Status')).toBeVisible();

    // Should show either plans or loading state
    await expect(
      page.locator('text=No plans available').or(page.locator('text=Pesan'))
    ).toBeVisible({ timeout: 5000 });
  });

  test('should display educational tips carousel correctly', async ({ page }) => {
    // Check educational tips section
    await expect(page.locator('text=Educational Tips')).toBeVisible();

    // Check for tip content
    await expect(page.locator('text=Diversifikasi Portofolio')).toBeVisible();

    // Check for carousel indicators (dots)
    const indicators = page.locator('button').filter({ hasText: '' }).locator('..');
    await expect(indicators).toBeVisible();
  });

  test('should handle real-time price updates via WebSocket', async ({ page }) => {
    // Check that WebSocket connection is established
    // This would be verified by checking console logs or connection status
    // For now, we verify that real-time price display elements are present
    await expect(page.locator('text=Watchlist')).toBeVisible();

    // Check if watchlist shows price information
    const priceElements = page.locator('text=Rp').or(page.locator('text=No transactions yet'));
    await expect(priceElements.first()).toBeVisible({ timeout: 5000 });
  });

  test('should handle WebSocket disconnection gracefully', async ({ page }) => {
    // Navigate to dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // Simulate WebSocket disconnection
    await page.evaluate(() => {
      // Access the socket instance and disconnect it
      if (window.socket) {
        window.socket.disconnect();
      }
    });

    // Dashboard should still function despite WebSocket disconnection
    await expect(page.locator('text=Market Overview')).toBeVisible();
    await expect(page.locator('text=Watchlist')).toBeVisible();

    // Should fallback to polling for real-time data
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Last updated')).toBeVisible();
  });

  test('should handle empty market overview data', async ({ page }) => {
    // Intercept API call to return empty data
    await page.route('/api/stocks/market-overview', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            indices: [],
            brokers: [],
            ihsgChart: []
          },
          timestamp: new Date().toISOString()
        })
      });
    });

    // Reload page to get empty data
    await page.reload();

    // Should display empty state messages
    await expect(page.locator('text=No market data available')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=No broker data available')).toBeVisible({ timeout: 10000 });
  });

  test('should handle zero AI quota state', async ({ page }) => {
    // Intercept dashboard API to return zero quota
    await page.route('/dashboard/summary', async route => {
      const response = await route.fetch();
      const data = await response.json();

      // Modify the response to have zero quota
      data.data.ai_quota = { remaining: 0, used: 10 };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data)
      });
    });

    await page.reload();

    // Should show quota exceeded message
    await expect(page.locator('text=AI quota has been used up')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Upgrade Plan')).toBeVisible({ timeout: 10000 });
  });

  test('should handle error states for failed API calls', async ({ page }) => {
    // Intercept dashboard API to return error
    await page.route('/dashboard/summary', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          message: 'Failed to load dashboard data'
        })
      });
    });

    await page.reload();

    // Should display error state with refresh option
    await expect(page.locator('text=Failed to Load Dashboard')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Refresh')).toBeVisible({ timeout: 10000 });
  });

  test('should handle subscription order with invalid plan', async ({ page }) => {
    // Intercept subscription order API to return error
    await page.route('/plans/order', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Invalid plan selected',
          message: 'Please select a valid plan'
        })
      });
    });

    // Try to create subscription order
    await page.click('text=Pesan');

    // Should handle error gracefully (toast notification or error message)
    await page.waitForTimeout(2000);

    // Dashboard should remain functional
    await expect(page.locator('text=Subscription Status')).toBeVisible();
  });

  test('should handle network timeout in market overview', async ({ page }) => {
    // Intercept market overview API to simulate timeout
    await page.route('/api/stocks/market-overview', async route => {
      // Delay response to simulate timeout
      await new Promise(resolve => setTimeout(resolve, 10000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            indices: [],
            brokers: [],
            ihsgChart: []
          }
        })
      });
    });

    await page.reload();

    // Should show loading state initially
    await expect(page.locator('.animate-spin').or(page.locator('text=No market data available'))).toBeVisible({ timeout: 15000 });
  });

  test('should maintain all existing dashboard features', async ({ page }) => {
    // Verify all original sections are still present
    await expect(page.locator('text=Profile')).toBeVisible();
    await expect(page.locator('text=Subscription Status')).toBeVisible();
    await expect(page.locator('text=Portfolio Snapshot')).toBeVisible();
    await expect(page.locator('text=Portfolio Performance')).toBeVisible();
    await expect(page.locator('text=Stock Transaction History')).toBeVisible();
    await expect(page.locator('text=Watchlist')).toBeVisible();
    await expect(page.locator('text=Market Overview')).toBeVisible();
    await expect(page.locator('text=Top Gainers')).toBeVisible();
    await expect(page.locator('text=AI Recommendations')).toBeVisible();
    await expect(page.locator('text=Educational Tips')).toBeVisible();

    // Verify navigation elements
    await expect(page.locator('text=Edit Profile')).toBeVisible();
    await expect(page.locator('text=Change Password')).toBeVisible();
    await expect(page.locator('text=View Portfolio')).toBeVisible();
    await expect(page.locator('text=Start Virtual Trading')).toBeVisible();
  });
});