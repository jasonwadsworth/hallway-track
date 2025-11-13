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

interface Badge {
  id: string;
  name: string;
  description: string;
  threshold: number;
  category: string;
  iconUrl?: string;
  earnedAt?: string;
}

export async function handler(
  event: EventBridgeEvent<'ConnectionCreated', ConnectionCreatedDetail>
): Promise<void> {
  console.log('Maker badge handler invoked', JSON.stringify(event, null, 2));

  const { userId, connectedUserId, timestamp } = event.detail;

  try {
    // Check if connected user is the maker
    if (!MAKER_USER_ID) {
      console.log('MAKER_USER_ID not configured, skipping');
      return;
    }

    if (connectedUserId !== MAKER_USER_ID) {
      console.log(`Connected user ${connectedUserId} is not the maker ${MAKER_USER_ID}`);
      return;
    }

    console.log(`User ${userId} connected with maker, checking for badge award`);

    // Get user to check if they already have the badge
    const userResult = await docClient.send(
      new GetCommand({
        TableName: USERS_TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' }
      })
    );


    const user = userResult.Item;
    if (!user) {
      console.log(`User ${userId} not found`);
      return;
    }

    const hasBadge = user.badges?.some((b: Badge) => b.id === 'met-the-maker');
    if (hasBadge) {
      console.log(`User ${userId} already has the maker badge`);
      return;
    }

    // Award badge
    const badge: Badge = {
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

    console.log(`Successfully awarded maker badge to user ${userId}`);
  } catch (error) {
    console.error('Error awarding maker badge:', error);
    throw error;
  }
}
