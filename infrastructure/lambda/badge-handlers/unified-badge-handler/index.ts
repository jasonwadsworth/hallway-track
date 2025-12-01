import { EventBridgeEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;
const MAKER_USER_ID = process.env.MAKER_USER_ID;
const REINVENT_DATES = process.env.REINVENT_DATES;

// Event interfaces
interface UserConnectionCountUpdatedDetail {
    userId: string;
    connectionCount: number;
    previousCount: number;
    timestamp: string;
}

interface ConnectionCreatedDetail {
    connectionId: string;
    userId: string;
    connectedUserId: string;
    timestamp: string;
}

type BadgeEvent =
    | EventBridgeEvent<'UserConnectionCountUpdated', UserConnectionCountUpdatedDetail>
    | EventBridgeEvent<'ConnectionCreated', ConnectionCreatedDetail>;

// Badge and user interfaces
interface BadgeMetadata {
    relatedUserId?: string;
    relatedUserName?: string;
    eventYear?: number;
    count?: number;
    triangleUsers?: string[];
}

interface Badge {
    id: string;
    name: string;
    description: string;
    threshold: number;
    category: string;
    earnedAt: string;
    iconUrl?: string;
    metadata?: BadgeMetadata;
}

interface User {
    PK: string;
    SK: string;
    id: string;
    displayName: string;
    badges: Badge[];
    connectionCount: number;
    updatedAt: string;
}

interface Connection {
    connectedUserId: string;
    createdAt: string;
}

interface EventConfig {
    year: number;
    start: string;
    end: string;
}

interface BadgeContext {
    connectionCount?: number;
    newConnection?: {
        connectedUserId: string;
        timestamp: string;
    };
}

interface BadgeEvaluationResult {
    badgesToAdd: Badge[];
    badgesToRemove: Badge[];
}

// Badge evaluator function type
type BadgeEvaluator = (user: User, context: BadgeContext) => Promise<BadgeEvaluationResult>;

// Main handler function
export async function handler(event: BadgeEvent): Promise<void> {
    console.log('Unified badge handler invoked', JSON.stringify(event, null, 2));

    try {
        await processBadgeEvent(event);
        console.log('Badge processing completed successfully');
    } catch (error) {
        console.error('Error processing badge event:', error);
        throw error;
    }
}

async function processBadgeEvent(event: BadgeEvent): Promise<void> {
    const eventType = event['detail-type'];

    if (eventType === 'UserConnectionCountUpdated') {
        const { userId, connectionCount } = event.detail;
        console.log(`Processing connection count update for user ${userId}: ${connectionCount}`);
        await processAllBadgeTypes(userId, { connectionCount });
    } else if (eventType === 'ConnectionCreated') {
        const { userId, connectedUserId, timestamp } = event.detail;
        console.log(`Processing connection creation between ${userId} and ${connectedUserId}`);

        // Process badges for both users involved in the connection
        await processAllBadgeTypes(userId, { newConnection: { connectedUserId, timestamp } });
        await processAllBadgeTypes(connectedUserId, { newConnection: { connectedUserId: userId, timestamp } });
    } else {
        console.warn(`Unknown event type: ${eventType}`);
    }
}

async function processAllBadgeTypes(userId: string, context: BadgeContext): Promise<void> {
    console.log(`Processing all badge types for user ${userId}`, context);

    try {
        // Get user data with connections
        const user = await getUserWithConnections(userId);
        if (!user) {
            console.warn(`User ${userId} not found, skipping badge processing`);
            return;
        }

        const currentBadges = user.badges || [];
        console.log(
            `User ${userId} currently has ${currentBadges.length} badges:`,
            currentBadges.map((b) => b.id)
        );

        let updatedBadges = [...currentBadges];

        // Process all badge types in sequence
        const badgeEvaluators: Record<string, BadgeEvaluator> = {
            threshold: evaluateThresholdBadges,
            vip: evaluateVIPBadges,
            triangle: evaluateTriangleBadges,
            maker: evaluateMakerBadges,
            earlySupporter: evaluateEarlySupporterBadges,
            event: evaluateEventBadges,
        };

        let totalBadgesAdded = 0;
        let totalBadgesRemoved = 0;

        for (const [badgeType, evaluator] of Object.entries(badgeEvaluators)) {
            console.log(`Evaluating ${badgeType} badges for user ${userId}`);

            try {
                const { badgesToAdd, badgesToRemove } = await evaluator(user, context);

                // Remove badges that no longer qualify
                if (badgesToRemove.length > 0) {
                    console.log(
                        `Removing ${badgeType} badges:`,
                        badgesToRemove.map((b) => b.id)
                    );
                    updatedBadges = updatedBadges.filter((badge) => !badgesToRemove.some((remove) => remove.id === badge.id));
                    totalBadgesRemoved += badgesToRemove.length;
                }

                // Add new badges
                if (badgesToAdd.length > 0) {
                    console.log(
                        `Adding ${badgeType} badges:`,
                        badgesToAdd.map((b) => b.id)
                    );
                    updatedBadges.push(...badgesToAdd);
                    totalBadgesAdded += badgesToAdd.length;
                }

                console.log(`${badgeType} badge evaluation complete for user ${userId}: +${badgesToAdd.length} -${badgesToRemove.length}`);
            } catch (error) {
                console.error(`Error evaluating ${badgeType} badges for user ${userId}:`, error);
                // Continue processing other badge types to ensure partial failures don't break everything
            }
        }

        console.log(
            `Badge processing summary for user ${userId}: +${totalBadgesAdded} -${totalBadgesRemoved} (${currentBadges.length} -> ${updatedBadges.length})`
        );

        // Validate badge integrity before updating
        if (!validateBadgeIntegrity(updatedBadges)) {
            console.error(`Badge integrity validation failed for user ${userId}, reverting changes`);
            return;
        }

        // Update user if badges changed
        if (badgesChanged(currentBadges, updatedBadges)) {
            console.log(`Updating badges for user ${userId}: ${currentBadges.length} -> ${updatedBadges.length}`);
            await updateUserBadges(userId, updatedBadges);
        } else {
            console.log(`No badge changes for user ${userId}`);
        }
    } catch (error) {
        console.error(`Error processing badges for user ${userId}:`, error);
        throw error;
    }
}

// Threshold badge definitions
const THRESHOLD_BADGES = [
    { id: 'first-connection', name: 'Ice Breaker', threshold: 1, description: 'Made your first connection' },
    { id: 'networker', name: 'Networker', threshold: 5, description: 'Connected with 5 people' },
    { id: 'socialite', name: 'Socialite', threshold: 10, description: 'Connected with 10 people' },
    { id: 'connector', name: 'Super Connector', threshold: 25, description: 'Connected with 25 people' },
    { id: 'legend', name: 'Networking Legend', threshold: 50, description: 'Connected with 50 people' },
];

async function evaluateThresholdBadges(user: User, context: BadgeContext): Promise<BadgeEvaluationResult> {
    console.log(`Evaluating threshold badges for user ${user.id} with connection count ${user.connectionCount}`);

    const currentBadges = user.badges || [];
    const currentThresholdBadges = currentBadges.filter((badge) => THRESHOLD_BADGES.some((tb) => tb.id === badge.id));

    // Determine which badges the user should have based on connection count
    const qualifyingBadges = THRESHOLD_BADGES.filter((tb) => user.connectionCount >= tb.threshold);

    // Find badges to add (user qualifies but doesn't have)
    const badgesToAdd: Badge[] = qualifyingBadges
        .filter((qb) => !currentThresholdBadges.some((cb) => cb.id === qb.id))
        .map((qb) => ({
            id: qb.id,
            name: qb.name,
            description: qb.description,
            threshold: qb.threshold,
            category: 'threshold',
            earnedAt: new Date().toISOString(),
            iconUrl: `/badge-images/${qb.id}.svg`,
        }));

    // Find badges to remove (user has but no longer qualifies)
    const badgesToRemove: Badge[] = currentThresholdBadges.filter((cb) => !qualifyingBadges.some((qb) => qb.id === cb.id));

    console.log(`Threshold badge evaluation for user ${user.id}:`, {
        connectionCount: user.connectionCount,
        currentThresholdBadges: currentThresholdBadges.map((b) => b.id),
        qualifyingBadges: qualifyingBadges.map((b) => b.id),
        badgesToAdd: badgesToAdd.map((b) => b.id),
        badgesToRemove: badgesToRemove.map((b) => b.id),
    });

    return { badgesToAdd, badgesToRemove };
}

async function evaluateVIPBadges(user: User, context: BadgeContext): Promise<BadgeEvaluationResult> {
    console.log(`Evaluating VIP badges for user ${user.id}`);

    const currentBadges = user.badges || [];
    const existingVIPBadge = currentBadges.find((badge) => badge.id === 'vip-connection');

    // VIP badges are only awarded/updated when a new connection is made
    if (!context.newConnection) {
        console.log('No new connection context, skipping VIP badge evaluation');
        return { badgesToAdd: [], badgesToRemove: [] };
    }

    const { connectedUserId, timestamp } = context.newConnection;

    try {
        // Get connected user to check their connection count
        const connectedUserResult = await docClient.send(
            new GetCommand({
                TableName: USERS_TABLE_NAME,
                Key: { PK: `USER#${connectedUserId}`, SK: 'PROFILE' },
            })
        );

        const connectedUser = connectedUserResult.Item as User | undefined;

        if (!connectedUser || connectedUser.connectionCount < 50) {
            console.log(`Connected user ${connectedUserId} does not have 50+ connections (${connectedUser?.connectionCount || 0})`);
            return { badgesToAdd: [], badgesToRemove: [] };
        }

        console.log(`User ${user.id} connected with VIP user ${connectedUserId} (${connectedUser.connectionCount} connections)`);

        if (existingVIPBadge) {
            // Update existing badge count
            const currentCount = existingVIPBadge.metadata?.count || 1;
            const updatedBadge: Badge = {
                ...existingVIPBadge,
                metadata: { ...existingVIPBadge.metadata, count: currentCount + 1 },
            };

            console.log(`Updating VIP badge count from ${currentCount} to ${currentCount + 1} for user ${user.id}`);

            // Return the updated badge as both remove and add to replace it
            return {
                badgesToAdd: [updatedBadge],
                badgesToRemove: [existingVIPBadge],
            };
        } else {
            // Award new VIP badge
            const newBadge: Badge = {
                id: 'vip-connection',
                name: 'VIP Connection',
                description: 'Connected with a highly connected user (50+ connections)',
                threshold: 0,
                category: 'special',
                iconUrl: '/badge-images/vip-connection.svg',
                earnedAt: timestamp,
                metadata: { count: 1 },
            };

            console.log(`Awarding new VIP badge to user ${user.id}`);
            return { badgesToAdd: [newBadge], badgesToRemove: [] };
        }
    } catch (error) {
        console.error(`Error evaluating VIP badges for user ${user.id}:`, error);
        return { badgesToAdd: [], badgesToRemove: [] };
    }
}

async function evaluateTriangleBadges(user: User, context: BadgeContext): Promise<BadgeEvaluationResult> {
    console.log(`Evaluating triangle badges for user ${user.id}`);

    const currentBadges = user.badges || [];
    const hasTriangleBadge = currentBadges.some((badge) => badge.id === 'triangle-complete');

    // Triangle badges are only awarded when a new connection is made
    if (!context.newConnection) {
        console.log('No new connection context, skipping triangle badge evaluation');
        return { badgesToAdd: [], badgesToRemove: [] };
    }

    // If user already has the triangle badge, no need to check again
    if (hasTriangleBadge) {
        console.log(`User ${user.id} already has the triangle badge`);
        return { badgesToAdd: [], badgesToRemove: [] };
    }

    const { connectedUserId, timestamp } = context.newConnection;

    try {
        console.log(`Checking for triangle completion for user ${user.id} with new connection to ${connectedUserId}`);

        // Query user's connections
        const userConnectionsResult = await docClient.send(
            new QueryCommand({
                TableName: CONNECTIONS_TABLE_NAME,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `USER#${user.id}`,
                    ':sk': 'CONNECTION#',
                },
            })
        );

        const userConnectionIds = new Set((userConnectionsResult.Items || []).map((item) => (item as Connection).connectedUserId));

        // Query connected user's connections
        const connectedUserConnectionsResult = await docClient.send(
            new QueryCommand({
                TableName: CONNECTIONS_TABLE_NAME,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `USER#${connectedUserId}`,
                    ':sk': 'CONNECTION#',
                },
            })
        );

        // Find mutual connections (excluding the new connection)
        const mutualConnection = (connectedUserConnectionsResult.Items || []).find((item) => {
            const c = item as Connection;
            return userConnectionIds.has(c.connectedUserId) && c.connectedUserId !== user.id;
        });

        if (!mutualConnection) {
            console.log(`No triangle found for user ${user.id}`);
            return { badgesToAdd: [], badgesToRemove: [] };
        }

        console.log(`Triangle found for user ${user.id} with ${connectedUserId} and ${mutualConnection.connectedUserId}`);

        // Award triangle badge
        const triangleBadge: Badge = {
            id: 'triangle-complete',
            name: 'Triangle Complete',
            description: 'Created a mutual connection triangle',
            threshold: 0,
            category: 'special',
            iconUrl: '/badge-images/triangle-complete.svg',
            earnedAt: timestamp,
            metadata: {
                triangleUsers: [connectedUserId, mutualConnection.connectedUserId],
            },
        };

        console.log(`Awarding triangle badge to user ${user.id}`);
        return { badgesToAdd: [triangleBadge], badgesToRemove: [] };
    } catch (error) {
        console.error(`Error evaluating triangle badges for user ${user.id}:`, error);
        return { badgesToAdd: [], badgesToRemove: [] };
    }
}

