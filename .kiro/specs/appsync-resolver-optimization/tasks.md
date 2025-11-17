# Implementation Plan

- [x] 1. Create event handler infrastructure
  - Create EventBridge rules for ConnectionRemoved and ConnectionRequestApproved events
  - Set up Dead Letter Queue for failed events
  - Configure CloudWatch alarms for DLQ messages
  - _Requirements: 1.4, 1.6, 4.4, 4.6_

- [x] 1.1 Create ConnectionRemovedHandler Lambda
  - Write Lambda function to handle ConnectionRemoved events
  - Implement reciprocal connection deletion logic
  - Implement connection count updates for both users
  - Emit badge re-evaluation events
  - Add idempotency using event ID
  - _Requirements: 1.4, 1.5, 1.6_

- [x] 1.2 Create ConnectionRequestApprovedHandler Lambda
  - Write Lambda function to handle ConnectionRequestApproved events
  - Implement bidirectional connection creation
  - Implement metadata transfer to initiator's connection
  - Implement connection count updates for both users
  - Emit badge awarding events
  - Add idempotency using event ID
  - _Requirements: 4.4, 4.5, 4.6_

- [x] 1.3 Add EventBridge rules to CDK stack
  - Define EventBridge rule for ConnectionRemoved events
  - Define EventBridge rule for ConnectionRequestApproved events
  - Configure Lambda targets with retry and DLQ settings
  - Grant necessary IAM permissions
  - _Requirements: 1.4, 4.4_

- [x] 2. Implement field resolvers for data fetching
  - Create field resolvers to separate data fetching from business logic
  - Implement batching using DataLoader pattern
  - Handle missing data gracefully
  - _Requirements: 2.2, 2.3, 2.4, 2.6, 5.3, 5.4, 5.5, 5.6_

- [x] 2.1 Create Connection.connectedUser field resolver
  - Write Lambda function for Connection.connectedUser field
  - Implement DataLoader for batching user lookups
  - Handle missing users by returning null
  - Add error logging
  - _Requirements: 2.2, 2.3, 2.4, 2.6_

- [x] 2.2 Create ConnectionRequest field resolvers
  - Write Lambda function for ConnectionRequest.initiator field
  - Write Lambda function for ConnectionRequest.recipient field
  - Implement DataLoader for batching user lookups
  - Add metadata sanitization for recipient field resolver
  - Handle missing users by returning null
  - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 2.3 Register field resolvers in CDK stack
  - Add field resolver for Connection.connectedUser
  - Add field resolver for ConnectionRequest.initiator
  - Add field resolver for ConnectionRequest.recipient
  - Configure AppSync data sources
  - _Requirements: 2.2, 5.3, 5.4_

- [x] 3. Refactor removeConnection mutation
  - Simplify resolver to focus on deleting user's connection
  - Emit ConnectionRemoved event
  - Remove synchronous reciprocal deletion logic
  - Remove synchronous count update logic
  - Remove synchronous badge re-evaluation logic
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3.1 Update removeConnection Lambda function
  - Simplify to delete only user's connection record
  - Add EventBridge client for event emission
  - Emit ConnectionRemoved event with userId and connectedUserId
  - Remove reciprocal connection deletion code
  - Remove connection count update code
  - Remove badge re-evaluation code
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 4. Refactor approveConnectionRequest mutation
  - Simplify resolver to focus on deleting request record
  - Emit ConnectionRequestApproved event
  - Remove synchronous connection creation logic
  - Remove synchronous metadata transfer logic
  - Remove synchronous count update logic
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4.1 Update approveConnectionRequest Lambda function
  - Simplify to delete only request record
  - Add EventBridge client for event emission
  - Emit ConnectionRequestApproved event with request details
  - Remove connection creation code
  - Remove metadata transfer code
  - Remove count update code
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 5. Refactor updateConnectionNote mutation
  - Update to always use SET operation
  - Accept empty strings as valid note values
  - Remove conditional REMOVE logic
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 5.1 Update updateConnectionNote Lambda function
  - Change to always use SET operation for notes
  - Store empty string for cleared notes
  - Remove conditional REMOVE expression logic
  - Maintain note length validation (max 1000 characters)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 6. Refactor query resolvers to use field resolvers
  - Update queries to return data without embedded user objects
  - Remove inline user data fetching loops
  - Rely on field resolvers for user data
  - _Requirements: 2.1, 2.5, 5.1, 5.2, 5.8_

- [x] 6.1 Update getMyConnections Lambda function
  - Remove inline user data fetching loop
  - Return connection records without connectedUser field
  - Let field resolver handle user data fetching
  - _Requirements: 2.1, 2.5_

- [x] 6.2 Update getIncomingConnectionRequests Lambda function
  - Remove inline initiator user data fetching loop
  - Remove metadata sanitization logic (move to field resolver)
  - Return request records without initiator field
  - Let field resolver handle user data fetching and sanitization
  - _Requirements: 5.1, 5.7, 5.8_

- [x] 6.3 Update getOutgoingConnectionRequests Lambda function
  - Remove inline recipient user data fetching loop
  - Return request records without recipient field
  - Let field resolver handle user data fetching
  - _Requirements: 5.2, 5.8_

- [x] 7. Add monitoring and observability
  - Create CloudWatch dashboards for key metrics
  - Set up CloudWatch alarms for failures
  - Add custom metrics for event processing
  - Configure X-Ray tracing
  - _Requirements: Non-functional requirements (Monitoring)_

- [x] 7.1 Add CloudWatch metrics and alarms
  - Create custom metrics for event processing
  - Create alarm for DLQ message count
  - Create alarm for event handler error rate
  - Create alarm for field resolver error rate
  - _Requirements: Non-functional requirements (Monitoring)_

- [x] 7.2 Add structured logging
  - Add structured logs to event handlers
  - Add structured logs to field resolvers
  - Add correlation IDs for tracing
  - Create CloudWatch Insights queries
  - _Requirements: Non-functional requirements (Monitoring)_

- [x] 8. Deploy and validate
  - Deploy infrastructure changes
  - Run integration tests
  - Verify event processing
  - Monitor for errors
  - _Requirements: All requirements_

- [x] 8.1 Deploy CDK stack changes
  - Deploy EventBridge rules and event handlers
  - Deploy field resolvers
  - Deploy refactored mutations
  - Verify CloudFormation stack update
  - _Requirements: All requirements_

- [x] 8.2 Validate event-driven flows
  - Test removeConnection end-to-end flow
  - Test approveConnectionRequest end-to-end flow
  - Verify reciprocal operations complete asynchronously
  - Verify connection counts remain accurate
  - Check CloudWatch logs for event processing
  - _Requirements: 1.4, 1.5, 1.6, 4.4, 4.5, 4.6_

- [x] 8.3 Validate field resolver functionality
  - Test getMyConnections with field resolver
  - Test getIncomingConnectionRequests with field resolver
  - Test getOutgoingConnectionRequests with field resolver
  - Verify batching reduces DynamoDB queries
  - Verify metadata sanitization works correctly
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 8.4 Validate updateConnectionNote changes
  - Test setting note to non-empty value
  - Test clearing note with empty string
  - Verify SET operation used consistently
  - Verify note length validation still works
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
