# Testing Guide

## Overview

This project uses a comprehensive testing strategy:
- **Unit Tests**: Jest for backend Lambda functions
- **Integration Tests**: Jest for workflow testing
- **E2E Tests**: Playwright for user journey testing

## Setup

### Backend Tests
```bash
npm install
```

### Frontend E2E Tests
```bash
cd frontend
npm install
npx playwright install
```

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Integration Tests
```bash
# Integration tests run with unit tests
npm test -- integration
```

### E2E Tests
```bash
cd frontend

# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed
```

## Test Structure

### Unit Tests
```
infrastructure/
  lambda/
    connection-requests/
      __tests__/
        validation.test.ts
    badge-handlers/
      unified-badge-handler/
        __tests__/
          thresholds.test.ts
```

### Integration Tests
```
infrastructure/
  __tests__/
    integration/
      connection-request-flow.test.ts
      badge-awarding-flow.test.ts
      connection-removal-flow.test.ts
```

### E2E Tests
```
frontend/
  e2e/
    auth.spec.ts
    profile.spec.ts
    connections.spec.ts
    pwa.spec.ts
```

## Unit Tests

### Connection Request Validation Tests
**Location**: `infrastructure/lambda/connection-requests/__tests__/validation.test.ts`

Tests cover:
- ✅ Duplicate request prevention
- ✅ Self-connection prevention
- ✅ User existence validation
- ✅ Note length validation (max 1000 characters)
- ✅ Tag validation (max 10 tags)

### Badge Threshold Tests
**Location**: `infrastructure/lambda/badge-handlers/unified-badge-handler/__tests__/thresholds.test.ts`

Tests cover:
- ✅ Connection count thresholds (1, 5, 10, 25, 50)
- ✅ Badge deduplication
- ✅ VIP connection badge (50+ connections)
- ✅ Early supporter badge (first 10 connections at 500)
- ✅ Triangle complete badge detection

## Integration Tests

### Connection Request Workflow
**Location**: `infrastructure/__tests__/integration/connection-request-flow.test.ts`

Tests cover:
- ✅ Complete request-to-connection flow
- ✅ Metadata transfer from request to connection
- ✅ Request denial without connection creation
- ✅ Request cancellation by initiator
- ✅ Connection count updates for both users

### Badge Awarding Workflow
**Location**: `infrastructure/__tests__/integration/badge-awarding-flow.test.ts`

Tests cover:
- ✅ First connection badge awarding
- ✅ Multiple threshold badges at once
- ✅ Badge deduplication
- ✅ VIP connection badge for high-connection users
- ✅ Met-the-maker badge
- ✅ re:Invent connector badge for event dates
- ✅ Badge event publishing to EventBridge
- ✅ Triangle complete badge detection
- ✅ Early supporter badge logic

### Connection Removal Workflow
**Location**: `infrastructure/__tests__/integration/connection-removal-flow.test.ts`

Tests cover:
- ✅ Complete removal flow (find reciprocal, delete both, update counts)
- ✅ Badge re-evaluation after removal
- ✅ ConnectionRemoved event publishing
- ✅ Missing reciprocal connection handling
- ✅ Connection count going negative prevention
- ✅ Idempotent removal requests

## E2E Tests

### Authentication Flow
**Location**: `frontend/e2e/auth.spec.ts`

Tests cover:
- ✅ Login page display for unauthenticated users
- ✅ Successful login and redirect to dashboard
- ✅ Invalid credentials error handling
- ✅ Sign out functionality

### Profile Management
**Location**: `frontend/e2e/profile.spec.ts`

Tests cover:
- ✅ Profile display
- ✅ Profile editing
- ✅ QR code display
- ✅ Contact link management
- ✅ Badge showcase display

### Connection Workflow
**Location**: `frontend/e2e/connections.spec.ts`

Tests cover:
- ✅ Sending connection request with note/tags
- ✅ Viewing incoming/outgoing requests
- ✅ Approving connection request
- ✅ Denying connection request
- ✅ Viewing connections list
- ✅ Viewing connection detail
- ✅ Adding notes to connections
- ✅ Adding tags to connections
- ✅ Removing connections

### PWA Functionality
**Location**: `frontend/e2e/pwa.spec.ts`

Tests cover:
- ✅ PWA install prompt display on mobile
- ✅ iOS-specific instructions
- ✅ Dismissing install prompt
- ✅ Remembered dismissed state
- ✅ Valid manifest.json
- ✅ Service worker registration

## Writing New Tests

### Unit Test Example
```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('Feature Name', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = someFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### E2E Test Example
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should perform user action', async ({ page }) => {
    await page.goto('/path');
    await page.click('button:has-text("Click Me")');
    await expect(page.locator('text=Success')).toBeVisible();
  });
});
```

## Test Environment Variables

For E2E tests, set these environment variables:

```bash
# Test user credentials
export TEST_USER_EMAIL="test@example.com"
export TEST_USER_PASSWORD="TestPassword123!"

# Base URL (defaults to production)
export BASE_URL="https://d3ahxq34efx0ga.cloudfront.net"
```

## Coverage Goals

- ✅ **Unit Tests**: 80%+ coverage for business logic
- ✅ **Integration Tests**: Cover critical user workflows
- ✅ **E2E Tests**: Cover main user journeys

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
      - run: npm run test:coverage

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd frontend && npm install
      - run: npx playwright install --with-deps
      - run: cd frontend && npm run test:e2e
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

## Test Coverage Summary

### ✅ Completed
- Unit tests for validation logic
- Unit tests for badge thresholds
- Integration tests for connection request workflow
- Integration tests for badge awarding
- Integration tests for connection removal
- E2E tests for authentication
- E2E tests for profile management
- E2E tests for connection workflow
- E2E tests for PWA functionality

### 📊 Coverage Statistics
Run `npm run test:coverage` to see detailed coverage reports.

## Troubleshooting

### Unit Tests Failing
- Ensure all dependencies are installed: `npm install`
- Check mock configurations match actual AWS SDK usage
- Verify test data matches expected formats

### E2E Tests Failing
- Ensure Playwright browsers are installed: `npx playwright install`
- Check BASE_URL is accessible
- Verify test credentials are valid
- Run in headed mode to debug: `npm run test:e2e:headed`

### Flaky Tests
- Add appropriate wait conditions
- Use `waitForSelector` instead of fixed timeouts
- Check for race conditions in async operations
