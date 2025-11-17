import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { AppSyncResolverEvent } from 'aws-lambda';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

interface Connection {
  id: string;
  userId: string;
  connectedUserId: string;
  tags: string[];
  note?: string;
  createdAt: string;
  updatedAt: string;
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
let batchQueue: string[] = [];
let batchTimer: NodeJS.Timeout | null = null;

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

export const handler = async (event: AppSyncResolverEvent<unknown>): Promise<User | null> => {
  console.log('Connection.connectedUser field resolver invoked');

  const connection = event.source as Connection;
  const connectedUserId = connection.connectedUserId;

  if (!connectedUserId) {
    console.warn('No connectedUserId in connection');
    return null;
  }

  try {
    // For single field resolution, just fetch the user directly
    // In a real DataLoader implementation, this would batch multiple requests
    const users = await batchGetUsers([connectedUserId]);
    const user = users.get(connectedUserId) || null;

    if (!user) {
      console.warn(`User not found for connectedUserId: ${connectedUserId}`);
    }

    return user;
  } catch (error) {
    console.error('Error fetching connected user:', error);
    return null;
  }
};
