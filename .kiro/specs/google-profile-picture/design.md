# Design Document: Google Profile Picture Support

## Overview

This feature enhances the Hallway Track application to display Google profile pictures for users who authenticate with Google. The system will store the profile picture URL from Google OAuth and update it on each login to keep it current. The frontend will prioritize displaying the Google profile picture when available, falling back to Gravatar for users without one.

The key technical components are:
1. **Data Model Update**: Add `profilePictureUrl` field to user profiles
2. **Post-Authentication Lambda**: New Lambda trigger to update profile pictures on each login
3. **Post-Confirmation Lambda Update**: Store initial profile picture URL on first signup
4. **Frontend Update**: Modify profile picture display logic to use Google pictures first

## Architecture

### High-Level Flow

**First-Time Google Sign-In:**
1. User authenticates with Google → Cognito receives profile data including picture URL
2. Post-confirmation trigger fires → Creates user profile with both `profilePictureUrl` and `gravatarHash`
3. User profile is returned to frontend → Displays Google profile picture

**Subsequent Google Sign-Ins:**
1. User authenticates with Google → Cognito validates identity
2. Post-authentication trigger fires → Retrieves current picture URL from Cognito attributes
3. Lambda compares stored URL with current URL → Updates DynamoDB if changed
4. User continues to app → Profile picture stays current

**Email/Password Users:**
1. User authenticates with email/password → No profile picture URL available
2. Profile displays using Gravatar based on `gravatarHash`

### Components Involved

- **Amazon Cognito User Pool**: Stores `picture` attribute from Google OAuth
- **Post-Authentication Lambda**: New Lambda function to sync profile picture on each login
- **Post-Confirmation Lambda**: Updated to store initial profile picture URL
- **DynamoDB Users Table**: Updated schema to include `profilePictureUrl` field
- **GraphQL Schema**: Updated to include `profilePictureUrl` in User types
- **Frontend Components**: Updated to prioritize Google profile pictures

## Components and Interfaces

### 1. Data Model Changes

**DynamoDB Users Table:**
```typescript
{
  PK: 'USER#<userId>',
  SK: 'PROFILE',
  id: string,
  email: string,
  displayName: string,
  gravatarHash: string,
  profilePictureUrl?: string,  // NEW: Optional Google profile picture URL
  contactLinks: ContactLink[],
  badges: Badge[],
  connectionCount: number,
  createdAt: string,
  updatedAt: string
}
```

**GraphQL Schema Updates:**
```graphql
type User {
  id: ID!
  email: AWSEmail!
  displayName: String!
  gravatarHash: String!
  profilePictureUrl: String  # NEW: Optional profile picture URL
  contactLinks: [ContactLink!]!
  badges: [Badge!]!
  connectionCount: Int!
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type PublicProfile {
  id: ID!
  displayName: String!
  gravatarHash: String!
  profilePictureUrl: String  # NEW
}

type ConnectedProfile {
  id: ID!
  displayName: String!
  gravatarHash: String!
  profilePictureUrl: String  # NEW
  contactLinks: [ContactLink!]!
  badges: [Badge!]!
}
```

### 2. Post-Confirmation Lambda Update

**Changes Required:**
- Extract `picture` attribute from Cognito event
- Store `profilePictureUrl` in DynamoDB when creating user profile
- Maintain backward compatibility for email/password users

**Implementation:**
```typescript
export const handler = async (event: PostConfirmationTriggerEvent) => {
  const userId = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;
  const profilePictureUrl = event.request.userAttributes.picture; // NEW

  // Generate Gravatar hash (still needed as fallback)
  const gravatarHash = createHash('md5')
    .update(email.toLowerCase().trim())
    .digest('hex');

  // Generate display name
  let displayName: string;
  const givenName = event.request.userAttributes.given_name;
  const familyName = event.request.userAttributes.family_name;

  if (givenName && familyName) {
    displayName = `${givenName} ${familyName}`;
  } else if (givenName) {
    displayName = givenName;
  } else {
    displayName = email.split('@')[0];
  }

  const now = new Date().toISOString();

  const item: Record<string, unknown> = {
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
  };

  // Add profilePictureUrl only if it exists (Google sign-in)
  if (profilePictureUrl) {
    item.profilePictureUrl = profilePictureUrl;
  }

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return event;
};
```

### 3. Post-Authentication Lambda (New)

**Purpose:**
- Runs after every successful authentication
- Updates profile picture URL if it has changed
- Skips update if URL is unchanged to minimize writes

