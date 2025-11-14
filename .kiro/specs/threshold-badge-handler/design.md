# Design Document

## Overview

This design implements a unified badge handler that consolidates all badge awarding logic into a single Lambda function. Instead of having separate handlers for threshold badges, VIP badges, triangle badges, etc., this unified handler will process all badge types when connection-related events occur. This eliminates the inefficiency of triggering multiple Lambda functions for the same event and centralizes badge logic for better maintainability.

## Architecture

### Event Flow

```
DynamoDB Stream → Badge Stream Processor → EventBridge → Unified Badge Handler → DynamoDB
```

1. **DynamoDB Stream**: User profile updates and connection changes trigger stream events
2. **Badge Stream Processor**: Detects changes and publishes relevant events (UserConnectionCountUpdated, ConnectionCreated)
3. **EventBridge**: Routes events to the unified badge handler
4. **Unified Badge Handler**: Processes events and evaluates all badge types (threshold, VIP, triangle, maker, early supporter, event badges)
5. **DynamoDB**: User badges are updated in the users table

### Integration Points

- **Input**: Multiple event types from EventBridge (UserConnectionCountUpdated, ConnectionCreated)
- **Output**: Updated user badge lists in DynamoDB users table
- **Dependencies**: Users table, connections table, existing badge data structures
- **Triggers**: EventBridge rules matching hallway-track.users and hallway-track.connections source events

## Components and Interfaces

### Unified Badge Handler Lambda

**Function**: `infrastructure/lambda/badge-handlers/unified-badge-handler/index.ts`

**Event Interfaces**:
```typescript
interface UserConnectionCountUpdatedDetail {
  userId: string;
  connectionCount: number;
  previousCount: number;
  timestamp: string;
}

interface ConnectionCreatedDetail {
  connectionId: string;
  userId: string;
  connectedUserId: string;
  timestamp: string;
}

type BadgeEvent =
  | EventBridgeEvent<'UserConnectionCountUpdated', UserConnectionCountUpdatedDetail>
  | EventBridgeEvent<'ConnectionCreated', ConnectionCreatedDetail>;
```

**Badge Type Handlers**:
```typescript
// All badge logic consolidated in one handler
const BADGE_EVALUATORS = {
  threshold: evaluateThresholdBadges,
  vip: evaluateVIPBadges,
  triangle: evaluateTriangleBadges,
  maker: evaluateMakerBadges,
  earlySupporter: evaluateEarlySupporterBadges,
  event: evaluateEventBadges
};

const THRESHOLD_BADGES = [
  { id: 'first-connection', name: 'Ice Breaker', threshold: 1, description: 'Made your first connection' },
  { id: 'networker', name: 'Networker', threshold: 5, description: 'Connected with 5 people' },
  { id: 'socialite', name: 'Socialite', threshold: 10, description: 'Connected with 10 people' },
  { id: 'connector', name: 'Super Connector', threshold: 25, description: 'Connected with 25 people' },
  { id: 'legend', name: 'Networking Legend', threshold: 50, description: 'Connected with 50 people' },
];
```

### EventBridge Rules

**Rule Name**: `UnifiedBadgeRule`
**Event Pattern**:
```json
{
  "source": ["hallway-track.users", "hallway-track.connections"],
  "detail-type": ["UserConnectionCountUpdated", "ConnectionCreated"]
}
```

### DynamoDB Operations

**Read Operations**:
- Get user profile to retrieve current badges

**Write Operations**:
- Update user profile with new badge list

## Data Models

### Badge Structure
```typescript
interface Badge {
  id: string;
  name: string;
  description: string;
  threshold: number;
  category: string;
  earnedAt: string;
  iconUrl?: string;
  metadata?: BadgeMetadata;
}
```

### User Profile Structure
```typescript
interface User {
  PK: string;           // USER#{userId}
  SK: string;           // PROFILE
  id: string;
  badges: Badge[];
  connectionCount: number;
  updatedAt: string;
  // ... other fields
}
```

## Error Handling

### Event Processing Errors
- **Invalid Event Data**: Log error and skip processing
- **User Not Found**: Log warning and skip processing
- **DynamoDB Errors**: Retry with exponential backoff, then fail
- **Badge Logic Errors**: Log error details and continue processing

### Idempotency
- Check existing badges before awarding to prevent duplicates
- Use earnedAt timestamp to detect if badge was already awarded
- Handle duplicate events gracefully

