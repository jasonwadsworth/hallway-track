import { test, expect } from '@playwright/test';

test.describe('Connection Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    // Add login steps here
  });

  test('should send connection request', async ({ page }) => {
    // Navigate to another user's profile
    await page.goto('/profile/test-user-id');
    
    // Click connect button
    await page.click('button:has-text("Send Request")');
    
    // Modal should open for adding note/tags
    await expect(page.locator('text=Send Connection Request')).toBeVisible();
    
    // Add note
    await page.fill('textarea[name="note"]', 'Met at re:Invent 2024');
    
    // Add tag
    await page.fill('input[name="tag"]', 'conference');
    await page.click('button:has-text("Add Tag")');
    
    // Send request
    await page.click('button:has-text("Send Request")');
    
    // Should show success
    await expect(page.locator('text=Request Sent')).toBeVisible();
  });

  test('should view incoming connection requests', async ({ page }) => {
    await page.goto('/connection-requests');
    
    await expect(page.locator('h2:has-text("Connection Requests")')).toBeVisible();
    
    // Should see tabs
    await expect(page.locator('button:has-text("Incoming")')).toBeVisible();
    await expect(page.locator('button:has-text("Outgoing")')).toBeVisible();
  });

  test('should approve connection request', async ({ page }) => {
    await page.goto('/connection-requests');
    
    // Click on incoming tab
    await page.click('button:has-text("Incoming")');
    
    // Approve first request
    await page.click('button:has-text("Approve")').first();
    
    // Should show success
    await expect(page.locator('text=Connection approved')).toBeVisible();
  });

  test('should deny connection request', async ({ page }) => {
    await page.goto('/connection-requests');
    
    // Click on incoming tab
    await page.click('button:has-text("Incoming")');
    
    // Deny first request
    await page.click('button:has-text("Deny")').first();
    
    // Should show success
    await expect(page.locator('text=Request denied')).toBeVisible();
  });

  test('should view connections list', async ({ page }) => {
    await page.goto('/connections');
    
    await expect(page.locator('h2:has-text("My Connections")')).toBeVisible();
    await expect(page.locator('.connection-card')).toBeVisible();
  });

  test('should view connection detail', async ({ page }) => {
    await page.goto('/connections');
    
    // Click on first connection
    await page.click('.connection-card').first();
    
    // Should show connection detail
    await expect(page.locator('.connection-detail')).toBeVisible();
    await expect(page.locator('text=Notes')).toBeVisible();
    await expect(page.locator('text=Tags')).toBeVisible();
  });

  test('should add note to connection', async ({ page }) => {
    await page.goto('/connections');
    await page.click('.connection-card').first();
    
    // Add note
    await page.fill('textarea[name="note"]', 'Great conversation about serverless');
    await page.click('button:has-text("Save Note")');
    
    // Should show success
    await expect(page.locator('text=Note saved')).toBeVisible();
  });

  test('should add tag to connection', async ({ page }) => {
    await page.goto('/connections');
    await page.click('.connection-card').first();
    
    // Add tag
    await page.fill('input[name="tag"]', 'aws');
    await page.click('button:has-text("Add Tag")');
    
    // Should show tag
    await expect(page.locator('.tag:has-text("aws")')).toBeVisible();
  });

  test('should remove connection', async ({ page }) => {
    await page.goto('/connections');
    await page.click('.connection-card').first();
    
    // Click remove button
    await page.click('button:has-text("Remove Connection")');
    
    // Confirm removal
    await page.click('button:has-text("Remove")');
    
    // Should redirect to connections list
    await expect(page).toHaveURL('/connections');
    await expect(page.locator('text=Connection removed')).toBeVisible();
  });
});
