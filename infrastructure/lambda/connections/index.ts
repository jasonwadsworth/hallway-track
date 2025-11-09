import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { AppSyncResolverEvent } from 'aws-lambda';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;

interface Badge {
  id: string;
  name: string;
  description: string;
  threshold: number;
  iconUrl?: string;
  earnedAt?: string;
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

export const handler = async (event: AppSyncResolverEvent<Record<string, unknown>>): Promise<Connection | ConnectionWithUser[] | boolean> => {
  const identity = event.identity as { sub?: string };
  const userId = identity?.sub;
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const fieldName = event.info.fieldName;

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
