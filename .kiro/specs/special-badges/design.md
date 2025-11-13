# Design Document

## Overview

This design extends the existing badge system to support special achievement badges beyond simple connection count thresholds. The implementation uses an event-driven architecture with DynamoDB Streams and EventBridge to process badge awards asynchronously, ensuring connection creation remains fast and responsive.

The system adds new badge types that recognize unique accomplishments:
- **Met the Maker**: Connect with the app creator
- **Early Supporter**: Be among the first 10 connections of someone who reaches 1000+ connections
- **VIP Connection**: Connect with users who have 50+ connections
- **Triangle Complete**: Create a mutual connection triangle
- **re:Invent Connector**: Connect during AWS re:Invent conference dates

## Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Badge Display│  │Badge Progress│  │Badge Showcase│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ GraphQL (AppSync)
                            │
┌─────────────────────────────────────────────────────────────┐
│                  Connections Lambda                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  createConnection()                                   │   │
│  │    ├─ Create connection records                      │   │
│  │    ├─ Update connection counts                       │   │
│  │    └─ Award threshold badges (existing)              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    DynamoDB Tables                           │
│  ┌──────────────┐              ┌──────────────┐            │
│  │ Users Table  │              │ Connections  │            │
│  │  - badges[]  │◄─────────┐   │   Table      │            │
│  │  - count     │          │   │  - Streams   │            │
│  └──────────────┘          │   │  - GSI       │            │
└────────────────────────────┼───┴──────────────┘────────────┘
                             │          │
                             │          │ DynamoDB Streams
                             │          ▼
                             │   ┌──────────────────────┐
                             │   │  Stream Processor    │
                             │   │  Lambda              │
                             │   │  - Parse events      │
                             │   │  - Send to EventBridge│
                             │   └──────────────────────┘
                             │          │
                             │          ▼
                             │   ┌──────────────────────────────────┐
                             │   │       EventBridge Bus            │
                             │   │  Events:                         │
                             │   │  - ConnectionCreated             │
                             │   │  - UserConnectionCountUpdated    │
                             │   └──────────────────────────────────┘
                             │          │
                             │          ├─────────────────┬──────────────┬──────────────┬──────────────┐
                             │          ▼                 ▼              ▼              ▼              ▼
                             │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
                             │   │ Maker Badge  │ │  VIP Badge   │ │Triangle Badge│ │ Event Badge  │ │Early Supporter│
                             │   │   Handler    │ │   Handler    │ │   Handler    │ │   Handler    │ │   Handler    │
                             └───┤   Lambda     │ │   Lambda     │ │   Lambda     │ │   Lambda     │ │   Lambda     │
                                 └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Event-Driven Architecture

The special badge system uses an event-driven architecture to decouple badge processing from connection creation:

1. **DynamoDB Streams**: Enabled on Users and Connections tables to capture all changes
2. **Stream Processor Lambda**: Lightweight function that transforms DynamoDB stream records into domain events
3. **EventBridge**: Central event bus that routes events to appropriate badge handlers
4. **Badge Handler Lambdas**: Specialized functions that evaluate specific badge criteria and award badges

This architecture provides:
- **Fast connection creation**: No badge processing blocks the user request
- **Scalability**: Each badge handler scales independently
- **Maintainability**: Easy to add new badge types without modifying existing code
- **Reliability**: Failed badge awards can be retried without affecting connections
- **Observability**: Clear event trail for debugging and monitoring

### Configuration Management

Special badge parameters will be stored as environment variables in the badge handler Lambda functions:
- `MAKER_USER_ID`: The user ID of the app creator (used by Maker Badge Handler)
- `REINVENT_DATES`: JSON string containing conference date ranges (used by Event Badge Handler)
  - Example: `[{"year": 2024, "start": "2024-12-02", "end": "2024-12-06"}]`

These values will be set in the CDK stack and can be updated through infrastructure changes.

## Components and Interfaces

### Event Definitions

The system will publish and consume the following events:

```typescript
// Published when a new connection is created
interface ConnectionCreatedEvent {
  detailType: 'ConnectionCreated';
  source: 'hallway-track.connections';
  detail: {
    connectionId: string;
    userId: string;
    connectedUserId: string;
    timestamp: string;
  };
}

// Published when a user's connection count is updated
interface UserConnectionCountUpdatedEvent {
  detailType: 'UserConnectionCountUpdated';
  source: 'hallway-track.users';
  detail: {
    userId: string;
    connectionCount: number;
    previousCount: number;
    timestamp: string;
  };
}
```

