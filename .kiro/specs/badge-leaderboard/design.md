# Design Document: Badge Leaderboard

## Overview

The Badge Leaderboard feature extends the existing leaderboard functionality to display a ranked list of users based on their badge count. This feature
leverages a new `badgeCount` field in the User table and provides an efficient query mechanism using a DynamoDB Global Secondary Index (GSI). The feature
integrates with the existing Leaderboard component, adding a tabbed interface to switch between connection and badge leaderboards.

## Architecture

The badge leaderboard follows the same serverless architecture pattern as the existing connection leaderboard:

```
┌─────────────────┐
│  React Frontend │
│   (TypeScript)  │
└────────┬────────┘
         │ GraphQL Query
         │ (getBadgeLeaderboard)
         ▼
┌─────────────────┐
│  AWS AppSync    │
│  GraphQL API    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Lambda Function│
│  (Badge         │
│   Leaderboard)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DynamoDB GSI   │
│  (ByBadgeCount) │
└─────────────────┘
```

### Key Design Decisions

1. **New GSI for Badge Count**: Create a new GSI on the Users table to enable efficient querying by badge count in descending order
2. **Separate Lambda Function**: Use a dedicated Lambda function for badge leaderboard queries to maintain separation of concerns
3. **Tabbed UI**: Add tabs to the existing Leaderboard component to switch between connection and badge views
4. **Badge Count Field**: Add a `badgeCount` field to User records, updated when badges are awarded
5. **Reuse Existing Patterns**: Follow the same patterns as the connection leaderboard for consistency

## Components and Interfaces

### GraphQL Schema Extensions

```graphql
type BadgeLeaderboardEntry {
    rank: Int!
    userId: ID!
    displayName: String!
    profilePictureUrl: String
    uploadedProfilePictureUrl: String
    gravatarHash: String!
    badgeCount: Int!
    isCurrentUser: Boolean!
}

type BadgeLeaderboardResult {
    entries: [BadgeLeaderboardEntry!]!
    currentUserEntry: BadgeLeaderboardEntry
    hasMore: Boolean!
    nextToken: String
}

type Query {
    getBadgeLeaderboard(limit: Int, nextToken: String): BadgeLeaderboardResult!
}
```

### DynamoDB Schema Changes

**New GSI on Users Table**: `ByBadgeCount`

-   **Partition Key**: `GSI3PK` (String) - Static value "BADGE_LEADERBOARD" for all users
-   **Sort Key**: `GSI3SK` (String) - Format: `{paddedBadgeCount}#{userId}`
    -   Badge count is zero-padded to 10 digits for proper sorting (e.g., "0000000005#user-123")
    -   Sorted in descending order by using inverted count: `9999999999 - badgeCount`

**Users Table Item Updates**:

```typescript
{
  PK: "USER#{userId}",
  SK: "PROFILE",
  // ... existing fields
  badgeCount: 5,           // New field
  GSI3PK: "BADGE_LEADERBOARD",  // New field
  GSI3SK: "9999999994#user-123"  // New field (9999999999 - 5)
}
```

### Lambda Function Interface

```typescript
interface BadgeLeaderboardQueryInput {
    limit?: number; // Default: 10, Max: 100
    nextToken?: string;
    currentUserId: string; // From Cognito context
}

interface BadgeLeaderboardQueryOutput {
    entries: BadgeLeaderboardEntry[];
    currentUserEntry?: BadgeLeaderboardEntry;
    hasMore: boolean;
    nextToken?: string;
}
```

## Data Models

### BadgeLeaderboardEntry

```typescript
interface BadgeLeaderboardEntry {
    rank: number;
    userId: string;
    displayName: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
    gravatarHash: string;
    badgeCount: number;
    isCurrentUser: boolean;
}
```

### DynamoDB Query Pattern

**Query for Top N Users by Badge Count**:

```typescript
{
  TableName: 'hallway-track-users',
  IndexName: 'ByBadgeCount',
  KeyConditionExpression: 'GSI3PK = :pk',
  ExpressionAttributeValues: {
    ':pk': 'BADGE_LEADERBOARD'
  },
  ScanIndexForward: true,  // Ascending order (inverted counts)
  Limit: limit
}
```

