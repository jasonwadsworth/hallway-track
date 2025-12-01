import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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

interface ConnectionRemovedDetail {
    userId: string;
    connectedUserId: string;
    connectionId: string;
    timestamp: string;
}

// Track processed events for idempotency
const processedEvents = new Set<string>();

export const handler = async (event: EventBridgeEvent<'ConnectionRemoved', ConnectionRemovedDetail>): Promise<void> => {
    console.log('ConnectionRemovedHandler invoked:', JSON.stringify(event, null, 2));

    const eventId = event.id;
    const { userId, connectedUserId, connectionId, timestamp } = event.detail;

    // Idempotency check
    if (processedEvents.has(eventId)) {
        console.log(`Event ${eventId} already processed, skipping`);
        return;
    }

    try {
        // Step 1: Find and delete reciprocal connection
        console.log(`Finding reciprocal connection for user ${connectedUserId} connected to ${userId}`);

        const reciprocalConnectionsResult = await docClient.send(
            new QueryCommand({
                TableName: CONNECTIONS_TABLE_NAME,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                FilterExpression: 'connectedUserId = :connectedUserId',
                ExpressionAttributeValues: {
                    ':pk': `USER#${connectedUserId}`,
                    ':sk': 'CONNECTION#',
                    ':connectedUserId': userId,
                },
            })
        );

        if (reciprocalConnectionsResult.Items && reciprocalConnectionsResult.Items.length > 0) {
            const reciprocalConnection = reciprocalConnectionsResult.Items[0];
            console.log(`Deleting reciprocal connection: ${reciprocalConnection.id}`);

            await docClient.send(
                new DeleteCommand({
                    TableName: CONNECTIONS_TABLE_NAME,
                    Key: {
                        PK: reciprocalConnection.PK,
                        SK: reciprocalConnection.SK,
                    },
                })
            );

            console.log('Reciprocal connection deleted successfully');
        } else {
            console.warn(`Reciprocal connection not found for user ${connectedUserId} connected to ${userId}`);
        }

        // Step 2: Update connection counts and leaderboard GSI for both users
        const now = new Date().toISOString();

        console.log(`Updating connection count for user ${userId}`);
        const userResult = await docClient.send(
            new UpdateCommand({
                TableName: USERS_TABLE_NAME,
                Key: {
                    PK: `USER#${userId}`,
                    SK: 'PROFILE',
                },
                UpdateExpression: 'SET connectionCount = if_not_exists(connectionCount, :zero) - :dec, updatedAt = :now',
                ExpressionAttributeValues: {
                    ':zero': 0,
                    ':dec': 1,
                    ':now': now,
                },
                ReturnValues: 'ALL_NEW',
            })
        );

        console.log(`Updating connection count for user ${connectedUserId}`);
        const connectedUserResult = await docClient.send(
            new UpdateCommand({
                TableName: USERS_TABLE_NAME,
                Key: {
                    PK: `USER#${connectedUserId}`,
                    SK: 'PROFILE',
                },
                UpdateExpression: 'SET connectionCount = if_not_exists(connectionCount, :zero) - :dec, updatedAt = :now',
                ExpressionAttributeValues: {
                    ':zero': 0,
                    ':dec': 1,
                    ':now': now,
                },
                ReturnValues: 'ALL_NEW',
            })
        );

        // Update leaderboard GSI fields for both users
        const userCount = Math.max(0, (userResult.Attributes?.connectionCount as number) || 0);
        const connectedUserCount = Math.max(0, (connectedUserResult.Attributes?.connectionCount as number) || 0);

        const updatePromises: Promise<unknown>[] = [];

        // If count > 0, update GSI fields; if count = 0, remove from leaderboard
        if (userCount > 0) {
            updatePromises.push(
                docClient.send(
                    new UpdateCommand({
                        TableName: USERS_TABLE_NAME,
                        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
                        UpdateExpression: 'SET GSI2PK = :gsi2pk, GSI2SK = :gsi2sk',
                        ExpressionAttributeValues: {
                            ':gsi2pk': 'LEADERBOARD',
                            ':gsi2sk': calculateGSI2SK(userId, userCount),
                        },
                    })
                )
            );
        } else {
            updatePromises.push(
                docClient.send(
                    new UpdateCommand({
                        TableName: USERS_TABLE_NAME,
                        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
                        UpdateExpression: 'REMOVE GSI2PK, GSI2SK',
                    })
                )
            );
        }

        if (connectedUserCount > 0) {
            updatePromises.push(
                docClient.send(
                    new UpdateCommand({
                        TableName: USERS_TABLE_NAME,
                        Key: { PK: `USER#${connectedUserId}`, SK: 'PROFILE' },
                        UpdateExpression: 'SET GSI2PK = :gsi2pk, GSI2SK = :gsi2sk',
                        ExpressionAttributeValues: {
                            ':gsi2pk': 'LEADERBOARD',
                            ':gsi2sk': calculateGSI2SK(connectedUserId, connectedUserCount),
                        },
                    })
                )
            );
        } else {
            updatePromises.push(
                docClient.send(
                    new UpdateCommand({
                        TableName: USERS_TABLE_NAME,
                        Key: { PK: `USER#${connectedUserId}`, SK: 'PROFILE' },
                        UpdateExpression: 'REMOVE GSI2PK, GSI2SK',
                    })
                )
            );
        }

        await Promise.all(updatePromises);

        console.log('Connection counts and leaderboard GSI updated successfully');

        // Note: Badge re-evaluation events will be emitted automatically by the
        // DynamoDB stream processor when it detects the connection count changes.
        // No need to manually emit events here - this prevents duplication and race conditions.

        // Mark event as processed
        processedEvents.add(eventId);

        console.log(`ConnectionRemovedHandler completed successfully for event ${eventId}`);
    } catch (error) {
        console.error('Error processing ConnectionRemoved event:', error);
        throw error; // Let EventBridge retry
    }
};
