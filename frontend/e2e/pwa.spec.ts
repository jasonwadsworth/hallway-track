import { test, expect } from '@playwright/test';
import { mockPWAConditions } from './helpers';

test.describe('PWA Functionality', () => {
  test('should display PWA install prompt on mobile', async ({ page, context }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Mock PWA conditions before navigation
    await mockPWAConditions(page, 'ios');
    
    await page.goto('/');
    
    // Wait for React app to mount - wait for either authenticator or main app content
    await Promise.race([
      page.waitForSelector('[data-amplify-authenticator]', { timeout: 15000 }).catch(() => null),
      page.waitForSelector('text=Welcome to HallwayTrak', { timeout: 15000 }).catch(() => null)
    ]);
    
    // Debug: Check environment state
    const debugInfo = await page.evaluate(() => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      return {
        userAgent: navigator.userAgent,
        isIOS,
        isStandalone,
        dismissed,
        hasRoot: !!document.getElementById('root')
      };
    });
    console.log('PWA Debug Info:', debugInfo);
    
    // Wait for install prompt timer (3 second delay) plus additional buffer for render
    await page.waitForTimeout(4000);
    
    // Should show install prompt
    await expect(page.locator('.pwa-install-prompt')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Install HallwayTrak')).toBeVisible();
  });

  test('should show iOS-specific instructions on iOS', async ({ page }) => {
    // Mock iOS user agent
    await page.setViewportSize({ width: 375, height: 667 });
    await mockPWAConditions(page, 'ios');
    
    await page.goto('/');
    
    // Wait for page to be ready
    await Promise.race([
      page.waitForSelector('[data-amplify-authenticator]', { timeout: 15000 }).catch(() => null),
      page.waitForSelector('text=Welcome to HallwayTrak', { timeout: 15000 }).catch(() => null)
    ]);
    
    await page.waitForTimeout(4000);
    
    // Should show iOS share icon and instructions
    await expect(page.locator('.ios-share')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Add to Home Screen')).toBeVisible();
  });

  test('should allow dismissing install prompt', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockPWAConditions(page, 'ios');
    
    await page.goto('/');
    
    // Wait for page to be ready
    await Promise.race([
      page.waitForSelector('[data-amplify-authenticator]', { timeout: 15000 }).catch(() => null),
      page.waitForSelector('text=Welcome to HallwayTrak', { timeout: 15000 }).catch(() => null)
    ]);
    
    await page.waitForTimeout(4000);
    
    // Wait for prompt to appear before trying to dismiss
    await expect(page.locator('.pwa-install-prompt')).toBeVisible({ timeout: 5000 });
    
    // Click dismiss button
    await page.click('.pwa-dismiss');
    
    // Prompt should disappear
    await expect(page.locator('.pwa-install-prompt')).not.toBeVisible();
  });

  test('should remember dismissed state', async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await mockPWAConditions(page, 'ios');
    
    await page.goto('/');
    
    // Wait for page to be ready
    await Promise.race([
      page.waitForSelector('[data-amplify-authenticator]', { timeout: 15000 }).catch(() => null),
      page.waitForSelector('text=Welcome to HallwayTrak', { timeout: 15000 }).catch(() => null)
    ]);
    
    await page.waitForTimeout(4000);
    
    // Verify prompt is visible before dismissing
    await expect(page.locator('.pwa-install-prompt')).toBeVisible({ timeout: 5000 });
    
    await page.click('.pwa-dismiss');
    
    // Wait for prompt to be hidden after dismissing
    await expect(page.locator('.pwa-install-prompt')).not.toBeVisible();
    
    // Verify localStorage was set before reloading
    const dismissedValue = await page.evaluate(() => localStorage.getItem('pwa-install-dismissed'));
    expect(dismissedValue).toBe('true');
    
    // Reload page - keep mocked conditions but DON'T clear dismissed state
    await mockPWAConditions(page, 'ios', false);
    await page.reload();
    
    // Wait for page to be ready after reload
    await Promise.race([
      page.waitForSelector('[data-amplify-authenticator]', { timeout: 15000 }).catch(() => null),
      page.waitForSelector('text=Welcome to HallwayTrak', { timeout: 15000 }).catch(() => null)
    ]);
    
    await page.waitForTimeout(4000);
    
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
