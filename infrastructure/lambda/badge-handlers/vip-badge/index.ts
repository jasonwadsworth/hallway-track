import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

interface ConnectionCreatedDetail {
  connectionId: string;
  userId: string;
  connectedUserId: string;
  timestamp: string;
}

interface BadgeMetadata {
  count?: number;
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

interface User {
  badges?: Badge[];
  connectionCount: number;
}

export async function handler(
  event: EventBridgeEvent<'ConnectionCreated', ConnectionCreatedDetail>
): Promise<void> {
  console.log('VIP badge handler invoked', JSON.stringify(event, null, 2));

  const { userId, connectedUserId, timestamp } = event.detail;

  try {
    // Get connected user to check their connection count
    const connectedUserResult = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${connectedUserId}`, SK: 'PROFILE' }
      })
    );

    const connectedUser = connectedUserResult.Item as User | undefined;


    if (!connectedUser || connectedUser.connectionCount < 50) {
      console.log(`Connected user ${connectedUserId} does not have 50+ connections`);
      return;
    }

    console.log(`User ${userId} connected with VIP user ${connectedUserId}, checking for badge award`);

    // Get current user
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

    const existingBadge = user.badges?.find((b: Badge) => b.id === 'vip-connection');

    let updatedBadges: Badge[];
    if (existingBadge) {
      // Update count
      const currentCount = existingBadge.metadata?.count || 1;
      existingBadge.metadata = { count: currentCount + 1 };
      updatedBadges = user.badges || [];
      console.log(`Updated VIP badge count to ${currentCount + 1} for user ${userId}`);
    } else {
      // Award new badge
      const badge: Badge = {
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
      console.log(`Awarded VIP badge to user ${userId}`);
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

    console.log(`Successfully processed VIP badge for user ${userId}`);
  } catch (error) {
    console.error('Error awarding VIP badge:', error);
    throw error;
  }
}
