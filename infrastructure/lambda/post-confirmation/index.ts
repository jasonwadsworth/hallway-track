import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { PostConfirmationTriggerEvent } from 'aws-lambda';
import { createHash } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: PostConfirmationTriggerEvent) => {
  console.log('Post-confirmation trigger event:', JSON.stringify(event, null, 2));

  const userId = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;

  if (!email) {
    console.error('No email found in user attributes');
    return event;
  }

  // Generate Gravatar hash
  const gravatarHash = createHash('md5')
    .update(email.toLowerCase().trim())
    .digest('hex');

  // Use email prefix as default display name
  const displayName = email.split('@')[0];

  const now = new Date().toISOString();

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
          id: userId,
          email,
          displayName,
          gravatarHash,
          contactLinks: [],
          badges: [],
          connectionCount: 0,
          createdAt: now,
          updatedAt: now,
        },
      })
    );

    console.log(`Successfully created profile for user ${userId}`);
  } catch (error) {
    console.error('Error creating user profile:', error);
    // Don't throw - we don't want to block user sign-up if profile creation fails
    // The frontend can handle creating the profile as a fallback
  }

  return event;
};
