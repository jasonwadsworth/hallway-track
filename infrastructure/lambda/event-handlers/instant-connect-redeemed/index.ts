import { DynamoDBClient, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
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

interface InstantConnectRedeemedDetail {
    tokenOwnerId: string;
    redeemerId: string;
    timestamp: string;
}

// Track processed events for idempotency
const processedEvents = new Set<string>();

export const handler = async (event: EventBridgeEvent<'InstantConnectRedeemed', InstantConnectRedeemedDetail>): Promise<void> => {
    console.log('InstantConnectRedeemedHandler invoked:', JSON.stringify(event, null, 2));

    const eventId = event.id;
    const { tokenOwnerId, redeemerId } = event.detail;

    // Idempotency check
    if (processedEvents.has(eventId)) {
        console.log(`Event ${eventId} already processed, skipping`);
        return;
    }

    try {
        const now = new Date().toISOString();

        // Step 1: Create bidirectional connections using a transaction
        console.log(`Creating bidirectional connections between ${tokenOwnerId} and ${redeemerId}`);

        await dynamoClient.send(
            new TransactWriteItemsCommand({
                TransactItems: [
                    {
                        Put: {
                            TableName: CONNECTIONS_TABLE_NAME,
                            Item: marshall({
                                PK: `USER#${tokenOwnerId}`,
                                SK: `CONNECTION#${redeemerId}`,
                                GSI1PK: `CONNECTED#${redeemerId}`,
                                GSI1SK: now,
                                id: redeemerId,
                                userId: tokenOwnerId,
                                connectedUserId: redeemerId,
                                tags: [],
                                createdAt: now,
                                updatedAt: now,
                            }),
                        },
                    },
                    {
                        Put: {
                            TableName: CONNECTIONS_TABLE_NAME,
                            Item: marshall({
                                PK: `USER#${redeemerId}`,
                                SK: `CONNECTION#${tokenOwnerId}`,
                                GSI1PK: `CONNECTED#${tokenOwnerId}`,
                                GSI1SK: now,
                                id: tokenOwnerId,
                                userId: redeemerId,
                                connectedUserId: tokenOwnerId,
                                tags: [],
                                createdAt: now,
                                updatedAt: now,
                            }),
                        },
                    },
                ],
            })
        );

        console.log('Bidirectional connections created successfully via transaction');

        // Step 2: Update connection counts for both users
        console.log('Updating connection counts for both users');

        const [ownerResult, redeemerResult] = await Promise.all([
            docClient.send(
                new UpdateCommand({
                    TableName: USERS_TABLE_NAME,
                    Key: {
                        PK: `USER#${tokenOwnerId}`,
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
                        PK: `USER#${redeemerId}`,
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
        const ownerCount = (ownerResult.Attributes?.connectionCount as number) || 1;
        const redeemerCount = (redeemerResult.Attributes?.connectionCount as number) || 1;

        await Promise.all([
            docClient.send(
                new UpdateCommand({
                    TableName: USERS_TABLE_NAME,
                    Key: {
                        PK: `USER#${tokenOwnerId}`,
                        SK: 'PROFILE',
                    },
                    UpdateExpression: 'SET GSI2PK = :gsi2pk, GSI2SK = :gsi2sk',
                    ExpressionAttributeValues: {
                        ':gsi2pk': 'LEADERBOARD',
                        ':gsi2sk': calculateGSI2SK(tokenOwnerId, ownerCount),
                    },
                })
            ),
            docClient.send(
                new UpdateCommand({
                    TableName: USERS_TABLE_NAME,
                    Key: {
                        PK: `USER#${redeemerId}`,
                        SK: 'PROFILE',
                    },
                    UpdateExpression: 'SET GSI2PK = :gsi2pk, GSI2SK = :gsi2sk',
                    ExpressionAttributeValues: {
                        ':gsi2pk': 'LEADERBOARD',
                        ':gsi2sk': calculateGSI2SK(redeemerId, redeemerCount),
                    },
                })
            ),
        ]);

        console.log('Connection counts and leaderboard GSI updated successfully');

        // Note: ConnectionCreated and UserConnectionCountUpdated events will be emitted
        // automatically by the DynamoDB stream processor when it detects the new connections
        // and connection count changes. This triggers badge evaluation.

        // Mark event as processed
        processedEvents.add(eventId);

        console.log(`InstantConnectRedeemedHandler completed successfully for event ${eventId}`);
    } catch (error) {
        console.error('Error processing InstantConnectRedeemed event:', error);
        throw error; // Let EventBridge retry
    }
};