### Badge Type Definitions

Extend the existing badge structure to support special badges with metadata:

```typescript
interface Badge {
  id: string;                    // Unique badge identifier
  name: string;                  // Display name
  description: string;           // Badge description
  threshold: number;             // For threshold badges (0 for special badges)
  iconUrl?: string;              // Badge icon URL
  earnedAt?: string;             // ISO timestamp when earned
  metadata?: BadgeMetadata;      // NEW: Additional context
  category: 'threshold' | 'special';  // NEW: Badge category
}

interface BadgeMetadata {
  relatedUserId?: string;        // For maker, early supporter badges
  relatedUserName?: string;      // Display name of related user
  eventYear?: number;            // For event badges
  count?: number;                // For countable achievements (VIP connections)
  triangleUsers?: string[];      // For triangle badges
}
```

### Special Badge Definitions

```typescript
const SPECIAL_BADGE_DEFINITIONS = [
  {
    id: 'met-the-maker',
    name: 'Met the Maker',
    description: 'Connected with the creator of Hallway Track',
    category: 'special',
    iconUrl: '/badge-images/met-the-maker.svg'
  },
  {
    id: 'early-supporter',
    name: 'Early Supporter',
    description: 'Was among the first 10 connections of a user with 1000+ connections',
    category: 'special',
    iconUrl: '/badge-images/early-supporter.svg'
  },
  {
    id: 'vip-connection',
    name: 'VIP Connection',
    description: 'Connected with a highly connected user (50+ connections)',
    category: 'special',
    iconUrl: '/badge-images/vip-connection.svg'
  },
  {
    id: 'triangle-complete',
    name: 'Triangle Complete',
    description: 'Created a mutual connection triangle',
    category: 'special',
    iconUrl: '/badge-images/triangle-complete.svg'
  },
  {
    id: 'reinvent-connector',
    name: 're:Invent Connector',
    description: 'Connected during AWS re:Invent',
    category: 'special',
    iconUrl: '/badge-images/reinvent-connector.svg'
  }
];
```

### Stream Processor Lambda

A lightweight Lambda function processes DynamoDB stream records and publishes events to EventBridge:

```typescript
// infrastructure/lambda/badge-stream-processor/index.ts
import { DynamoDBStreamEvent } from 'aws-lambda';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const eventBridge = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  const events = [];

  for (const record of event.Records) {
    if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
      const newImage = record.dynamodb?.NewImage;
      const oldImage = record.dynamodb?.OldImage;

      // Check if this is a connection creation
      if (newImage?.PK?.S?.startsWith('USER#') && newImage?.SK?.S?.startsWith('CONNECTION#')) {
        events.push({
          Source: 'hallway-track.connections',
          DetailType: 'ConnectionCreated',
          Detail: JSON.stringify({
            connectionId: newImage.id.S,
            userId: newImage.userId.S,
            connectedUserId: newImage.connectedUserId.S,
            timestamp: newImage.createdAt.S
          }),
          EventBusName: EVENT_BUS_NAME
        });
      }

      // Check if this is a user connection count update
      if (newImage?.PK?.S?.startsWith('USER#') && newImage?.SK?.S === 'PROFILE') {
        const newCount = parseInt(newImage.connectionCount?.N || '0');
        const oldCount = parseInt(oldImage?.connectionCount?.N || '0');

        if (newCount !== oldCount) {
          events.push({
            Source: 'hallway-track.users',
            DetailType: 'UserConnectionCountUpdated',
            Detail: JSON.stringify({
              userId: newImage.id.S,
              connectionCount: newCount,
              previousCount: oldCount,
              timestamp: newImage.updatedAt.S
            }),
            EventBusName: EVENT_BUS_NAME
          });
        }
      }
    }
  }

  // Publish events to EventBridge
  if (events.length > 0) {
    await eventBridge.send(new PutEventsCommand({ Entries: events }));
  }
}
```

### Badge Handler Lambdas

Each badge type has a dedicated Lambda function that listens for specific events.

#### 1. Maker Badge Handler

Listens for `ConnectionCreated` events and awards badge when user connects with the maker.

