/**
 * Connection Search Lambda Handler
 *
 * Provides server-side search functionality for user connections.
 * Supports fuzzy matching against display name, tags, and notes.
 * Results are ranked by match quality.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { AppSyncResolverEvent } from 'aws-lambda';
import { fuzzyMatch, fuzzyMatchArray } from './fuzzy-match';
import { calculateFieldScore, calculateCombinedScore, compareScores, ScoringResult } from './scoring';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;

// Interfaces
interface SearchQueryArgs {
    query: string;
}

interface ConnectionRecord {
    PK: string;
    SK: string;
    id: string;
    userId: string;
    connectedUserId: string;
    tags: string[];
    note?: string;
    createdAt: string;
    updatedAt: string;
}

interface UserProfile {
    PK: string;
    SK: string;
    id: string;
    displayName: string;
    gravatarHash: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
}

interface ConnectedProfile {
    id: string;
    displayName: string;
    gravatarHash: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
    contactLinks: unknown[];
    badges: unknown[];
}

interface Connection {
    id: string;
    userId: string;
    connectedUserId: string;
    connectedUser?: ConnectedProfile;
    tags: string[];
    note?: string;
    createdAt: string;
    updatedAt: string;
}

interface ConnectionSearchResult {
    connection: Connection;
    score: number;
}

interface SearchConnectionsResult {
    results: ConnectionSearchResult[];
    totalCount: number;
}

interface ScoredConnection {
    connection: Connection;
    scoring: ScoringResult;
}

/**
 * Main handler for connection search queries.
 */
export const handler = async (event: AppSyncResolverEvent<SearchQueryArgs>): Promise<SearchConnectionsResult> => {
    console.log('Connection search query:', JSON.stringify(event, null, 2));

    // Extract user ID from Cognito identity
    const identity = event.identity as { sub?: string; username?: string } | undefined;
    const currentUserId = identity?.sub || identity?.username;
    if (!currentUserId) {
        throw new Error('Unauthorized: User identity not found');
    }

    const query = event.arguments?.query ?? '';
    const trimmedQuery = query.trim();

    try {
        // Fetch all connections for the user
        const connections = await fetchUserConnections(currentUserId);

        if (connections.length === 0) {
            return {
                results: [],
                totalCount: 0,
            };
        }

        // Fetch connected user profiles
        const connectionsWithProfiles = await enrichConnectionsWithProfiles(connections);

        // If query is empty, return all connections (no scoring needed)
        if (trimmedQuery === '') {
            const results: ConnectionSearchResult[] = connectionsWithProfiles.map((conn) => ({
                connection: conn,
                score: 1.0,
            }));
            return {
                results,
                totalCount: results.length,
            };
        }

        // Score and filter connections
        const scoredConnections = scoreConnections(connectionsWithProfiles, trimmedQuery);

        // Filter out non-matches and sort by score
        const matchingConnections = scoredConnections.filter((sc) => sc.scoring.totalScore > 0).sort((a, b) => compareScores(a.scoring, b.scoring));

        // Map to result format
        const results: ConnectionSearchResult[] = matchingConnections.map((sc) => ({
            connection: sc.connection,
            score: sc.scoring.totalScore,
        }));

        return {
            results,
            totalCount: results.length,
        };
    } catch (error) {
        console.error('Error searching connections:', error);
        throw error;
    }
};

/**
 * Fetch all connections for a user from DynamoDB.
 */
async function fetchUserConnections(userId: string): Promise<ConnectionRecord[]> {
    const result = await docClient.send(
        new QueryCommand({
            TableName: CONNECTIONS_TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': `USER#${userId}`,
                ':sk': 'CONNECTION#',
            },
        })
    );

    return (result.Items || []) as ConnectionRecord[];
}

/**
 * Enrich connections with connected user profile data.
 */
async function enrichConnectionsWithProfiles(connections: ConnectionRecord[]): Promise<Connection[]> {
    if (connections.length === 0) {
        return [];
    }

    // Get unique connected user IDs
    const connectedUserIds = [...new Set(connections.map((c) => c.connectedUserId))];

    // Batch get user profiles
    const userProfiles = await batchGetUserProfiles(connectedUserIds);
    const profileMap = new Map(userProfiles.map((p) => [p.id, p]));

    // Map connections with profiles
    return connections.map((conn) => {
        const profile = profileMap.get(conn.connectedUserId);
        return {
            id: conn.id,
            userId: conn.userId,
            connectedUserId: conn.connectedUserId,
            connectedUser: profile
                ? {
                      id: profile.id,
                      displayName: profile.displayName,
                      gravatarHash: profile.gravatarHash,
                      profilePictureUrl: profile.profilePictureUrl,
                      uploadedProfilePictureUrl: profile.uploadedProfilePictureUrl,
                      contactLinks: [],
                      badges: [],
                  }
                : undefined,
            tags: conn.tags || [],
            note: conn.note,
            createdAt: conn.createdAt,
            updatedAt: conn.updatedAt,
        };
    });
}

