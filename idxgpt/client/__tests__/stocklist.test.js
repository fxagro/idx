// E2E Tests for Stocklist Page (Verification)
import { test, expect } from '@playwright/test';

test.describe('Stocklist Page Verification Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.goto('/stocks');
  });

  test('should display stocklist with all features intact', async ({ page }) => {
    // Check header
    await expect(page.locator('h1')).toContainText('Stock List');
    await expect(page.locator('p')).toContainText('Interactive stock table');

    // Check market overview widget
    await expect(page.locator('text=Market Overview')).toBeVisible();

    // Check search and filters
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();

    // Check stock table
    await expect(page.locator('table')).toBeVisible();

    // Check table headers
    await expect(page.locator('text=Symbol')).toBeVisible();
    await expect(page.locator('text=Company')).toBeVisible();
    await expect(page.locator('text=Price')).toBeVisible();
    await expect(page.locator('text=Change %')).toBeVisible();
    await expect(page.locator('text=Volume')).toBeVisible();
    await expect(page.locator('text=Market Cap')).toBeVisible();
    await expect(page.locator('text=Actions')).toBeVisible();
  });

  test('should handle search functionality', async ({ page }) => {
    // Type in search box
    await page.fill('input[placeholder*="Search"]', 'BBCA');

    // Should filter results (may be no results, but shouldn't crash)
    await expect(page.locator('table')).toBeVisible();
  });

  test('should handle sorting functionality', async ({ page }) => {
    // Click on symbol header to sort
    await page.click('text=Symbol');

    // Table should still be visible and functional
    await expect(page.locator('table')).toBeVisible();
  });

  test('should open stock details modal', async ({ page }) => {
    // Click on first stock details button (📊 icon)
    const detailsButtons = page.locator('text=📊');
    if (await detailsButtons.count() > 0) {
      await detailsButtons.first().click();

      // Modal should appear
      await expect(page.locator('text=Stock Information')).toBeVisible();
    }
  });

  test('should display market indices in overview', async ({ page }) => {
    // Check that market overview shows indices
    await expect(page.locator('text=Market Overview')).toBeVisible();

    // Should show some market data (even if empty, shouldn't crash)
    await expect(page.locator('text=Market Overview').locator('..')).toBeVisible();
  });

  test('should handle empty search results', async ({ page }) => {
    // Search for non-existent stock
    await page.fill('input[placeholder*="Search"]', 'NONEXISTENTSTOCK');

    // Should show "No stocks found" message
    await expect(page.locator('text=No stocks found matching your criteria')).toBeVisible();
  });

  test('should maintain table layout and responsiveness', async ({ page }) => {
    // Check that table is properly structured
    await expect(page.locator('thead')).toBeVisible();
    await expect(page.locator('tbody')).toBeVisible();

    // Check that table is responsive (has overflow handling)
    await expect(page.locator('table')).toHaveClass(/min-w-full/);
  });

  test('should handle modal interactions', async ({ page }) => {
    // Try to open modal if stocks exist
    const detailsButtons = page.locator('text=📊');
    if (await detailsButtons.count() > 0) {
      await detailsButtons.first().click();

      // Check modal content
      await expect(page.locator('text=Stock Information')).toBeVisible();

      // Close modal
      await page.click('text=✕');
      await expect(page.locator('text=Stock Information')).not.toBeVisible();
    }
  });

  test('should display educational tooltips', async ({ page }) => {
    // Try to open modal first
    const detailsButtons = page.locator('text=📊');
    if (await detailsButtons.count() > 0) {
      await detailsButtons.first().click();

      // Check for educational tips in modal
      await expect(page.locator('text=Educational Tips')).toBeVisible();
    }
  });

  test('should handle watchlist functionality in modal', async ({ page }) => {
    // Try to open modal if stocks exist
    const detailsButtons = page.locator('text=📊');
    if (await detailsButtons.count() > 0) {
      await detailsButtons.first().click();

      // Check for watchlist buttons
      await expect(page.locator('text=Add to Watchlist')).toBeVisible();
    }
  });

  test('should handle AI analysis button in modal', async ({ page }) => {
    // Try to open modal if stocks exist
    const detailsButtons = page.locator('text=📊');
    if (await detailsButtons.count() > 0) {
      await detailsButtons.first().click();

      // Check for AI analysis button
      await expect(page.locator('text=AI Analysis')).toBeVisible();
    }
  });
});