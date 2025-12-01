# Design Document: Connection Leaderboard

## Overview

The Connection Leaderboard feature displays a ranked list of users based on their connection counts, encouraging networking and community engagement. The
leaderboard leverages the existing `connectionCount` field in the User table and provides an efficient query mechanism using DynamoDB Global Secondary Index
(GSI). The feature includes both a full leaderboard view and personalized user ranking information.

## Architecture

The leaderboard follows a serverless architecture pattern consistent with the existing Hallway Track system:

```
┌─────────────────┐
│  React Frontend │
│   (TypeScript)  │
└────────┬────────┘
         │ GraphQL Query
         │ (getLeaderboard)
         ▼
┌─────────────────┐
│  AWS AppSync    │
│  GraphQL API    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Lambda Function│
│  (Leaderboard)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DynamoDB GSI   │
│  (ByConnection  │
│   Count)        │
└─────────────────┘
```

### Key Design Decisions

1. **GSI for Efficient Queries**: Create a new GSI on the Users table to enable efficient querying by connection count in descending order
2. **Lambda-Based Resolver**: Use a Lambda function to handle the complex query logic and ranking calculations
3. **Pagination Support**: Implement pagination to handle large result sets efficiently
4. **Caching Strategy**: Leverage AppSync caching to reduce database load for frequently accessed leaderboard data
5. **Minimum Threshold**: Only include users with at least 1 connection to keep the leaderboard meaningful

## Components and Interfaces

### GraphQL Schema Extensions

```graphql
type LeaderboardEntry {
    rank: Int!
    userId: ID!
    displayName: String!
    profilePictureUrl: String
    uploadedProfilePictureUrl: String
    gravatarHash: String!
    connectionCount: Int!
    isCurrentUser: Boolean!
}

type LeaderboardResult {
    entries: [LeaderboardEntry!]!
    currentUserEntry: LeaderboardEntry
    hasMore: Boolean!
    nextToken: String
}

type Query {
    getLeaderboard(limit: Int, nextToken: String): LeaderboardResult!
}
```

### DynamoDB Schema Changes

**New GSI on Users Table**: `ByConnectionCount`

-   **Partition Key**: `GSI2PK` (String) - Static value "LEADERBOARD" for all users
-   **Sort Key**: `GSI2SK` (String) - Format: `{paddedConnectionCount}#{userId}`
    -   Connection count is zero-padded to 10 digits for proper sorting (e.g., "0000000042#user-123")
    -   Sorted in descending order by using inverted count: `9999999999 - connectionCount`

**Users Table Item Updates**:

```typescript
{
  PK: "USER#{userId}",
  SK: "PROFILE",
  // ... existing fields
  connectionCount: 42,
  GSI2PK: "LEADERBOARD",  // New field
  GSI2SK: "9999999957#user-123"  // New field (9999999999 - 42)
}
```

### Lambda Function Interface

```typescript
interface LeaderboardQueryInput {
    limit?: number; // Default: 10, Max: 100
    nextToken?: string;
    currentUserId: string; // From Cognito context
}

interface LeaderboardQueryOutput {
    entries: LeaderboardEntry[];
    currentUserEntry?: LeaderboardEntry;
    hasMore: boolean;
    nextToken?: string;
}
```

## Data Models

### LeaderboardEntry

```typescript
interface LeaderboardEntry {
    rank: number;
    userId: string;
    displayName: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
    gravatarHash: string;
    connectionCount: number;
    isCurrentUser: boolean;
}
```

### DynamoDB Query Pattern

**Query for Top N Users**:

```typescript
{
  TableName: 'hallway-track-users',
  IndexName: 'ByConnectionCount',
  KeyConditionExpression: 'GSI2PK = :pk',
  ExpressionAttributeValues: {
    ':pk': 'LEADERBOARD'
  },
  ScanIndexForward: true,  // Ascending order (inverted counts)
  Limit: limit
}
```

**Query for Specific User's Rank**:

