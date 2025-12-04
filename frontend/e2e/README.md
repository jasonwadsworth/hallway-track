# E2E Tests

End-to-end tests for the HallwayTrak frontend application using Playwright.

## Setup

### Prerequisites

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Install Playwright browsers (first time only):
```bash
npx playwright install
```

### Environment Variables

For full test coverage, set up test user credentials:

```bash
export TEST_USER_EMAIL="your-test-user@example.com"
export TEST_USER_PASSWORD="YourTestPassword123!"
```

**Note**: Tests that require authentication will be skipped if these environment variables are not set.

### Test Data Requirements

For all tests to pass, your test user should have:
- At least one existing connection (for connection management tests)
- At least one incoming connection request (for request approval/denial tests)
- A valid profile setup

Tests will gracefully skip when required data is not available.

## Running Tests

### Run All Tests
```bash
npm run test:e2e
```

### Run Tests in UI Mode (Interactive)
```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode (Watch Browser)
```bash
npm run test:e2e:headed
```

### Run Specific Test File
```bash
npx playwright test e2e/auth.spec.ts
```

### Run Tests with Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project="Mobile Chrome"
```

## Test Suites

### PWA Functionality (`pwa.spec.ts`)
Tests Progressive Web App installation features:
- Install prompt display on mobile devices
- iOS-specific installation instructions
- Prompt dismissal functionality
- Dismissed state persistence
- Manifest.json validity
- Service worker registration

**Special Note**: These tests use mocked PWA conditions since Playwright doesn't trigger native PWA events.

### Authentication Flow (`auth.spec.ts`)
Tests user authentication using AWS Amplify:
- Login page display for unauthenticated users
- Successful login flow
- Invalid credential error handling
- Sign out functionality

**Requirements**: Most tests require `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` environment variables.

### Connection Workflow (`connections.spec.ts`)
Tests user connection management:
- Sending connection requests
- Viewing incoming/outgoing requests
- Approving connection requests
- Denying connection requests
- Viewing connections list
- Viewing connection details
- Adding notes to connections
- Adding tags to connections
- Removing connections

**Requirements**: 
- Authentication credentials
- Test user should have existing connections and pending requests for full coverage

### Profile Management (`profile.spec.ts`)
Tests user profile features:
- Profile display
- Profile editing
- QR code display
- Contact links management
- Badge showcase

**Requirements**: Authentication credentials

## Helper Functions

The `helpers.ts` file provides reusable test utilities:

### `login(page: Page)`
Authenticates a user using credentials from environment variables.

```typescript
import { login } from './helpers';

test('my test', async ({ page }) => {
  await page.goto('/');
  await login(page);
  // User is now authenticated
});
```

### `logout(page: Page)`
Signs out the current user.

```typescript
import { logout } from './helpers';

test('my test', async ({ page }) => {
  // ... user is logged in
  await logout(page);
  // User is now signed out
});
```

### `mockPWAConditions(page: Page, platform?: 'ios' | 'android' | 'desktop')`
Mocks PWA detection conditions for testing PWA features.

```typescript
import { mockPWAConditions } from './helpers';

test('PWA test', async ({ page }) => {
  await mockPWAConditions(page, 'ios');
  await page.goto('/');
  // PWA prompt will appear as if on iOS device
});
```

## Configuration

Tests are configured in `playwright.config.ts`:
- Base URL: `https://d3ahxq34efx0ga.cloudfront.net` (or override with `BASE_URL` env var)
- Test timeout: 60 seconds
- Action timeout: 15 seconds
- Expect timeout: 10 seconds
- Browser projects: Desktop Chrome, Mobile Chrome, Mobile Safari

## Troubleshooting

### Tests Timing Out
- Check if the application is running and accessible at the base URL
- Increase timeouts in `playwright.config.ts` if needed
- Ensure network conditions are stable

### Authentication Tests Failing
- Verify `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` are set correctly
- Ensure the test user exists in the system
- Check that AWS Cognito is properly configured

### Tests Being Skipped
- Tests skip when prerequisites aren't met (e.g., no test credentials, no connections)
- This is expected behavior and not a failure
- Set up required environment variables and test data for full coverage

### PWA Tests Failing
- Ensure the mock functions are being called before navigation
- Check that localStorage is available in the test environment
- Verify the PWA component is rendering on the page

## Continuous Integration

Tests can be run in CI/CD pipelines:

```yaml
- name: Install dependencies
  run: npm ci
  working-directory: ./frontend

- name: Install Playwright
  run: npx playwright install --with-deps
  working-directory: ./frontend

- name: Run E2E tests
  run: npm run test:e2e
  working-directory: ./frontend
  env:
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
    BASE_URL: ${{ secrets.TEST_BASE_URL }}
```

## Writing New Tests

### Best Practices

1. **Use Helper Functions**: Leverage `login()`, `logout()`, and other helpers for common operations

2. **Make Tests Resilient**:
   - Use flexible selectors that match UI variations
   - Add appropriate timeouts for async operations
   - Handle missing data gracefully with `test.skip()`
   - Use regex patterns for text matching

3. **Wait for Page States**:
   ```typescript
   await page.waitForLoadState('networkidle');
   ```

4. **Check Element Existence Before Interaction**:
   ```typescript
   const buttonCount = await page.locator('button:has-text("Submit")').count();
   if (buttonCount === 0) {
     test.skip();
   }
   ```

5. **Use Flexible Locators**:
   ```typescript
   // Match multiple variations
   page.locator('h1:has-text("My Profile"), h1:has-text("Profile")')
   
   // Use regex for partial matches
   page.locator('text=/Success|Saved|Updated/i')
   ```

6. **Handle Empty States**:
   ```typescript
   const items = await page.locator('.item').count();
   if (items === 0) {
     // Check for empty state message or skip test
   }
   ```

## Test Data Management

Consider creating test data setup/teardown scripts:
- Create connections programmatically via API
- Set up test user profiles
- Clean up test data after test runs

This ensures tests have consistent data to work with.
