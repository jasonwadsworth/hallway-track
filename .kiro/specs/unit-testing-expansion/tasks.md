# Implementation Plan

-   [ ] 1. Set up test utilities infrastructure

    -   Create `infrastructure/__tests__/utils/` directory structure
    -   Implement reusable test utilities for factories, mocks, and assertions
    -   _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.3, 6.4, 6.5_

-   [ ] 1.1 Create test factory functions

    -   Implement `test-factories.ts` with factory functions for User, ConnectionRequest, Connection, and ContactLink
    -   Include sensible defaults and override capabilities
    -   Add TypeScript types and JSDoc documentation
    -   _Requirements: 6.1, 6.4, 6.5_

-   [ ] 1.2 Create mock helper functions

    -   Implement `mock-helpers.ts` with functions for mocking DynamoDB operations (Get, Put, Update, Query, Delete)
    -   Add EventBridge mocking helpers
    -   Include reset functionality for test isolation
    -   _Requirements: 3.3, 6.2, 6.4, 6.5_

-   [ ] 1.3 Create DynamoDB assertion utilities

    -   Implement `dynamodb-assertions.ts` with custom assertions for verifying DynamoDB operations
    -   Add assertions for EventBridge events
    -   Provide readable error messages
    -   _Requirements: 6.3, 6.4, 6.5_

-   [ ] 2. Implement connection requests Lambda tests

    -   Create comprehensive unit tests for the connection requests Lambda function
    -   Cover all CRUD operations and validation logic
    -   _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.2_

-   [ ] 2.1 Test connection request creation

    -   Write tests for creating connection requests with valid data
    -   Test note length validation (max 1000 characters)
    -   Test tag validation (max 50 characters per tag, non-empty)
    -   Test prevention of self-connections
    -   Test checking for existing connections
    -   Test detection of duplicate pending requests
    -   _Requirements: 1.1, 1.2, 1.3, 1.4, 5.2_

-   [ ] 2.2 Test connection request approval workflow

    -   Write tests for approving connection requests
    -   Test authorization checks (only recipient can approve)
    -   Test status validation (only PENDING requests can be approved)
    -   Test EventBridge event emission
    -   Test error handling for non-existent requests
    -   _Requirements: 1.1, 1.2, 1.3, 1.4, 5.2_

-   [ ] 2.3 Test connection request denial and cancellation

    -   Write tests for denying connection requests
    -   Write tests for cancelling connection requests
    -   Test authorization checks for both operations
    -   Test status validation
    -   Test record deletion
    -   _Requirements: 1.1, 1.2, 1.3, 1.4, 5.2_

-   [ ] 2.4 Test connection request metadata updates

    -   Write tests for updating connection request notes and tags
    -   Test validation rules for metadata
    -   Test removal of metadata (empty values)
    -   Test authorization (only initiator can update)
    -   _Requirements: 1.1, 1.2, 1.3, 1.4, 5.2_

-   [ ] 2.5 Test connection request queries

    -   Write tests for getting incoming connection requests
    -   Write tests for getting outgoing connection requests
    -   Test metadata sanitization for incoming requests
    -   Test sorting (most recent first)
    -   _Requirements: 1.1, 1.2, 1.3, 5.2_

-   [ ] 2.6 Test connection status checking

    -   Write tests for checkConnectionOrRequest function
    -   Test detection of existing connections
    -   Test detection of pending requests in both directions
    -   Test request direction identification
    -   _Requirements: 1.1, 1.2, 1.3, 5.2_

-   [ ] 3. Implement contact links Lambda tests

    -   Create unit tests for the contact links Lambda function
    -   Cover update and removal operations
    -   _Requirements: 1.1, 1.2, 1.3, 1.4, 5.4_

-   [ ] 3.1 Test contact link updates

    -   Write tests for updating contact link label
    -   Write tests for updating contact link URL
    -   Write tests for updating contact link visibility
    -   Test partial updates (only provided fields)
    -   Test DynamoDB update operations
    -   _Requirements: 1.1, 1.2, 1.3, 1.4, 5.4_

-   [ ] 3.2 Test contact link removal

    -   Write tests for removing contact links
    -   Test error handling for non-existent links
    -   Test DynamoDB update operations
    -   Verify user record is updated correctly
    -   _Requirements: 1.1, 1.2, 1.3, 1.4, 5.4_

-   [ ] 3.3 Test contact link error scenarios

    -   Write tests for unauthorized access attempts
    -   Write tests for missing user records
    -   Write tests for DynamoDB errors
    -   Verify error messages are descriptive
    -   _Requirements: 1.1, 1.2, 1.3, 1.4, 5.4_