async function evaluateMakerBadges(user: User, context: BadgeContext): Promise<BadgeEvaluationResult> {
    console.log(`Evaluating maker badges for user ${user.id}`);

    const currentBadges = user.badges || [];
    const existingMakerBadge = currentBadges.find((badge) => badge.id === 'met-the-maker');

    // Check if MAKER_USER_ID is configured
    if (!MAKER_USER_ID) {
        console.log('MAKER_USER_ID not configured, skipping maker badge evaluation');
        return { badgesToAdd: [], badgesToRemove: [] };
    }

    // Handle new connection case
    if (context.newConnection) {
        const { connectedUserId, timestamp } = context.newConnection;

        // If user already has the maker badge, no need to check again
        if (existingMakerBadge) {
            console.log(`User ${user.id} already has the maker badge`);
            return { badgesToAdd: [], badgesToRemove: [] };
        }

        // Check if connected user is the maker
        if (connectedUserId !== MAKER_USER_ID) {
            console.log(`Connected user ${connectedUserId} is not the maker ${MAKER_USER_ID}`);
            return { badgesToAdd: [], badgesToRemove: [] };
        }

        console.log(`User ${user.id} connected with maker, awarding badge`);

        // Award maker badge
        const makerBadge: Badge = {
            id: 'met-the-maker',
            name: 'Met the Maker',
            description: 'Connected with the creator of Hallway Track',
            threshold: 0,
            category: 'special',
            iconUrl: '/badge-images/met-the-maker.svg',
            earnedAt: timestamp,
        };

        return { badgesToAdd: [makerBadge], badgesToRemove: [] };
    }

    // Handle connection count update case - check if user still has connection to maker
    if (context.connectionCount !== undefined && existingMakerBadge) {
        console.log(`Checking if user ${user.id} still has connection to maker ${MAKER_USER_ID}`);

        try {
            // Query user's connections to see if they're still connected to the maker
            const connectionsResult = await docClient.send(
                new QueryCommand({
                    TableName: CONNECTIONS_TABLE_NAME,
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                    FilterExpression: 'connectedUserId = :makerId',
                    ExpressionAttributeValues: {
                        ':pk': `USER#${user.id}`,
                        ':sk': 'CONNECTION#',
                        ':makerId': MAKER_USER_ID,
                    },
                })
            );

            const stillConnectedToMaker = (connectionsResult.Items || []).length > 0;

            if (!stillConnectedToMaker) {
                console.log(`User ${user.id} is no longer connected to maker, removing badge`);
                return { badgesToAdd: [], badgesToRemove: [existingMakerBadge] };
            } else {
                console.log(`User ${user.id} still connected to maker, keeping badge`);
            }
        } catch (error) {
            console.error(`Error checking maker connection for user ${user.id}:`, error);
            // On error, keep the badge to avoid false removals
        }
    }

    return { badgesToAdd: [], badgesToRemove: [] };
}

