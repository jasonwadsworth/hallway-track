import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { AppSyncResolverEvent } from 'aws-lambda';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;
const CONNECTION_REQUESTS_TABLE_NAME = process.env.CONNECTION_REQUESTS_TABLE_NAME!;

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

// Badge definitions removed - now handled by unified badge handler

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

  if (fieldName === 'checkConnection') {
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

async function createApprovedConnection(userId: string, args: { connectedUserId: string }): Promise<Connection> {
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

  // Badge awarding is now handled asynchronously by the unified badge handler

  return connection;
}

// checkAndAwardBadges function removed - badge awarding is now handled asynchronously by the unified badge handler

// Badge re-evaluation functions removed - all badge logic is now handled asynchronously by the unified badge handler

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

    // Step 8: Decrement connectionCount for both users and get updated results
    const userUpdateResult = await docClient.send(
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

    const connectedUserUpdateResult = await docClient.send(
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

    // Step 9: Re-evaluate badges for both users using the updated connection counts
    // Badge re-evaluation is now handled asynchronously by the unified badge handler

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

// Export for use by connection-requests Lambda
export { createApprovedConnection };
