# Unit Testing Expansion Design

## Overview

This design document outlines the approach for expanding unit test coverage across the Hallway Track application. The testing strategy focuses on critical business logic in Lambda functions and resolvers while maintaining the project's "simplicity first" philosophy. Tests will use Jest with TypeScript, aws-sdk-client-mock for AWS service mocking, and follow a consistent structure across the codebase.

## Architecture

### Testing Framework Stack

- **Test Runner**: Jest (already configured)
- **TypeScript Support**: ts-jest (already configured)
- **AWS Mocking**: aws-sdk-client-mock for DynamoDB and EventBridge
- **Assertion Library**: Jest's built-in expect
- **Test Organization**: `__tests__` directories adjacent to source code

### Test File Organization

```
infrastructure/
├── lambda/
│   ├── connection-requests/
│   │   ├── __tests__/
│   │   │   ├── connection-requests.test.ts
│   │   │   └── validation.test.ts
│   │   └── index.ts
│   ├── contact-links/
│   │   ├── __tests__/
│   │   │   └── contact-links.test.ts
│   │   └── index.ts
│   └── badge-stream-processor/
│       ├── __tests__/
│       │   └── badge-stream-processor.test.ts
│       └── index.ts
├── resolvers/
│   └── __tests__/
│       ├── connection-resolvers.test.ts
│       └── profile-resolvers.test.ts
└── __tests__/
    ├── integration/
    │   ├── badge-workflow.test.ts (existing)
    │   └── connection-workflow.test.ts (existing)
    └── utils/
        ├── test-factories.ts
        ├── mock-helpers.ts
        └── dynamodb-assertions.ts
```

## Components and Interfaces

### Test Utilities

#### Test Factories (`infrastructure/__tests__/utils/test-factories.ts`)

Factory functions for creating test data with sensible defaults:

```typescript
interface UserFactory {
  createUser(overrides?: Partial<User>): User;
  createConnectionRequest(overrides?: Partial<ConnectionRequest>): ConnectionRequest;
  createConnection(overrides?: Partial<Connection>): Connection;
  createContactLink(overrides?: Partial<ContactLink>): ContactLink;
}
```

**Purpose**: Reduce boilerplate in tests by providing reusable data creation functions.

#### Mock Helpers (`infrastructure/__tests__/utils/mock-helpers.ts`)

Helper functions for common AWS service mocking patterns:

```typescript
interface MockHelpers {
  mockDynamoDBGet(tableName: string, item: Record<string, unknown> | null): void;
  mockDynamoDBPut(tableName: string): void;
  mockDynamoDBUpdate(tableName: string, attributes: Record<string, unknown>): void;
  mockDynamoDBQuery(tableName: string, items: Record<string, unknown>[]): void;
  mockEventBridgePutEvents(): void;
  resetAllMocks(): void;
}
```

**Purpose**: Simplify AWS service mocking setup and reduce test code duplication.

#### DynamoDB Assertions (`infrastructure/__tests__/utils/dynamodb-assertions.ts`)

Custom assertions for verifying DynamoDB operations:

```typescript
interface DynamoDBAssertions {
  expectDynamoDBGet(tableName: string, key: Record<string, string>): void;
  expectDynamoDBPut(tableName: string, item: Partial<Record<string, unknown>>): void;
  expectDynamoDBUpdate(tableName: string, key: Record<string, string>): void;
  expectDynamoDBQuery(tableName: string, keyCondition: string): void;
  expectEventBridgeEvent(source: string, detailType: string): void;
}
```

**Purpose**: Provide readable assertions for AWS service interactions.

### Lambda Function Tests

#### Connection Requests Tests

**File**: `infrastructure/lambda/connection-requests/__tests__/connection-requests.test.ts`

**Test Coverage**:
- Creating connection requests with valid data
- Validating note length (max 1000 characters)
- Validating tag length (max 50 characters per tag)
- Preventing self-connections
- Checking for existing connections before creating requests
- Detecting duplicate pending requests
- Approving connection requests
- Denying connection requests
- Cancelling connection requests
- Updating connection request metadata
- Querying incoming/outgoing requests

**Mocking Strategy**:
- Mock DynamoDB GetCommand, PutCommand, UpdateCommand, QueryCommand, DeleteCommand
- Mock EventBridge PutEventsCommand
- Use test factories for user and request data

#### Contact Links Tests

**File**: `infrastructure/lambda/contact-links/__tests__/contact-links.test.ts`

**Test Coverage**:
- Updating contact link label
- Updating contact link URL
- Updating contact link visibility
- Removing contact links
- Handling non-existent contact links
- Verifying DynamoDB updates