async function evaluateEarlySupporterBadges(user: User, context: BadgeContext): Promise<BadgeEvaluationResult> {
    console.log(`Evaluating early supporter badges for user ${user.id}`);

    // Early supporter badges are only triggered when a user reaches exactly 500 connections
    // This is different from other badges - it awards badges to OTHER users (the early supporters)
    if (!context.connectionCount || context.connectionCount !== 500) {
        console.log(`User ${user.id} connection count is ${context.connectionCount}, not 500 - skipping early supporter evaluation`);
        return { badgesToAdd: [], badgesToRemove: [] };
    }

    console.log(`User ${user.id} reached 500 connections, processing early supporter badges for their connections`);

    try {
        // Query all connections for this user
        const connectionsResult = await docClient.send(
            new QueryCommand({
                TableName: CONNECTIONS_TABLE_NAME,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `USER#${user.id}`,
                    ':sk': 'CONNECTION#',
                },
            })
        );

        const connections = (connectionsResult.Items || []) as Connection[];

        // Sort by creation date and get first 10
        const earlyConnections = connections.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(0, 10);

        console.log(`Found ${earlyConnections.length} early connections for user ${user.id}`);

        // Award badge to each early supporter
        let badgesAwarded = 0;
        for (const connection of earlyConnections) {
            try {
                const supporterResult = await docClient.send(
                    new GetCommand({
                        TableName: USERS_TABLE_NAME,
                        Key: { PK: `USER#${connection.connectedUserId}`, SK: 'PROFILE' },
                    })
                );

                const supporter = supporterResult.Item as User | undefined;
                if (!supporter) {
                    console.log(`Supporter ${connection.connectedUserId} not found`);
                    continue;
                }

                // Check if they already have this badge for this user
                const hasBadge = supporter.badges?.some((b: Badge) => b.id === 'early-supporter' && b.metadata?.relatedUserId === user.id);
                if (hasBadge) {
                    console.log(`Supporter ${connection.connectedUserId} already has early supporter badge for ${user.id}`);
                    continue;
                }

                // Award badge to the supporter
                const badge: Badge = {
                    id: 'early-supporter',
                    name: 'Early Supporter',
                    description: 'Was among the first 10 connections of a user with 500+ connections',
                    threshold: 0,
                    category: 'special',
                    iconUrl: '/badge-images/early-supporter.svg',
                    earnedAt: connection.createdAt,
                    metadata: {
                        relatedUserId: user.id,
                        relatedUserName: user.displayName,
                    },
                };

                const updatedBadges = [...(supporter.badges || []), badge];
                const newBadgeCount = updatedBadges.length;

                await docClient.send(
                    new UpdateCommand({
                        TableName: USERS_TABLE_NAME,
                        Key: { PK: `USER#${connection.connectedUserId}`, SK: 'PROFILE' },
                        UpdateExpression: 'SET badges = :badges, badgeCount = :badgeCount, GSI3PK = :gsi3pk, GSI3SK = :gsi3sk, updatedAt = :now',
                        ExpressionAttributeValues: {
                            ':badges': updatedBadges,
                            ':badgeCount': newBadgeCount,
                            ':gsi3pk': 'BADGE_LEADERBOARD',
                            ':gsi3sk': calculateGSI3SK(connection.connectedUserId, newBadgeCount),
                            ':now': new Date().toISOString(),
                        },
                    })
                );

                badgesAwarded++;
                console.log(`Awarded early supporter badge to ${connection.connectedUserId}`);
            } catch (error) {
                console.error(`Error awarding early supporter badge to ${connection.connectedUserId}:`, error);
                // Continue with other supporters
            }
        }

        console.log(`Successfully awarded ${badgesAwarded} early supporter badges for user ${user.id}`);

        // Early supporter evaluation doesn't change the current user's badges
        return { badgesToAdd: [], badgesToRemove: [] };
    } catch (error) {
        console.error(`Error evaluating early supporter badges for user ${user.id}:`, error);
        return { badgesToAdd: [], badgesToRemove: [] };
    }
}