```typescript
{
  TableName: 'hallway-track-users',
  IndexName: 'ByConnectionCount',
  KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK < :userSK',
  ExpressionAttributeValues: {
    ':pk': 'LEADERBOARD',
    ':userSK': userGSI2SK
  },
  Select: 'COUNT'
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system
should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property 1: Leaderboard entries are sorted by connection count in descending order

_For any_ set of users with varying connection counts, when the leaderboard is queried, the returned entries should be ordered such that each entry's connection
count is greater than or equal to the next entry's connection count.

**Validates: Requirements 1.1**

### Property 2: All leaderboard entries contain required fields

_For any_ leaderboard entry returned by the system, the entry should contain non-null values for rank, userId, displayName, gravatarHash, and connectionCount
fields.

**Validates: Requirements 1.2**

### Property 3: Users with identical connection counts receive identical ranks

_For any_ set of users where multiple users have the same connection count, all users with that connection count should be assigned the same rank value.

**Validates: Requirements 1.3**

### Property 4: Leaderboard excludes users with zero connections

_For any_ leaderboard query result, no entry should have a connectionCount value of zero.

**Validates: Requirements 1.5**

### Property 5: Current user is correctly identified in results

_For any_ leaderboard query where the current user appears in the returned entries, exactly one entry should have isCurrentUser set to true, and that entry's
userId should match the requesting user's ID.

**Validates: Requirements 2.1**

### Property 6: Current user entry is provided when not in top results

_For any_ leaderboard query where the current user has at least 1 connection but does not appear in the main entries list, the currentUserEntry field should be
populated with the user's rank and connection count.

**Validates: Requirements 2.2**

### Property 7: Leaderboard data reflects current database state

_For any_ user in the leaderboard results, the connectionCount value in the leaderboard entry should match the connectionCount value stored in the database for
that user.

**Validates: Requirements 3.3**

## Error Handling

### Input Validation

-   **Invalid Limit**: If limit is less than 1 or greater than 100, return error "Limit must be between 1 and 100"
-   **Invalid NextToken**: If nextToken is malformed or expired, return error "Invalid pagination token"
-   **Unauthenticated Request**: If user is not authenticated, return standard AppSync authentication error

### Database Errors

-   **DynamoDB Throttling**: Implement exponential backoff with up to 3 retries
-   **GSI Not Ready**: Return error "Leaderboard temporarily unavailable" if GSI is still being created
-   **Query Timeout**: Return partial results with error message if query exceeds timeout

### Edge Cases

-   **Empty Leaderboard**: If no users have connections, return empty entries array with appropriate message
-   **Single User**: If only one user has connections, return single-entry leaderboard
-   **Current User Not Found**: If current user doesn't exist in database, still return leaderboard but without currentUserEntry

## Testing Strategy

### Unit Tests

Unit tests will verify specific examples and edge cases:

1. **Empty leaderboard**: Verify system handles case where no users have connections
2. **Single user**: Verify leaderboard works with only one user
3. **Pagination boundaries**: Test first page, middle page, and last page scenarios
4. **Rank calculation with ties**: Verify correct rank assignment when multiple users have same count
5. **Current user highlighting**: Test cases where current user is in results vs. not in results
6. **Error handling**: Test invalid inputs, missing data, and database errors

### Property-Based Tests

Property-based tests will verify universal properties across many randomly generated inputs:

1. **Sorting property**: Generate random user sets and verify descending order
2. **Required fields property**: Generate random users and verify all fields are present
3. **Tie-breaking property**: Generate users with duplicate counts and verify same ranks
4. **Exclusion property**: Generate users including zero-connection users and verify exclusion
5. **Current user identification**: Generate random leaderboards and verify correct isCurrentUser flag
6. **Data consistency property**: Verify leaderboard data matches database state

**Testing Framework**: We will use **fast-check** for property-based testing in TypeScript/Node.js.

**Test Configuration**: Each property-based test will run a minimum of 100 iterations to ensure thorough coverage of the input space.

### Integration Tests

1. **End-to-end leaderboard query**: Test full GraphQL query through AppSync
2. **GSI query performance**: Verify query completes within acceptable time limits
3. **Cache behavior**: Verify AppSync caching reduces database queries
4. **Concurrent access**: Test leaderboard under concurrent user requests

## Implementation Notes

### GSI Update Strategy

When a user's connection count changes, the GSI2PK and GSI2SK fields must be updated:

```typescript
async function updateUserConnectionCount(userId: string, newCount: number): Promise<void> {
    const invertedCount = 9999999999 - newCount;
    const paddedCount = invertedCount.toString().padStart(10, '0');

    await dynamodb.update({
        TableName: 'hallway-track-users',
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        UpdateExpression: 'SET connectionCount = :count, GSI2PK = :gsi2pk, GSI2SK = :gsi2sk, updatedAt = :now',
        ExpressionAttributeValues: {
            ':count': newCount,
            ':gsi2pk': 'LEADERBOARD',
            ':gsi2sk': `${paddedCount}#${userId}`,
            ':now': new Date().toISOString(),
        },
    });
}
```

### Rank Calculation Algorithm

```typescript
function calculateRanks(entries: RawLeaderboardEntry[]): LeaderboardEntry[] {
    let currentRank = 1;
    let previousCount = -1;
    let usersAtCurrentRank = 0;

    return entries.map((entry, index) => {
        if (entry.connectionCount !== previousCount) {
            currentRank = index + 1;
            previousCount = entry.connectionCount;
        }

        return {
            ...entry,
            rank: currentRank,
        };
    });
}
```

### Caching Strategy

-   **AppSync Cache TTL**: 60 seconds for leaderboard queries
-   **Cache Key**: Include limit and nextToken in cache key
-   **Cache Invalidation**: Not required since 60-second staleness is acceptable
-   **Per-User Cache**: currentUserEntry is user-specific and should not be cached globally

### Migration Strategy

A one-time migration Lambda function will populate GSI2PK and GSI2SK for all existing users:

```typescript
async function migrateExistingUsers(): Promise<void> {
    // Scan all users
    // For each user, calculate and set GSI2PK and GSI2SK based on current connectionCount
    // Use batch writes for efficiency
}
```

## Performance Considerations

### Query Optimization

-   **Limit Default**: Default to 10 entries to minimize data transfer
-   **Projection Expression**: Only fetch required fields (no full user objects)
-   **Parallel Queries**: Fetch main leaderboard and current user rank in parallel when needed

### Scalability

-   **GSI Capacity**: GSI uses on-demand billing, scales automatically
-   **Lambda Concurrency**: Default concurrency sufficient for expected load
-   **AppSync Caching**: Reduces database load by 95%+ for popular leaderboard queries

### Cost Optimization

-   **Read Capacity**: GSI queries are efficient (single partition key)
-   **Data Transfer**: Minimal payload size (only essential fields)
-   **Lambda Duration**: Expected execution time < 500ms for typical queries
