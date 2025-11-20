import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PostAuthenticationTriggerEvent } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: PostAuthenticationTriggerEvent) => {
    console.log('Post-authentication trigger event:', JSON.stringify(event, null, 2));

    const userId = event.request.userAttributes.sub;
    const newProfilePictureUrl = event.request.userAttributes.picture;

    // Only proceed if user has a profile picture from Google
    if (!newProfilePictureUrl) {
        console.log('No profile picture URL in attributes, skipping update');
        return event;
    }

    try {
        // Get current user profile
        const getResult = await docClient.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: {
                    PK: `USER#${userId}`,
                    SK: 'PROFILE',
                },
            })
        );

        const currentProfilePictureUrl = getResult.Item?.profilePictureUrl;

        // Only update if the URL has changed
        if (currentProfilePictureUrl === newProfilePictureUrl) {
            console.log('Profile picture URL unchanged, skipping update');
            return event;
        }

        // Update profile picture URL
        await docClient.send(
            new UpdateCommand({
                TableName: TABLE_NAME,
                Key: {
                    PK: `USER#${userId}`,
                    SK: 'PROFILE',
                },
                UpdateExpression: 'SET profilePictureUrl = :url, updatedAt = :updatedAt',
                ExpressionAttributeValues: {
                    ':url': newProfilePictureUrl,
                    ':updatedAt': new Date().toISOString(),
                },
            })
        );

        console.log(`Successfully updated profile picture for user ${userId}`);
    } catch (error) {
        console.error('Error updating profile picture:', error);
        // Don't throw - we don't want to block authentication if update fails
    }

    return event;
};
