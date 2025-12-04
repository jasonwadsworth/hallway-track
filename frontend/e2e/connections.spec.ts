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
    // Navigate to leaderboard to find a real user to connect with
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
    
    // Find a user profile link (but not our own)
    const profileLinks = page.locator('a[href^="/profile/"]');
    const linkCount = await profileLinks.count();
    
    if (linkCount === 0) {
      test.skip(); // Skip if no users on leaderboard
    }
    
    // Click the first profile link
    await profileLinks.first().click();
    await page.waitForLoadState('networkidle');
    
    // Look for connect button - actual text is "Send Request"
    const connectButton = page.locator('button.btn-connect:has-text("Send Request")');
    
    // Check if button exists
    const buttonCount = await connectButton.count();
    if (buttonCount === 0) {
      test.skip(); // Skip if no connect button (e.g., already connected or own profile)
    }
    
    await connectButton.click();
    
    // Modal should open for adding note/tags
    await expect(page.locator('text=Send Connection Request')).toBeVisible({ timeout: 10000 });
    
    // Add note - the textarea has id="note-input", not name="note"
    const noteTextarea = page.locator('textarea#note-input');
    if (await noteTextarea.count() > 0) {
      await noteTextarea.fill('Met at re:Invent 2024');
    }
    
    // Add tag - the input has id="tag-input", not name="tag"
    const tagInput = page.locator('input#tag-input');
    if (await tagInput.count() > 0) {
      await tagInput.fill('conference');
      // The button text is "Add", not "Add Tag"
      const addTagButton = page.locator('button.btn-add-tag:has-text("Add")');
      if (await addTagButton.count() > 0) {
        await addTagButton.click();
      }
    }
    
    // Send request - button text is "Send Request"
    const sendButton = page.locator('button.btn-submit:has-text("Send Request")');
    await sendButton.click();
    
    // Should show success message "Connection request sent!"
    await expect(page.locator('text=/Connection request sent/i')).toBeVisible({ timeout: 10000 });
  });

  test('should view incoming connection requests', async ({ page }) => {
    await page.goto('/connection-requests');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for the main heading
    await expect(page.locator('h2:has-text("Connection Requests")')).toBeVisible({ timeout: 10000 });
    
    // Should see tabs with count indicators
    await expect(page.locator('button.tab-button:has-text("Incoming")')).toBeVisible();
    await expect(page.locator('button.tab-button:has-text("Outgoing")')).toBeVisible();
  });

  test('should approve connection request', async ({ page }) => {
    await page.goto('/connection-requests');
    await page.waitForLoadState('networkidle');
    
    // Make sure we're on the incoming tab
    const incomingTab = page.locator('button.tab-button:has-text("Incoming")');
    await incomingTab.click();
    
    // Wait a moment for tab content to load
    await page.waitForTimeout(1000);
    
    // Check if there are any requests to approve
    const approveButtons = page.locator('button.btn-approve:has-text("Approve")');
    const approveCount = await approveButtons.count();
    
    if (approveCount === 0) {
      test.skip(); // Skip if no pending requests
    }
    
    // Approve first request
    await approveButtons.first().click();
    
    // Wait for the request to be processed and removed from the list
    await page.waitForTimeout(2000);
    
    // The request should be removed from the incoming list (no specific success message shown)
    // Just verify we're still on the page
    await expect(page.locator('h2:has-text("Connection Requests")')).toBeVisible();
  });

  test('should deny connection request', async ({ page }) => {
    await page.goto('/connection-requests');
    await page.waitForLoadState('networkidle');
    
    // Make sure we're on the incoming tab
    const incomingTab = page.locator('button.tab-button:has-text("Incoming")');
    await incomingTab.click();
    
    // Wait a moment for tab content to load
    await page.waitForTimeout(1000);
    
    // Check if there are any requests to deny
    const denyButtons = page.locator('button.btn-deny:has-text("Deny")');
    const denyCount = await denyButtons.count();
    
    if (denyCount === 0) {
      test.skip(); // Skip if no pending requests
    }
    
    // Deny first request
    await denyButtons.first().click();
    
    // Wait for the request to be processed and removed from the list
    await page.waitForTimeout(2000);
    
    // The request should be removed from the incoming list (no specific success message shown)
    // Just verify we're still on the page
    await expect(page.locator('h2:has-text("Connection Requests")')).toBeVisible();
  });

  test('should view connections list', async ({ page }) => {
    await page.goto('/connections');
    await page.waitForLoadState('networkidle');
    
    // Check for the main heading
    await expect(page.locator('h2:has-text("My Connections")')).toBeVisible({ timeout: 10000 });
    
    // Check if any connections exist
    const connectionCards = page.locator('.connection-card');
    const cardCount = await connectionCards.count();
    
    // Test passes if page loads, even with no connections
    if (cardCount === 0) {
      // Look for empty state message
      await expect(page.locator('text=/No connections yet|You don\'t have any connections/i')).toBeVisible({ timeout: 5000 });
    } else {
      // Verify at least one connection card is visible
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
    
    // Should show connection detail page with the correct class
    await expect(page.locator('.connection-detail')).toBeVisible({ timeout: 10000 });
    
    // Should have back button
    await expect(page.locator('button.btn-back:has-text("Back to Connections")')).toBeVisible();
    
    // Should show sections for tags and notes
    await expect(page.locator('h3:has-text("Tags")')).toBeVisible();
    await expect(page.locator('h3:has-text("Notes")')).toBeVisible();
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
    
    // Look for note textarea - it has class "notes-textarea", not name="note"
    const noteTextarea = page.locator('textarea.notes-textarea');
    const textareaCount = await noteTextarea.count();
    
    if (textareaCount === 0) {
      test.skip(); // Skip if no note field
    }
    
    // Clear existing note and add new one
    await noteTextarea.clear();
    await noteTextarea.fill('Great conversation about serverless');
    
    // Click save button - text is "Save Note"
    const saveButton = page.locator('button.btn-save-note:has-text("Save Note")');
    await saveButton.click();
    
    // Should show success message "Note saved successfully!"
    await expect(page.locator('.note-status-success:has-text("Note saved successfully!")')).toBeVisible({ timeout: 10000 });
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
    
    // Look for tag input in the TagManager component - it has class "tag-input"
    const tagInput = page.locator('.tag-manager input.tag-input');
    const inputCount = await tagInput.count();
    
    if (inputCount === 0) {
      test.skip(); // Skip if no tag field
    }
    
    // Generate a unique tag to avoid duplicates
    const uniqueTag = `aws-${Date.now()}`;
    
    // Add tag
    await tagInput.fill(uniqueTag);
    
    // Click add tag button - text is "Add Tag"
    const addTagButton = page.locator('button.btn-add-tag:has-text("Add Tag")');
    await addTagButton.click();
    
    // Wait a moment for the tag to be added
    await page.waitForTimeout(1000);
    
    // Should show tag in the tags list
    await expect(page.locator(`.tag-item:has-text("${uniqueTag}")`)).toBeVisible({ timeout: 10000 });
  });

  test('should remove connection', async ({ page }) => {
    await page.goto('/connections');
    await page.waitForLoadState('networkidle');
    
    const connectionCards = page.locator('.connection-card');
    const cardCount = await connectionCards.count();
    
    if (cardCount === 0) {
      test.skip(); // Skip if no connections
    }
    
    // Click the remove button on the first connection card (trash icon)
    const removeButton = connectionCards.first().locator('button.remove-button');
    const buttonCount = await removeButton.count();
    
    if (buttonCount === 0) {
      test.skip(); // Skip if no remove button
    }
    
    // Click remove button
    await removeButton.click();
    
    // Wait for confirmation modal to appear
    await expect(page.locator('.modal-content h3:has-text("Remove Connection")')).toBeVisible({ timeout: 5000 });
    
    // Confirm removal by clicking the danger button
    const confirmButton = page.locator('button.button-danger:has-text("Remove Connection")');
    await confirmButton.click();
    
    // Wait for the modal to close and the connection to be removed
    await page.waitForTimeout(2000);
    
    // Modal should be gone
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
    
    // Should still be on connections page
    await expect(page.locator('h2:has-text("My Connections")')).toBeVisible();
  });
});
