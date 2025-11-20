import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;

interface OldConnection {
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

interface NewConnection {
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

export const handler = async (): Promise<{ migrated: number; errors: number }> => {
  let migrated = 0;
  let errors = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  console.log('Starting connection migration...');

  do {
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: CONNECTIONS_TABLE_NAME,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = (scanResult.Items || []) as OldConnection[];
    console.log(`Processing ${items.length} connections...`);

    for (const oldConnection of items) {
      try {
        // Create new connection with connectedUserId as SK
        const newConnection: NewConnection = {
          ...oldConnection,
          SK: `CONNECTION#${oldConnection.connectedUserId}`,
          id: oldConnection.connectedUserId,
        };

        // Put new connection
        await docClient.send(
          new PutCommand({
            TableName: CONNECTIONS_TABLE_NAME,
            Item: newConnection,
          })
        );

        // Delete old connection if SK is different
        if (oldConnection.SK !== newConnection.SK) {
          await docClient.send(
            new DeleteCommand({
              TableName: CONNECTIONS_TABLE_NAME,
              Key: {
                PK: oldConnection.PK,
                SK: oldConnection.SK,
              },
            })
          );
        }

        migrated++;
        console.log(`Migrated connection: ${oldConnection.PK} -> ${newConnection.SK}`);
      } catch (error) {
        errors++;
        console.error(`Error migrating connection ${oldConnection.PK}/${oldConnection.SK}:`, error);
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`Migration complete. Migrated: ${migrated}, Errors: ${errors}`);

  return { migrated, errors };
};
