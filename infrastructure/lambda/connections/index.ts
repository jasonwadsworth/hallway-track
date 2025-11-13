import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { AppSyncResolverEvent } from 'aws-lambda';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;

interface BadgeMetadata {
  relatedUserId?: string;
  relatedUserName?: string;
  eventYear?: number;
  count?: number;
  triangleUsers?: string[];
}

interface Badge {
  id: string;
  name: string;
  description: string;
  threshold: number;
  iconUrl?: string;
  earnedAt?: string;
  category?: string;
  metadata?: BadgeMetadata;
}

interface User {
  PK: string;
  SK: string;
  id: string;
  email: string;
  displayName: string;
  gravatarHash: string;
  contactLinks: unknown[];
  badges: Badge[];
  connectionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Connection {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  id: string;
  userId: string;
  connectedUserId: string;
  tags: string[];
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// Badge definitions
const BADGE_DEFINITIONS = [
  { id: 'first-connection', name: 'Ice Breaker', threshold: 1, description: 'Made your first connection' },
  { id: 'networker', name: 'Networker', threshold: 5, description: 'Connected with 5 people' },
  { id: 'socialite', name: 'Socialite', threshold: 10, description: 'Connected with 10 people' },
  { id: 'connector', name: 'Super Connector', threshold: 25, description: 'Connected with 25 people' },
  { id: 'legend', name: 'Networking Legend', threshold: 50, description: 'Connected with 50 people' },
];

interface ConnectionWithUser extends Connection {
  connectedUser?: User;
}

interface RemoveConnectionResult {
  success: boolean;
  message?: string;
}

export const handler = async (event: AppSyncResolverEvent<Record<string, unknown>>): Promise<Connection | ConnectionWithUser[] | boolean | RemoveConnectionResult> => {
  const identity = event.identity as { sub?: string };
  const userId = identity?.sub;
  const fieldName = event.info.fieldName;

  // Handle removeConnection specially to ensure we always return RemoveConnectionResult
  if (fieldName === 'removeConnection') {
    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
      };
    }
    return await removeConnection(userId, event.arguments as { connectionId: string });
  }

  // For other operations, throw error if not authorized
  if (!userId) {
    throw new Error('Unauthorized');
  }

  if (fieldName === 'createConnection') {
    return await createConnection(userId, event.arguments as { connectedUserId: string });
  } else if (fieldName === 'checkConnection') {
    return await checkConnection(userId, event.arguments as { userId: string });
  } else if (fieldName === 'getMyConnections') {
    return await getMyConnections(userId);
  } else if (fieldName === 'addTagToConnection') {
    return await addTagToConnection(userId, event.arguments as { connectionId: string; tag: string });
  } else if (fieldName === 'removeTagFromConnection') {
    return await removeTagFromConnection(userId, event.arguments as { connectionId: string; tag: string });
  } else if (fieldName === 'updateConnectionNote') {
    return await updateConnectionNote(userId, event.arguments as { connectionId: string; note?: string | null });
  }

  throw new Error(`Unknown field: ${fieldName}`);
};

async function checkConnection(userId: string, args: { userId: string }): Promise<boolean> {
  const { userId: connectedUserId } = args;

  // Query connections table to see if connection exists
  const result = await docClient.send(
    new QueryCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'CONNECTION#',
      },
    })
  );

  // Check if any connection has the connectedUserId
  const connectionExists = (result.Items || []).some(
    (item: Record<string, unknown>) => item.connectedUserId === connectedUserId
  );

  return connectionExists;
}