**Lambda Configuration:**
```typescript
// In hallway-track-stack.ts
const postAuthenticationLambda = new lambda.Function(this, 'PostAuthenticationFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('lambda/post-authentication'),
  environment: {
    TABLE_NAME: usersTable.tableName,
  },
  timeout: Duration.seconds(10),
});

// Grant DynamoDB permissions
usersTable.grantReadWriteData(postAuthenticationLambda);

// Add trigger to User Pool
userPool.addTrigger(
  cognito.UserPoolOperation.POST_AUTHENTICATION,
  postAuthenticationLambda
);
```

**Implementation:**
```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PostAuthenticationTriggerEvent } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: PostAuthenticationTriggerEvent) => {
  console.log('Post-authentication trigger event:', JSON.stringify(event, null, 2));

  const userId = event.request.userAttributes.sub;
  const newProfilePictureUrl = event.request.userAttributes.picture;

  // Only proceed if user has a profile picture from Google
  if (!newProfilePictureUrl) {
    console.log('No profile picture URL in attributes, skipping update');
    return event;
  }

  try {
    // Get current user profile
    const getResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
        },
      })
    );

    const currentProfilePictureUrl = getResult.Item?.profilePictureUrl;

    // Only update if the URL has changed
    if (currentProfilePictureUrl === newProfilePictureUrl) {
      console.log('Profile picture URL unchanged, skipping update');
      return event;
    }

    // Update profile picture URL
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PROFILE',
        },
        UpdateExpression: 'SET profilePictureUrl = :url, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':url': newProfilePictureUrl,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );

    console.log(`Successfully updated profile picture for user ${userId}`);
  } catch (error) {
    console.error('Error updating profile picture:', error);
    // Don't throw - we don't want to block authentication if update fails
  }

  return event;
};
```

### 4. GraphQL Resolver Updates

**Affected Resolvers:**
All resolvers that return user profile data need to include `profilePictureUrl`:

- `Query.getMyProfile`
- `Query.getPublicProfile`
- `Query.getConnectedProfile`
- `Connection.connectedUser`
- `ConnectionRequest.initiator`
- `ConnectionRequest.recipient`

**Example Update (Query.getPublicProfile.js):**
```javascript
export function request(ctx) {
  return {
    operation: 'GetItem',
    key: util.dynamodb.toMapValues({
      PK: `USER#${ctx.args.userId}`,
      SK: 'PROFILE'
    })
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  if (!ctx.result) {
    return null;
  }

  return {
    id: ctx.result.id,
    displayName: ctx.result.displayName,
    gravatarHash: ctx.result.gravatarHash,
    profilePictureUrl: ctx.result.profilePictureUrl  // NEW
  };
}
```

### 5. Frontend Updates

**Profile Picture Component:**
Create a reusable component that handles the fallback logic:

```typescript
// src/components/ProfilePicture.tsx
import { getGravatarUrl } from '../utils/gravatar';

interface ProfilePictureProps {
  profilePictureUrl?: string;
  gravatarHash: string;
  displayName: string;
  size?: number;
  className?: string;
}

export function ProfilePicture({
  profilePictureUrl,
  gravatarHash,
  displayName,
  size = 200,
  className = '',
}: ProfilePictureProps) {
  const [imageError, setImageError] = useState(false);

  // Use Google profile picture if available and hasn't errored
  const imageUrl = profilePictureUrl && !imageError
    ? profilePictureUrl
    : getGravatarUrl(gravatarHash, size);

  return (
    <img
      src={imageUrl}
      alt={`${displayName}'s profile picture`}
      className={className}
      onError={() => {
        if (profilePictureUrl && !imageError) {
          // Fallback to Gravatar if Google image fails to load
          setImageError(true);
        }
      }}
    />
  );
}
```

**Usage Example:**
```typescript
// Replace existing img tags with ProfilePicture component
<ProfilePicture
  profilePictureUrl={user.profilePictureUrl}
  gravatarHash={user.gravatarHash}
  displayName={user.displayName}
  size={200}
  className="rounded-full"
/>
```

## Data Flow

### New User Sign-In with Google

```
1. User clicks "Sign in with Google"
   ↓
2. Google OAuth flow completes
   ↓
3. Cognito creates user with attributes:
   - email
   - given_name, family_name
   - picture (URL)
   ↓
4. Post-Confirmation Lambda fires
   ↓
