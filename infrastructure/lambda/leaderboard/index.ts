import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { AppSyncResolverEvent } from 'aws-lambda';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

// Interfaces
interface LeaderboardQueryArgs {
    limit?: number;
    nextToken?: string;
}

interface LeaderboardEntry {
    rank: number;
    userId: string;
    displayName: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
    gravatarHash: string;
    connectionCount: number;
    isCurrentUser: boolean;
}

interface LeaderboardResult {
    entries: LeaderboardEntry[];
    currentUserEntry?: LeaderboardEntry;
    hasMore: boolean;
    nextToken?: string;
}

interface UserProfile {
    PK: string;
    SK: string;
    id: string;
    displayName: string;
    gravatarHash: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
    connectionCount: number;
    GSI2PK?: string;
    GSI2SK?: string;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * Calculate the GSI2SK value for leaderboard sorting.
 * Uses inverted count (9999999999 - count) for descending order sort.
 */
function calculateGSI2SK(userId: string, connectionCount: number): string {
    const invertedCount = 9999999999 - connectionCount;
    const paddedCount = invertedCount.toString().padStart(10, '0');
    return `${paddedCount}#${userId}`;
}

/**
 * Extract connection count from GSI2SK value.
 */
function extractConnectionCount(gsi2sk: string): number {
    const invertedCount = parseInt(gsi2sk.split('#')[0], 10);
    return 9999999999 - invertedCount;
}

/**
 * Calculate ranks for leaderboard entries, handling ties.
 * Users with the same connection count get the same rank.
 */
function calculateRanks(entries: LeaderboardEntry[], startRank: number = 1): LeaderboardEntry[] {
    let currentRank = startRank;
    let previousCount = -1;

    return entries.map((entry, index) => {
        if (entry.connectionCount !== previousCount) {
            currentRank = startRank + index;
            previousCount = entry.connectionCount;
        }
        return { ...entry, rank: currentRank };
    });
}

/**
 * Main handler for leaderboard queries.
 */
export const handler = async (event: AppSyncResolverEvent<LeaderboardQueryArgs>): Promise<LeaderboardResult> => {
    console.log('Leaderboard query:', JSON.stringify(event, null, 2));

    // Extract user ID from Cognito identity
    const identity = event.identity as { sub?: string; username?: string } | undefined;
    const currentUserId = identity?.sub || identity?.username;
    if (!currentUserId) {
        throw new Error('Unauthorized: User identity not found');
    }

    // Validate and set limit
    let limit = event.arguments?.limit ?? DEFAULT_LIMIT;
    if (limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const nextToken = event.arguments?.nextToken;

    try {
        console.log('Query parameters:', {
            tableName: USERS_TABLE_NAME,
            limit,
            nextToken: nextToken ? 'provided' : 'none',
            currentUserId,
        });

        // Query leaderboard GSI
        const queryParams: {
            TableName: string;
            IndexName: string;
            KeyConditionExpression: string;
            ExpressionAttributeValues: Record<string, string>;
            Limit: number;
            ScanIndexForward: boolean;
            ExclusiveStartKey?: Record<string, string>;
        } = {
            TableName: USERS_TABLE_NAME,
            IndexName: 'ByConnectionCount',
            KeyConditionExpression: 'GSI2PK = :pk',
            ExpressionAttributeValues: {
                ':pk': 'LEADERBOARD',
            },
            Limit: limit + 1, // Fetch one extra to check if there are more
            ScanIndexForward: true, // Ascending order (inverted counts = descending connection counts)
        };

        console.log('DynamoDB query params:', JSON.stringify(queryParams, null, 2));

        // Handle pagination
        if (nextToken) {
            try {
                const decoded = JSON.parse(Buffer.from(nextToken, 'base64').toString('utf-8'));
                queryParams.ExclusiveStartKey = decoded;
            } catch {
                throw new Error('Invalid pagination token');
            }
        }

        const queryResult = await docClient.send(new QueryCommand(queryParams));
        console.log('DynamoDB query result:', {
            itemCount: queryResult.Items?.length || 0,
            scannedCount: queryResult.ScannedCount,
            lastEvaluatedKey: queryResult.LastEvaluatedKey ? 'present' : 'none',
        });

        if (queryResult.Items && queryResult.Items.length > 0) {
            console.log('First item sample:', JSON.stringify(queryResult.Items[0], null, 2));
        }

        const items = (queryResult.Items || []) as UserProfile[];

        // Check if there are more results
        const hasMore = items.length > limit;
        const resultItems = hasMore ? items.slice(0, limit) : items;

        // Map to LeaderboardEntry format
        let entries: LeaderboardEntry[] = resultItems.map((item) => ({
            rank: 0, // Will be calculated
            userId: item.id,
            displayName: item.displayName,
            profilePictureUrl: item.profilePictureUrl,
            uploadedProfilePictureUrl: item.uploadedProfilePictureUrl,
            gravatarHash: item.gravatarHash,
            connectionCount: item.connectionCount,
            isCurrentUser: item.id === currentUserId,
        }));

        // Calculate ranks with tie handling
        entries = calculateRanks(entries);

        // Generate next token if there are more results
        let responseNextToken: string | undefined;
        if (hasMore && resultItems.length > 0) {
            const lastItem = resultItems[resultItems.length - 1];
            const lastKey = {
                PK: lastItem.PK,
                SK: lastItem.SK,
                GSI2PK: lastItem.GSI2PK,
                GSI2SK: lastItem.GSI2SK,
            };
            responseNextToken = Buffer.from(JSON.stringify(lastKey)).toString('base64');
        }

        // Check if current user is in the results
        const currentUserInResults = entries.some((e) => e.isCurrentUser);
        let currentUserEntry: LeaderboardEntry | undefined;

        // If current user is not in results, fetch their rank separately
        if (!currentUserInResults) {
            currentUserEntry = await getCurrentUserEntry(currentUserId);
        }

        console.log('Returning result:', {
            entriesCount: entries.length,
            hasCurrentUserEntry: !!currentUserEntry,
            hasMore,
            hasNextToken: !!responseNextToken,
        });

        return {
            entries,
            currentUserEntry,
            hasMore,
            nextToken: responseNextToken,
        };
    } catch (error) {
        console.error('Error querying leaderboard:', error);
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        throw error;
    }
};

/**
 * Get the current user's leaderboard entry with their rank.
 * Returns undefined if user has no connections.
 */
async function getCurrentUserEntry(userId: string): Promise<LeaderboardEntry | undefined> {
    // First, get the user's profile to check their connection count
    const userResult = await docClient.send(
        new GetCommand({
            TableName: USERS_TABLE_NAME,
            Key: {
                PK: `USER#${userId}`,
                SK: 'PROFILE',
            },
        })
    );

    const user = userResult.Item as UserProfile | undefined;
    if (!user || !user.connectionCount || user.connectionCount === 0) {
        // User has no connections, not on leaderboard
        return undefined;
    }

    // Calculate user's rank by counting how many users have more connections
    const userGSI2SK = calculateGSI2SK(userId, user.connectionCount);

    const countResult = await docClient.send(
        new QueryCommand({
            TableName: USERS_TABLE_NAME,
            IndexName: 'ByConnectionCount',
            KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK < :userSK',
            ExpressionAttributeValues: {
                ':pk': 'LEADERBOARD',
                ':userSK': userGSI2SK,
            },
            Select: 'COUNT',
        })
    );

    const usersAhead = countResult.Count || 0;
    const rank = usersAhead + 1;

    return {
        rank,
        userId: user.id,
        displayName: user.displayName,
        profilePictureUrl: user.profilePictureUrl,
        uploadedProfilePictureUrl: user.uploadedProfilePictureUrl,
        gravatarHash: user.gravatarHash,
        connectionCount: user.connectionCount,
        isCurrentUser: true,
    };
}
