import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display login page for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    
    // Should see Amplify authenticator
    await expect(page.locator('text=Sign in')).toBeVisible();
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    // Note: This test requires test credentials
    // In CI/CD, use environment variables for test user credentials
    
    await page.goto('/');
    
    // Fill in login form
    await page.fill('input[name="username"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'TestPassword123!');
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Welcome to HallwayTrak')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[name="username"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'WrongPassword123!');
    
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=Incorrect username or password')).toBeVisible();
  });

  test('should allow user to sign out', async ({ page }) => {
    // Assumes user is already logged in
    await page.goto('/');
    
    // Click sign out button
    await page.click('button:has-text("Sign Out")');
    
    // Should return to login page
    await expect(page.locator('text=Sign in')).toBeVisible();
  });
});