/**
 * Batch get user profiles from DynamoDB.
 */
async function batchGetUserProfiles(userIds: string[]): Promise<UserProfile[]> {
    if (userIds.length === 0) {
        return [];
    }

    // DynamoDB BatchGetItem has a limit of 100 items
    const BATCH_SIZE = 100;
    const profiles: UserProfile[] = [];

    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);
        const keys = batch.map((id) => ({
            PK: `USER#${id}`,
            SK: 'PROFILE',
        }));

        const result = await docClient.send(
            new BatchGetCommand({
                RequestItems: {
                    [USERS_TABLE_NAME]: {
                        Keys: keys,
                    },
                },
            })
        );

        const items = result.Responses?.[USERS_TABLE_NAME] || [];
        profiles.push(...(items as UserProfile[]));
    }

    return profiles;
}

/**
 * Score all connections against the search query.
 */
function scoreConnections(connections: Connection[], query: string): ScoredConnection[] {
    return connections.map((connection) => {
        const scoring = scoreConnection(connection, query);
        return { connection, scoring };
    });
}

/**
 * Check if a single word matches anywhere in the connection (name, tags, or notes).
 * Returns the best match result for this word.
 */
function matchWordInConnection(word: string, displayName: string, tags: string[], note: string | undefined): { matched: boolean; score: number } {
    let bestScore = 0;

    // Check name
    if (displayName) {
        const nameMatch = fuzzyMatch(word, displayName);
        if (nameMatch.score > bestScore) {
            bestScore = nameMatch.score;
        }
    }

    // Check tags
    if (tags && tags.length > 0) {
        const tagMatch = fuzzyMatchArray(word, tags);
        if (tagMatch.score > bestScore) {
            bestScore = tagMatch.score;
        }
    }

    // Check note
    if (note) {
        const noteMatch = fuzzyMatch(word, note);
        if (noteMatch.score > bestScore) {
            bestScore = noteMatch.score;
        }
    }

    return { matched: bestScore > 0, score: bestScore };
}

/**
 * Score a single connection against the search query.
 * Supports multi-word queries where ALL words must match somewhere in the connection.
 */
function scoreConnection(connection: Connection, query: string): ScoringResult {
    // Split query into words
    const words = query
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0);

    if (words.length === 0) {
        return { matches: [], totalScore: 0 };
    }

    const displayName = connection.connectedUser?.displayName || '';
    const tags = connection.tags || [];
    const note = connection.note;

    // For multi-word queries, ALL words must match somewhere
    const wordScores: number[] = [];
    for (const word of words) {
        const result = matchWordInConnection(word, displayName, tags, note);
        if (!result.matched) {
            // If any word doesn't match, the connection doesn't match
            return { matches: [], totalScore: 0 };
        }
        wordScores.push(result.score);
    }

    // All words matched - calculate combined score
    // Use average of word scores, with bonus for matching more words
    const avgScore = wordScores.reduce((a, b) => a + b, 0) / wordScores.length;
    const multiWordBonus = Math.min((words.length - 1) * 0.05, 0.2); // Up to 0.2 bonus for multi-word
    const totalScore = Math.min(avgScore + multiWordBonus, 1.0);

    // Build field matches for the result (use single-word matching for field attribution)
    const fieldMatches = [];

    if (displayName) {
        const nameMatch = fuzzyMatch(query, displayName);
        if (nameMatch.score > 0) {
            fieldMatches.push(calculateFieldScore('name', nameMatch));
        }
    }

    if (tags.length > 0) {
        const tagMatch = fuzzyMatchArray(query, tags);
        if (tagMatch.score > 0) {
            fieldMatches.push(calculateFieldScore('tag', tagMatch));
        }
    }

    if (note) {
        const noteMatch = fuzzyMatch(query, note);
        if (noteMatch.score > 0) {
            fieldMatches.push(calculateFieldScore('note', noteMatch));
        }
    }

    return { matches: fieldMatches, totalScore };
}

// Export for testing
export { scoreConnection, scoreConnections };