async function evaluateEventBadges(user: User, context: BadgeContext): Promise<BadgeEvaluationResult> {
    console.log(`Evaluating event badges for user ${user.id}`);

    // Event badges are only awarded when a new connection is made
    if (!context.newConnection) {
        console.log('No new connection context, skipping event badge evaluation');
        return { badgesToAdd: [], badgesToRemove: [] };
    }

    // Check if REINVENT_DATES is configured
    if (!REINVENT_DATES) {
        console.log('REINVENT_DATES not configured, skipping event badge evaluation');
        return { badgesToAdd: [], badgesToRemove: [] };
    }

    let reinventDates: EventConfig[];
    try {
        reinventDates = JSON.parse(REINVENT_DATES);
    } catch (error) {
        console.error('Failed to parse REINVENT_DATES:', error);
        return { badgesToAdd: [], badgesToRemove: [] };
    }

    const { timestamp } = context.newConnection;
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
        return { badgesToAdd: [], badgesToRemove: [] };
    }

    // TypeScript assertion: matchedEvent is guaranteed to be non-null after the check above
    const event = matchedEvent as EventConfig;
    console.log(`Connection occurred during re:Invent ${event.year}, checking for badge award`);

    const currentBadges = user.badges || [];
    const hasBadgeForYear = currentBadges.some((b: Badge) => b.id === 'reinvent-connector' && b.metadata?.eventYear === event.year);

    if (hasBadgeForYear) {
        console.log(`User ${user.id} already has re:Invent badge for ${event.year}`);
        return { badgesToAdd: [], badgesToRemove: [] };
    }

    // Award event badge
    const eventBadge: Badge = {
        id: 'reinvent-connector',
        name: 're:Invent Connector',
        description: `Connected during AWS re:Invent ${event.year}`,
        threshold: 0,
        category: 'special',
        iconUrl: '/badge-images/reinvent-connector.svg',
        earnedAt: timestamp,
        metadata: { eventYear: event.year },
    };

    console.log(`Awarding re:Invent ${event.year} badge to user ${user.id}`);
    return { badgesToAdd: [eventBadge], badgesToRemove: [] };
}