**Mocking Strategy**:
- Mock DynamoDB GetCommand and UpdateCommand
- Use test factories for user and contact link data

#### Badge Stream Processor Tests

**File**: `infrastructure/lambda/badge-stream-processor/__tests__/badge-stream-processor.test.ts`

**Test Coverage**:
- Processing connection creation events
- Processing user connection count updates
- Ignoring irrelevant stream records
- Handling multiple records in a batch
- Publishing events to EventBridge
- Error handling for malformed records

**Mocking Strategy**:
- Mock EventBridge PutEventsCommand
- Create DynamoDB stream event fixtures
- Verify EventBridge event payloads

### Resolver Tests

**File**: `infrastructure/resolvers/__tests__/connection-resolvers.test.ts`

**Test Coverage**:
- Testing JavaScript resolver logic (if complex)
- Validating resolver transformations
- Testing authorization checks in resolvers

**Note**: Many resolvers are simple pass-through or field resolvers. Only test resolvers with significant logic.

## Data Models

### Test Data Interfaces

All test data will use the same TypeScript interfaces as production code:

```typescript
interface User {
  PK: string;
  SK: string;
  id: string;
  email: string;
  displayName: string;
  gravatarHash: string;
  contactLinks: ContactLink[];
  badges: unknown[];
  connectionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionRequest {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  id: string;
  initiatorUserId: string;
  recipientUserId: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  actionedAt?: string;
  initiatorNote?: string;
  initiatorTags?: string[];
}

interface ContactLink {
  id: string;
  label: string;
  url: string;
  visible: boolean;
}
```

### Test Fixtures

Test fixtures will be created using factory functions with sensible defaults:

```typescript
// Example factory usage
const testUser = createUser({
  id: 'test-user-123',
  displayName: 'Test User',
  connectionCount: 5
});

const testRequest = createConnectionRequest({
  initiatorUserId: 'user-1',
  recipientUserId: 'user-2',
  status: 'PENDING'
});
```

## Error Handling

### Test Error Scenarios

Each Lambda function test suite will include error handling tests:

1. **DynamoDB Errors**: Test behavior when DynamoDB operations fail
2. **EventBridge Errors**: Test behavior when event publishing fails
3. **Validation Errors**: Test all validation rules and error messages
4. **Authorization Errors**: Test unauthorized access attempts
5. **Not Found Errors**: Test handling of missing resources

### Error Testing Pattern

```typescript
it('should handle DynamoDB errors gracefully', async () => {
  // Mock DynamoDB to throw an error
  mockDynamoDBClient.on(GetCommand).rejects(new Error('DynamoDB error'));

  // Execute function
  const result = await handler(event);

  // Verify error handling
  expect(result.success).toBe(false);
  expect(result.message).toContain('Please try again');
});
```

## Testing Strategy

### Unit Test Scope

**In Scope**:
- Lambda function business logic
- Input validation
- Data transformations
- Error handling
- AWS service interactions (mocked)
- Badge calculation logic
- Connection request workflows
- Contact link management

**Out of Scope**:
- CDK infrastructure code (covered by CDK synthesis)
- Simple pass-through resolvers
- AWS service implementations
- End-to-end workflows (covered by integration tests)

### Test Organization Principles

1. **Co-location**: Tests live in `__tests__` directories next to the code they test
2. **Naming**: Test files use `.test.ts` extension
3. **Structure**: Each test file mirrors the structure of the source file
4. **Isolation**: Each test is independent and can run in any order
5. **Clarity**: Test names clearly describe what is being tested

### Mocking Strategy

#### AWS Services

Use `aws-sdk-client-mock` for all AWS service mocking:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
});

it('should get user from DynamoDB', async () => {
  ddbMock.on(GetCommand).resolves({
    Item: { id: 'user-123', displayName: 'Test User' }
  });

  // Test code...
});
```

#### Environment Variables

Mock environment variables in test setup:

```typescript
beforeAll(() => {
  process.env.USERS_TABLE_NAME = 'test-users-table';
  process.env.CONNECTIONS_TABLE_NAME = 'test-connections-table';
  process.env.EVENT_BUS_NAME = 'test-event-bus';
});

