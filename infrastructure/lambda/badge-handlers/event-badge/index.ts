import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const REINVENT_DATES = process.env.REINVENT_DATES;

interface ConnectionCreatedDetail {
  connectionId: string;
  userId: string;
  connectedUserId: string;
  timestamp: string;
}

interface EventConfig {
  year: number;
  start: string;
  end: string;
}

interface BadgeMetadata {
  eventYear?: number;
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
}

export async function handler(
  event: EventBridgeEvent<'ConnectionCreated', ConnectionCreatedDetail>
): Promise<void> {
  console.log('Event badge handler invoked', JSON.stringify(event, null, 2));

  const { userId, timestamp } = event.detail;

  try {
    if (!REINVENT_DATES) {
      console.log('REINVENT_DATES not configured, skipping');
      return;
    }

    let reinventDates: EventConfig[];
    try {
      reinventDates = JSON.parse(REINVENT_DATES);
    } catch (error) {
      console.error('Failed to parse REINVENT_DATES:', error);
      return;
    }

    const connectionDate = new Date(timestamp);


    // Check if connection falls within any configured date range
    let matchedEvent: EventConfig | null = null;
    for (const eventConfig of reinventDates) {
      const startDate = new Date(eventConfig.start);
      const endDate = new Date(eventConfig.end);

      if (connectionDate >= startDate && connectionDate <= endDate) {
        matchedEvent = eventConfig;
        break;
      }
    }

    if (!matchedEvent) {
      console.log(`Connection timestamp ${timestamp} does not fall within any configured event dates`);
      return;
    }

    console.log(`Connection occurred during re:Invent ${matchedEvent.year}, checking for badge award`);

    // Get user to check if they already have badge for this year
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

    const hasBadgeForYear = user.badges?.some(
      (b: Badge) => b.id === 'reinvent-connector' && b.metadata?.eventYear === matchedEvent.year
    );
    if (hasBadgeForYear) {
      console.log(`User ${userId} already has re:Invent badge for ${matchedEvent.year}`);
      return;
    }

    // Award badge
    const badge: Badge = {
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

    console.log(`Successfully awarded re:Invent ${matchedEvent.year} badge to user ${userId}`);
  } catch (error) {
    console.error('Error awarding event badge:', error);
    throw error;
  }
}