// Utility functions
async function getUserWithConnections(userId: string): Promise<User | null> {
    try {
        const userResult = await docClient.send(
            new GetCommand({
                TableName: USERS_TABLE_NAME,
                Key: {
                    PK: `USER#${userId}`,
                    SK: 'PROFILE',
                },
            })
        );

        if (!userResult.Item) {
            console.warn(`User ${userId} not found in database`);
            return null;
        }

        const user = userResult.Item as User;

        // Validate user data structure
        if (!user.id || typeof user.connectionCount !== 'number') {
            console.error(`Invalid user data structure for user ${userId}:`, user);
            return null;
        }

        console.log(`Retrieved user ${userId} with ${user.connectionCount} connections and ${user.badges?.length || 0} badges`);
        return user;
    } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
        throw error;
    }
}

async function _getUserConnections(userId: string): Promise<Connection[]> {
    try {
        const connectionsResult = await docClient.send(
            new QueryCommand({
                TableName: CONNECTIONS_TABLE_NAME,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                    ':pk': `USER#${userId}`,
                    ':sk': 'CONNECTION#',
                },
            })
        );

        const connections = (connectionsResult.Items || []) as Connection[];
        console.log(`Retrieved ${connections.length} connections for user ${userId}`);
        return connections;
    } catch (error) {
        console.error(`Error fetching connections for user ${userId}:`, error);
        throw error;
    }
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

