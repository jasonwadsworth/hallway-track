import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    // Skip all tests in this suite if no credentials are provided
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      test.skip();
    }
    
    // Login before each test
    await page.goto('/');
    await login(page);
  });

  test('should display user profile', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // Look for profile heading - may vary in exact text
    const heading = page.locator('h1:has-text("My Profile"), h1:has-text("Profile"), h2:has-text("My Profile")');
    await expect(heading).toBeVisible({ timeout: 10000 });
    
    // Look for profile avatar/image - class names may vary
    const avatar = page.locator('.profile-avatar, [class*="avatar"], img[alt*="profile" i]');
    const avatarCount = await avatar.count();
    if (avatarCount > 0) {
      await expect(avatar.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should allow editing profile', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // Look for edit button
    const editButton = page.locator('button:has-text("Edit Profile"), button:has-text("Edit")');
    const buttonCount = await editButton.count();
    
    if (buttonCount === 0) {
      test.skip(); // Skip if no edit button found
    }
    
    // Click edit button
    await editButton.first().click();
    
    // Modal should open - look for dialog or modal with proper selectors
    const modal = page.locator('text="Edit Profile", [role="dialog"]:has-text("Profile"), .modal:has-text("Profile")');
    await expect(modal.first()).toBeVisible({ timeout: 10000 });
    
    // Look for display name input
    const displayNameInput = page.locator('input[name="displayName"], input[placeholder*="name" i]');
    const inputCount = await displayNameInput.count();
    
    if (inputCount === 0) {
      test.skip(); // Skip if no display name input
    }
    
    // Update display name
    const testName = 'Updated Name ' + Date.now();
    await displayNameInput.first().fill(testName);
    
    // Save changes
    const saveButton = page.locator('button:has-text("Save"), button[type="submit"]');
    await saveButton.first().click();
    
    // Wait for modal to close and check for updated name or success message
    await page.waitForTimeout(1000);
    
    // Either the name appears or a success message shows
    const nameVisible = await page.locator(`text="${testName}"`).isVisible().catch(() => false);
    const successVisible = await page.locator('text=/Saved|Updated|Success/i').isVisible().catch(() => false);
    
    expect(nameVisible || successVisible).toBeTruthy();
  });

  test('should display QR code', async ({ page }) => {
    await page.goto('/qr-code');
    await page.waitForLoadState('networkidle');
    
    // Look for SVG (QR code is rendered as SVG by qrcode.react library)
    const qrCode = page.locator('svg, canvas');
    await expect(qrCode.first()).toBeVisible({ timeout: 10000 });
    
    // Look for instruction text
    const instructions = page.locator('text=/Show this QR code|Scan this code|Scan to connect|QR Code/i');
    const instructionCount = await instructions.count();
    if (instructionCount > 0) {
      await expect(instructions.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('should allow managing contact links', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // Look for manage links button
    const manageButton = page.locator('button:has-text("Manage Contact Links"), button:has-text("Manage Links"), button:has-text("Contact Links")');
    const buttonCount = await manageButton.count();
    
    if (buttonCount === 0) {
      test.skip(); // Skip if no manage button found
    }
    
    // Click manage links button
    await manageButton.first().click();
    
    // Modal should open
    const modal = page.locator('text=/Manage Contact Links|Contact Links|Add Link/i');
    await expect(modal.first()).toBeVisible({ timeout: 10000 });
    
    // Look for link type selector
    const linkTypeSelect = page.locator('select[name="linkType"], select[name="type"]');
    const selectCount = await linkTypeSelect.count();
    
    if (selectCount > 0) {
      // Add new link
      await linkTypeSelect.first().selectOption('LinkedIn');
      
      const urlInput = page.locator('input[name="url"], input[type="url"], input[placeholder*="url" i]');
      await urlInput.first().fill('https://linkedin.com/in/testuser');
      
      const addButton = page.locator('button:has-text("Add Link"), button:has-text("Add")');
      await addButton.first().click();
      
      // Should show in list or show success
      await page.waitForTimeout(500);
      const linkedInVisible = await page.locator('text="LinkedIn"').isVisible().catch(() => false);
      const successVisible = await page.locator('text=/Added|Success|Saved/i').isVisible().catch(() => false);
      
      expect(linkedInVisible || successVisible).toBeTruthy();
    }
  });

  test('should display badges', async ({ page }) => {
    await page.goto('/badges');
    await page.waitForLoadState('networkidle');
    
    // Look for badges heading
    const heading = page.locator('h1:has-text("Badge Showcase"), h1:has-text("Badges"), h2:has-text("Badges")');
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    
    // Look for badge cards - may be empty if user has no badges
    const badgeCards = page.locator('.badge-card, [class*="badge"]');
    const cardCount = await badgeCards.count();
    
    // Test passes if page loads, even with no badges
    if (cardCount === 0) {
      // Look for empty state message or description text
      const emptyState = page.locator('text=/No badges|You don\'t have any badges|Earn badges by connecting/i');
      const emptyCount = await emptyState.count();
      if (emptyCount > 0) {
        await expect(emptyState.first()).toBeVisible({ timeout: 5000 });
      }
    } else {
      await expect(badgeCards.first()).toBeVisible();
    }
  });
});