```typescript
// infrastructure/lambda/badge-handlers/maker-badge/index.ts
import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const MAKER_USER_ID = process.env.MAKER_USER_ID!;

interface ConnectionCreatedDetail {
  connectionId: string;
  userId: string;
  connectedUserId: string;
  timestamp: string;
}

export async function handler(
  event: EventBridgeEvent<'ConnectionCreated', ConnectionCreatedDetail>
): Promise<void> {
  const { userId, connectedUserId, timestamp } = event.detail;

  // Check if connected user is the maker
  if (connectedUserId !== MAKER_USER_ID) {
    return;
  }

  // Get user to check if they already have the badge
  const userResult = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
    })
  );

  const user = userResult.Item;
  if (!user) return;

  const hasBadge = user.badges?.some((b: Badge) => b.id === 'met-the-maker');
  if (hasBadge) return;

  // Award badge
  const badge = {
    id: 'met-the-maker',
    name: 'Met the Maker',
    description: 'Connected with the creator of Hallway Track',
    threshold: 0,
    category: 'special',
    iconUrl: '/badge-images/met-the-maker.svg',
    earnedAt: timestamp
  };

  const updatedBadges = [...(user.badges || []), badge];

  await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: 'SET badges = :badges, updatedAt = :now',
      ExpressionAttributeValues: {
        ':badges': updatedBadges,
        ':now': new Date().toISOString()
      }
    })
  );
}
```

#### 2. VIP Badge Handler

Listens for `ConnectionCreated` events and awards/updates badge when connecting with VIP users.

