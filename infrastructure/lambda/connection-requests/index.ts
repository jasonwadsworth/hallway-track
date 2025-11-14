import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { AppSyncResolverEvent } from 'aws-lambda';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;
const CONNECTION_REQUESTS_TABLE_NAME = process.env.CONNECTION_REQUESTS_TABLE_NAME!;

interface User {
  PK: string;
  SK: string;
  id: string;
  email: string;
  displayName: string;
  gravatarHash: string;
  contactLinks: unknown[];
  badges: unknown[];
  connectionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionRequest {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  id: string;
  initiatorUserId: string;
  recipientUserId: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  actionedAt?: string;
}

interface ConnectionRequestWithUsers extends ConnectionRequest {
  initiator?: User;
  recipient?: User;
}

interface ConnectionRequestResult {
  success: boolean;
  message?: string;
  request?: ConnectionRequest;
}

interface ConnectionStatus {
  isConnected: boolean;
  hasPendingRequest: boolean;
  requestDirection?: 'incoming' | 'outgoing';
}

export const handler = async (event: AppSyncResolverEvent<Record<string, unknown>>): Promise<ConnectionRequestResult | ConnectionRequestWithUsers[] | ConnectionStatus> => {
  console.log('Connection requests handler invoked:', JSON.stringify(event, null, 2));

  const identity = event.identity as { sub?: string };
  const userId = identity?.sub;
  const fieldName = event.info.fieldName;

  console.log('Field name:', fieldName, 'User ID:', userId);

  if (!userId) {
    console.error('No user ID found in identity');
    throw new Error('Unauthorized');
  }

  if (fieldName === 'createConnectionRequest') {
    return await createConnectionRequest(userId, event.arguments as { recipientUserId: string });
  } else if (fieldName === 'approveConnectionRequest') {
    return await approveConnectionRequest(userId, event.arguments as { requestId: string });
  } else if (fieldName === 'denyConnectionRequest') {
    return await denyConnectionRequest(userId, event.arguments as { requestId: string });
  } else if (fieldName === 'cancelConnectionRequest') {
    return await cancelConnectionRequest(userId, event.arguments as { requestId: string });
  } else if (fieldName === 'getIncomingConnectionRequests') {
    return await getIncomingConnectionRequests(userId);
  } else if (fieldName === 'getOutgoingConnectionRequests') {
    return await getOutgoingConnectionRequests(userId);
  } else if (fieldName === 'checkConnectionOrRequest') {
    return await checkConnectionOrRequest(userId, event.arguments as { userId: string });
  }

  throw new Error(`Unknown field: ${fieldName}`);
};

async function createConnectionRequest(initiatorUserId: string, args: { recipientUserId: string }): Promise<ConnectionRequestResult> {
  const { recipientUserId } = args;

  console.log('Creating connection request from', initiatorUserId, 'to', recipientUserId);

  try {
    // Validate that user is not connecting with themselves
    if (initiatorUserId === recipientUserId) {
      return {
        success: false,
        message: 'Cannot send connection request to yourself',
      };
    }

    // Check if recipient user exists
    const recipientUserResult = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: {
          PK: `USER#${recipientUserId}`,
          SK: 'PROFILE',
        },
      })
    );

    if (!recipientUserResult.Item) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    // Check if users are already connected
    const connectionExists = await checkExistingConnection(initiatorUserId, recipientUserId);
    if (connectionExists) {
      return {
        success: false,
        message: 'You are already connected with this user',
      };
    }

    // Check for existing pending request (either direction)
    const existingRequest = await checkExistingRequest(initiatorUserId, recipientUserId);
    if (existingRequest) {
      if (existingRequest.initiatorUserId === initiatorUserId) {
        return {
          success: false,
          message: 'Connection request already sent',
        };
      } else {
        return {
          success: false,
          message: 'This user has already sent you a connection request',
        };
      }
    }

    const now = new Date().toISOString();
    const requestId = randomUUID();

    // Create connection request record
    const connectionRequest: ConnectionRequest = {
      PK: `USER#${recipientUserId}`,
      SK: `REQUEST#${requestId}`,
      GSI1PK: `USER#${initiatorUserId}`,
      GSI1SK: now,
      id: requestId,
      initiatorUserId,
      recipientUserId,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        Item: connectionRequest,
      })
    );

    return {
      success: true,
      message: 'Connection request sent successfully',
      request: connectionRequest,
    };
  } catch (error) {
    console.error('Error creating connection request:', error);
    return {
      success: false,
      message: 'Failed to send connection request. Please try again.',
    };
  }
}

