# Implementation Plan

- [x] 1. Update GraphQL schema and TypeScript types
  - Add `category` and `metadata` fields to Badge type in GraphQL schema
  - Add BadgeMetadata type to GraphQL schema
  - Update Badge and BadgeMetadata interfaces in `frontend/src/types.ts`
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 2. Create EventBridge infrastructure
  - Create EventBridge event bus in CDK stack
  - Define event patterns for ConnectionCreated and UserConnectionCountUpdated
  - Set up CloudWatch log group for event bus
  - _Requirements: 6.1, 6.2_

- [x] 3. Enable DynamoDB Streams and create stream processor
- [x] 3.1 Enable streams on DynamoDB tables
  - Enable DynamoDB Streams on Users table with NEW_AND_OLD_IMAGES
  - Enable DynamoDB Streams on Connections table with NEW_AND_OLD_IMAGES
  - _Requirements: 8.1, 8.2_

- [x] 3.2 Implement stream processor Lambda
  - Create `infrastructure/lambda/badge-stream-processor/index.ts`
  - Parse DynamoDB stream records for connection creation events
  - Parse DynamoDB stream records for user connection count updates
  - Publish events to EventBridge
  - Add error handling and logging
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 3.3 Configure stream processor in CDK
  - Create Lambda function in CDK stack
  - Grant EventBridge PutEvents permission
  - Connect Lambda to DynamoDB streams as event source
  - Set batch size and retry configuration
  - _Requirements: 6.4_

- [x] 4. Implement Maker Badge Handler
- [x] 4.1 Create maker badge handler Lambda
  - Create `infrastructure/lambda/badge-handlers/maker-badge/index.ts`
  - Implement logic to check if connected user is the maker
  - Implement logic to check if user already has the badge
  - Implement badge award logic with proper metadata
  - Add error handling and logging
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 4.2 Configure maker badge handler in CDK
  - Create Lambda function in CDK stack
  - Set MAKER_USER_ID environment variable
  - Grant DynamoDB read/write permissions on Users table
  - Create EventBridge rule to route ConnectionCreated events
  - Configure DLQ for failed events
  - _Requirements: 6.1, 6.2_

- [x] 5. Implement VIP Badge Handler
- [x] 5.1 Create VIP badge handler Lambda
  - Create `infrastructure/lambda/badge-handlers/vip-badge/index.ts`
  - Implement logic to check connected user's connection count
  - Implement logic to award new badge or update existing badge count
  - Add error handling and logging
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5.2 Configure VIP badge handler in CDK
  - Create Lambda function in CDK stack
  - Grant DynamoDB read/write permissions on Users table
  - Create EventBridge rule to route ConnectionCreated events
  - Configure DLQ for failed events
  - _Requirements: 6.4_

- [x] 6. Implement Triangle Badge Handler
- [x] 6.1 Create triangle badge handler Lambda
  - Create `infrastructure/lambda/badge-handlers/triangle-badge/index.ts`
  - Implement logic to query user's existing connections
  - Implement logic to query connected user's connections
  - Implement logic to find mutual connections
  - Implement badge award logic with triangle user metadata
  - Add error handling and logging
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6.2 Configure triangle badge handler in CDK
  - Create Lambda function in CDK stack
  - Grant DynamoDB read/write permissions on Users table
  - Grant DynamoDB read permissions on Connections table
  - Create EventBridge rule to route ConnectionCreated events
  - Configure DLQ for failed events
  - _Requirements: 6.4_

- [x] 7. Implement Event Badge Handler
- [x] 7.1 Create event badge handler Lambda
  - Create `infrastructure/lambda/badge-handlers/event-badge/index.ts`
  - Implement logic to parse REINVENT_DATES configuration
  - Implement logic to check if connection timestamp falls within event dates
  - Implement logic to check if user already has badge for specific year
  - Implement badge award logic with event year metadata
  - Add error handling and logging
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7.2 Configure event badge handler in CDK
  - Create Lambda function in CDK stack
  - Set REINVENT_DATES environment variable with sample data
  - Grant DynamoDB read/write permissions on Users table
  - Create EventBridge rule to route ConnectionCreated events
  - Configure DLQ for failed events
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 8. Implement Early Supporter Badge Handler
- [x] 8.1 Create early supporter badge handler Lambda
  - Create `infrastructure/lambda/badge-handlers/early-supporter-badge/index.ts`
  - Implement logic to check if connection count is exactly 1000
  - Implement logic to query and sort all user connections by creation date
  - Implement logic to get first 10 connections
  - Implement logic to award badge to each early supporter with metadata
  - Add error handling and logging
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 8.2 Configure early supporter badge handler in CDK
  - Create Lambda function in CDK stack
  - Grant DynamoDB read/write permissions on Users table
  - Grant DynamoDB read permissions on Connections table
  - Create EventBridge rule to route UserConnectionCountUpdated events
  - Configure DLQ for failed events
  - _Requirements: 6.4_

- [x] 9. Create badge icon assets
  - Create or source SVG icon for met-the-maker badge
  - Create or source SVG icon for early-supporter badge
  - Create or source SVG icon for vip-connection badge
  - Create or source SVG icon for triangle-complete badge
  - Create or source SVG icon for reinvent-connector badge
  - Add icons to `frontend/public/badge-images/` directory
  - _Requirements: 1.3, 2.3, 3.3, 4.3, 5.3_

- [x] 10. Update frontend badge display components
- [x] 10.1 Update BadgeDisplay component
  - Modify component to display badge category
  - Add rendering for badge metadata (related users, event years, counts)
  - Implement sorting logic to show special badges before threshold badges
  - Handle multiple instances of same badge type
  - Update styling for special badges
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 10.2 Update BadgeProgress component
  - Modify component to show progress only for threshold badges
  - Hide progress bars for special badges
  - Display special badges with "Earned" or "Not Earned" status
  - Update styling to differentiate badge types
  - _Requirements: 7.1, 7.2_

- [x] 11. Implement retroactive badge migration
- [x] 11.1 Create migration Lambda
  - Create `infrastructure/lambda/badge-migration/index.ts`
  - Implement logic to scan all users from DynamoDB
  - Implement logic to query all connections per user
  - Implement logic to publish ConnectionCreated events for each connection
  - Implement logic to publish UserConnectionCountUpdated events for users with 1000+ connections
  - Add batch processing and rate limiting
  - Add progress logging
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 11.2 Configure migration Lambda in CDK
  - Create Lambda function in CDK stack with increased timeout (15 minutes)
  - Grant DynamoDB read permissions on Users and Connections tables
  - Grant EventBridge PutEvents permission
  - Add CloudWatch log group
  - _Requirements: 8.4_

- [ ] 12. Add monitoring and observability
  - Create CloudWatch dashboard for badge system metrics
  - Add alarms for high error rates in badge handlers
  - Add alarm for DLQ message count
  - Add alarm for stream processing lag
  - Configure log retention policies
  - _Requirements: 6.4_

- [ ] 13. Update documentation
  - Document new badge types and how they're earned
  - Document configuration parameters (MAKER_USER_ID, REINVENT_DATES)
  - Document event-driven architecture
  - Document how to run migration Lambda
  - Add troubleshooting guide for badge issues
  - _Requirements: 6.1, 6.2, 6.3_
