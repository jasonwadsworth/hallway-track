import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

interface Badge {
    id: string;
    name: string;
    earnedAt?: string;
}

interface UserProfile {
    PK: string;
    SK: string;
    id: string;
    badges?: Badge[];
    badgeCount?: number;
}

/**
 * Calculate the GSI3SK value for badge leaderboard sorting.
 * Uses inverted count (9999999999 - count) for descending order sort.
 */
function calculateGSI3SK(userId: string, badgeCount: number): string {
    const invertedCount = 9999999999 - badgeCount;
    const paddedCount = invertedCount.toString().padStart(10, '0');
    return `${paddedCount}#${userId}`;
}

interface MigrationResult {
    processedUsers: number;
    updatedUsers: number;
    status: 'success' | 'error';
    message: string;
}

export async function handler(): Promise<MigrationResult> {
    console.log('Starting badge leaderboard GSI migration...');

    let processedUsers = 0;
    let updatedUsers = 0;

    try {
        let lastEvaluatedKey: Record<string, unknown> | undefined;

        do {
            // Scan all user profiles
            const scanResult = await docClient.send(
                new ScanCommand({
                    TableName: USERS_TABLE_NAME,
                    FilterExpression: 'SK = :sk',
                    ExpressionAttributeValues: {
                        ':sk': 'PROFILE',
                    },
                    ExclusiveStartKey: lastEvaluatedKey,
                    Limit: 25,
                })
            );

            const users = (scanResult.Items || []) as UserProfile[];
            console.log(`Processing batch of ${users.length} users`);

            // Prepare batch write items
            const writeRequests: Array<{
                PutRequest: {
                    Item: Record<string, unknown>;
                };
            }> = [];

            for (const user of users) {
                // Count badges from the badges array
                const badgeCount = user.badges?.length ?? 0;

                // Only add to badge leaderboard if user has at least 1 badge
                if (badgeCount > 0) {
                    writeRequests.push({
                        PutRequest: {
                            Item: {
                                ...user,
                                badgeCount,
                                GSI3PK: 'BADGE_LEADERBOARD',
                                GSI3SK: calculateGSI3SK(user.id, badgeCount),
                            },
                        },
                    });
                    updatedUsers++;
                }

                processedUsers++;
            }

            // Execute batch writes in groups of 25 (DynamoDB limit)
            for (let i = 0; i < writeRequests.length; i += 25) {
                const batch = writeRequests.slice(i, i + 25);
                await docClient.send(
                    new BatchWriteCommand({
                        RequestItems: {
                            [USERS_TABLE_NAME]: batch,
                        },
                    })
                );

                // Small delay to avoid throttling
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // Log progress
            console.log(`Progress: ${processedUsers} users processed, ${updatedUsers} updated with badge GSI fields`);

            lastEvaluatedKey = scanResult.LastEvaluatedKey;

            // Small delay between batches
            if (lastEvaluatedKey) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        } while (lastEvaluatedKey);

        const message = `Migration complete! Processed ${processedUsers} users, updated ${updatedUsers} with badge leaderboard GSI fields`;
        console.log(message);

        return {
            processedUsers,
            updatedUsers,
            status: 'success',
            message,
        };
    } catch (error) {
        console.error('Badge leaderboard migration failed:', error);
        return {
            processedUsers,
            updatedUsers,
            status: 'error',
            message: `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
