import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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

interface User {
  PK: string;
  SK: string;
  id: string;
  email: string;
  displayName: string;
  gravatarHash: string;
  contactLinks: ContactLink[];
  badges: unknown[];
  connectionCount: number;
  createdAt: string;
  updatedAt: string;
}

export const handler = async (event: AppSyncResolverEvent<Record<string, unknown>>): Promise<User> => {
  const identity = event.identity as { sub?: string };
  const userId = identity?.sub;
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const fieldName = event.info.fieldName;

  // Get current user
  const getResult = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
    })
  );

  if (!getResult.Item) {
    throw new Error('User not found');
  }

  const user = getResult.Item as User;
  const contactLinks = user.contactLinks || [];

  if (fieldName === 'updateContactLink') {
    const { contactLinkId, label, url, visible } = event.arguments as {
      contactLinkId: string;
      label?: string;
      url?: string;
      visible?: boolean;
    };

    const linkIndex = contactLinks.findIndex((link) => link.id === contactLinkId);
    if (linkIndex === -1) {
      throw new Error('Contact link not found');
    }

    // Update the contact link
    if (label !== undefined) {
      contactLinks[linkIndex].label = label;
    }
    if (url !== undefined) {
      contactLinks[linkIndex].url = url;
    }
    if (visible !== undefined) {
      contactLinks[linkIndex].visible = visible;
    }
  } else if (fieldName === 'removeContactLink') {
    const { contactLinkId } = event.arguments as { contactLinkId: string };

    const linkIndex = contactLinks.findIndex((link) => link.id === contactLinkId);
    if (linkIndex === -1) {
      throw new Error('Contact link not found');
    }

    // Remove the contact link
    contactLinks.splice(linkIndex, 1);
  } else {
    throw new Error(`Unknown field: ${fieldName}`);
  }

  // Update the user with modified contact links
  const now = new Date().toISOString();
  const updateResult = await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
      },
      UpdateExpression: 'SET contactLinks = :contactLinks, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':contactLinks': contactLinks,
        ':updatedAt': now,
      },
      ReturnValues: 'ALL_NEW',
    })
  );

  return updateResult.Attributes as User;
};
