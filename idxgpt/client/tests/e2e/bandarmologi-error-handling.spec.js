import { test, expect } from '@playwright/test';

test.describe('Bandarmologi Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Bandarmologi page
    await page.goto('/bandarmologi');
    await page.waitForLoadState('networkidle');
  });

  test('should display invalid broker code error (400)', async ({ page }) => {
    // Mock API to return 400 error for invalid broker
    await page.route('**/api/stocks/brokers/holdings?broker=XX&days=30', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid broker code',
          message: 'Broker table not found in database'
        })
      });
    });

    // Select invalid broker code
    await page.fill('[data-testid="broker-select"]', 'XX');
    await page.click('[data-testid="show-holdings-button"]');

    // Wait for error message to appear
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid broker code');
  });

  test('should display no data available error (404)', async ({ page }) => {
    // Mock API to return 404 error for empty data
    await page.route('**/api/stocks/brokers/holdings?broker=AK&days=30', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'No data available',
          message: 'No holdings data found for this broker'
        })
      });
    });

    // Select valid broker code
    await page.fill('[data-testid="broker-select"]', 'AK');
    await page.click('[data-testid="show-holdings-button"]');

    // Wait for error message to appear
    await expect(page.locator('[data-testid="error-message"]')).toContainText('No data available');
  });

  test('should display server error message (500)', async ({ page }) => {
    // Mock API to return 500 error
    await page.route('**/api/stocks/bandar?symbol=BBCA&days=30', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          message: 'Database connection failed'
        })
      });
    });

    // Try to fetch bandarmologi data
    await page.fill('[data-testid="stock-input"]', 'BBCA');
    await page.click('[data-testid="analyze-button"]');

    // Wait for error message to appear
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Server error');
  });

  test('should display network error message', async ({ page }) => {
    // Mock network error by blocking the request
    await page.route('**/api/stocks/bandar?symbol=BBCA&days=30', async route => {
      await route.abort();
    });

    // Try to fetch bandarmologi data
    await page.fill('[data-testid="stock-input"]', 'BBCA');
    await page.click('[data-testid="analyze-button"]');

    // Wait for error message to appear
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Network error');
  });

  test('should retry on network timeout', async ({ page }) => {
    let requestCount = 0;

    // Mock API to fail twice then succeed
    await page.route('**/api/stocks/bandar?symbol=BBCA&days=30', async route => {
      requestCount++;
      if (requestCount <= 2) {
        // Simulate timeout on first two attempts
        await new Promise(resolve => setTimeout(resolve, 11000)); // Longer than timeout
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            brokers: [
              { kode_broker: 'AK', nama_broker: 'Test Broker', net_vol: 1000 }
            ]
          })
        });
      } else {
        // Succeed on third attempt
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            brokers: [
              { kode_broker: 'AK', nama_broker: 'Test Broker', net_vol: 1000 }
            ]
          })
        });
      }
    });

    // Try to fetch bandarmologi data
    await page.fill('[data-testid="stock-input"]', 'BBCA');
    await page.click('[data-testid="analyze-button"]');

    // Should eventually succeed after retries
    await expect(page.locator('[data-testid="broker-table"]')).toBeVisible();
    expect(requestCount).toBeGreaterThan(1); // Should have retried
  });

  test('should handle multiple error types in sequence', async ({ page }) => {
    // Test 400 error
    await page.route('**/api/stocks/brokers/holdings?broker=XX&days=30', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid broker code',
          message: 'Broker table not found in database'
        })
      });
    });

    await page.fill('[data-testid="broker-select"]', 'XX');
    await page.click('[data-testid="show-holdings-button"]');
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid broker code');

    // Clear error and test 404 error
    await page.click('[data-testid="clear-error-button"]');

    await page.route('**/api/stocks/brokers/holdings?broker=AK&days=30', async route => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'No data available',
          message: 'No holdings data found for this broker'
        })
      });
    });

    await page.fill('[data-testid="broker-select"]', 'AK');
    await page.click('[data-testid="show-holdings-button"]');
    await expect(page.locator('[data-testid="error-message"]')).toContainText('No data available');

    // Clear error and test 500 error
    await page.click('[data-testid="clear-error-button"]');

    await page.route('**/api/stocks/bandar?symbol=BBCA&days=30', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          message: 'Database connection failed'
        })
      });
    });

    await page.fill('[data-testid="stock-input"]', 'BBCA');
    await page.click('[data-testid="analyze-button"]');
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Server error');
  });

  test('should handle error recovery', async ({ page }) => {
    // First make API fail
    await page.route('**/api/stocks/brokers/holdings?broker=AK&days=30', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error',
          message: 'Database connection failed'
        })
      });
    });

    await page.fill('[data-testid="broker-select"]', 'AK');
    await page.click('[data-testid="show-holdings-button"]');
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Server error');

    // Then make API succeed
    await page.route('**/api/stocks/brokers/holdings?broker=AK&days=30', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          holdings: [
            { saham: 'BBCA', net_vol: 1000, net_val: 50000000 }
          ]
        })
      });
    });

    // Clear error and retry
    await page.click('[data-testid="clear-error-button"]');
    await page.click('[data-testid="show-holdings-button"]');

    // Should now succeed
    await expect(page.locator('[data-testid="holdings-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });
});