```typescript
// infrastructure/lambda/badge-handlers/vip-badge/index.ts
export async function handler(
  event: EventBridgeEvent<'ConnectionCreated', ConnectionCreatedDetail>
): Promise<void> {
  const { userId, connectedUserId, timestamp } = event.detail;

  // Get connected user to check their connection count
  const connectedUserResult = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${connectedUserId}`, SK: 'PROFILE' }
    })
  );

  const connectedUser = connectedUserResult.Item;
  if (!connectedUser || connectedUser.connectionCount < 50) {
    return;
  }

  // Get current user
  const userResult = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
    })
  );

  const user = userResult.Item;
  if (!user) return;

  const existingBadge = user.badges?.find((b: Badge) => b.id === 'vip-connection');

  let updatedBadges;
  if (existingBadge) {
    // Update count
    const currentCount = existingBadge.metadata?.count || 1;
    existingBadge.metadata = { count: currentCount + 1 };
    updatedBadges = user.badges;
  } else {
    // Award new badge
    const badge = {
      id: 'vip-connection',
      name: 'VIP Connection',
      description: 'Connected with a highly connected user (50+ connections)',
      threshold: 0,
      category: 'special',
      iconUrl: '/badge-images/vip-connection.svg',
      earnedAt: timestamp,
      metadata: { count: 1 }
    };
    updatedBadges = [...(user.badges || []), badge];
  }

  await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: 'SET badges = :badges, updatedAt = :now',
      ExpressionAttributeValues: {
        ':badges': updatedBadges,
        ':now': new Date().toISOString()
      }
    })
  );
}
```

#### 3. Triangle Badge Handler

Listens for `ConnectionCreated` events and awards badge when a mutual connection triangle is formed.

```typescript
// infrastructure/lambda/badge-handlers/triangle-badge/index.ts
export async function handler(
  event: EventBridgeEvent<'ConnectionCreated', ConnectionCreatedDetail>
): Promise<void> {
  const { userId, connectedUserId, timestamp } = event.detail;

  // Get user to check if they already have the badge
  const userResult = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
    })
  );

  const user = userResult.Item;
  if (!user) return;

  const hasBadge = user.badges?.some((b: Badge) => b.id === 'triangle-complete');
  if (hasBadge) return; // Only award once

  // Query user's connections
  const userConnectionsResult = await docClient.send(
    new QueryCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'CONNECTION#'
      }
    })
  );

  const userConnectionIds = new Set(
    userConnectionsResult.Items?.map(c => c.connectedUserId) || []
  );

  // Query connected user's connections
  const connectedUserConnectionsResult = await docClient.send(
    new QueryCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${connectedUserId}`,
        ':sk': 'CONNECTION#'
      }
    })
  );

  // Find mutual connections
  const mutualConnection = connectedUserConnectionsResult.Items?.find(
    c => userConnectionIds.has(c.connectedUserId) && c.connectedUserId !== userId
  );

  if (!mutualConnection) return;

  // Award badge
  const badge = {
    id: 'triangle-complete',
    name: 'Triangle Complete',
    description: 'Created a mutual connection triangle',
    threshold: 0,
    category: 'special',
    iconUrl: '/badge-images/triangle-complete.svg',
    earnedAt: timestamp,
    metadata: {
      triangleUsers: [connectedUserId, mutualConnection.connectedUserId]
    }
  };

  const updatedBadges = [...(user.badges || []), badge];

  await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: 'SET badges = :badges, updatedAt = :now',
      ExpressionAttributeValues: {
        ':badges': updatedBadges,
        ':now': new Date().toISOString()
      }
    })
  );
}
```

#### 4. Event Badge Handler

Listens for `ConnectionCreated` events and awards badge when connection occurs during configured events.

```typescript
// infrastructure/lambda/badge-handlers/event-badge/index.ts
export async function handler(
  event: EventBridgeEvent<'ConnectionCreated', ConnectionCreatedDetail>
): Promise<void> {
  const { userId, timestamp } = event.detail;

  const reinventDatesStr = process.env.REINVENT_DATES;
  if (!reinventDatesStr) return;

  const reinventDates = JSON.parse(reinventDatesStr);
  const connectionDate = new Date(timestamp);

  // Check if connection falls within any configured date range
  let matchedEvent = null;
  for (const eventConfig of reinventDates) {
    const startDate = new Date(eventConfig.start);
    const endDate = new Date(eventConfig.end);

    if (connectionDate >= startDate && connectionDate <= endDate) {
      matchedEvent = eventConfig;
      break;
    }
  }

  if (!matchedEvent) return;

  // Get user to check if they already have badge for this year
  const userResult = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
    })
  );

  const user = userResult.Item;
  if (!user) return;

  const hasBadgeForYear = user.badges?.some(
    (b: Badge) => b.id === 'reinvent-connector' && b.metadata?.eventYear === matchedEvent.year
  );
  if (hasBadgeForYear) return;

  // Award badge
  const badge = {
    id: 'reinvent-connector',
    name: 're:Invent Connector',
    description: `Connected during AWS re:Invent ${matchedEvent.year}`,
    threshold: 0,
    category: 'special',
    iconUrl: '/badge-images/reinvent-connector.svg',
    earnedAt: timestamp,
    metadata: { eventYear: matchedEvent.year }
  };

  const updatedBadges = [...(user.badges || []), badge];

  await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      UpdateExpression: 'SET badges = :badges, updatedAt = :now',
      ExpressionAttributeValues: {
        ':badges': updatedBadges,
        ':now': new Date().toISOString()
      }
    })
  );
}
```

#### 5. Early Supporter Badge Handler

Listens for `UserConnectionCountUpdated` events and awards badges to early supporters when a user reaches 500 connections.

```typescript
// infrastructure/lambda/badge-handlers/early-supporter-badge/index.ts
export async function handler(
  event: EventBridgeEvent<'UserConnectionCountUpdated', UserConnectionCountUpdatedDetail>
): Promise<void> {
  const { userId, connectionCount } = event.detail;

  // Only process when user reaches exactly 500 connections
  if (connectionCount !== 500) return;

  // Query all connections for this user, sorted by creation date
  const connectionsResult = await docClient.send(
    new QueryCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'CONNECTION#'
      }
    })
  );

  const connections = connectionsResult.Items || [];

  // Sort by creation date and get first 10
  const earlyConnections = connections
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 10);

  // Get the popular user's display name
  const popularUserResult = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
    })
  );

  const popularUser = popularUserResult.Item;
  if (!popularUser) return;

  // Award badge to each early supporter
  for (const connection of earlyConnections) {
    const supporterResult = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${connection.connectedUserId}`, SK: 'PROFILE' }
      })
    );

    const supporter = supporterResult.Item;
    if (!supporter) continue;

    // Check if they already have this badge for this user
    const hasBadge = supporter.badges?.some(
      (b: Badge) => b.id === 'early-supporter' && b.metadata?.relatedUserId === userId
    );
    if (hasBadge) continue;

    // Award badge
    const badge = {
      id: 'early-supporter',
      name: 'Early Supporter',
      description: 'Was among the first 10 connections of a user with 1000+ connections',
      threshold: 0,
      category: 'special',
      iconUrl: '/badge-images/early-supporter.svg',
      earnedAt: connection.createdAt,
      metadata: {
        relatedUserId: userId,
        relatedUserName: popularUser.displayName
      }
    };

    const updatedBadges = [...(supporter.badges || []), badge];

    await docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${connection.connectedUserId}`, SK: 'PROFILE' },
        UpdateExpression: 'SET badges = :badges, updatedAt = :now',
        ExpressionAttributeValues: {
          ':badges': updatedBadges,
          ':now': new Date().toISOString()
        }
      })
    );
  }
}
```