async function approveConnectionRequest(recipientUserId: string, args: { requestId: string }): Promise<ConnectionRequestResult> {
  const { requestId } = args;

  try {
    // Get the connection request
    const requestResult = await docClient.send(
      new GetCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        Key: {
          PK: `USER#${recipientUserId}`,
          SK: `REQUEST#${requestId}`,
        },
      })
    );

    if (!requestResult.Item) {
      return {
        success: false,
        message: 'Connection request not found',
      };
    }

    const request = requestResult.Item as ConnectionRequest;

    // Verify the request is for this user and is pending
    if (request.recipientUserId !== recipientUserId) {
      return {
        success: false,
        message: 'You do not have permission to approve this request',
      };
    }

    if (request.status !== 'PENDING') {
      return {
        success: false,
        message: 'Connection request is no longer pending',
      };
    }

    const now = new Date().toISOString();

    // Delete the request record since connection will be created
    await docClient.send(
      new DeleteCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        Key: {
          PK: request.PK,
          SK: request.SK,
        },
      })
    );

    // Create the actual connection by calling the connections service
    // This will be implemented when we integrate with the existing connections Lambda
    await createApprovedConnection(request.initiatorUserId, request.recipientUserId);

    return {
      success: true,
      message: 'Connection request approved successfully',
    };
  } catch (error) {
    console.error('Error approving connection request:', error);
    return {
      success: false,
      message: 'Failed to approve connection request. Please try again.',
    };
  }
}

async function denyConnectionRequest(recipientUserId: string, args: { requestId: string }): Promise<ConnectionRequestResult> {
  const { requestId } = args;

  try {
    // Get the connection request
    const requestResult = await docClient.send(
      new GetCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        Key: {
          PK: `USER#${recipientUserId}`,
          SK: `REQUEST#${requestId}`,
        },
      })
    );

    if (!requestResult.Item) {
      return {
        success: false,
        message: 'Connection request not found',
      };
    }

    const request = requestResult.Item as ConnectionRequest;

    // Verify the request is for this user and is pending
    if (request.recipientUserId !== recipientUserId) {
      return {
        success: false,
        message: 'You do not have permission to deny this request',
      };
    }

    if (request.status !== 'PENDING') {
      return {
        success: false,
        message: 'Connection request is no longer pending',
      };
    }

    const now = new Date().toISOString();

    // Delete the request record since it's been denied
    await docClient.send(
      new DeleteCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        Key: {
          PK: request.PK,
          SK: request.SK,
        },
      })
    );

    return {
      success: true,
      message: 'Connection request denied',
    };
  } catch (error) {
    console.error('Error denying connection request:', error);
    return {
      success: false,
      message: 'Failed to deny connection request. Please try again.',
    };
  }
}

async function cancelConnectionRequest(initiatorUserId: string, args: { requestId: string }): Promise<ConnectionRequestResult> {
  const { requestId } = args;

  try {
    // Find the request by querying the GSI (since we don't know the recipient)
    const queryResult = await docClient.send(
      new QueryCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        IndexName: 'ByInitiator',
        KeyConditionExpression: 'GSI1PK = :pk',
        FilterExpression: 'id = :requestId AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':pk': `USER#${initiatorUserId}`,
          ':requestId': requestId,
          ':status': 'PENDING',
        },
      })
    );

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return {
        success: false,
        message: 'Connection request not found or already processed',
      };
    }

    const request = queryResult.Items[0] as ConnectionRequest;

    const now = new Date().toISOString();

    // Delete the request record since it's been cancelled
    await docClient.send(
      new DeleteCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        Key: {
          PK: request.PK,
          SK: request.SK,
        },
      })
    );

    return {
      success: true,
      message: 'Connection request cancelled',
    };
  } catch (error) {
    console.error('Error cancelling connection request:', error);
    return {
      success: false,
      message: 'Failed to cancel connection request. Please try again.',
    };
  }
}

async function getIncomingConnectionRequests(userId: string): Promise<ConnectionRequestWithUsers[]> {
  try {
    // Query incoming requests for this user
    const result = await docClient.send(
      new QueryCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'REQUEST#',
        },
        ScanIndexForward: false, // Most recent first
      })
    );

    const requests = (result.Items || []) as ConnectionRequest[];

    // Fetch initiator user details for each request
    const requestsWithUsers: ConnectionRequestWithUsers[] = [];

    for (const request of requests) {
      const userResult = await docClient.send(
        new GetCommand({
          TableName: USERS_TABLE_NAME,
          Key: {
            PK: `USER#${request.initiatorUserId}`,
            SK: 'PROFILE',
          },
        })
      );

      if (userResult.Item) {
        requestsWithUsers.push({
          ...request,
          initiator: userResult.Item as User,
        });
      } else {
        // Include request even if user not found
        requestsWithUsers.push(request);
      }
    }

    return requestsWithUsers;
  } catch (error) {
    console.error('Error getting incoming connection requests:', error);
    return [];
  }
}