async function createConnection(userId: string, args: { connectedUserId: string }): Promise<Connection> {
  const { connectedUserId } = args;

  // Validate that user is not connecting with themselves
  if (userId === connectedUserId) {
    throw new Error('Cannot connect with yourself');
  }

  // Check if connected user exists
  const connectedUserResult = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        PK: `USER#${connectedUserId}`,
        SK: 'PROFILE',
      },
    })
  );

  if (!connectedUserResult.Item) {
    throw new Error('User not found');
  }

  // Check for duplicate connection
  const isDuplicate = await checkConnection(userId, { userId: connectedUserId });
  if (isDuplicate) {
    throw new Error('Already connected with this user');
  }

  const now = new Date().toISOString();
  const connectionId = randomUUID();

  // Create connection record for current user
  const connection: Connection = {
    PK: `USER#${userId}`,
    SK: `CONNECTION#${connectionId}`,
    GSI1PK: `CONNECTED#${connectedUserId}`,
    GSI1SK: now,
    id: connectionId,
    userId,
    connectedUserId,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Item: connection,
    })
  );

  // Create reciprocal connection record for connected user
  const reciprocalConnectionId = randomUUID();
  const reciprocalConnection: Connection = {
    PK: `USER#${connectedUserId}`,
    SK: `CONNECTION#${reciprocalConnectionId}`,
    GSI1PK: `CONNECTED#${userId}`,
    GSI1SK: now,
    id: reciprocalConnectionId,
    userId: connectedUserId,
    connectedUserId: userId,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Item: reciprocalConnection,
    })
  );

  // Increment connectionCount for current user
  const currentUserResult = await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: 'SET connectionCount = if_not_exists(connectionCount, :zero) + :inc, updatedAt = :now',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':inc': 1,
        ':now': now,
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  // Increment connectionCount for connected user
  const connectedUserUpdateResult = await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        PK: `USER#${connectedUserId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: 'SET connectionCount = if_not_exists(connectionCount, :zero) + :inc, updatedAt = :now',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':inc': 1,
        ':now': now,
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  // Check and award badges for current user
  const currentUser = currentUserResult.Attributes as User;
  await checkAndAwardBadges(currentUser);

  // Check and award badges for connected user
  const connectedUser = connectedUserUpdateResult.Attributes as User;
  await checkAndAwardBadges(connectedUser);

  return connection;
}

async function checkAndAwardBadges(user: User): Promise<void> {
  const currentBadges = user.badges || [];
  const earnedBadgeIds = new Set(currentBadges.map((b) => b.id));
  const newBadges: Badge[] = [];

  // Check each badge threshold
  for (const badgeDef of BADGE_DEFINITIONS) {
    // If user has reached threshold and hasn't earned this badge yet
    if (user.connectionCount >= badgeDef.threshold && !earnedBadgeIds.has(badgeDef.id)) {
      newBadges.push({
        id: badgeDef.id,
        name: badgeDef.name,
        description: badgeDef.description,
        threshold: badgeDef.threshold,
        category: 'threshold',
        earnedAt: new Date().toISOString(),
      });
    }
  }

  // If there are new badges to award, update the user
  if (newBadges.length > 0) {
    const updatedBadges = [...currentBadges, ...newBadges];
    await docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE_NAME,
        Key: {
          PK: user.PK,
          SK: user.SK,
        },
        UpdateExpression: 'SET badges = :badges, updatedAt = :now',
        ExpressionAttributeValues: {
          ':badges': updatedBadges,
          ':now': new Date().toISOString(),
        },
      })
    );
  }
}

// Badge re-evaluation functions for connection removal

function removeInvalidThresholdBadges(badges: Badge[], connectionCount: number): Badge[] {
  const thresholdBadges = [
    { id: 'first-connection', threshold: 1 },
    { id: 'networker', threshold: 5 },
    { id: 'socialite', threshold: 10 },
    { id: 'connector', threshold: 25 },
    { id: 'legend', threshold: 50 },
  ];

  return badges.filter((badge) => {
    const thresholdBadge = thresholdBadges.find((tb) => tb.id === badge.id);
    if (!thresholdBadge) return true; // Keep non-threshold badges
    return connectionCount >= thresholdBadge.threshold; // Keep if still qualifies
  });
}

async function reevaluateVIPBadge(badge: Badge, connections: Connection[]): Promise<Badge | null> {
  // Count how many connected users have 50+ connections
  let vipCount = 0;

  for (const connection of connections) {
    const connectedUserResult = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: {
          PK: `USER#${connection.connectedUserId}`,
          SK: 'PROFILE',
        },
      })
    );

    const connectedUser = connectedUserResult.Item as User | undefined;
    if (connectedUser && connectedUser.connectionCount >= 50) {
      vipCount++;
    }
  }

  if (vipCount === 0) {
    return null; // Remove badge
  }

  // Update badge metadata with new count
  return {
    ...badge,
    metadata: { count: vipCount },
  };
}