async function updateUserBadges(userId: string, badges: Badge[]): Promise<void> {
    try {
        const badgeCount = badges.length;

        // Build update expression based on badge count
        // Only add to badge leaderboard if user has at least 1 badge
        let updateExpression: string;
        let expressionAttributeValues: Record<string, unknown>;

        if (badgeCount > 0) {
            updateExpression = 'SET badges = :badges, badgeCount = :badgeCount, GSI3PK = :gsi3pk, GSI3SK = :gsi3sk, updatedAt = :now';
            expressionAttributeValues = {
                ':badges': badges,
                ':badgeCount': badgeCount,
                ':gsi3pk': 'BADGE_LEADERBOARD',
                ':gsi3sk': calculateGSI3SK(userId, badgeCount),
                ':now': new Date().toISOString(),
            };
        } else {
            // Remove from badge leaderboard if no badges
            updateExpression = 'SET badges = :badges, badgeCount = :badgeCount, updatedAt = :now REMOVE GSI3PK, GSI3SK';
            expressionAttributeValues = {
                ':badges': badges,
                ':badgeCount': badgeCount,
                ':now': new Date().toISOString(),
            };
        }

        await docClient.send(
            new UpdateCommand({
                TableName: USERS_TABLE_NAME,
                Key: {
                    PK: `USER#${userId}`,
                    SK: 'PROFILE',
                },
                UpdateExpression: updateExpression,
                ConditionExpression: 'attribute_exists(PK)',
                ExpressionAttributeValues: expressionAttributeValues,
            })
        );

        console.log(`Successfully updated ${badges.length} badges for user ${userId} (badgeCount: ${badgeCount})`);
    } catch (error) {
        if ((error as Error & { name: string }).name === 'ConditionalCheckFailedException') {
            console.warn(`User ${userId} no longer exists, skipping badge update`);
            return;
        }
        console.error(`Error updating badges for user ${userId}:`, error);
        throw error;
    }
}

