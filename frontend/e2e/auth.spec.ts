import { test, expect } from '@playwright/test';
import { login, logout } from './helpers';

test.describe('Authentication Flow', () => {
  test('should display login page for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    
    // Should see Amplify authenticator component
    await expect(page.locator('[data-amplify-authenticator]')).toBeVisible({ timeout: 10000 });
    
    // Should see username/email input
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    
    // Should see password input
    await expect(page.locator('input[type="password"]')).toBeVisible();
    
    // Should see submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    // Note: This test requires valid test credentials
    // Set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables
    
    // Skip this test if no credentials are provided
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      test.skip();
    }
    
    await page.goto('/');
    
    // Use login helper
    await login(page);
    
    // Should be on dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Welcome to HallwayTrak')).toBeVisible({ timeout: 10000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');
    
    // Wait for authenticator to load
    await page.waitForSelector('[data-amplify-authenticator]', { timeout: 10000 });
    
    // Fill in with invalid credentials
    await page.fill('input[autocomplete="username"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Should show error message - Amplify may show various error messages
    // Look for common error patterns
    await expect(
      page.locator('text=/Incorrect|Invalid|User does not exist|not found/i')
    ).toBeVisible({ timeout: 10000 });
  });

  test('should allow user to sign out', async ({ page }) => {
    // Skip if no credentials provided
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      test.skip();
    }
    
    await page.goto('/');
    
    // Login first
    await login(page);
    
    // Wait for dashboard to be fully loaded
    await expect(page.locator('text=Welcome to HallwayTrak')).toBeVisible();
    
    // Click sign out button
    await logout(page);
    
    // Should return to login page
    await expect(page.locator('[data-amplify-authenticator]')).toBeVisible({ timeout: 10000 });
  });
});