function reevaluateMakerBadge(badge: Badge, connectedUserIds: Set<string>): Badge | null {
  const makerUserId = process.env.MAKER_USER_ID;
  if (!makerUserId) {
    return badge; // Keep badge if no maker configured
  }

  // Check if maker is still in connections
  if (connectedUserIds.has(makerUserId)) {
    return badge; // Keep badge
  }

  return null; // Remove badge
}

function reevaluateTriangleBadge(badge: Badge, connectedUserIds: Set<string>): Badge | null {
  const triangleUsers = badge.metadata?.triangleUsers || [];

  // Check if both triangle users are still in connections
  const allTriangleUsersConnected = triangleUsers.every((userId) => connectedUserIds.has(userId));

  if (allTriangleUsersConnected) {
    return badge; // Keep badge
  }

  return null; // Remove badge
}

async function reevaluateSpecialBadges(userId: string, badges: Badge[]): Promise<Badge[]> {
  // Get user's current connections
  const connectionsResult = await docClient.send(
    new QueryCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'CONNECTION#',
      },
    })
  );

  const connections = (connectionsResult.Items || []) as Connection[];
  const connectedUserIds = new Set(connections.map((c) => c.connectedUserId));

  const reevaluatedBadges: Badge[] = [];

  for (const badge of badges) {
    let updatedBadge: Badge | null = badge;

    if (badge.id === 'vip-connection') {
      updatedBadge = await reevaluateVIPBadge(badge, connections);
    } else if (badge.id === 'met-the-maker') {
      updatedBadge = reevaluateMakerBadge(badge, connectedUserIds);
    } else if (badge.id === 'triangle-complete') {
      updatedBadge = reevaluateTriangleBadge(badge, connectedUserIds);
    } else if (badge.id === 'early-supporter' || badge.id.startsWith('reinvent-connector-')) {
      // Keep historical badges
      updatedBadge = badge;
    }

    if (updatedBadge !== null) {
      reevaluatedBadges.push(updatedBadge);
    }
  }

  return reevaluatedBadges;
}

async function reevaluateBadges(userId: string, connectionCount: number): Promise<void> {
  // Get user's current badges
  const userResult = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
    })
  );

  const user = userResult.Item as User | undefined;
  if (!user) {
    console.log(`User ${userId} not found during badge re-evaluation`);
    return;
  }

  let badges = user.badges || [];

  // Step 1: Remove invalid threshold badges
  badges = removeInvalidThresholdBadges(badges, connectionCount);

  // Step 2: Re-evaluate special badges
  badges = await reevaluateSpecialBadges(userId, badges);

  // Step 3: Update user's badges in database
  await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: 'SET badges = :badges, updatedAt = :now',
      ExpressionAttributeValues: {
        ':badges': badges,
        ':now': new Date().toISOString(),
      },
    })
  );
}

