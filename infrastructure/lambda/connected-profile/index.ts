import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import { AppSyncResolverEvent } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const cloudWatchClient = new CloudWatchClient({});

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;

/**
 * Send custom metrics to CloudWatch for privacy protection monitoring
 */
async function sendPrivacyMetric(metricName: string, value: number = 1, dimensions: Record<string, string> = {}) {
  try {
    await cloudWatchClient.send(
      new PutMetricDataCommand({
        Namespace: 'HallwayTrack/Privacy',
        MetricData: [
          {
            MetricName: metricName,
            Value: value,
            Unit: 'Count',
            Timestamp: new Date(),
            Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value })),
          },
        ],
      })
    );
  } catch (error) {
    console.error('Failed to send CloudWatch metric:', error);
    // Don't throw - metrics failures shouldn't break the main functionality
  }
}

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
  category?: string;
  metadata?: unknown;
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

interface ConnectedProfile {
  id: string;
  displayName: string;
  gravatarHash: string;
  contactLinks: ContactLink[];
  badges: Badge[];
}

/**
 * Verify if a bidirectional connection exists between two users
 * @param requestingUserId - The user making the request
 * @param profileUserId - The user whose profile is being accessed
 * @returns Promise<boolean> - True if connection exists, false otherwise
 */
async function checkConnectionExists(requestingUserId: string, profileUserId: string): Promise<boolean> {
  try {
    // Query connections table to verify bidirectional connection
    const result = await docClient.send(
      new QueryCommand({
        TableName: CONNECTIONS_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${requestingUserId}`,
          ':sk': 'CONNECTION#',
        },
      })
    );

    // Check if any connection has the profileUserId
    return (result.Items || []).some(
      (item: Record<string, unknown>) => item.connectedUserId === profileUserId
    );
  } catch (error) {
    console.error('Error checking connection status:', error);
    throw new Error('Unable to verify connection status');
  }
}

export const handler = async (
  event: AppSyncResolverEvent<{ userId: string }>
): Promise<ConnectedProfile> => {
  const { userId: profileUserId } = event.arguments;
  const identity = event.identity as { sub?: string };
  const requestingUserId = identity?.sub;

  // Ensure user is authenticated
  if (!requestingUserId) {
    throw new Error('Authentication required');
  }

  // Fetch the profile user from DynamoDB
  const result = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        PK: `USER#${profileUserId}`,
        SK: 'PROFILE',
      },
    })
  );

  if (!result.Item) {
    throw new Error('User not found');
  }

  const user = result.Item as User;

  // Check if requesting user is viewing their own profile (always allow)
  if (requestingUserId === profileUserId) {
    const visibleContactLinks = (user.contactLinks || []).filter(
      (link) => link.visible === true
    );

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'connected_profile_access',
      requestingUserId,
      profileUserId,
      accessType: 'own_profile',
      contactLinksReturned: visibleContactLinks.length,
      privacyProtectionApplied: false
    }));

    // Send metrics for own profile access
    await sendPrivacyMetric('ConnectedProfileAccess', 1, { AccessType: 'OwnProfile' });

    return {
      id: user.id,
      displayName: user.displayName,
      gravatarHash: user.gravatarHash,
      contactLinks: visibleContactLinks,
      badges: user.badges || [],
    };
  }

  // For other users, verify connection exists
  const isConnected = await checkConnectionExists(requestingUserId, profileUserId);

  if (!isConnected) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: 'connected_profile_access_denied',
      requestingUserId,
      profileUserId,
      accessType: 'unauthorized',
      reason: 'not_connected',
      privacyProtectionApplied: true
    }));

    // Send metrics for privacy protection events
    await sendPrivacyMetric('PrivacyProtectionApplied', 1, { Reason: 'NotConnected' });
    await sendPrivacyMetric('AuthorizationFailure', 1, { Type: 'ConnectedProfile' });

    throw new Error('Not authorized to view this user\'s connected profile');
  }

  // Return visible contact links for connected users
  const visibleContactLinks = (user.contactLinks || []).filter(
    (link) => link.visible === true
  );

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'connected_profile_access',
    requestingUserId,
    profileUserId,
    accessType: 'connected_user',
    contactLinksReturned: visibleContactLinks.length,
    privacyProtectionApplied: false
  }));

  // Send metrics for successful connected profile access
  await sendPrivacyMetric('ConnectedProfileAccess', 1, { AccessType: 'ConnectedUser' });
  await sendPrivacyMetric('ContactLinksReturned', visibleContactLinks.length);

  return {
    id: user.id,
    displayName: user.displayName,
    gravatarHash: user.gravatarHash,
    contactLinks: visibleContactLinks,
    badges: user.badges || [],
  };
};