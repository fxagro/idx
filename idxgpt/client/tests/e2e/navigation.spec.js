const { test, expect } = require('@playwright/test');

test('should display affiliate menu and panel for user', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"]', 'testuser1@demo.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('[data-testid="affiliate-menu"]')).toBeVisible();
  await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
  await page.click('[data-testid="affiliate-menu"]');
  await expect(page).toHaveURL(/\/affiliate/);
  await expect(page.locator('[data-testid="referral-link"]')).toBeVisible();
});

test('should display admin menus and user management for admin', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.fill('input[name="email"]', 'agro@demo.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('[data-testid="admin-menu"]')).toBeVisible();
  await expect(page.locator('[data-testid="user-management-menu"]')).toBeVisible();
  await expect(page.locator('[data-testid="affiliate-settings-menu"]')).toBeVisible();
  await page.click('[data-testid="user-management-menu"]');
  await expect(page).toHaveURL(/\/admin\/users/);
  await expect(page.locator('[data-testid="user-management-table"]')).toBeVisible();
});