import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;

interface UserConnectionCountUpdatedDetail {
  userId: string;
  connectionCount: number;
  previousCount: number;
  timestamp: string;
}

interface BadgeMetadata {
  relatedUserId?: string;
  relatedUserName?: string;
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
  createdAt: string;
}

interface User {
  badges?: Badge[];
  displayName: string;
}

export async function handler(
  event: EventBridgeEvent<'UserConnectionCountUpdated', UserConnectionCountUpdatedDetail>
): Promise<void> {
  console.log('Early supporter badge handler invoked', JSON.stringify(event, null, 2));

  const { userId, connectionCount } = event.detail;

  try {
    // Only process when user reaches exactly 500 connections
    if (connectionCount !== 500) {
      console.log(`User ${userId} has ${connectionCount} connections, not 500`);
      return;
    }

    console.log(`User ${userId} reached 500 connections, awarding early supporter badges`);


    // Query all connections for this user
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

    const connections = (connectionsResult.Items || []) as Connection[];

    // Sort by creation date and get first 10
    const earlyConnections = connections
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, 10);

    console.log(`Found ${earlyConnections.length} early connections for user ${userId}`);

    // Get the popular user's display name
    const popularUserResult = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
      })
    );

    const popularUser = popularUserResult.Item as User | undefined;
    if (!popularUser) {
      console.log(`Popular user ${userId} not found`);
      return;
    }

    // Award badge to each early supporter
    let badgesAwarded = 0;
    for (const connection of earlyConnections) {
      const supporterResult = await docClient.send(
        new GetCommand({
          TableName: USERS_TABLE_NAME,
          Key: { PK: `USER#${connection.connectedUserId}`, SK: 'PROFILE' }
        })
      );

      const supporter = supporterResult.Item as User | undefined;
      if (!supporter) {
        console.log(`Supporter ${connection.connectedUserId} not found`);
        continue;
      }

      // Check if they already have this badge for this user
      const hasBadge = supporter.badges?.some(
        (b: Badge) => b.id === 'early-supporter' && b.metadata?.relatedUserId === userId
      );
      if (hasBadge) {
        console.log(`Supporter ${connection.connectedUserId} already has early supporter badge for ${userId}`);
        continue;
      }

      // Award badge
      const badge: Badge = {
        id: 'early-supporter',
        name: 'Early Supporter',
        description: 'Was among the first 10 connections of a user with 500+ connections',
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

      badgesAwarded++;
      console.log(`Awarded early supporter badge to ${connection.connectedUserId}`);
    }

    console.log(`Successfully awarded ${badgesAwarded} early supporter badges`);
  } catch (error) {
    console.error('Error awarding early supporter badges:', error);
    throw error;
  }
}
