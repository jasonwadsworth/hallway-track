import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const eventBridge = new EventBridgeClient({});

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

interface User {
  id: string;
  connectionCount: number;
  updatedAt: string;
}

interface Connection {
  id: string;
  userId: string;
  connectedUserId: string;
  createdAt: string;
}

export async function handler(): Promise<void> {
  console.log('Starting badge migration...');

  try {
    let processedUsers = 0;
    let publishedEvents = 0;

    // Scan all users
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const scanResult = await docClient.send(
        new ScanCommand({
          TableName: USERS_TABLE_NAME,
          FilterExpression: 'SK = :sk',
          ExpressionAttributeValues: {
            ':sk': 'PROFILE'
          },
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: 25 // Process in small batches
        })
      );

      const users = (scanResult.Items || []) as User[];
      console.log(`Processing batch of ${users.length} users`);

      for (const user of users) {
        // Query all connections for this user
        const connectionsResult = await docClient.send(
          new QueryCommand({
            TableName: CONNECTIONS_TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `USER#${user.id}`,
              ':sk': 'CONNECTION#'
            }
          })
        );

        const connections = (connectionsResult.Items || []) as Connection[];
        console.log(`User ${user.id} has ${connections.length} connections`);

        // Publish ConnectionCreated events for each connection
        const connectionEvents = connections.map(connection => ({
          Source: 'hallway-track.migration',
          DetailType: 'ConnectionCreated',
          Detail: JSON.stringify({
            connectionId: connection.id,
            userId: connection.userId,
            connectedUserId: connection.connectedUserId,
            timestamp: connection.createdAt
          }),
          EventBusName: EVENT_BUS_NAME
        }));


        // Publish events in batches of 10 (EventBridge limit)
        for (let i = 0; i < connectionEvents.length; i += 10) {
          const batch = connectionEvents.slice(i, i + 10);
          await eventBridge.send(new PutEventsCommand({ Entries: batch }));
          publishedEvents += batch.length;

          // Small delay to avoid throttling
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // If user has 500+ connections, publish UserConnectionCountUpdated event
        if (user.connectionCount >= 500) {
          await eventBridge.send(
            new PutEventsCommand({
              Entries: [{
                Source: 'hallway-track.migration',
                DetailType: 'UserConnectionCountUpdated',
                Detail: JSON.stringify({
                  userId: user.id,
                  connectionCount: user.connectionCount,
                  previousCount: 0,
                  timestamp: user.updatedAt
                }),
                EventBusName: EVENT_BUS_NAME
              }]
            })
          );
          publishedEvents++;
          console.log(`Published UserConnectionCountUpdated event for user ${user.id}`);
        }

        processedUsers++;

        // Log progress every 10 users
        if (processedUsers % 10 === 0) {
          console.log(`Progress: ${processedUsers} users processed, ${publishedEvents} events published`);
        }
      }

      lastEvaluatedKey = scanResult.LastEvaluatedKey;

      // Small delay between batches
      if (lastEvaluatedKey) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } while (lastEvaluatedKey);

    console.log(`Migration complete! Processed ${processedUsers} users, published ${publishedEvents} events`);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}