**Query for Specific User's Badge Rank**:

```typescript
{
  TableName: 'hallway-track-users',
  IndexName: 'ByBadgeCount',
  KeyConditionExpression: 'GSI3PK = :pk AND GSI3SK < :userSK',
  ExpressionAttributeValues: {
    ':pk': 'BADGE_LEADERBOARD',
    ':userSK': userGSI3SK
  },
  Select: 'COUNT'
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system
should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

Based on the prework analysis, the following properties were identified. After reflection to eliminate redundancy:

-   Properties 1.2 (sorting) and 3.2 (data consistency) are distinct - sorting verifies order, consistency verifies values match database
-   Properties 1.3 (required fields) and 1.4 (tie-breaking) are distinct - one checks structure, one checks rank calculation
-   Properties 2.1 (current user identification) and 2.2 (current user entry population) cover different scenarios and are both needed

### Property 1: Badge leaderboard entries are sorted by badge count in descending order

_For any_ set of users with varying badge counts, when the badge leaderboard is queried, the returned entries should be ordered such that each entry's badge
count is greater than or equal to the next entry's badge count.

**Validates: Requirements 1.2**

### Property 2: All badge leaderboard entries contain required fields

_For any_ badge leaderboard entry returned by the system, the entry should contain non-null values for rank, userId, displayName, gravatarHash, and badgeCount
fields.

**Validates: Requirements 1.3**

### Property 3: Users with identical badge counts receive identical ranks

_For any_ set of users where multiple users have the same badge count, all users with that badge count should be assigned the same rank value.

**Validates: Requirements 1.4**

### Property 4: Badge leaderboard excludes users with zero badges

_For any_ badge leaderboard query result, no entry should have a badgeCount value of zero.

**Validates: Requirements 1.6**

### Property 5: Current user is correctly identified in badge leaderboard results

_For any_ badge leaderboard query where the current user appears in the returned entries, exactly one entry should have isCurrentUser set to true, and that
entry's userId should match the requesting user's ID.

**Validates: Requirements 2.1**

### Property 6: Current user entry is provided when not in top badge results

_For any_ badge leaderboard query where the current user has at least 1 badge but does not appear in the main entries list, the currentUserEntry field should be
populated with the user's rank and badge count.

**Validates: Requirements 2.2**

### Property 7: Badge count increments when badges are earned

_For any_ user who earns a new badge, the badgeCount field should increment by 1 and the GSI3SK should be updated to reflect the new count.

**Validates: Requirements 3.1**

### Property 8: Badge leaderboard data reflects current database state

_For any_ user in the badge leaderboard results, the badgeCount value in the leaderboard entry should match the badgeCount value stored in the database for that
user.

**Validates: Requirements 3.2**

## Error Handling

### Input Validation

-   **Invalid Limit**: If limit is less than 1 or greater than 100, return error "Limit must be between 1 and 100"
-   **Invalid NextToken**: If nextToken is malformed or expired, return error "Invalid pagination token"
-   **Unauthenticated Request**: If user is not authenticated, return standard AppSync authentication error

### Database Errors

-   **DynamoDB Throttling**: Implement exponential backoff with up to 3 retries
-   **GSI Not Ready**: Return error "Badge leaderboard temporarily unavailable" if GSI is still being created
-   **Query Timeout**: Return partial results with error message if query exceeds timeout

### Edge Cases

-   **Empty Leaderboard**: If no users have badges, return empty entries array with appropriate message
-   **Single User**: If only one user has badges, return single-entry leaderboard
-   **Current User Not Found**: If current user doesn't exist in database, still return leaderboard but without currentUserEntry

## Testing Strategy

### Unit Tests

Unit tests will verify specific examples and edge cases:

1. **Empty badge leaderboard**: Verify system handles case where no users have badges
2. **Single user**: Verify badge leaderboard works with only one user
3. **Pagination boundaries**: Test first page, middle page, and last page scenarios
4. **Rank calculation with ties**: Verify correct rank assignment when multiple users have same badge count
5. **Current user highlighting**: Test cases where current user is in results vs. not in results
6. **Error handling**: Test invalid inputs, missing data, and database errors

### Property-Based Tests

Property-based tests will verify universal properties across many randomly generated inputs:

1. **Sorting property**: Generate random user sets and verify descending order by badge count
2. **Required fields property**: Generate random users and verify all fields are present
3. **Tie-breaking property**: Generate users with duplicate badge counts and verify same ranks
4. **Exclusion property**: Generate users including zero-badge users and verify exclusion
5. **Current user identification**: Generate random leaderboards and verify correct isCurrentUser flag
6. **Data consistency property**: Verify leaderboard data matches database state

**Testing Framework**: We will use **fast-check** for property-based testing in TypeScript/Node.js.

**Test Configuration**: Each property-based test will run a minimum of 100 iterations to ensure thorough coverage of the input space.

### Integration Tests

1. **End-to-end badge leaderboard query**: Test full GraphQL query through AppSync
2. **GSI query performance**: Verify query completes within acceptable time limits
3. **Badge count update flow**: Verify badge count updates when badges are awarded

## Implementation Notes

### Badge Count Update Strategy

When a user earns a badge, the badge handler must update the badgeCount and GSI fields:

```typescript
async function updateUserBadgeCount(userId: string, newCount: number): Promise<void> {
    const invertedCount = 9999999999 - newCount;
    const paddedCount = invertedCount.toString().padStart(10, '0');

    await dynamodb.update({
        TableName: 'hallway-track-users',
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        UpdateExpression: 'SET badgeCount = :count, GSI3PK = :gsi3pk, GSI3SK = :gsi3sk, updatedAt = :now',
        ExpressionAttributeValues: {
            ':count': newCount,
            ':gsi3pk': 'BADGE_LEADERBOARD',
            ':gsi3sk': `${paddedCount}#${userId}`,
            ':now': new Date().toISOString(),
        },
    });
}
```

### Rank Calculation Algorithm

Reuse the same rank calculation algorithm as the connection leaderboard:

```typescript
function calculateRanks(entries: RawBadgeLeaderboardEntry[]): BadgeLeaderboardEntry[] {
    let currentRank = 1;
    let previousCount = -1;

    return entries.map((entry, index) => {
        if (entry.badgeCount !== previousCount) {
            currentRank = index + 1;
            previousCount = entry.badgeCount;
        }

        return {
            ...entry,
            rank: currentRank,
        };
    });
}
```

### Frontend Tab Implementation

The Leaderboard component will be updated to include tabs:

```typescript
type LeaderboardType = 'connections' | 'badges';

