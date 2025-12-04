import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { AppSyncResolverEvent } from 'aws-lambda';

const s3Client = new S3Client({});
const cloudFrontClient = new CloudFrontClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const BUCKET_NAME = process.env.PROFILE_PICTURES_BUCKET_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID!;

interface User {
    id: string;
    email: string;
    displayName: string;
    gravatarHash: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
    contactLinks: unknown[];
    badges: unknown[];
    connectionCount: number;
    createdAt: string;
    updatedAt: string;
}

export const handler = async (event: AppSyncResolverEvent<Record<string, never>>): Promise<User> => {
    const identity = event.identity as { sub?: string };
    const userId = identity?.sub;

    if (!userId) {
        throw new Error('Unauthorized');
    }

    // Get current user profile
    const userResult = await docClient.send(
        new GetCommand({
            TableName: USERS_TABLE_NAME,
            Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        })
    );

    if (!userResult.Item) {
        throw new Error('User not found');
    }

    const user = userResult.Item as User & { uploadedProfilePictureKey?: string };
    const oldKey = user.uploadedProfilePictureKey;

    // Delete all profile pictures for this user from S3
    const listResult = await s3Client.send(
        new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: `${userId}/`,
        })
    );

    if (listResult.Contents && listResult.Contents.length > 0) {
        await s3Client.send(
            new DeleteObjectsCommand({
                Bucket: BUCKET_NAME,
                Delete: { Objects: listResult.Contents.filter((obj: { Key?: string }) => obj.Key).map((obj: { Key?: string }) => ({ Key: obj.Key! })) },
            })
        );
    }

    // Update DynamoDB to remove profile picture fields
    await docClient.send(
        new UpdateCommand({
            TableName: USERS_TABLE_NAME,
            Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
            UpdateExpression: 'REMOVE uploadedProfilePictureUrl, uploadedProfilePictureKey, profilePictureUploadedAt SET updatedAt = :updatedAt',
            ExpressionAttributeValues: { ':updatedAt': new Date().toISOString() },
        })
    );

    // Invalidate CloudFront cache
    if (oldKey) {
        await cloudFrontClient.send(
            new CreateInvalidationCommand({
                DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
                InvalidationBatch: {
                    CallerReference: `remove-${userId}-${Date.now()}`,
                    Paths: { Quantity: 1, Items: [`/${oldKey}`] },
                },
            })
        );
    }

    delete user.uploadedProfilePictureUrl;
    delete user.uploadedProfilePictureKey;
    user.updatedAt = new Date().toISOString();

    return user;
};
