# Design Document

## Overview

This design implements contact link privacy protection at the API level by modifying the `getPublicProfile` resolver to verify connection status before returning contact links. The solution ensures that contact information is only accessible to connected users, preventing unauthorized access through API calls.

## Architecture

### Current State Analysis

The current `getPublicProfile` resolver returns a single `PublicProfile` type that includes contact links filtered only by the `visible` flag. This creates a security vulnerability where any authenticated user can access visible contact links of any other user, regardless of connection status.

### Proposed Changes

1. **Type Separation**: Create distinct `PublicProfile` and `ConnectedProfile` types
2. **Connection-Based Routing**: Return different profile types based on connection status
3. **Schema Updates**: Update GraphQL schema to reflect the new type structure
4. **Privacy by Design**: Ensure truly public profiles contain minimal information

## Components and Interfaces

### GraphQL Schema Changes

**New Types**:
```graphql
type PublicProfile {
  id: ID!
  displayName: String!
  gravatarHash: String!
}

type ConnectedProfile {
  id: ID!
  displayName: String!
  gravatarHash: String!
  contactLinks: [ContactLink!]!
  badges: [Badge!]!
}
```

**Updated Queries**:
```graphql
type Query {
  # Public profile - always accessible, minimal data
  getPublicProfile(userId: ID!): PublicProfile

  # Connected profile - requires connection, full data
  getConnectedProfile(userId: ID!): ConnectedProfile
}
```

### Separate Profile Resolvers

**File**: `infrastructure/lambda/public-profile/index.ts` (modified)
- Handles `getPublicProfile` query
- Returns minimal profile data (id, displayName, gravatarHash)
- No connection verification needed
- Always accessible to authenticated users

**File**: `infrastructure/lambda/connected-profile/index.ts` (new)
- Handles `getConnectedProfile` query
- Requires connection verification before returning data
- Returns full profile data including contact links and badges
- Throws authorization error if users are not connected

### Connection Verification Function

**Function**: `checkConnectionExists(requestingUserId: string, profileUserId: string): Promise<boolean>`

**Purpose**: Verify if a bidirectional connection exists between two users

**Implementation**:
```typescript
async function checkConnectionExists(requestingUserId: string, profileUserId: string): Promise<boolean> {
  // Query connections table to verify bidirectional connection
  const result = await docClient.send(
    new QueryCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${requestingUserId}`,
        ':sk': 'CONNECTION#',
      },
    })
  );

  // Check if any connection has the profileUserId
  return (result.Items || []).some(
    (item: Record<string, unknown>) => item.connectedUserId === profileUserId
  );
}
```

### Connected Profile Authorization Logic

**Logic Flow for `getConnectedProfile`**:
1. Extract requesting user ID from event identity
2. Check if requesting user is viewing their own profile (always allow)
3. If viewing another user's profile, verify bidirectional connection exists
4. If not connected, throw authorization error
5. If connected, return full profile data with visible contact links
6. Log access attempts for security monitoring

**Logic Flow for `getPublicProfile`**:
1. Validate user exists
2. Return minimal profile data (no authorization checks needed)
3. Log public profile access

## Data Models

### Separated Profile Types

```typescript
// Truly public profile - minimal information for non-connected users
interface PublicProfile {
  id: string;
  displayName: string;
  gravatarHash: string;
}

// Connected profile - full information for connected users
interface ConnectedProfile {
  id: string;
  displayName: string;
  gravatarHash: string;
  contactLinks: ContactLink[];
  badges: Badge[];
}


```

### Connection Verification Result

```typescript
interface ConnectionVerificationResult {
  isConnected: boolean;
  error?: string;
}
```

## Error Handling

### Connection Verification Failures

1. **Database Errors**: Log error and throw connection verification failed error
2. **Missing User Identity**: Throw authentication required error
3. **Invalid User IDs**: Validate input parameters and return appropriate error messages

### Authorization Errors

- `getConnectedProfile` throws explicit authorization errors for non-connected users
- Clear error messages indicate connection requirement
- No fallback to partial data exposure

### Graceful Degradation

- `getPublicProfile` remains available even if connection verification is down
- System errors are logged and monitored
- API remains responsive with clear error boundaries

### Response Patterns

```typescript
// getPublicProfile - always succeeds for valid users
{
  id: "user123",
  displayName: "John Doe",
  gravatarHash: "abc123"
}

