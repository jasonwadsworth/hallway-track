# Implementation Plan

- [x] 1. Update GraphQL schema with new types and queries
  - Add `ConnectedProfile` type with full profile data fields
  - Update `PublicProfile` type to contain only minimal fields (id, displayName, gravatarHash)
  - Add `getConnectedProfile` query that returns `ConnectedProfile`
  - Update existing `getPublicProfile` query to return minimal `PublicProfile`
  - _Requirements: 1.1, 1.5, 3.3_

- [x] 2. Modify existing public profile resolver for minimal data
  - [x] 2.1 Update public-profile Lambda to return only minimal profile data
    - Remove contact links and badges from response
    - Keep only id, displayName, and gravatarHash fields
    - Remove connection verification logic (not needed for public profiles)
    - _Requirements: 1.2, 2.1_

  - [x] 2.2 Update resolver mapping in CDK infrastructure
    - Ensure getPublicProfile query maps to updated resolver
    - _Requirements: 1.5_

- [x] 3. Create new connected profile resolver with authorization
  - [x] 3.1 Create connected-profile Lambda function
    - Implement connection verification using existing patterns from connections Lambda
    - Add logic to check if requesting user is viewing own profile (always allow)
    - Add logic to verify bidirectional connection exists for other users
    - Return authorization error if users are not connected
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3_

  - [x] 3.2 Implement connection verification helper function
    - Query connections table to check if bidirectional connection exists
    - Handle database errors gracefully with appropriate error responses
    - Reuse existing connection query patterns from connections/index.ts
    - _Requirements: 2.2, 2.3, 3.4_

  - [x] 3.3 Add comprehensive error handling
    - Throw NOT_CONNECTED error for unauthorized access attempts
    - Handle missing authentication context
    - Log authorization failures for security monitoring
    - _Requirements: 2.4, 3.5_

  - [x] 3.4 Wire up connected profile resolver in CDK
    - Create Lambda function resource in infrastructure
    - Add environment variables for connections table access
    - Map getConnectedProfile query to new resolver
    - _Requirements: 1.5, 3.3_

- [x] 4. Update frontend components to use appropriate queries
  - [x] 4.1 Update connection-related components to use getConnectedProfile
    - Modify ConnectionCard component to use getConnectedProfile query
    - Update ConnectionDetail component for full profile access
    - Handle authorization errors gracefully in UI
    - _Requirements: 1.4, 1.5_

  - [x] 4.2 Update public profile components to use minimal getPublicProfile
    - Ensure QR code scanning and public profile viewing use getPublicProfile
    - Remove contact links display from public profile views
    - Update error handling for different query types
    - _Requirements: 1.2, 3.5_

- [x] 5. Add security logging and monitoring
  - [x] 5.1 Implement audit logging for profile access attempts
    - Log successful connected profile access with user IDs
    - Log authorization failures with requesting user context
    - Include timestamp and connection status in logs
    - _Requirements: 2.4, 3.5_

  - [x] 5.2 Add CloudWatch metrics for privacy protection
    - Track authorization failure rates
    - Monitor connection verification performance
    - Alert on unusual access patterns
    - _Requirements: 2.4_

- [ ]* 6. Add comprehensive testing for privacy protection
  - [ ]* 6.1 Write unit tests for connection verification logic
    - Test bidirectional connection detection
    - Test own profile access (should always succeed)
    - Test non-connected user access (should fail with authorization error)
    - Test database error handling
    - _Requirements: 2.2, 2.3, 3.4_

  - [ ]* 6.2 Write integration tests for end-to-end privacy protection
    - Test complete flow from frontend query to backend authorization
    - Verify contact links are not accessible without connection
    - Test connection creation enables profile access
    - Validate error responses match expected format
    - _Requirements: 1.1, 1.2, 1.3_