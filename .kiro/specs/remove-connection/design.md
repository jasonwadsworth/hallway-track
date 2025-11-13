# Design Document: Remove Connection Feature

## Overview

This feature enables users to remove connections from their network. When a connection is removed, the system must:
1. Delete both connection records (bidirectional)
2. Decrement connection counts for both users
3. Re-evaluate and remove badges that are no longer valid

The design follows the existing serverless architecture using AWS Lambda, DynamoDB, and GraphQL via AppSync.

## Architecture

### High-Level Flow

```
User Request → GraphQL Mutation → Lambda Handler → DynamoDB Operations → Badge Re-evaluation
```

### Components Involved

1. **GraphQL Schema** - Add `removeConnection` mutation
2. **Connections Lambda** - Add handler for connection removal
3. **Badge Re-evaluation Logic** - Check and remove invalid badges
4. **Frontend Components** - Add UI for removing connections

## Components and Interfaces

### 1. GraphQL API Changes

#### New Mutation

```graphql
type Mutation {
  removeConnection(connectionId: ID!): RemoveConnectionResult!
}

type RemoveConnectionResult {
  success: Boolean!
  message: String
}
```

The mutation accepts a `connectionId` and returns a result indicating success or failure.

### 2. Lambda Handler Implementation

#### Function: `removeConnection`

**Location:** `infrastructure/lambda/connections/index.ts`

**Input:**
- `userId` (from Cognito identity)
- `connectionId` (from GraphQL arguments)

**Process:**
1. Validate the connection exists and belongs to the user
2. Retrieve the connection to get `connectedUserId`
3. Delete the user's connection record
4. Find and delete the reciprocal connection record
5. Decrement `connectionCount` for both users
6. Re-evaluate badges for both users
7. Return success response

**Output:**
- `RemoveConnectionResult` with success status

#### Error Handling

- **Connection not found:** Return error if connectionId is invalid
- **Unauthorized:** Return error if connection doesn't belong to user
- **Partial failure:** Log errors but continue with deletion where possible
- **Reciprocal connection not found:** Log warning but continue (data consistency issue)

### 3. Badge Re-evaluation System

#### Overview

When a connection is removed, badges must be re-evaluated for both users. The system needs to check:
- Threshold badges (based on connection count)
- Special badges (based on specific connections)

#### Threshold Badge Re-evaluation

**Badges to check:**
- Ice Breaker (1 connection)
- Networker (5 connections)
- Socialite (10 connections)
- Super Connector (25 connections)
- Networking Legend (50 connections)

**Logic:**
```typescript
function removeInvalidThresholdBadges(badges: Badge[], connectionCount: number): Badge[] {
  const thresholdBadges = [
    { id: 'first-connection', threshold: 1 },
    { id: 'networker', threshold: 5 },
    { id: 'socialite', threshold: 10 },
    { id: 'connector', threshold: 25 },
    { id: 'legend', threshold: 50 }
  ];

  return badges.filter(badge => {
    const thresholdBadge = thresholdBadges.find(tb => tb.id === badge.id);
    if (!thresholdBadge) return true; // Keep non-threshold badges
    return connectionCount >= thresholdBadge.threshold; // Keep if still qualifies
  });
}
```

#### Special Badge Re-evaluation

Each special badge type requires different validation logic:

##### 1. VIP Connection Badge

**Badge ID:** `vip-connection`

**Validation Logic:**
- Query all remaining connections for the user
- Count how many connected users have 50+ connections
- If count > 0: Update badge metadata with new count
- If count = 0: Remove badge

**Metadata:** `{ count: number }`

##### 2. Met the Maker Badge

**Badge ID:** `met-the-maker`

**Validation Logic:**
- Check if any remaining connection is with the maker user (from `MAKER_USER_ID` env var)
- If yes: Keep badge
- If no: Remove badge

**Metadata:** `{ relatedUserId: string, relatedUserName: string }`

##### 3. Triangle Complete Badge

**Badge ID:** `triangle-complete`