async function removeConnection(userId: string, args: { connectionId: string }): Promise<RemoveConnectionResult> {
  const { connectionId } = args;

  // Ensure we always return a RemoveConnectionResult, never throw
  try {
    // Step 1: Validate connectionId is provided
    if (!connectionId) {
      throw new Error('Connection ID is required');
    }

    // Step 2: Retrieve connection record from DynamoDB
    const connectionResult = await docClient.send(
      new GetCommand({
        TableName: CONNECTIONS_TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `CONNECTION#${connectionId}`,
        },
      })
    );

    // Step 3: Verify connection exists
    if (!connectionResult.Item) {
      throw new Error('Connection not found');
    }

    const connection = connectionResult.Item as Connection;

    // Step 4: Verify connection belongs to the authenticated user
    if (connection.userId !== userId) {
      throw new Error('You do not have permission to remove this connection');
    }

    // Step 5: Extract connectedUserId for reciprocal deletion
    const connectedUserId = connection.connectedUserId;

    // Step 6: Delete the user's connection record
    await docClient.send(
      new DeleteCommand({
        TableName: CONNECTIONS_TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `CONNECTION#${connectionId}`,
        },
      })
    );

    // Step 7: Find and delete the reciprocal connection record
    const reciprocalConnectionsResult = await docClient.send(
      new QueryCommand({
        TableName: CONNECTIONS_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${connectedUserId}`,
          ':sk': 'CONNECTION#',
        },
      })
    );

    const reciprocalConnection = (reciprocalConnectionsResult.Items || []).find(
      (item: Record<string, unknown>) => item.connectedUserId === userId
    );

    if (reciprocalConnection) {
      await docClient.send(
        new DeleteCommand({
          TableName: CONNECTIONS_TABLE_NAME,
          Key: {
            PK: reciprocalConnection.PK as string,
            SK: reciprocalConnection.SK as string,
          },
        })
      );
    } else {
      console.warn(`Reciprocal connection not found for user ${connectedUserId} connected to ${userId}`);
    }

    // Step 8: Decrement connectionCount for both users
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: USERS_TABLE_NAME,
          Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE',
          },
          UpdateExpression: 'SET connectionCount = if_not_exists(connectionCount, :zero) - :dec, updatedAt = :now',
          ExpressionAttributeValues: {
            ':zero': 0,
            ':dec': 1,
            ':now': new Date().toISOString(),
          },
          ReturnValues: 'ALL_NEW',
        })
      );
    } catch (error) {
      console.error(`Failed to decrement connection count for user ${userId}:`, error);
    }

    try {
      await docClient.send(
        new UpdateCommand({
          TableName: USERS_TABLE_NAME,
          Key: {
            PK: `USER#${connectedUserId}`,
            SK: 'PROFILE',
          },
          UpdateExpression: 'SET connectionCount = if_not_exists(connectionCount, :zero) - :dec, updatedAt = :now',
          ExpressionAttributeValues: {
            ':zero': 0,
            ':dec': 1,
            ':now': new Date().toISOString(),
          },
          ReturnValues: 'ALL_NEW',
        })
      );
    } catch (error) {
      console.error(`Failed to decrement connection count for user ${connectedUserId}:`, error);
    }

    // Step 9: Get updated connection counts for badge re-evaluation
    const userResult = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
        },
      })
    );

    const connectedUserResult = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: {
          PK: `USER#${connectedUserId}`,
          SK: 'PROFILE',
        },
      })
    );

    // Step 10: Re-evaluate badges for both users
    if (userResult.Item) {
      const user = userResult.Item as User;
      await reevaluateBadges(userId, user.connectionCount);
    }

    if (connectedUserResult.Item) {
      const connectedUser = connectedUserResult.Item as User;
      await reevaluateBadges(connectedUserId, connectedUser.connectionCount);
    }

    return {
      success: true,
      message: 'Connection removed successfully',
    };
  } catch (error) {
    console.error('Error removing connection:', error);

    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: false,
      message: 'Failed to remove connection. Please try again.',
    };
  }
}

