# Post-Confirmation Lambda Deployment

## What Changed

Added a Cognito post-confirmation Lambda trigger that automatically creates user profiles in DynamoDB when users sign up. This is the proper architectural solution instead of creating profiles from the frontend.

## Changes Made

1. **New Lambda Function**: `infrastructure/lambda/post-confirmation/`
   - Automatically creates user profile in DynamoDB after Cognito sign-up confirmation
   - Generates Gravatar hash from email
   - Sets default display name from email prefix

2. **CDK Stack Update**: `infrastructure/stacks/hallway-track-stack.ts`
   - Added post-confirmation Lambda trigger to Cognito User Pool
   - Reordered resource creation (DynamoDB table before User Pool)

3. **Frontend Cleanup**:
   - Removed `ProfileInitializer` component (no longer needed)
   - Removed `useEnsureProfile` hook (no longer needed)
   - Simplified `App.tsx`

## Deployment Steps

### 1. Deploy Infrastructure

```bash
npm run deploy
```

This will:
- Create the new post-confirmation Lambda function
- Update the Cognito User Pool with the Lambda trigger
- Deploy all other infrastructure changes

### 2. Test with New User

Create a new test user to verify the trigger works:

```bash
# The post-confirmation trigger will automatically create their profile
# when they confirm their email
```

### 3. Existing Users

**Important**: Existing users who signed up before this change won't have profiles automatically created. You have two options:

#### Option A: Manual Profile Creation (Recommended for few users)
Have existing users sign out and back in, then manually create their profile through the UI if needed.

#### Option B: Backfill Script (For many users)
Create a script to backfill profiles for existing Cognito users:

```typescript
// scripts/backfill-profiles.ts
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createHash } from 'crypto';

const cognitoClient = new CognitoIdentityProviderClient({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const USER_POOL_ID = 'your-user-pool-id';
const TABLE_NAME = 'hallway-track-users';

async function backfillProfiles() {
  const { Users } = await cognitoClient.send(
    new ListUsersCommand({ UserPoolId: USER_POOL_ID })
  );

  for (const user of Users || []) {
    const userId = user.Attributes?.find(a => a.Name === 'sub')?.Value;
    const email = user.Attributes?.find(a => a.Name === 'email')?.Value;

    if (!userId || !email) continue;

    const gravatarHash = createHash('md5').update(email.toLowerCase().trim()).digest('hex');
    const displayName = email.split('@')[0];
    const now = new Date().toISOString();

    await dynamoClient.send(
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
        ConditionExpression: 'attribute_not_exists(PK)', // Only create if doesn't exist
      })
    );

    console.log(`Created profile for ${email}`);
  }
}

backfillProfiles().catch(console.error);
```

## Benefits of This Approach

1. **Reliability**: Profile creation happens server-side, guaranteed to run
2. **Security**: No need to expose createUser mutation to frontend
3. **Performance**: Profile exists before user even logs in for the first time
4. **Best Practice**: Follows AWS recommended patterns for Cognito triggers
5. **Cleaner Frontend**: Removes complexity from client-side code

## Rollback

If you need to rollback:

1. Remove the `lambdaTriggers` section from the User Pool configuration
2. Redeploy: `npm run deploy`
3. Restore the ProfileInitializer component in the frontend

## Monitoring

Check CloudWatch Logs for the post-confirmation Lambda:
- Log Group: `/aws/lambda/HallwayTrackStack-PostConfirmationFunction*`
- Look for successful profile creation messages
- Monitor for any errors during user sign-up