async function getOutgoingConnectionRequests(userId: string): Promise<ConnectionRequestWithUsers[]> {
  try {
    // Query outgoing requests using GSI
    const result = await docClient.send(
      new QueryCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        IndexName: 'ByInitiator',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
        },
        ScanIndexForward: false, // Most recent first
      })
    );

    const requests = (result.Items || []) as ConnectionRequest[];

    // Fetch recipient user details for each request
    const requestsWithUsers: ConnectionRequestWithUsers[] = [];

    for (const request of requests) {
      const userResult = await docClient.send(
        new GetCommand({
          TableName: USERS_TABLE_NAME,
          Key: {
            PK: `USER#${request.recipientUserId}`,
            SK: 'PROFILE',
          },
        })
      );

      if (userResult.Item) {
        requestsWithUsers.push({
          ...request,
          recipient: userResult.Item as User,
        });
      } else {
        // Include request even if user not found
        requestsWithUsers.push(request);
      }
    }

    return requestsWithUsers;
  } catch (error) {
    console.error('Error getting outgoing connection requests:', error);
    return [];
  }
}

async function checkConnectionOrRequest(userId: string, args: { userId: string }): Promise<ConnectionStatus> {
  const { userId: otherUserId } = args;

  try {
    // Check if already connected
    const isConnected = await checkExistingConnection(userId, otherUserId);
    if (isConnected) {
      return {
        isConnected: true,
        hasPendingRequest: false,
      };
    }

    // Check for pending requests in either direction
    const pendingRequest = await checkExistingRequest(userId, otherUserId);
    if (pendingRequest) {
      const requestDirection = pendingRequest.initiatorUserId === userId ? 'outgoing' : 'incoming';
      return {
        isConnected: false,
        hasPendingRequest: true,
        requestDirection,
      };
    }

    return {
      isConnected: false,
      hasPendingRequest: false,
    };
  } catch (error) {
    console.error('Error checking connection or request:', error);
    return {
      isConnected: false,
      hasPendingRequest: false,
    };
  }
}

// Helper functions

async function checkExistingConnection(userId1: string, userId2: string): Promise<boolean> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: CONNECTIONS_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId1}`,
          ':sk': 'CONNECTION#',
        },
      })
    );

    return (result.Items || []).some(
      (item: Record<string, unknown>) => item.connectedUserId === userId2
    );
  } catch (error) {
    console.error('Error checking existing connection:', error);
    return false;
  }
}

async function checkExistingRequest(userId1: string, userId2: string): Promise<ConnectionRequest | null> {
  try {
    // Check for request from userId1 to userId2
    const outgoingResult = await docClient.send(
      new QueryCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'initiatorUserId = :initiator AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':pk': `USER#${userId2}`,
          ':sk': 'REQUEST#',
          ':initiator': userId1,
          ':status': 'PENDING',
        },
      })
    );

    if (outgoingResult.Items && outgoingResult.Items.length > 0) {
      return outgoingResult.Items[0] as ConnectionRequest;
    }

    // Check for request from userId2 to userId1
    const incomingResult = await docClient.send(
      new QueryCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'initiatorUserId = :initiator AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':pk': `USER#${userId1}`,
          ':sk': 'REQUEST#',
          ':initiator': userId2,
          ':status': 'PENDING',
        },
      })
    );

    if (incomingResult.Items && incomingResult.Items.length > 0) {
      return incomingResult.Items[0] as ConnectionRequest;
    }

    return null;
  } catch (error) {
    console.error('Error checking existing request:', error);
    return null;
  }
}

async function createApprovedConnection(initiatorUserId: string, recipientUserId: string): Promise<void> {
  // This function will call the existing connection creation logic
  // For now, we'll implement a simplified version
  // In the integration step, this will call the existing connections Lambda function

  const now = new Date().toISOString();
  const connectionId1 = randomUUID();
  const connectionId2 = randomUUID();

  // Create connection record for initiator
  const connection1 = {
    PK: `USER#${initiatorUserId}`,
    SK: `CONNECTION#${connectionId1}`,
    GSI1PK: `CONNECTED#${recipientUserId}`,
    GSI1SK: now,
    id: connectionId1,
    userId: initiatorUserId,
    connectedUserId: recipientUserId,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };

  // Create connection record for recipient
  const connection2 = {
    PK: `USER#${recipientUserId}`,
    SK: `CONNECTION#${connectionId2}`,
    GSI1PK: `CONNECTED#${initiatorUserId}`,
    GSI1SK: now,
    id: connectionId2,
    userId: recipientUserId,
    connectedUserId: initiatorUserId,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };

  // Create both connections
  await Promise.all([
    docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Item: connection1,
    })),
    docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Item: connection2,
    })),
  ]);

  // Update connection counts for both users
  await Promise.all([
    docClient.send(new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        PK: `USER#${initiatorUserId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: 'SET connectionCount = if_not_exists(connectionCount, :zero) + :inc, updatedAt = :now',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':inc': 1,
        ':now': now,
      },
    })),
    docClient.send(new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        PK: `USER#${recipientUserId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: 'SET connectionCount = if_not_exists(connectionCount, :zero) + :inc, updatedAt = :now',
      ExpressionAttributeValues: {
        ':zero': 0,
        ':inc': 1,
        ':now': now,
      },
    })),
  ]);

  // TODO: Award badges and trigger events (will be integrated later)
}