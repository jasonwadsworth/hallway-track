import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;

interface ConnectionCreatedDetail {
  connectionId: string;
  userId: string;
  connectedUserId: string;
  timestamp: string;
}

interface BadgeMetadata {
  triangleUsers?: string[];
}

interface Badge {
  id: string;
  name: string;
  description: string;
  threshold: number;
  category: string;
  iconUrl?: string;
  earnedAt?: string;
  metadata?: BadgeMetadata;
}

interface Connection {
  connectedUserId: string;
}

interface User {
  badges?: Badge[];
}

export async function handler(
  event: EventBridgeEvent<'ConnectionCreated', ConnectionCreatedDetail>
): Promise<void> {
  console.log('Triangle badge handler invoked', JSON.stringify(event, null, 2));

  const { userId, connectedUserId, timestamp } = event.detail;

  try {
    // Get user to check if they already have the badge
    const userResult = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
      })
    );

    const user = userResult.Item as User | undefined;


    if (!user) {
      console.log(`User ${userId} not found`);
      return;
    }

    const hasBadge = user.badges?.some((b: Badge) => b.id === 'triangle-complete');
    if (hasBadge) {
      console.log(`User ${userId} already has the triangle badge`);
      return;
    }

    console.log(`Checking for triangle completion for user ${userId}`);

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
      (userConnectionsResult.Items || []).map((item) => (item as Connection).connectedUserId)
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

    // Find mutual connections (excluding the new connection)
    const mutualConnection = (connectedUserConnectionsResult.Items || []).find(
      (item) => {
        const c = item as Connection;
        return userConnectionIds.has(c.connectedUserId) && c.connectedUserId !== userId;
      }
    );

    if (!mutualConnection) {
      console.log(`No triangle found for user ${userId}`);
      return;
    }

    console.log(`Triangle found for user ${userId} with ${connectedUserId} and ${mutualConnection.connectedUserId}`);

    // Award badge
    const badge: Badge = {
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

    console.log(`Successfully awarded triangle badge to user ${userId}`);
  } catch (error) {
    console.error('Error awarding triangle badge:', error);
    throw error;
  }
}