// getConnectedProfile - success for connected users
{
  id: "user123",
  displayName: "John Doe",
  gravatarHash: "abc123",
  contactLinks: [...],
  badges: [...]
}

// getConnectedProfile - authorization error for non-connected users
{
  error: "Not authorized to view this user's connected profile",
  code: "NOT_CONNECTED"
}

// System error (connection verification failed)
{
  error: "Unable to verify connection status",
  code: "CONNECTION_VERIFICATION_FAILED"
}
```

## Testing Strategy

### Unit Tests

1. **Connection Verification Tests**:
   - Test with existing bidirectional connection
   - Test with no connection
   - Test with database errors
   - Test with invalid user IDs

2. **Profile Type Selection Tests**:
   - Test own profile access (should return ConnectedProfile)
   - Test connected user profile access (should return ConnectedProfile)
   - Test non-connected user profile access (should return PublicProfile)
   - Test with mixed visibility settings on contact links

3. **Error Handling Tests**:
   - Test connection table unavailable
   - Test malformed user IDs
   - Test missing authentication context

### Integration Tests

1. **End-to-End Privacy Protection**:
   - Create two users without connection
   - Verify only PublicProfile is returned (no contact links or badges)
   - Create connection between users
   - Verify ConnectedProfile is returned with full data

2. **Performance Tests**:
   - Measure impact of connection verification on response time
   - Test with large numbers of connections
   - Verify database query efficiency

### Security Tests

1. **Authorization Bypass Attempts**:
   - Test with manipulated user IDs
   - Test with expired authentication tokens
   - Test with cross-user access attempts

2. **Data Leakage Prevention**:
   - Verify PublicProfile contains only minimal data
   - Test error messages don't leak user information
   - Validate audit logs capture privacy protection events

## Implementation Phases

### Phase 1: Core Privacy Protection
- Create new `getConnectedProfile` resolver with connection verification
- Modify existing `getPublicProfile` resolver to return minimal data only
- Update GraphQL schema with new query and types
- Add basic error handling and logging

### Phase 2: Enhanced Security
- Add comprehensive audit logging
- Implement performance optimizations
- Add detailed error handling for edge cases

### Phase 3: Monitoring and Validation
- Add metrics for privacy protection events
- Implement automated security testing
- Performance monitoring and optimization

## Security Considerations

### Authentication Requirements
- All requests must include valid user authentication
- User identity must be extracted from event.identity.sub
- Invalid or missing authentication results in privacy protection

### Data Access Patterns
- Connection verification uses existing DynamoDB access patterns
- No new sensitive data exposure through error messages
- Audit logs exclude sensitive user information

### Privacy by Default
- Default behavior is privacy protection (empty contact links)
- Explicit connection verification required for data access
- No fallback to less secure behavior on errors

## Performance Considerations

### Database Query Optimization
- Reuse existing connection query patterns from `connections/index.ts`
- Single query to verify connection status
- Efficient key-based lookups using existing table structure

### Caching Strategy
- Consider caching connection status for frequently accessed profiles
- Cache invalidation on connection changes
- Balance between performance and data freshness

### Response Time Impact
- Additional database query adds ~10-20ms to response time
- Acceptable trade-off for security enhancement
- Monitor and optimize if performance issues arise

## Monitoring and Observability

### Audit Logging
```typescript
interface PrivacyAuditLog {
  timestamp: string;
  requestingUserId: string;
  profileUserId: string;
  connectionExists: boolean;
  contactLinksReturned: number;
  privacyProtectionApplied: boolean;
}
```

### Metrics to Track
- Privacy protection events per hour
- Connection verification success/failure rates
- Response time impact of privacy checks
- Failed connection verification attempts

### Alerting
- High rate of privacy protection events (potential abuse)
- Connection verification failures (system issues)
- Unusual access patterns (security monitoring)