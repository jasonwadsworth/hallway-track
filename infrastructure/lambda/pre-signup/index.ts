import { PreSignUpTriggerEvent } from 'aws-lambda';
import { CognitoIdentityProvider, ListUsersCommand, AdminLinkProviderForUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProvider({});

export const handler = async (event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerEvent> => {
  console.log('Pre-signup event:', JSON.stringify(event, null, 2));

  // Only process external provider sign-ups
  if (event.triggerSource !== 'PreSignUp_ExternalProvider') {
    return event;
  }

  const email = event.request.userAttributes.email;
  const userPoolId = event.userPoolId;

  // Auto-confirm and auto-verify for external providers
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;

  if (!email) {
    console.log('No email found');
    return event;
  }

  try {
    // Check if there's an existing user with this email
    const listResponse = await client.send(new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `email = "${email}"`,
      Limit: 2,
    }));

    const existingUsers = listResponse.Users?.filter((u: { Username?: string }) => !u.Username?.includes('_')) || [];

    if (existingUsers.length === 1) {
      const existingUser = existingUsers[0];
      console.log(`Found existing user ${existingUser.Username} with email ${email}, linking accounts`);

      // Link the external provider to the existing user
      await client.send(new AdminLinkProviderForUserCommand({
        UserPoolId: userPoolId,
        DestinationUser: {
          ProviderName: 'Cognito',
          ProviderAttributeValue: existingUser.Username!,
        },
        SourceUser: {
          ProviderName: event.userName.split('_')[0],
          ProviderAttributeName: 'Cognito_Subject',
          ProviderAttributeValue: event.userName.split('_')[1],
        },
      }));

      console.log('Successfully linked accounts');
    } else {
      console.log('No existing user found, allowing new user creation');
    }
  } catch (error) {
    console.error('Error linking accounts:', error);
    // Don't throw - allow sign-up to proceed
  }

  return event;
};