5. Lambda creates DynamoDB record:
   - gravatarHash (from email)
   - profilePictureUrl (from picture attribute)
   - displayName (from name attributes)
   ↓
6. User profile returned to frontend
   ↓
7. Frontend displays Google profile picture
```

### Returning User Sign-In with Google

```
1. User signs in with Google
   ↓
2. Cognito validates identity
   ↓
3. Post-Authentication Lambda fires
   ↓
4. Lambda reads current profile from DynamoDB
   ↓
5. Lambda compares stored URL with Cognito picture attribute
   ↓
6. If different:
   - Update DynamoDB with new URL
   - Update updatedAt timestamp
   ↓
7. If same:
   - Skip update (no write operation)
   ↓
8. Authentication completes
   ↓
9. Frontend fetches profile (includes latest picture URL)
```

### Account Linking Scenario

```
1. User has email/password account (only gravatarHash)
   ↓
2. User signs in with Google (same email)
   ↓
3. Cognito links accounts
   ↓
4. Post-Authentication Lambda fires
   ↓
5. Lambda detects no profilePictureUrl in DynamoDB
   ↓
6. Lambda updates profile with Google picture URL
   ↓
7. User now has both gravatarHash and profilePictureUrl
   ↓
8. Frontend displays Google profile picture
```

## Error Handling

### Post-Authentication Lambda Errors

**DynamoDB Read Failure:**
- Log error with user ID and error details
- Return event to allow authentication to proceed
- User will see stale profile picture (acceptable degradation)

**DynamoDB Update Failure:**
- Log error with user ID and error details
- Return event to allow authentication to proceed
- Profile picture will be updated on next login attempt

**Missing User Profile:**
- Log warning (shouldn't happen in normal flow)
- Return event to allow authentication
- User can still access app, profile may need manual creation

### Frontend Error Handling

**Google Profile Picture Load Failure:**
- Catch `onError` event on img tag
- Automatically fall back to Gravatar URL
- No user-visible error (seamless fallback)

**Missing profilePictureUrl:**
- Check for undefined/null before using
- Fall back to Gravatar URL
- Works for all email/password users

## Testing Strategy

### Unit Tests

**Post-Authentication Lambda:**
```typescript
describe('Post-authentication Lambda', () => {
  it('should update profile picture when URL changes', async () => {
    // Mock DynamoDB to return old URL
    // Call handler with new URL
    // Verify UpdateCommand called with new URL
  });

  it('should skip update when URL unchanged', async () => {
    // Mock DynamoDB to return same URL
    // Call handler with same URL
    // Verify UpdateCommand not called
  });

  it('should handle missing profile picture attribute', async () => {
    // Call handler without picture attribute
    // Verify no DynamoDB operations
    // Verify event returned successfully
  });

  it('should not throw on DynamoDB errors', async () => {
    // Mock DynamoDB to throw error
    // Call handler
    // Verify error logged but event returned
  });
});
```

**Post-Confirmation Lambda:**
```typescript
describe('Post-confirmation Lambda with profile picture', () => {
  it('should store profilePictureUrl for Google users', async () => {
    const event = {
      request: {
        userAttributes: {
          sub: 'user-123',
          email: 'user@gmail.com',
          given_name: 'John',
          family_name: 'Doe',
          picture: 'https://lh3.googleusercontent.com/...',
        },
      },
    };

    await handler(event);

    expect(mockPutCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Item: expect.objectContaining({
          profilePictureUrl: 'https://lh3.googleusercontent.com/...',
          gravatarHash: expect.any(String),
        }),
      })
    );
  });

  it('should not include profilePictureUrl for email/password users', async () => {
    const event = {
      request: {
        userAttributes: {
          sub: 'user-123',
          email: 'user@example.com',
          // No picture attribute
        },
      },
    };

    await handler(event);

    expect(mockPutCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Item: expect.not.objectContaining({
          profilePictureUrl: expect.anything(),
        }),
      })
    );
  });
});
```

**Frontend ProfilePicture Component:**
```typescript
describe('ProfilePicture', () => {
  it('should display Google profile picture when available', () => {
    render(
      <ProfilePicture
        profilePictureUrl="https://lh3.googleusercontent.com/..."
        gravatarHash="abc123"
        displayName="John Doe"
      />
    );

    const img = screen.getByAltText("John Doe's profile picture");
    expect(img).toHaveAttribute('src', 'https://lh3.googleusercontent.com/...');
  });

  it('should fall back to Gravatar when no profile picture URL', () => {
    render(
      <ProfilePicture
        gravatarHash="abc123"
        displayName="John Doe"
      />
    );

    const img = screen.getByAltText("John Doe's profile picture");
    expect(img).toHaveAttribute('src', expect.stringContaining('gravatar.com'));
  });

  it('should fall back to Gravatar on image load error', () => {
    render(
      <ProfilePicture
        profilePictureUrl="https://invalid-url.com/image.jpg"
        gravatarHash="abc123"
        displayName="John Doe"
      />
    );

    const img = screen.getByAltText("John Doe's profile picture");

    // Trigger error
    fireEvent.error(img);

    // Should now use Gravatar
    expect(img).toHaveAttribute('src', expect.stringContaining('gravatar.com'));
  });
});
```

### Integration Tests

**End-to-End Profile Picture Flow:**
1. Sign in with Google (new user)
2. Verify profile created with profilePictureUrl
3. Verify frontend displays Google picture
4. Sign out
5. Sign in again with Google
6. Verify post-authentication trigger runs
7. Verify profile picture URL is current

**Account Linking:**
1. Create account with email/password
2. Verify profile has only gravatarHash
3. Sign in with Google (same email)
4. Verify profilePictureUrl added to profile
5. Verify frontend displays Google picture

### Manual Testing

**Google Profile Picture Display:**
- Sign in with Google
- Verify profile picture appears in header
- Verify profile picture appears in connections list
- Verify profile picture appears in public profile view

**Fallback Behavior:**
- Sign in with email/password
- Verify Gravatar displays correctly
- Temporarily break Google image URL
- Verify automatic fallback to Gravatar

**Profile Picture Updates:**
- Change Google profile picture
- Sign in to Hallway Track
- Verify new picture appears (may take one login cycle)

## Performance Considerations

### DynamoDB Operations

**Write Optimization:**
- Post-authentication Lambda only writes when URL changes
- Typical case: No write needed (URL unchanged)
- Worst case: One conditional update per login

**Read Optimization:**
- Single GetItem operation per login
- Consistent reads not required (eventual consistency acceptable)
- Small item size (only checking one field)

### Lambda Performance

**Post-Authentication Lambda:**
- Cold start: ~500ms (acceptable for async operation)
- Warm execution: ~50-100ms
- Timeout: 10 seconds (plenty of buffer)
- Memory: 128MB (sufficient for simple DynamoDB operations)

**Frontend Performance:**
- Profile picture URLs cached by browser
- Fallback logic is synchronous (no additional network calls)
- Component re-renders minimized with proper React patterns

## Security Considerations

### Profile Picture URLs

**URL Validation:**
- Google provides HTTPS URLs only
- No additional validation needed (trusted source)
- URLs are public (no authentication required)

**Privacy:**
- Profile picture URLs are public by design
- Users control their Google profile picture visibility in Google settings
- No PII exposed beyond what user has made public on Google

### Lambda Security

**IAM Permissions:**
- Post-authentication Lambda has minimal permissions
- Read/write access only to Users table
- No access to other AWS resources

**Error Handling:**
- Errors logged but don't expose sensitive data
- Authentication proceeds even if update fails
- No user data leaked in error messages

## Deployment Considerations

### Migration Strategy

**Existing Users:**
- No migration needed for existing data
- `profilePictureUrl` is optional field
- Existing users continue using Gravatar
- Google users get profilePictureUrl on next login

**Rollout Plan:**
1. Deploy Lambda functions (post-authentication, updated post-confirmation)
2. Deploy GraphQL schema updates
3. Deploy frontend updates
4. No downtime required (backward compatible)

### Rollback Plan

**If Issues Occur:**
1. Remove post-authentication trigger from User Pool
2. Revert frontend to always use Gravatar
3. Existing profilePictureUrl data remains (no cleanup needed)
4. Can re-enable later without data loss

## Future Enhancements

### Profile Picture Management

**User Control:**
- Allow users to choose between Google picture and Gravatar
- Allow users to upload custom profile pictures
- Profile picture preferences stored in user profile

### Image Optimization

**CDN Integration:**
- Cache Google profile pictures in CloudFront
- Resize images for different display sizes
- Reduce load times for frequently viewed profiles

### Additional OAuth Providers

**Extensibility:**
- Same pattern works for other OAuth providers (GitHub, LinkedIn)
- Unified profile picture handling across all providers
- Priority order: Custom upload > OAuth provider > Gravatar
