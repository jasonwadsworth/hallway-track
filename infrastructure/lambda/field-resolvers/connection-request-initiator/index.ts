import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { AppSyncResolverEvent } from 'aws-lambda';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

interface ConnectionRequest {
  id: string;
  initiatorUserId: string;
  recipientUserId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  actionedAt?: string;
  initiatorNote?: string;
  initiatorTags?: string[];
}

interface PublicProfile {
  id: string;
  displayName: string;
  gravatarHash: string;
}

interface User {
  PK: string;
  SK: string;
  id: string;
  email: string;
  displayName: string;
  gravatarHash: string;
  contactLinks: unknown[];
  badges: unknown[];
  connectionCount: number;
  createdAt: string;
  updatedAt: string;
}

// Simple in-memory cache for batching within a single request
const batchCache = new Map<string, User | null>();

async function batchGetUsers(userIds: string[]): Promise<Map<string, User | null>> {
  const uniqueUserIds = [...new Set(userIds)];
  const results = new Map<string, User | null>();

  // Check cache first
  const uncachedUserIds: string[] = [];
  for (const userId of uniqueUserIds) {
    if (batchCache.has(userId)) {
      results.set(userId, batchCache.get(userId)!);
    } else {
      uncachedUserIds.push(userId);
    }
  }

  if (uncachedUserIds.length === 0) {
    return results;
  }

  console.log(`Batch fetching ${uncachedUserIds.length} users`);

  // Batch get from DynamoDB (max 100 items per request)
  const batchSize = 100;
  for (let i = 0; i < uncachedUserIds.length; i += batchSize) {
    const batch = uncachedUserIds.slice(i, i + batchSize);

    const keys = batch.map(userId => ({
      PK: `USER#${userId}`,
      SK: 'PROFILE',
    }));

    try {
      const response = await docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [USERS_TABLE_NAME]: {
              Keys: keys,
            },
          },
        })
      );

      const items = response.Responses?.[USERS_TABLE_NAME] || [];

      // Map results
      for (const item of items) {
        const user = item as User;
        results.set(user.id, user);
        batchCache.set(user.id, user);
      }

      // Mark missing users as null
      for (const userId of batch) {
        if (!results.has(userId)) {
          console.warn(`User not found: ${userId}`);
          results.set(userId, null);
          batchCache.set(userId, null);
        }
      }
    } catch (error) {
      console.error('Error batch fetching users:', error);
      // Mark all as null on error
      for (const userId of batch) {
        if (!results.has(userId)) {
          results.set(userId, null);
          batchCache.set(userId, null);
        }
      }
    }
  }

  return results;
}

function toPublicProfile(user: User | null): PublicProfile | null {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    displayName: user.displayName,
    gravatarHash: user.gravatarHash,
  };
}

export const handler = async (event: AppSyncResolverEvent<unknown>): Promise<PublicProfile | null> => {
  console.log('ConnectionRequest.initiator field resolver invoked');

  const request = event.source as ConnectionRequest;
  const initiatorUserId = request.initiatorUserId;

  if (!initiatorUserId) {
    console.warn('No initiatorUserId in connection request');
    return null;
  }

  try {
    const users = await batchGetUsers([initiatorUserId]);
    const user = users.get(initiatorUserId) || null;

    if (!user) {
      console.warn(`User not found for initiatorUserId: ${initiatorUserId}`);
      return null;
    }

    return toPublicProfile(user);
  } catch (error) {
    console.error('Error fetching initiator user:', error);
    return null;
  }
};
