# Implementation Plan

- [x] 1. Create unified badge handler Lambda function
  - Create new Lambda function directory structure at `infrastructure/lambda/badge-handlers/unified-badge-handler/`
  - Implement main handler function that processes EventBridge events for both UserConnectionCountUpdated and ConnectionCreated
  - Set up TypeScript interfaces for all event types and badge structures
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 2. Implement threshold badge evaluation logic
  - Migrate threshold badge definitions from connections Lambda to unified handler
  - Implement evaluateThresholdBadges function that awards/removes badges based on connection count
  - Handle edge cases like users jumping multiple thresholds at once
  - _Requirements: 1.2, 1.4, 2.2_

- [x] 3. Consolidate VIP badge logic
  - Extract VIP badge logic from existing vip-badge handler
  - Implement evaluateVIPBadges function that checks for connections with 50+ connection users
  - Handle VIP badge removal when connections are removed
  - _Requirements: 1.1, 2.2, 3.3_

- [x] 4. Consolidate triangle badge logic
  - Extract triangle badge logic from existing triangle-badge handler
  - Implement evaluateTriangleBadges function that detects mutual connection triangles
  - Handle triangle badge removal when triangle connections are broken
  - _Requirements: 1.1, 2.2, 3.3_

- [x] 5. Consolidate maker badge logic
  - Extract maker badge logic from existing maker-badge handler
  - Implement evaluateMakerBadges function that awards badges for connecting with the maker user
  - Use environment variable for maker user ID configuration
  - _Requirements: 1.1, 2.2, 3.3_

- [x] 6. Consolidate early supporter badge logic
  - Extract early supporter badge logic from existing early-supporter-badge handler
  - Implement evaluateEarlySupporterBadges function that awards badges to first 10 connections of 500+ connection users
  - Handle the special case of exactly 500 connections trigger
  - _Requirements: 1.1, 2.2, 3.3_

- [x] 7. Consolidate event badge logic
  - Extract event badge logic from existing event-badge handler
  - Implement evaluateEventBadges function that awards re:Invent connector badges based on connection timing
  - Use configuration for event date ranges
  - _Requirements: 1.1, 2.2, 3.3_

- [x] 8. Implement unified badge processing orchestration
  - Create processAllBadgeTypes function that coordinates all badge evaluators
  - Implement badge change detection to minimize database updates
  - Add comprehensive error handling and logging for each badge type
  - _Requirements: 1.1, 1.5, 2.3, 2.4_

- [x] 9. Implement database operations and utilities
  - Create getUserWithConnections function that fetches user data and connection details
  - Implement updateUserBadges function with optimized DynamoDB operations
  - Add helper functions for badge comparison and change detection
  - _Requirements: 1.5, 3.2_

- [x] 10. Configure EventBridge integration
  - Update CDK infrastructure to create unified badge handler Lambda
  - Configure EventBridge rule to route both UserConnectionCountUpdated and ConnectionCreated events
  - Set up appropriate IAM permissions for DynamoDB and EventBridge access
  - _Requirements: 3.1, 3.5_

- [x] 11. Remove synchronous badge logic from connections Lambda
  - Remove checkAndAwardBadges function from connections/index.ts
  - Remove reevaluateBadges function and related threshold badge logic
  - Remove BADGE_DEFINITIONS constant and badge-related imports
  - _Requirements: 3.4_

- [x] 12. Remove individual badge handler Lambdas
  - Delete vip-badge, triangle-badge, maker-badge, early-supporter-badge, and event-badge handler directories
  - Remove corresponding EventBridge rules and CDK infrastructure
  - Update CDK stack to remove old badge handler resources
  - _Requirements: 3.4_

- [x] 13. Update badge stream processor if needed
  - Verify badge stream processor publishes all required events
  - Add ConnectionCreated event publishing if not already present
  - Ensure event payload includes all necessary data for badge evaluation
  - _Requirements: 3.1_

- [ ]* 14. Add comprehensive testing
  - Write unit tests for each badge evaluator function
  - Create integration tests for EventBridge event processing
  - Add tests for edge cases like multiple badge changes in one event
  - Test error handling and idempotency scenarios
  - _Requirements: 2.3, 2.4_

- [ ]* 15. Add monitoring and observability
  - Add CloudWatch metrics for badge processing success/failure rates
  - Implement structured logging for badge awarding and removal events
  - Add alerts for badge processing errors or timeouts
  - _Requirements: 2.3_