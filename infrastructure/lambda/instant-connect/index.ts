import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { AppSyncResolverEvent } from 'aws-lambda';
import { randomBytes } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const eventBridgeClient = new EventBridgeClient({});

const INSTANT_CONNECT_TOKENS_TABLE_NAME = process.env.INSTANT_CONNECT_TOKENS_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'hallway-track-badges';
const FRONTEND_URL = process.env.FRONTEND_URL || '';

const TOKEN_EXPIRY_MINUTES = 5;
const TOKEN_TTL_HOURS = 24;

interface InstantConnectToken {
    PK: string;
    SK: string;
    GSI1PK: string;
    GSI1SK: string;
    token: string;
    userId: string;
    createdAt: string;
    expiresAt: string;
    TTL: number;
}

interface InstantConnectTokenResponse {
    token: string;
    expiresAt: string;
    url: string;
}

interface InstantConnectResult {
    success: boolean;
    message?: string;
    connectedUser?: {
        id: string;
        displayName: string;
        gravatarHash: string;
        profilePictureUrl?: string;
        uploadedProfilePictureUrl?: string;
    };
}

export const handler = async (event: AppSyncResolverEvent<Record<string, unknown>>): Promise<InstantConnectTokenResponse | InstantConnectResult> => {
    console.log('Instant connect handler invoked:', JSON.stringify(event, null, 2));

    const identity = event.identity as { sub?: string };
    const userId = identity?.sub;
    const fieldName = event.info.fieldName;

    console.log('Field name:', fieldName, 'User ID:', userId);

    if (!userId) {
        console.error('No user ID found in identity');
        throw new Error('Unauthorized');
    }

    if (fieldName === 'generateInstantConnectToken') {
        return await generateInstantConnectToken(userId);
    } else if (fieldName === 'redeemInstantConnectToken') {
        return await redeemInstantConnectToken(userId, event.arguments as { token: string });
    }

    throw new Error(`Unknown field: ${fieldName}`);
};

async function generateInstantConnectToken(userId: string): Promise<InstantConnectTokenResponse> {
    console.log('Generating instant connect token for user:', userId);

    try {
        // Delete any existing token for this user
        await deleteExistingUserToken(userId);

        // Generate cryptographically secure token (32 bytes = 256 bits of entropy)
        const tokenBytes = randomBytes(32);
        const token = tokenBytes.toString('base64url');

        const now = new Date();
        const createdAt = now.toISOString();
        const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();
        const ttl = Math.floor(now.getTime() / 1000) + TOKEN_TTL_HOURS * 60 * 60;

        const tokenRecord: InstantConnectToken = {
            PK: `TOKEN#${token}`,
            SK: 'TOKEN',
            GSI1PK: `USER#${userId}`,
            GSI1SK: 'TOKEN',
            token,
            userId,
            createdAt,
            expiresAt,
            TTL: ttl,
        };

        await docClient.send(
            new PutCommand({
                TableName: INSTANT_CONNECT_TOKENS_TABLE_NAME,
                Item: tokenRecord,
            })
        );

        const url = `${FRONTEND_URL}/connect/${token}`;

        console.log('Token generated successfully, expires at:', expiresAt);

        return {
            token,
            expiresAt,
            url,
        };
    } catch (error) {
        console.error('Error generating instant connect token:', error);
        throw new Error('Failed to generate instant connect token');
    }
}

async function deleteExistingUserToken(userId: string): Promise<void> {
    try {
        // Query for existing token using GSI
        const result = await docClient.send(
            new QueryCommand({
                TableName: INSTANT_CONNECT_TOKENS_TABLE_NAME,
                IndexName: 'ByUser',
                KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
                ExpressionAttributeValues: {
                    ':pk': `USER#${userId}`,
                    ':sk': 'TOKEN',
                },
            })
        );

        if (result.Items && result.Items.length > 0) {
            // Delete existing token(s)
            for (const item of result.Items) {
                await docClient.send(
                    new DeleteCommand({
                        TableName: INSTANT_CONNECT_TOKENS_TABLE_NAME,
                        Key: {
                            PK: item.PK,
                            SK: item.SK,
                        },
                    })
                );
                console.log('Deleted existing token:', item.PK);
            }
        }
    } catch (error) {
        console.error('Error deleting existing user token:', error);
        // Don't throw - continue with token generation
    }
}

