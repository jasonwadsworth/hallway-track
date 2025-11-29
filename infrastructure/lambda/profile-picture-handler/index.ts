import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Event } from 'aws-lambda';

const cloudFrontClient = new CloudFrontClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID!;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN!;

export const handler = async (event: S3Event): Promise<void> => {
    for (const record of event.Records) {
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

        // Extract userId from key: {userId}/{timestamp}-{filename}
        const userId = key.split('/')[0];
        if (!userId) {
            console.error(`Invalid key format: ${key}`);
            continue;
        }

        try {
            const cloudFrontUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;

            // Get current user to check for existing profile picture
            const userResult = await docClient.send(
                new GetCommand({
                    TableName: USERS_TABLE_NAME,
                    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
                    ProjectionExpression: 'uploadedProfilePictureKey',
                })
            );
            const oldKey = userResult.Item?.uploadedProfilePictureKey;

            // Update DynamoDB with new profile picture URL
            await docClient.send(
                new UpdateCommand({
                    TableName: USERS_TABLE_NAME,
                    Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
                    UpdateExpression: 'SET uploadedProfilePictureUrl = :url, uploadedProfilePictureKey = :key, profilePictureUploadedAt = :uploadedAt, updatedAt = :updatedAt',
                    ExpressionAttributeValues: {
                        ':url': cloudFrontUrl,
                        ':key': key,
                        ':uploadedAt': new Date().toISOString(),
                        ':updatedAt': new Date().toISOString(),
                    },
                })
            );

            // Invalidate CloudFront cache for old image if exists
            if (oldKey && oldKey !== key) {
                await cloudFrontClient.send(
                    new CreateInvalidationCommand({
                        DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
                        InvalidationBatch: {
                            CallerReference: `${userId}-${Date.now()}`,
                            Paths: { Quantity: 1, Items: [`/${oldKey}`] },
                        },
                    })
                );
            }

            console.log(`Updated profile picture for user ${userId}: ${cloudFrontUrl}`);
        } catch (error) {
            console.error(`Error processing image ${key}:`, error);
            throw error;
        }
    }
};
