import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { AppSyncResolverEvent } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

interface ContactLink {
  id: string;
  label: string;
  url: string;
  visible: boolean;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  threshold: number;
  iconUrl?: string;
  earnedAt?: string;
}

interface User {
  PK: string;
  SK: string;
  id: string;
  email: string;
  displayName: string;
  gravatarHash: string;
  contactLinks: ContactLink[];
  badges: Badge[];
  connectionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PublicProfile {
  id: string;
  displayName: string;
  gravatarHash: string;
}

export const handler = async (
  event: AppSyncResolverEvent<{ userId: string }>
): Promise<PublicProfile> => {
  const { userId } = event.arguments;

  // Fetch user from DynamoDB
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
    throw new Error('User not found');
  }

  const user = result.Item as User;

  // Log public profile access
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'public_profile_access',
    profileUserId: userId,
    accessType: 'public',
    privacyProtectionApplied: true
  }));

  // Return minimal public profile data only
  return {
    id: user.id,
    displayName: user.displayName,
    gravatarHash: user.gravatarHash,
  };
};
