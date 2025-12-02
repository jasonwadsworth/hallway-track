import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeEvent } from 'aws-lambda';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

/**
 * Calculate the GSI2SK value for leaderboard sorting.
 * Uses inverted count (9999999999 - count) for descending order sort.
 */
function calculateGSI2SK(userId: string, connectionCount: number): string {
    const invertedCount = 9999999999 - connectionCount;
    const paddedCount = invertedCount.toString().padStart(10, '0');
    return `${paddedCount}#${userId}`;
}

interface ConnectionRequestApprovedDetail {
    requestId: string;
    initiatorUserId: string;
    recipientUserId: string;
    initiatorNote?: string;
    initiatorTags?: string[];
    timestamp: string;
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

// Track processed events for idempotency
const processedEvents = new Set<string>();

export const handler = async (event: EventBridgeEvent<'ConnectionRequestApproved', ConnectionRequestApprovedDetail>): Promise<void> => {
    console.log('ConnectionRequestApprovedHandler invoked:', JSON.stringify(event, null, 2));

    const eventId = event.id;
    const { requestId, initiatorUserId, recipientUserId, initiatorNote, initiatorTags, timestamp } = event.detail;

    // Idempotency check
    if (processedEvents.has(eventId)) {
        console.log(`Event ${eventId} already processed, skipping`);
        return;
    }

    try {
        const now = new Date().toISOString();

        // Step 1: Create bidirectional connections
        console.log(`Creating bidirectional connections between ${initiatorUserId} and ${recipientUserId}`);

        // Use connectedUserId as the connection ID for direct lookups
        // This allows getConnectedProfile to find connections by SK: CONNECTION#<connectedUserId>

        // Create connection record for initiator
        const connection1: Connection = {
            PK: `USER#${initiatorUserId}`,
            SK: `CONNECTION#${recipientUserId}`,
            GSI1PK: `CONNECTED#${recipientUserId}`,
            GSI1SK: now,
            id: recipientUserId,
            userId: initiatorUserId,
            connectedUserId: recipientUserId,
            tags: initiatorTags || [],
            createdAt: now,
            updatedAt: now,
        };

        // Add note if provided
        if (initiatorNote && initiatorNote.trim().length > 0) {
            connection1.note = initiatorNote.trim();
        }

        // Create connection record for recipient
        const connection2: Connection = {
            PK: `USER#${recipientUserId}`,
            SK: `CONNECTION#${initiatorUserId}`,
            GSI1PK: `CONNECTED#${initiatorUserId}`,
            GSI1SK: now,
            id: initiatorUserId,
            userId: recipientUserId,
            connectedUserId: initiatorUserId,
            tags: [],
            createdAt: now,
            updatedAt: now,
        };

        // Create both connections
        await Promise.all([
            docClient.send(
                new PutCommand({
                    TableName: CONNECTIONS_TABLE_NAME,
                    Item: connection1,
                })
            ),
            docClient.send(
                new PutCommand({
                    TableName: CONNECTIONS_TABLE_NAME,
                    Item: connection2,
                })
            ),
        ]);

        console.log('Bidirectional connections created successfully');

        // Step 2: Update connection counts and leaderboard GSI for both users
        console.log('Updating connection counts for both users');

        // Update both users and get their new connection counts
        const [initiatorResult, recipientResult] = await Promise.all([
            docClient.send(
                new UpdateCommand({
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
                    ReturnValues: 'ALL_NEW',
                })
            ),
            docClient.send(
                new UpdateCommand({
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
                    ReturnValues: 'ALL_NEW',
                })
            ),
        ]);

        // Update leaderboard GSI fields for both users
        const initiatorCount = (initiatorResult.Attributes?.connectionCount as number) || 1;
        const recipientCount = (recipientResult.Attributes?.connectionCount as number) || 1;

        await Promise.all([
            docClient.send(
                new UpdateCommand({
                    TableName: USERS_TABLE_NAME,
                    Key: {
                        PK: `USER#${initiatorUserId}`,
                        SK: 'PROFILE',
                    },
                    UpdateExpression: 'SET GSI2PK = :gsi2pk, GSI2SK = :gsi2sk',
                    ExpressionAttributeValues: {
                        ':gsi2pk': 'LEADERBOARD',
                        ':gsi2sk': calculateGSI2SK(initiatorUserId, initiatorCount),
                    },
                })
            ),
            docClient.send(
                new UpdateCommand({
                    TableName: USERS_TABLE_NAME,
                    Key: {
                        PK: `USER#${recipientUserId}`,
                        SK: 'PROFILE',
                    },
                    UpdateExpression: 'SET GSI2PK = :gsi2pk, GSI2SK = :gsi2sk',
                    ExpressionAttributeValues: {
                        ':gsi2pk': 'LEADERBOARD',
                        ':gsi2sk': calculateGSI2SK(recipientUserId, recipientCount),
                    },
                })
            ),
        ]);

        console.log('Connection counts and leaderboard GSI updated successfully');

        // Note: ConnectionCreated and UserConnectionCountUpdated events will be emitted
        // automatically by the DynamoDB stream processor when it detects the new connections
        // and connection count changes. No need to manually emit events here - this prevents
        // duplication and race conditions.

        // Mark event as processed
        processedEvents.add(eventId);

        console.log(`ConnectionRequestApprovedHandler completed successfully for event ${eventId}`);
    } catch (error) {
        console.error('Error processing ConnectionRequestApproved event:', error);
        throw error; // Let EventBridge retry
    }
};