-   [ ] 4. Implement badge stream processor Lambda tests

    -   Create unit tests for the badge stream processor Lambda function
    -   Cover event processing and EventBridge publishing
    -   _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1_

-   [ ] 4.1 Test connection creation event processing

    -   Write tests for processing connection creation events from DynamoDB streams
    -   Test EventBridge event payload structure
    -   Test extraction of connection data from stream records
    -   _Requirements: 1.1, 1.2, 1.3, 5.1_

-   [ ] 4.2 Test connection count update event processing

    -   Write tests for processing user connection count updates
    -   Test detection of count changes
    -   Test EventBridge event payload for count updates
    -   Test ignoring records with no count change
    -   _Requirements: 1.1, 1.2, 1.3, 5.1_

-   [ ] 4.3 Test stream record filtering

    -   Write tests for ignoring irrelevant stream records
    -   Test handling of multiple records in a batch
    -   Test processing only INSERT and MODIFY events
    -   _Requirements: 1.1, 1.2, 1.3, 5.1_

-   [ ] 4.4 Test EventBridge publishing

    -   Write tests for publishing events to EventBridge
    -   Test batch event publishing
    -   Test error handling for EventBridge failures
    -   _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1_

-   [ ] 5. Implement badge calculation logic tests

    -   Create unit tests for badge awarding logic
    -   Expand existing integration tests into focused unit tests
    -   _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1_

-   [ ] 5.1 Test threshold badge logic

    -   Write tests for first-connection badge (1 connection)
    -   Write tests for connector badge (5 connections)
    -   Write tests for networker badge (10 connections)
    -   Test multiple badge awarding at thresholds
    -   Test prevention of duplicate badges
    -   _Requirements: 1.1, 1.2, 1.3, 5.1_

-   [ ] 5.2 Test special badge logic

    -   Write tests for VIP badge (connecting with high-connection user)
    -   Write tests for met-the-maker badge
    -   Write tests for reinvent-connector badge (event date validation)
    -   Write tests for early-supporter badge (first 10 connections when user reaches 500)
    -   _Requirements: 1.1, 1.2, 1.3, 5.1_

-   [ ] 5.3 Test triangle badge detection

    -   Write tests for detecting complete triangles
    -   Write tests for incomplete triangle scenarios
    -   Test mutual connection verification
    -   _Requirements: 1.1, 1.2, 1.3, 5.1_

-   [ ] 5.4 Test badge re-evaluation on connection removal

    -   Write tests for removing badges when count drops below threshold
    -   Write tests for retaining valid badges
    -   Test badge list updates
    -   _Requirements: 1.1, 1.2, 1.3, 5.1_

-   [ ] 6. Update Jest configuration and npm scripts

    -   Verify Jest configuration supports all test patterns
    -   Ensure coverage thresholds are set appropriately
    -   Update npm scripts if needed
    -   _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5_

-   [ ] 6.1 Verify Jest configuration

    -   Check that Jest is configured to find all test files
    -   Verify ts-jest preset is working correctly
    -   Ensure coverage collection includes all Lambda functions
    -   _Requirements: 3.1, 3.2, 3.3, 4.3_

-   [ ] 6.2 Set coverage thresholds

    -   Configure coverage thresholds in jest.config.js (60% overall, 80% for critical logic)
    -   Exclude type definitions and index files from coverage
    -   _Requirements: 4.3_

-   [ ] 6.3 Verify npm test scripts

    -   Ensure `npm test` runs all tests
    -   Ensure `npm run test:watch` works in watch mode
    -   Ensure `npm run test:coverage` generates coverage reports
    -   _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

-   [ ] 7. Run full test suite and validate

    -   Execute all tests to ensure they pass
    -   Generate coverage report
    -   Verify coverage meets goals
    -   _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

-   [ ] 7.1 Run tests and fix any failures

    -   Execute `npm test` and address any failing tests
    -   Ensure all tests are independent and can run in any order
    -   Verify test execution time is reasonable (< 30 seconds)
    -   _Requirements: 1.5, 4.1, 4.4, 4.5_

-   [ ] 7.2 Generate and review coverage report

    -   Run `npm run test:coverage`
    -   Review coverage report for gaps
    -   Verify critical logic has adequate coverage
    -   _Requirements: 4.3_

-   [ ] 7.3 Document test utilities usage
    -   Add README or comments explaining how to use test utilities
    -   Provide examples of common testing patterns
    -   Document mock helper functions
    -   _Requirements: 6.5_