## Data Models

### Updated Badge Schema

The Badge type in the GraphQL schema will be extended:

```graphql
type Badge {
  id: ID!
  name: String!
  description: String!
  threshold: Int!
  iconUrl: AWSURL
  earnedAt: AWSDateTime
  category: String!           # NEW: 'threshold' or 'special'
  metadata: BadgeMetadata     # NEW: Additional context
}

type BadgeMetadata {
  relatedUserId: ID
  relatedUserName: String
  eventYear: Int
  count: Int
  triangleUsers: [ID!]
}
```

### DynamoDB Storage

Badges are stored as a list attribute in the Users table. The existing structure supports nested objects, so no schema migration is needed:

```json
{
  "PK": "USER#123",
  "SK": "PROFILE",
  "badges": [
    {
      "id": "met-the-maker",
      "name": "Met the Maker",
      "description": "Connected with the creator of Hallway Track",
      "threshold": 0,
      "category": "special",
      "iconUrl": "/badge-images/met-the-maker.svg",
      "earnedAt": "2024-12-01T10:30:00Z"
    },
    {
      "id": "early-supporter",
      "name": "Early Supporter",
      "description": "Was among the first 10 connections of a user with 1000+ connections",
      "threshold": 0,
      "category": "special",
      "iconUrl": "/badge-images/early-supporter.svg",
      "earnedAt": "2024-11-15T14:20:00Z",
      "metadata": {
        "relatedUserId": "456",
        "relatedUserName": "Jane Doe"
      }
    }
  ]
}
```

## Error Handling

### Configuration Errors

- If `MAKER_USER_ID` is not set, maker badge handler skips processing
- If `REINVENT_DATES` is malformed, log error and skip event badge checks
- Invalid date formats in configuration should not crash the Lambda

### Badge Award Failures

- Badge award failures are logged but don't affect connection creation
- Use try-catch blocks around badge logic in each handler
- Failed badge awards can be retried through EventBridge retry policies
- Dead letter queues (DLQ) capture failed events for manual review

### Data Consistency

- Badge awards are eventually consistent (async processing)
- Users may not see badges immediately after connection creation
- Typical latency: < 5 seconds for badge to appear
- Idempotency: Handlers check for existing badges before awarding

## Testing Strategy

### Unit Tests (Optional)

- Test each badge handler with mock events
- Test stream processor event transformation
- Test configuration parsing and validation
- Test badge metadata generation

### Integration Tests (Optional)

- Test full flow from connection creation to badge award
- Test EventBridge event routing
- Test edge cases (duplicate badges, missing users, etc.)

### Manual Testing

- Create connections with maker user ID
- Create connections to reach VIP threshold
- Create triangle connections
- Test with various re:Invent date configurations
- Verify badge display in UI
- Monitor EventBridge and Lambda logs

## Retroactive Badge Processing

A one-time migration Lambda will process existing connections to award badges:

```typescript
// infrastructure/lambda/badge-migration/index.ts
export async function handler(): Promise<void> {
  // Scan all users
  const users = await scanAllUsers();

  for (const user of users) {
    // Query all connections for this user
    const connections = await getAllUserConnections(user.id);

    // For each connection, publish a ConnectionCreated event
    for (const connection of connections) {
      await eventBridge.send(
        new PutEventsCommand({
          Entries: [{
            Source: 'hallway-track.migration',
            DetailType: 'ConnectionCreated',
            Detail: JSON.stringify({
              connectionId: connection.id,
              userId: connection.userId,
              connectedUserId: connection.connectedUserId,
              timestamp: connection.createdAt
            }),
            EventBusName: EVENT_BUS_NAME
          }]
        })
      );
    }

    // If user has 1000+ connections, publish UserConnectionCountUpdated event
    if (user.connectionCount >= 1000) {
      await eventBridge.send(
        new PutEventsCommand({
          Entries: [{
            Source: 'hallway-track.migration',
            DetailType: 'UserConnectionCountUpdated',
            Detail: JSON.stringify({
              userId: user.id,
              connectionCount: user.connectionCount,
              previousCount: 0,
              timestamp: user.updatedAt
            }),
            EventBusName: EVENT_BUS_NAME
          }]
        })
      );
    }
  }
}
```

