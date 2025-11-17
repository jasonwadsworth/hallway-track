import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { AppSyncResolverEvent } from 'aws-lambda';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const eventBridgeClient = new EventBridgeClient({});

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;
const CONNECTION_REQUESTS_TABLE_NAME = process.env.CONNECTION_REQUESTS_TABLE_NAME!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'hallway-track-badges';

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
  initiatorNote?: string;
  initiatorTags?: string[];
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

export const handler = async (event: AppSyncResolverEvent<Record<string, unknown>>): Promise<ConnectionRequestResult | ConnectionRequest[] | ConnectionStatus> => {
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
    return await createConnectionRequest(userId, event.arguments as { recipientUserId: string; note?: string; tags?: string[] });
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
  } else if (fieldName === 'updateConnectionRequestMetadata') {
    return await updateConnectionRequestMetadata(userId, event.arguments as { requestId: string; note?: string; tags?: string[] });
  }

  throw new Error(`Unknown field: ${fieldName}`);
};

async function createConnectionRequest(initiatorUserId: string, args: { recipientUserId: string; note?: string; tags?: string[] }): Promise<ConnectionRequestResult> {
  const { recipientUserId, note, tags } = args;

  console.log('Creating connection request from', initiatorUserId, 'to', recipientUserId);

  try {
    // Validate note length if provided
    if (note && note.length > 1000) {
      return {
        success: false,
        message: 'Note must be 1000 characters or less',
      };
    }

    // Validate tags if provided
    if (tags) {
      for (const tag of tags) {
        if (!tag || tag.trim().length === 0) {
          return {
            success: false,
            message: 'Tags cannot be empty',
          };
        }
        if (tag.length > 50) {
          return {
            success: false,
            message: 'Tags must be 50 characters or less',
          };
        }
      }
    }

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

    // Add metadata if provided
    if (note && note.trim().length > 0) {
      connectionRequest.initiatorNote = note.trim();
    }
    if (tags && tags.length > 0) {
      connectionRequest.initiatorTags = tags.map(t => t.trim());
    }

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

    // Delete the request record
    await docClient.send(
      new DeleteCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        Key: {
          PK: request.PK,
          SK: request.SK,
        },
      })
    );

    console.log(`Connection request ${requestId} deleted`);

    // Emit ConnectionRequestApproved event for async processing
    await eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: 'hallway-track.connection-requests',
            DetailType: 'ConnectionRequestApproved',
            Detail: JSON.stringify({
              requestId,
              initiatorUserId: request.initiatorUserId,
              recipientUserId: request.recipientUserId,
              initiatorNote: request.initiatorNote,
              initiatorTags: request.initiatorTags,
              timestamp: now,
            }),
            EventBusName: EVENT_BUS_NAME,
          },
        ],
      })
    );

    console.log('ConnectionRequestApproved event emitted');

    // Return success immediately - connection creation and metadata transfer happen asynchronously
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

async function updateConnectionRequestMetadata(initiatorUserId: string, args: { requestId: string; note?: string; tags?: string[] }): Promise<ConnectionRequestResult> {
  const { requestId, note, tags } = args;

  try {
    // Validate note length if provided
    if (note && note.length > 1000) {
      return {
        success: false,
        message: 'Note must be 1000 characters or less',
      };
    }

    // Validate tags if provided
    if (tags) {
      for (const tag of tags) {
        if (!tag || tag.trim().length === 0) {
          return {
            success: false,
            message: 'Tags cannot be empty',
          };
        }
        if (tag.length > 50) {
          return {
            success: false,
            message: 'Tags must be 50 characters or less',
          };
        }
      }
    }

    // Find the request by querying the GSI (since we don't know the recipient)
    const queryResult = await docClient.send(
      new QueryCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        IndexName: 'ByInitiator',
        KeyConditionExpression: 'GSI1PK = :pk',
        FilterExpression: 'id = :requestId',
        ExpressionAttributeValues: {
          ':pk': `USER#${initiatorUserId}`,
          ':requestId': requestId,
        },
      })
    );

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return {
        success: false,
        message: 'Connection request not found',
      };
    }

    const request = queryResult.Items[0] as ConnectionRequest;

    // Verify the request is pending
    if (request.status !== 'PENDING') {
      return {
        success: false,
        message: 'This request can no longer be edited',
      };
    }

    const now = new Date().toISOString();

    // Build update expression dynamically
    const updateParts: string[] = ['updatedAt = :now'];
    const attributeValues: Record<string, string | string[]> = { ':now': now };
    const removeAttributes: string[] = [];

    if (note !== undefined) {
      if (note && note.trim().length > 0) {
        updateParts.push('initiatorNote = :note');
        attributeValues[':note'] = note.trim();
      } else {
        removeAttributes.push('initiatorNote');
      }
    }

    if (tags !== undefined) {
      if (tags && tags.length > 0) {
        updateParts.push('initiatorTags = :tags');
        attributeValues[':tags'] = tags.map(t => t.trim());
      } else {
        removeAttributes.push('initiatorTags');
      }
    }

    let updateExpression = `SET ${updateParts.join(', ')}`;
    if (removeAttributes.length > 0) {
      updateExpression += ` REMOVE ${removeAttributes.join(', ')}`;
    }

    // Update the request
    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: CONNECTION_REQUESTS_TABLE_NAME,
        Key: {
          PK: request.PK,
          SK: request.SK,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: attributeValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    return {
      success: true,
      message: 'Connection request metadata updated',
      request: updateResult.Attributes as ConnectionRequest,
    };
  } catch (error) {
    console.error('Error updating connection request metadata:', error);
    return {
      success: false,
      message: 'Failed to update connection request metadata. Please try again.',
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

async function getIncomingConnectionRequests(userId: string): Promise<ConnectionRequest[]> {
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

    // Sanitize metadata fields for recipients (privacy)
    // Remove initiatorNote and initiatorTags from the response
    const sanitizedRequests = requests.map(request => ({
      ...request,
      initiatorNote: undefined,
      initiatorTags: undefined,
    }));

    // Return requests without user data - field resolver will handle that
    return sanitizedRequests;
  } catch (error) {
    console.error('Error getting incoming connection requests:', error);
    return [];
  }
}

async function getOutgoingConnectionRequests(userId: string): Promise<ConnectionRequest[]> {
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

    // Return requests without user data - field resolver will handle that
    return requests;
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