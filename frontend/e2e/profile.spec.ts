import { test, expect } from '@playwright/test';

test.describe('Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    // Add login steps here
  });

  test('should display user profile', async ({ page }) => {
    await page.goto('/profile');
    
    await expect(page.locator('h1:has-text("My Profile")')).toBeVisible();
    await expect(page.locator('.profile-avatar')).toBeVisible();
  });

  test('should allow editing profile', async ({ page }) => {
    await page.goto('/profile');
    
    // Click edit button
    await page.click('button:has-text("Edit Profile")');
    
    // Modal should open
    await expect(page.locator('text=Edit Profile')).toBeVisible();
    
    // Update display name
    await page.fill('input[name="displayName"]', 'Updated Name');
    
    // Save changes
    await page.click('button:has-text("Save")');
    
    // Should show success and updated name
    await expect(page.locator('text=Updated Name')).toBeVisible();
  });

  test('should display QR code', async ({ page }) => {
    await page.goto('/qr-code');
    
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('text=Scan this code')).toBeVisible();
  });

  test('should allow managing contact links', async ({ page }) => {
    await page.goto('/profile');
    
    // Click manage links button
    await page.click('button:has-text("Manage Contact Links")');
    
    // Modal should open
    await expect(page.locator('text=Manage Contact Links')).toBeVisible();
    
    // Add new link
    await page.selectOption('select[name="linkType"]', 'LinkedIn');
    await page.fill('input[name="url"]', 'https://linkedin.com/in/testuser');
    await page.click('button:has-text("Add Link")');
    
    // Should show in list
    await expect(page.locator('text=LinkedIn')).toBeVisible();
  });

  test('should display badges', async ({ page }) => {
    await page.goto('/badges');
    
    await expect(page.locator('h1:has-text("Badge Showcase")')).toBeVisible();
    await expect(page.locator('.badge-card')).toBeVisible();
  });
});