afterAll(() => {
  delete process.env.USERS_TABLE_NAME;
  delete process.env.CONNECTIONS_TABLE_NAME;
  delete process.env.EVENT_BUS_NAME;
});
```

### Test Coverage Goals

**Target Coverage** (as per project philosophy - minimal but focused):
- Critical business logic: 80%+ coverage
- Validation functions: 90%+ coverage
- Error handling: 70%+ coverage
- Overall: 60%+ coverage (focused on critical paths)

**Coverage Exclusions**:
- Type definitions
- Index files (simple exports)
- CDK infrastructure code

### Test Execution

#### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

#### CI/CD Integration

Tests will run automatically in CI/CD pipeline:
- Run on every pull request
- Block merges if tests fail
- Generate coverage reports
- Fail if coverage drops below threshold

## Implementation Approach

### Phase 1: Test Infrastructure
1. Create test utilities directory structure
2. Implement test factories
3. Implement mock helpers
4. Implement DynamoDB assertions
5. Document utility usage

### Phase 2: Lambda Function Tests
1. Connection requests tests
2. Contact links tests
3. Badge stream processor tests
4. Other Lambda function tests as needed

### Phase 3: Resolver Tests
1. Identify resolvers with complex logic
2. Write tests for complex resolvers
3. Skip simple pass-through resolvers

### Phase 4: Validation and Refinement
1. Run full test suite
2. Verify coverage meets goals
3. Refactor tests for clarity
4. Update documentation

## Design Decisions and Rationales

### Decision 1: Co-located Tests
**Rationale**: Tests next to source code make it easier to find and maintain tests. This follows Jest best practices and improves developer experience.

### Decision 2: aws-sdk-client-mock
**Rationale**: This library is already in the project dependencies and provides a clean API for mocking AWS SDK v3 clients. It's well-maintained and widely used.

### Decision 3: Test Utilities
**Rationale**: Reusable utilities reduce boilerplate and make tests more readable. Factory functions ensure consistent test data across the suite.

### Decision 4: Focus on Critical Logic
**Rationale**: Aligns with project's "simplicity first" philosophy. We test what matters most rather than chasing 100% coverage.

### Decision 5: Skip Simple Resolvers
**Rationale**: Simple pass-through resolvers have minimal logic and are better tested through integration tests. Unit testing them provides little value.

### Decision 6: Mock All AWS Services
**Rationale**: Unit tests should be fast and not depend on external services. Mocking ensures tests are deterministic and can run anywhere.

### Decision 7: Integration Tests Remain Separate
**Rationale**: The existing integration tests serve a different purpose (testing workflows). Unit tests focus on individual functions in isolation.

## Testing Best Practices

### Test Structure (AAA Pattern)

```typescript
it('should create connection request successfully', async () => {
  // Arrange
  const initiatorUserId = 'user-1';
  const recipientUserId = 'user-2';
  mockDynamoDBGet('users-table', createUser({ id: recipientUserId }));
  mockDynamoDBQuery('connections-table', []);
  mockDynamoDBQuery('requests-table', []);
  mockDynamoDBPut('requests-table');

  // Act
  const result = await createConnectionRequest(initiatorUserId, {
    recipientUserId,
    note: 'Test note'
  });

  // Assert
  expect(result.success).toBe(true);
  expect(result.message).toBe('Connection request sent successfully');
  expectDynamoDBPut('requests-table', {
    initiatorUserId,
    recipientUserId,
    status: 'PENDING'
  });
});
```

### Test Naming Convention

- Use descriptive test names that explain the scenario
- Start with "should" for behavior tests
- Include the expected outcome
- Examples:
  - `should create connection request successfully`
  - `should reject note longer than 1000 characters`
  - `should prevent self-connections`

### Test Independence

- Each test should set up its own data
- Use `beforeEach` to reset mocks
- Don't rely on test execution order
- Clean up after tests in `afterEach`

### Assertion Clarity

- Use specific assertions
- Prefer `toBe` for primitives, `toEqual` for objects
- Use custom assertions for complex checks
- Include helpful error messages

## Future Considerations

### Potential Enhancements

1. **Snapshot Testing**: For complex object structures
2. **Performance Testing**: For critical paths
3. **Mutation Testing**: To verify test quality
4. **Visual Coverage Reports**: Integrated into CI/CD
5. **Test Parallelization**: For faster execution

### Maintenance Strategy

- Review and update tests when code changes
- Refactor tests to reduce duplication
- Keep test utilities up to date
- Monitor test execution time
- Remove obsolete tests

## References

- Jest Documentation: https://jestjs.io/
- aws-sdk-client-mock: https://github.com/m-radzikowski/aws-sdk-client-mock
- TypeScript Testing Best Practices: https://typescript-eslint.io/
- AWS Lambda Testing: https://docs.aws.amazon.com/lambda/latest/dg/testing-functions.html