**Validation Logic:**
- Get the triangle users from badge metadata
- Check if both users are still in the user's connections
- If yes: Keep badge
- If no: Remove badge

**Metadata:** `{ triangleUsers: [userId1, userId2] }`

**Note:** A user can only have one triangle badge, so if it's removed, they won't automatically get a new one for other triangles.

##### 4. Early Supporter Badge

**Badge ID:** `early-supporter`

**Validation Logic:**
- This badge is never removed when connections are deleted
- It represents a historical achievement (being in someone's first 10 connections)

**Metadata:** `{ relatedUserId: string, relatedUserName: string }`

##### 5. re:Invent Connector Badge

**Badge ID:** `reinvent-connector-{year}`

**Validation Logic:**
- This badge is never removed when connections are deleted
- It represents a historical achievement (connecting during re:Invent)

**Metadata:** `{ eventYear: number, count: number }`

#### Badge Re-evaluation Function

```typescript
async function reevaluateBadges(userId: string, connectionCount: number): Promise<void> {
  // Get user's current badges
  const user = await getUser(userId);
  let badges = user.badges || [];

  // Step 1: Remove invalid threshold badges
  badges = removeInvalidThresholdBadges(badges, connectionCount);

  // Step 2: Re-evaluate special badges
  badges = await reevaluateSpecialBadges(userId, badges);

  // Step 3: Update user's badges in database
  await updateUserBadges(userId, badges);
}

async function reevaluateSpecialBadges(userId: string, badges: Badge[]): Promise<Badge[]> {
  const connections = await getUserConnections(userId);
  const connectedUserIds = new Set(connections.map(c => c.connectedUserId));

  return await Promise.all(badges.map(async badge => {
    switch (badge.id) {
      case 'vip-connection':
        return await reevaluateVIPBadge(badge, connections);

      case 'met-the-maker':
        return reevaluateMakerBadge(badge, connectedUserIds);

      case 'triangle-complete':
        return reevaluateTriangleBadge(badge, connectedUserIds);

      case 'early-supporter':
      default:
        if (badge.id.startsWith('reinvent-connector-')) {
          return badge; // Keep event badges
        }
        return badge; // Keep other badges
    }
  })).then(badges => badges.filter(b => b !== null) as Badge[]);
}
```

### 4. Frontend Changes

#### ConnectionList Component

**Location:** `frontend/src/components/ConnectionList.tsx`

**Changes:**
- Add a delete/remove button to each connection card
- Implement confirmation dialog before deletion
- Call `removeConnection` mutation
- Update local state to remove the connection from the list
- Handle errors and display appropriate messages

#### ConnectionCard Component

**Location:** `frontend/src/components/ConnectionCard.tsx`

**Changes:**
- Add a remove button (trash icon or "Remove" text)
- Emit event when remove button is clicked
- Style the button appropriately (subtle, secondary action)

#### GraphQL Mutation

**Location:** `frontend/src/graphql/mutations.ts`

```typescript
export const removeConnection = `
  mutation RemoveConnection($connectionId: ID!) {
    removeConnection(connectionId: $connectionId) {
      success
      message
    }
  }
`;
```

## Data Models

### Connection Record (DynamoDB)

```typescript
interface Connection {
  PK: string;              // USER#{userId}
  SK: string;              // CONNECTION#{connectionId}
  GSI1PK: string;          // CONNECTED#{connectedUserId}
  GSI1SK: string;          // timestamp
  id: string;              // connectionId
  userId: string;          // owner of this connection record
  connectedUserId: string; // the other user in the connection
  tags: string[];
  note?: string;
  createdAt: string;
  updatedAt: string;
}
```

### User Record (DynamoDB)

```typescript
interface User {
  PK: string;              // USER#{userId}
  SK: string;              // PROFILE
  id: string;
  email: string;
  displayName: string;
  gravatarHash: string;
  contactLinks: ContactLink[];
  badges: Badge[];
  connectionCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### Badge Structure

```typescript
interface Badge {
  id: string;
  name: string;
  description: string;
  threshold: number;
  iconUrl?: string;
  earnedAt?: string;
  category: string;        // 'threshold' | 'special'
  metadata?: BadgeMetadata;
}

interface BadgeMetadata {
  relatedUserId?: string;
  relatedUserName?: string;
  eventYear?: number;
  count?: number;
  triangleUsers?: string[];
}
```

## Error Handling

### Lambda Function Errors

1. **Connection Not Found**
   - Status: Error
   - Message: "Connection not found"
   - Action: Return error to client

2. **Unauthorized Access**
   - Status: Error
   - Message: "You do not have permission to remove this connection"
   - Action: Return error to client

3. **Database Operation Failure**
   - Status: Error
   - Message: "Failed to remove connection. Please try again."
   - Action: Log error, return generic message to client

4. **Partial Deletion**
   - Status: Warning
   - Message: Log warning about reciprocal connection not found
   - Action: Continue with deletion, log for manual review

### Frontend Error Handling

1. **Network Error**
   - Display: "Unable to connect. Please check your internet connection."
   - Action: Allow retry

2. **Server Error**
   - Display: "Something went wrong. Please try again later."
   - Action: Allow retry

3. **Validation Error**
   - Display: Error message from server
   - Action: Close dialog, keep connection in list

## Testing Strategy

### Unit Tests (Optional)

Focus on critical badge re-evaluation logic:

1. **Threshold Badge Removal**
   - Test that badges are removed when count drops below threshold
   - Test that badges are kept when count is at or above threshold

2. **VIP Badge Re-evaluation**
   - Test count update when VIP connections remain
   - Test badge removal when no VIP connections remain

3. **Triangle Badge Re-evaluation**
   - Test badge removal when triangle is broken
   - Test badge retention when triangle remains intact

### Integration Testing

1. **End-to-End Connection Removal**
   - Create connection between two users
   - Remove connection
   - Verify both connection records are deleted
   - Verify connection counts are decremented
   - Verify badges are re-evaluated correctly

2. **Badge Re-evaluation Scenarios**
   - User with 5 connections removes 1 → Keeps Networker badge
   - User with 5 connections removes 2 → Loses Networker badge
   - User with VIP badge removes VIP connection → Loses badge
   - User with Triangle badge removes one triangle member → Loses badge

### Manual Testing

1. Test UI flow for removing connections
2. Test confirmation dialog
3. Test error messages
4. Test badge updates in profile view
5. Test reciprocal deletion (both users see connection removed)

## Performance Considerations

### Database Operations

- **Connection Deletion:** 2 DeleteItem operations (one for each side)
- **Connection Count Update:** 2 UpdateItem operations
- **Badge Re-evaluation:** 1-2 Query operations + 1-2 UpdateItem operations
- **Total:** ~6-8 DynamoDB operations per connection removal

### Optimization Opportunities

1. **Batch Operations:** Use TransactWriteItems for atomic deletion
2. **Caching:** Cache user data during badge re-evaluation
3. **Lazy Loading:** Only query connections if special badges need validation

### Expected Latency

- **Lambda Execution:** 500-1000ms
- **Frontend Update:** Immediate (optimistic UI update)
- **Total User Experience:** < 1 second

## Security Considerations

### Authorization

- Verify user owns the connection before deletion
- Use Cognito identity to get authenticated userId
- Never allow deletion of other users' connections

### Data Integrity

- Use conditional expressions to prevent race conditions
- Log all deletion operations for audit trail
- Handle partial failures gracefully

### Privacy

- No sensitive data exposed in error messages
- Connection removal is permanent (no soft delete)
- Both users' data is updated consistently

## Future Enhancements

1. **Undo Functionality:** Allow users to restore recently deleted connections
2. **Bulk Deletion:** Remove multiple connections at once
3. **Archive Instead of Delete:** Soft delete with archive functionality
4. **Notification:** Notify the other user when connection is removed (optional)
5. **Badge History:** Keep track of badges that were earned and lost over time
