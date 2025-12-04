import { Page } from '@playwright/test';

/**
 * Helper function to log in a user
 * Uses environment variables for test credentials
 */
export async function login(page: Page): Promise<void> {
  const email = process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

  // Wait for the Amplify Authenticator to load
  // Amplify UI uses specific data-amplify-* attributes
  await page.waitForSelector('[data-amplify-authenticator]', { timeout: 30000 });

  // Look for username/email input - Amplify uses input with autocomplete="username"
  const usernameInput = page.locator('input[autocomplete="username"]');
  await usernameInput.waitFor({ state: 'visible', timeout: 10000 });
  await usernameInput.fill(email);

  // Look for password input
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(password);

  // Click the sign in button - Amplify uses a button with type="submit"
  const signInButton = page.locator('button[type="submit"]').first();
  await signInButton.click();

  // Wait for the authenticator to disappear (sign of successful login)
  await page.waitForSelector('[data-amplify-authenticator]', { state: 'hidden', timeout: 30000 });
  
  // Wait for navigation to complete and page to be fully loaded
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  
  // Wait for a dashboard element to confirm successful login
  await page.waitForSelector('text=Welcome to HallwayTrak', { timeout: 30000 });
}

/**
 * Helper function to logout a user
 */
export async function logout(page: Page): Promise<void> {
  // Look for the sign out button - use flexible selector that matches text with emoji
  // The actual button text is "🚪 Sign Out" but :has-text should match partial text
  const signOutButton = page.locator('button:has-text("Sign Out"), button:has-text("Sign out"), button.btn-signout');
  
  // Wait for the button to be visible and enabled
  await signOutButton.first().waitFor({ state: 'visible', timeout: 10000 });
  
  // Click the button
  await signOutButton.first().click();

  // Wait for return to login page - authenticator should be visible again
  await page.waitForSelector('[data-amplify-authenticator]', { state: 'visible', timeout: 10000 });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check for presence of authenticator (login form)
    const authenticator = await page.locator('[data-amplify-authenticator]').count();
    return authenticator === 0;
  } catch {
    return false;
  }
}

/**
 * Mock PWA conditions for testing
 * This injects code into the page to make PWA prompt appear
 */
export async function mockPWAConditions(page: Page, platform: 'ios' | 'android' | 'desktop' = 'ios'): Promise<void> {
  // Mock the user agent
  if (platform === 'ios') {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
      });
    });
  } else if (platform === 'android') {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
      });
    });
  }

  // Mock PWA detection functions to force prompt to show
  await page.addInitScript(() => {
    // Clear any previous dismissal
    localStorage.removeItem('pwa-install-dismissed');
    
    // Mock display-mode to not be standalone
    window.matchMedia = ((query: string) => ({
      matches: query === '(display-mode: standalone)' ? false : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    })) as typeof window.matchMedia;
  });
}