This migration Lambda:
- Reuses existing badge handlers by publishing events
- Processes users in batches to avoid throttling
- Can be run multiple times (handlers are idempotent)
- Estimated processing time: ~1 hour for 10,000 users

## Frontend Changes

### Badge Display Updates

The existing `BadgeDisplay` component will be updated to:
- Display badge category (special vs threshold)
- Show badge metadata (related users, event years, counts)
- Sort special badges before threshold badges
- Handle multiple instances of the same badge type (e.g., multiple re:Invent years)

### Badge Progress Updates

The `BadgeProgress` component will be updated to:
- Show progress only for threshold badges
- Hide progress for special badges (they're binary achievements)
- Display special badges separately with "Earned" or "Not Earned" status

### TypeScript Types

Update `frontend/src/types.ts` to include new badge fields:

```typescript
export interface Badge {
  id: string;
  name: string;
  description: string;
  threshold: number;
  iconUrl?: string;
  earnedAt?: string;
  category: 'threshold' | 'special';  // NEW
  metadata?: BadgeMetadata;           // NEW
}

export interface BadgeMetadata {
  relatedUserId?: string;
  relatedUserName?: string;
  eventYear?: number;
  count?: number;
  triangleUsers?: string[];
}
```

## Performance Considerations

### Connection Creation Performance

- Connection creation is not impacted by badge processing
- Badge awards happen asynchronously (< 5 seconds typical latency)
- Stream processor adds minimal overhead (< 50ms)

### Query Optimization

- Use GSI for efficient connection queries
- Batch user lookups where possible in handlers
- Consider pagination for users with many connections

### EventBridge Throughput

- EventBridge supports 10,000 events/second per account
- Each connection creates 2 events (connection + count update)
- Sufficient for expected load (< 100 connections/second)

### Lambda Concurrency

- Each badge handler scales independently
- Default concurrency limits are sufficient
- Monitor throttling in CloudWatch

## Security Considerations

### Configuration Security

- Maker user ID is not sensitive but should be validated
- Event dates are public information
- No PII is stored in badge metadata beyond user IDs

### Badge Integrity

- Badges cannot be manually added or removed by users
- All badge awards are server-side only
- Badge metadata is read-only in the frontend
- EventBridge events are internal (not exposed to frontend)

### IAM Permissions

- Stream processor needs EventBridge PutEvents permission
- Badge handlers need DynamoDB read/write on Users table
- Badge handlers need DynamoDB read on Connections table
- Migration Lambda needs EventBridge PutEvents permission

## Deployment Plan

1. **Update GraphQL schema** with new Badge fields (category, metadata)
2. **Enable DynamoDB Streams** on Users and Connections tables
3. **Create EventBridge event bus** for badge events
4. **Deploy stream processor Lambda** with EventBridge permissions
5. **Deploy badge handler Lambdas** with EventBridge rules
6. **Set environment variables** (MAKER_USER_ID, REINVENT_DATES)
7. **Deploy frontend changes** for badge display
8. **Run retroactive badge migration** Lambda
9. **Monitor logs** for errors in CloudWatch
10. **Verify badges** appear correctly in UI

## Infrastructure Components (CDK)

The following AWS resources will be created:

- **EventBridge Event Bus**: `hallway-track-badges`
- **Lambda Functions**:
  - `badge-stream-processor`
  - `maker-badge-handler`
  - `vip-badge-handler`
  - `triangle-badge-handler`
  - `event-badge-handler`
  - `early-supporter-badge-handler`
  - `badge-migration` (one-time use)
- **EventBridge Rules**: One per badge handler to route events
- **DLQ (SQS)**: For failed badge award events
- **IAM Roles**: For Lambda execution with appropriate permissions

## Monitoring and Observability

### CloudWatch Metrics

- Lambda invocation counts per handler
- Lambda error rates per handler
- EventBridge event delivery success/failure
- DynamoDB stream processing lag

### CloudWatch Logs

- Stream processor logs (event transformation)
- Badge handler logs (award decisions)
- Migration Lambda logs (progress tracking)

### Alarms

- High error rate in any badge handler
- DLQ message count > 0
- Stream processing lag > 1 minute

## Future Enhancements

- Admin API for managing badge definitions
- Custom badge images per user
- Badge sharing on social media
- Badge leaderboards
- Time-limited badges (e.g., "First Week Connector")
- Location-based badges (e.g., "Connected in Las Vegas")
- Badge rarity tiers (common, rare, legendary)
- Badge collections and sets