function badgesChanged(currentBadges: Badge[], updatedBadges: Badge[]): boolean {
    if (currentBadges.length !== updatedBadges.length) {
        return true;
    }

    // Sort both arrays by badge ID for comparison
    const currentSorted = [...currentBadges].sort((a, b) => a.id.localeCompare(b.id));
    const updatedSorted = [...updatedBadges].sort((a, b) => a.id.localeCompare(b.id));

    // Compare badge IDs
    for (let i = 0; i < currentSorted.length; i++) {
        if (currentSorted[i].id !== updatedSorted[i].id) {
            return true;
        }
    }

    return false;
}

function validateBadgeIntegrity(badges: Badge[]): boolean {
    try {
        // Check for duplicate badge IDs
        const badgeIds = badges.map((b) => b.id);
        const uniqueBadgeIds = new Set(badgeIds);

        if (badgeIds.length !== uniqueBadgeIds.size) {
            console.error('Badge integrity check failed: duplicate badge IDs found');
            return false;
        }

        // Validate badge structure
        for (const badge of badges) {
            if (!badge.id || !badge.name || !badge.description || !badge.category || !badge.earnedAt) {
                console.error('Badge integrity check failed: invalid badge structure', badge);
                return false;
            }
        }

        console.log(`Badge integrity validation passed for ${badges.length} badges`);
        return true;
    } catch (error) {
        console.error('Error during badge integrity validation:', error);
        return false;
    }
}
