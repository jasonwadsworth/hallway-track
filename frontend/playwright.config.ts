import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  // Use multiple reporters in CI for better visibility
  reporter: process.env.CI 
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : 'html',
  // Set explicit timeouts
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000, // 10 seconds for expect assertions
  },
  use: {
    baseURL: process.env.BASE_URL || 'https://d3ahxq34efx0ga.cloudfront.net',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Add action and navigation timeouts
    actionTimeout: 15000, // 15 seconds for actions
    navigationTimeout: 30000, // 30 seconds for page navigation
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