function Leaderboard() {
    const [activeTab, setActiveTab] = useState<LeaderboardType>('connections');

    return (
        <div className="leaderboard">
            <div className="leaderboard-tabs">
                <button className={activeTab === 'connections' ? 'active' : ''} onClick={() => setActiveTab('connections')}>
                    🤝 Connections
                </button>
                <button className={activeTab === 'badges' ? 'active' : ''} onClick={() => setActiveTab('badges')}>
                    🏅 Badges
                </button>
            </div>
            {activeTab === 'connections' ? <ConnectionLeaderboard /> : <BadgeLeaderboard />}
        </div>
    );
}
```

### Migration Strategy

A one-time migration Lambda function will:

1. Scan all users in the database
2. Count badges for each user from their badges array
3. Set badgeCount, GSI3PK, and GSI3SK fields

```typescript
async function migrateExistingUsers(): Promise<void> {
    // Scan all users
    // For each user, count badges array length
    // Set badgeCount, GSI3PK, GSI3SK based on badge count
    // Use batch writes for efficiency
}
```

### Integration with Badge Handlers

The unified badge handler must be updated to increment badgeCount when awarding badges:

```typescript
// In unified-badge-handler/index.ts
async function awardBadge(userId: string, badge: Badge): Promise<void> {
    // ... existing badge award logic ...

    // After adding badge to user's badges array, update badgeCount
    const currentBadgeCount = user.badges?.length || 0;
    const newBadgeCount = currentBadgeCount + 1;
    await updateUserBadgeCount(userId, newBadgeCount);
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

### Cost Optimization

-   **Read Capacity**: GSI queries are efficient (single partition key)
-   **Data Transfer**: Minimal payload size (only essential fields)
-   **Lambda Duration**: Expected execution time < 500ms for typical queries
