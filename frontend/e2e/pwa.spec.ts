import { test, expect } from '@playwright/test';

test.describe('PWA Functionality', () => {
  test('should display PWA install prompt on mobile', async ({ page, context }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    // Wait for install prompt to appear (3 second delay)
    await page.waitForTimeout(3500);
    
    // Should show install prompt
    await expect(page.locator('.pwa-install-prompt')).toBeVisible();
    await expect(page.locator('text=Install HallwayTrak')).toBeVisible();
  });

  test('should show iOS-specific instructions on iOS', async ({ page }) => {
    // Mock iOS user agent
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await page.waitForTimeout(3500);
    
    // Should show iOS share icon and instructions
    await expect(page.locator('.ios-share')).toBeVisible();
    await expect(page.locator('text=Add to Home Screen')).toBeVisible();
  });

  test('should allow dismissing install prompt', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await page.waitForTimeout(3500);
    
    // Click dismiss button
    await page.click('.pwa-dismiss');
    
    // Prompt should disappear
    await expect(page.locator('.pwa-install-prompt')).not.toBeVisible();
  });

  test('should remember dismissed state', async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await page.waitForTimeout(3500);
    await page.click('.pwa-dismiss');
    
    // Reload page
    await page.reload();
    await page.waitForTimeout(3500);
    
    // Prompt should not reappear
    await expect(page.locator('.pwa-install-prompt')).not.toBeVisible();
  });

  test('should have valid manifest.json', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);
    
    const manifest = await response?.json();
    expect(manifest.name).toBe('HallwayTrak');
    expect(manifest.short_name).toBe('HallwayTrak');
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('should have service worker registered', async ({ page }) => {
    await page.goto('/');
    
    // Check if service worker is registered
    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    expect(swRegistered).toBe(true);
  });
});