### Logging Strategy
```typescript
// Event received
console.log('Processing threshold badge event', { userId, connectionCount, previousCount });

// Badge evaluation
console.log('Evaluating badges', { userId, currentBadges: badgeIds, newThreshold: connectionCount });

// Badge changes
console.log('Awarding badges', { userId, newBadges: newBadgeIds });
console.log('Removing badges', { userId, removedBadges: removedBadgeIds });

// Completion
console.log('Threshold badge processing complete', { userId, totalBadges: finalBadgeCount });
```

## Testing Strategy

### Unit Tests
- Badge evaluation logic for different connection counts
- Badge awarding and removal scenarios
- Error handling for invalid data
- Idempotency verification

### Integration Tests
- End-to-end event processing from EventBridge
- DynamoDB read/write operations
- Event parsing and validation

### Test Scenarios

**Badge Awarding**:
- User goes from 0 to 1 connections → Awards Ice Breaker
- User goes from 4 to 5 connections → Awards Networker
- User goes from 9 to 10 connections → Awards Socialite
- User goes from 24 to 25 connections → Awards Super Connector
- User goes from 49 to 50 connections → Awards Networking Legend

**Badge Removal**:
- User goes from 5 to 4 connections → Removes Networker
- User goes from 1 to 0 connections → Removes Ice Breaker

**Edge Cases**:
- User jumps multiple thresholds (0 to 10) → Awards all qualifying badges
- User already has badge → No duplicate awarded
- Invalid event data → Graceful error handling

## Implementation Details

### Unified Badge Processing Algorithm

```typescript
async function processBadgeEvent(event: BadgeEvent): Promise<void> {
  const eventType = event['detail-type'];

  if (eventType === 'UserConnectionCountUpdated') {
    const { userId, connectionCount } = event.detail;
    await processAllBadgeTypes(userId, { connectionCount });
  } else if (eventType === 'ConnectionCreated') {
    const { userId, connectedUserId, timestamp } = event.detail;
    await processAllBadgeTypes(userId, { newConnection: { connectedUserId, timestamp } });
    await processAllBadgeTypes(connectedUserId, { newConnection: { connectedUserId: userId, timestamp } });
  }
}

async function processAllBadgeTypes(userId: string, context: BadgeContext): Promise<void> {
  const user = await getUserWithConnections(userId);
  const currentBadges = user.badges || [];

  let updatedBadges = [...currentBadges];

  // Process all badge types in sequence
  for (const [badgeType, evaluator] of Object.entries(BADGE_EVALUATORS)) {
    const { badgesToAdd, badgesToRemove } = await evaluator(user, context);

    // Remove badges that no longer qualify
    updatedBadges = updatedBadges.filter(badge =>
      !badgesToRemove.some(remove => remove.id === badge.id)
    );

    // Add new badges
    updatedBadges.push(...badgesToAdd);
  }

  // Update user if badges changed
  if (badgesChanged(currentBadges, updatedBadges)) {
    await updateUserBadges(userId, updatedBadges);
  }
}
```

### Database Update Strategy

```typescript
async function updateUserBadges(userId: string, newBadges: Badge[]): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE_NAME,
    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
    UpdateExpression: 'SET badges = :badges, updatedAt = :now',
    ExpressionAttributeValues: {
      ':badges': newBadges,
      ':now': new Date().toISOString()
    }
  }));
}
```

## Migration Strategy

### Phase 1: Deploy Unified Handler
1. Deploy unified badge handler Lambda
2. Configure EventBridge rule for all badge events
3. Test with existing events

### Phase 2: Migrate Existing Badge Handlers
1. Remove individual badge handler Lambdas (vip-badge, triangle-badge, etc.)
2. Remove corresponding EventBridge rules
3. Consolidate all badge logic into unified handler

### Phase 3: Remove Synchronous Logic
1. Remove threshold badge logic from connections Lambda
2. Remove threshold badge logic from connection-requests Lambda
3. Verify all badge awarding is now asynchronous

### Phase 3: Validation
1. Monitor badge awarding for consistency
2. Run badge migration if needed to fix any gaps
3. Verify no duplicate badges are created

## Performance Considerations

### Event Processing
- Handler should complete within 15 minutes (EventBridge timeout)
- Batch DynamoDB operations where possible
- Use efficient badge comparison algorithms

### Scalability
- Handler processes one user at a time per event
- No cross-user dependencies
- Can handle high event volumes through Lambda concurrency

### Cost Optimization
- Minimize DynamoDB read/write operations
- Use conditional updates to avoid unnecessary writes
- Efficient badge comparison to reduce processing time