async function getMyConnections(userId: string): Promise<ConnectionWithUser[]> {
  // Query connections table for current user
  const result = await docClient.send(
    new QueryCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'CONNECTION#',
      },
      ScanIndexForward: false, // Sort by createdAt descending
    })
  );

  const connections = (result.Items || []) as Connection[];

  // Fetch connected user details for each connection
  const connectionsWithUsers: ConnectionWithUser[] = [];

  for (const connection of connections) {
    const userResult = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: {
          PK: `USER#${connection.connectedUserId}`,
          SK: 'PROFILE',
        },
      })
    );

    if (userResult.Item) {
      connectionsWithUsers.push({
        ...connection,
        connectedUser: userResult.Item as User,
      });
    } else {
      // If user not found, still include connection without user details
      connectionsWithUsers.push(connection);
    }
  }

  return connectionsWithUsers;
}

async function addTagToConnection(userId: string, args: { connectionId: string; tag: string }): Promise<Connection> {
  const { connectionId, tag } = args;

  // Validate tag length
  if (tag.length > 30) {
    throw new Error('Tag must be 30 characters or less');
  }

  // Get the connection
  const result = await docClient.send(
    new GetCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `CONNECTION#${connectionId}`,
      },
    })
  );

  if (!result.Item) {
    throw new Error('Connection not found');
  }

  const connection = result.Item as Connection;
  const currentTags = connection.tags || [];

  // Check if tag already exists
  if (currentTags.includes(tag)) {
    throw new Error('Tag already exists on this connection');
  }

  // Validate max 10 tags
  if (currentTags.length >= 10) {
    throw new Error('Maximum of 10 tags per connection');
  }

  // Add tag to connection
  const updatedTags = [...currentTags, tag];
  const now = new Date().toISOString();

  const updateResult = await docClient.send(
    new UpdateCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `CONNECTION#${connectionId}`,
      },
      UpdateExpression: 'SET tags = :tags, updatedAt = :now',
      ExpressionAttributeValues: {
        ':tags': updatedTags,
        ':now': now,
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  return updateResult.Attributes as Connection;
}

async function removeTagFromConnection(userId: string, args: { connectionId: string; tag: string }): Promise<Connection> {
  const { connectionId, tag } = args;

  // Get the connection
  const result = await docClient.send(
    new GetCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `CONNECTION#${connectionId}`,
      },
    })
  );

  if (!result.Item) {
    throw new Error('Connection not found');
  }

  const connection = result.Item as Connection;
  const currentTags = connection.tags || [];

  // Check if tag exists
  if (!currentTags.includes(tag)) {
    throw new Error('Tag not found on this connection');
  }

  // Remove tag from connection
  const updatedTags = currentTags.filter((t) => t !== tag);
  const now = new Date().toISOString();

  const updateResult = await docClient.send(
    new UpdateCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `CONNECTION#${connectionId}`,
      },
      UpdateExpression: 'SET tags = :tags, updatedAt = :now',
      ExpressionAttributeValues: {
        ':tags': updatedTags,
        ':now': now,
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  return updateResult.Attributes as Connection;
}

async function updateConnectionNote(userId: string, args: { connectionId: string; note?: string | null }): Promise<Connection> {
  const { connectionId, note } = args;

  // Validate note length if provided
  if (note && note.length > 1000) {
    throw new Error('Note must be 1000 characters or less');
  }

  // Get the connection to verify ownership
  const result = await docClient.send(
    new GetCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `CONNECTION#${connectionId}`,
      },
    })
  );

  if (!result.Item) {
    throw new Error('Connection not found');
  }

  const now = new Date().toISOString();

  // Update or remove note
  if (note === null || note === undefined || note.trim() === '') {
    // Remove note
    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: CONNECTIONS_TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `CONNECTION#${connectionId}`,
        },
        UpdateExpression: 'REMOVE note SET updatedAt = :now',
        ExpressionAttributeValues: {
          ':now': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );
    return updateResult.Attributes as Connection;
  } else {
    // Add or update note
    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: CONNECTIONS_TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `CONNECTION#${connectionId}`,
        },
        UpdateExpression: 'SET note = :note, updatedAt = :now',
        ExpressionAttributeValues: {
          ':note': note.trim(),
          ':now': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );
    return updateResult.Attributes as Connection;
  }
}