async function redeemInstantConnectToken(redeemerId: string, args: { token: string }): Promise<InstantConnectResult> {
    const { token } = args;
    console.log('Redeeming instant connect token for user:', redeemerId);

    try {
        // Look up token
        const tokenResult = await docClient.send(
            new GetCommand({
                TableName: INSTANT_CONNECT_TOKENS_TABLE_NAME,
                Key: {
                    PK: `TOKEN#${token}`,
                    SK: 'TOKEN',
                },
            })
        );

        if (!tokenResult.Item) {
            return {
                success: false,
                message: 'Invalid or expired connection link',
            };
        }

        const tokenRecord = tokenResult.Item as InstantConnectToken;

        // Check if token is expired
        const now = new Date();
        const expiresAt = new Date(tokenRecord.expiresAt);
        if (now > expiresAt) {
            // Delete expired token
            await deleteToken(token);
            return {
                success: false,
                message: 'This connection link has expired',
            };
        }

        // Check for self-redemption
        if (tokenRecord.userId === redeemerId) {
            return {
                success: false,
                message: 'You cannot connect with yourself',
            };
        }

        // Check if already connected
        const isConnected = await checkExistingConnection(redeemerId, tokenRecord.userId);
        if (isConnected) {
            // Delete token since they're already connected
            await deleteToken(token);
            return {
                success: false,
                message: 'You are already connected with this user',
            };
        }

        // Delete token immediately (single-use)
        await deleteToken(token);

        // Get token owner's profile
        const ownerProfile = await getUserProfile(tokenRecord.userId);
        if (!ownerProfile) {
            return {
                success: false,
                message: 'User not found',
            };
        }

        // Emit InstantConnectRedeemed event for async connection creation
        const timestamp = now.toISOString();
        await eventBridgeClient.send(
            new PutEventsCommand({
                Entries: [
                    {
                        Source: 'hallway-track.instant-connect',
                        DetailType: 'InstantConnectRedeemed',
                        Detail: JSON.stringify({
                            tokenOwnerId: tokenRecord.userId,
                            redeemerId,
                            timestamp,
                        }),
                        EventBusName: EVENT_BUS_NAME,
                    },
                ],
            })
        );

        console.log('InstantConnectRedeemed event emitted');

        return {
            success: true,
            message: 'Connected successfully',
            connectedUser: {
                id: ownerProfile.id,
                displayName: ownerProfile.displayName,
                gravatarHash: ownerProfile.gravatarHash,
                profilePictureUrl: ownerProfile.profilePictureUrl,
                uploadedProfilePictureUrl: ownerProfile.uploadedProfilePictureUrl,
            },
        };
    } catch (error) {
        console.error('Error redeeming instant connect token:', error);
        return {
            success: false,
            message: 'Failed to redeem connection link. Please try again.',
        };
    }
}

async function deleteToken(token: string): Promise<void> {
    await docClient.send(
        new DeleteCommand({
            TableName: INSTANT_CONNECT_TOKENS_TABLE_NAME,
            Key: {
                PK: `TOKEN#${token}`,
                SK: 'TOKEN',
            },
        })
    );
    console.log('Token deleted:', token);
}

async function checkExistingConnection(userId1: string, userId2: string): Promise<boolean> {
    try {
        const result = await docClient.send(
            new GetCommand({
                TableName: CONNECTIONS_TABLE_NAME,
                Key: {
                    PK: `USER#${userId1}`,
                    SK: `CONNECTION#${userId2}`,
                },
            })
        );
        return !!result.Item;
    } catch (error) {
        console.error('Error checking existing connection:', error);
        return false;
    }
}

interface UserProfile {
    id: string;
    displayName: string;
    gravatarHash: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
}

async function getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
        const result = await docClient.send(
            new GetCommand({
                TableName: USERS_TABLE_NAME,
                Key: {
                    PK: `USER#${userId}`,
                    SK: 'PROFILE',
                },
            })
        );

        if (!result.Item) {
            return null;
        }

        return {
            id: result.Item.id as string,
            displayName: result.Item.displayName as string,
            gravatarHash: result.Item.gravatarHash as string,
            profilePictureUrl: result.Item.profilePictureUrl as string | undefined,
            uploadedProfilePictureUrl: result.Item.uploadedProfilePictureUrl as string | undefined,
        };
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}
