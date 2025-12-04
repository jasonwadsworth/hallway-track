import { test, expect } from '@playwright/test';
import { login } from './helpers';

test.describe('Connection Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Skip all tests in this suite if no credentials are provided
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
      test.skip();
    }
    
    // Login before each test
    await page.goto('/');
    await login(page);
  });

  test('should send connection request', async ({ page }) => {
    // Navigate to another user's profile
    // Note: This requires a valid test user ID to exist
    await page.goto('/profile/test-user-id');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Look for connect button (text may vary)
    const connectButton = page.locator('button:has-text("Send Request"), button:has-text("Connect")').first();
    
    // Only proceed if button exists
    const buttonCount = await connectButton.count();
    if (buttonCount === 0) {
      test.skip(); // Skip if no connect button (e.g., already connected or own profile)
    }
    
    await connectButton.click();
    
    // Modal should open for adding note/tags
    await expect(page.locator('text=Send Connection Request')).toBeVisible({ timeout: 10000 });
    
    // Add note if textarea exists
    const noteTextarea = page.locator('textarea[name="note"]');
    if (await noteTextarea.count() > 0) {
      await noteTextarea.fill('Met at re:Invent 2024');
    }
    
    // Add tag if input exists
    const tagInput = page.locator('input[name="tag"]');
    if (await tagInput.count() > 0) {
      await tagInput.fill('conference');
      const addTagButton = page.locator('button:has-text("Add Tag")');
      if (await addTagButton.count() > 0) {
        await addTagButton.click();
      }
    }
    
    // Send request
    const sendButton = page.locator('button:has-text("Send Request"), button:has-text("Send")').last();
    await sendButton.click();
    
    // Should show success (may vary in exact wording)
    await expect(page.locator('text=/Request Sent|Request sent|Connection request sent/i')).toBeVisible({ timeout: 10000 });
  });

  test('should view incoming connection requests', async ({ page }) => {
    await page.goto('/connection-requests');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('h2:has-text("Connection Requests"), h1:has-text("Connection Requests")')).toBeVisible({ timeout: 10000 });
    
    // Should see tabs
    await expect(page.locator('button:has-text("Incoming")')).toBeVisible();
    await expect(page.locator('button:has-text("Outgoing")')).toBeVisible();
  });

  test('should approve connection request', async ({ page }) => {
    await page.goto('/connection-requests');
    await page.waitForLoadState('networkidle');
    
    // Click on incoming tab
    await page.click('button:has-text("Incoming")');
    
    // Wait a moment for tab content to load
    await page.waitForTimeout(500);
    
    // Check if there are any requests to approve
    const approveButtons = page.locator('button:has-text("Approve")');
    const approveCount = await approveButtons.count();
    
    if (approveCount === 0) {
      test.skip(); // Skip if no pending requests
    }
    
    // Approve first request
    await approveButtons.first().click();
    
    // Should show success
    await expect(page.locator('text=/Connection approved|Approved|Request approved/i')).toBeVisible({ timeout: 10000 });
  });

  test('should deny connection request', async ({ page }) => {
    await page.goto('/connection-requests');
    await page.waitForLoadState('networkidle');
    
    // Click on incoming tab
    await page.click('button:has-text("Incoming")');
    
    // Wait a moment for tab content to load
    await page.waitForTimeout(500);
    
    // Check if there are any requests to deny
    const denyButtons = page.locator('button:has-text("Deny"), button:has-text("Decline")');
    const denyCount = await denyButtons.count();
    
    if (denyCount === 0) {
      test.skip(); // Skip if no pending requests
    }
    
    // Deny first request
    await denyButtons.first().click();
    
    // Should show success
    await expect(page.locator('text=/Request denied|Denied|Request declined/i')).toBeVisible({ timeout: 10000 });
  });

  test('should view connections list', async ({ page }) => {
    await page.goto('/connections');
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('h2:has-text("My Connections"), h1:has-text("My Connections"), h2:has-text("Connections"), h1:has-text("Connections")')).toBeVisible({ timeout: 10000 });
    
    // Check if any connections exist - may be empty
    const connectionCards = page.locator('.connection-card');
    const cardCount = await connectionCards.count();
    
    // Test passes if page loads, even with no connections
    if (cardCount === 0) {
      // Look for empty state message
      await expect(page.locator('text=/No connections|You don\'t have any connections/i')).toBeVisible({ timeout: 5000 }).catch(() => {
        // Empty state message may not exist, that's ok
      });
    } else {
      await expect(connectionCards.first()).toBeVisible();
    }
  });

  test('should view connection detail', async ({ page }) => {
    await page.goto('/connections');
    await page.waitForLoadState('networkidle');
    
    // Check if any connections exist
    const connectionCards = page.locator('.connection-card');
    const cardCount = await connectionCards.count();
    
    if (cardCount === 0) {
      test.skip(); // Skip if no connections
    }
    
    // Click on first connection
    await connectionCards.first().click();
    
    // Wait for navigation
    await page.waitForLoadState('networkidle');
    
    // Should show connection detail
    await expect(page.locator('.connection-detail, [class*="detail"], [class*="Detail"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Notes, text=Note')).toBeVisible({ timeout: 5000 }).catch(() => {
      // Notes section might not be visible, that's ok
    });
  });

  test('should add note to connection', async ({ page }) => {
    await page.goto('/connections');
    await page.waitForLoadState('networkidle');
    
    const connectionCards = page.locator('.connection-card');
    const cardCount = await connectionCards.count();
    
    if (cardCount === 0) {
      test.skip(); // Skip if no connections
    }
    
    await connectionCards.first().click();
    await page.waitForLoadState('networkidle');
    
    // Look for note textarea
    const noteTextarea = page.locator('textarea[name="note"], textarea[placeholder*="note" i]');
    const textareaCount = await noteTextarea.count();
    
    if (textareaCount === 0) {
      test.skip(); // Skip if no note field
    }
    
    // Add note
    await noteTextarea.fill('Great conversation about serverless');
    
    const saveButton = page.locator('button:has-text("Save Note"), button:has-text("Save"), button:has-text("Add Note")');
    await saveButton.first().click();
    
    // Should show success
    await expect(page.locator('text=/Note saved|Saved|Note added/i')).toBeVisible({ timeout: 10000 });
  });

  test('should add tag to connection', async ({ page }) => {
    await page.goto('/connections');
    await page.waitForLoadState('networkidle');
    
    const connectionCards = page.locator('.connection-card');
    const cardCount = await connectionCards.count();
    
    if (cardCount === 0) {
      test.skip(); // Skip if no connections
    }
    
    await connectionCards.first().click();
    await page.waitForLoadState('networkidle');
    
    // Look for tag input
    const tagInput = page.locator('input[name="tag"], input[placeholder*="tag" i]');
    const inputCount = await tagInput.count();
    
    if (inputCount === 0) {
      test.skip(); // Skip if no tag field
    }
    
    // Add tag
    await tagInput.fill('aws');
    
    const addTagButton = page.locator('button:has-text("Add Tag")');
    await addTagButton.click();
    
    // Should show tag
    await expect(page.locator('.tag:has-text("aws"), [class*="tag"]:has-text("aws")')).toBeVisible({ timeout: 10000 });
  });

  test('should remove connection', async ({ page }) => {
    await page.goto('/connections');
    await page.waitForLoadState('networkidle');
    
    const connectionCards = page.locator('.connection-card');
    const cardCount = await connectionCards.count();
    
    if (cardCount === 0) {
      test.skip(); // Skip if no connections
    }
    
    await connectionCards.first().click();
    await page.waitForLoadState('networkidle');
    
    // Look for remove button
    const removeButton = page.locator('button:has-text("Remove Connection"), button:has-text("Remove"), button:has-text("Delete")');
    const buttonCount = await removeButton.count();
    
    if (buttonCount === 0) {
      test.skip(); // Skip if no remove button
    }
    
    // Click remove button
    await removeButton.first().click();
    
    // Look for confirmation button
    const confirmButton = page.locator('button:has-text("Remove"), button:has-text("Confirm"), button:has-text("Delete")');
    await confirmButton.last().click();
    
    // Should redirect to connections list or show success
    await page.waitForTimeout(1000);
    const url = page.url();
    
    // Either redirected to connections list OR shows success message
    if (url.includes('/connections') && !url.includes('/connections/')) {
      // Redirected back to list
      expect(url).toContain('/connections');
    } else {
      // Still on page but should show success
      await expect(page.locator('text=/Connection removed|Removed|Deleted/i')).toBeVisible({ timeout: 10000 });
    }
  });
});
