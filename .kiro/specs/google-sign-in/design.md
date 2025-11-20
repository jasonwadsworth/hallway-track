# Design Document: Google Sign-In

## Overview

This feature adds Google as a federated identity provider to the Hallway Track application, allowing users to authenticate using their Google accounts. The implementation leverages Amazon Cognito's built-in support for federated identities and AWS Amplify's authentication UI components.

The key technical challenge is account linking - ensuring that when a user who previously signed up with email/password attempts to sign in with Google using the same email address, Cognito automatically links the identities rather than creating a duplicate user account.

## Architecture

### High-Level Flow

1. **New User with Google**: User clicks "Sign in with Google" → Redirected to Google OAuth → Returns to app → Cognito creates user → Post-confirmation trigger creates DynamoDB profile
2. **Existing User Linking**: User with email/password account signs in with Google → Cognito detects matching email → Links Google identity to existing account → User can now use either method
3. **Returning Google User**: User signs in with Google → Cognito validates → Returns JWT tokens → App loads user profile

### Components Involved

- **Amazon Cognito User Pool**: Manages user identities and handles OAuth flow with Google
- **Google OAuth 2.0**: External identity provider for authentication
- **AWS Amplify Authenticator**: Frontend UI component that handles sign-in flows
- **Post-Confirmation Lambda**: Creates user profile in DynamoDB (already exists, no changes needed)
- **Frontend Application**: React app with Amplify UI components

## Components and Interfaces

### 1. Cognito User Pool Configuration

**Changes Required:**
- Add Google as an identity provider to the existing User Pool
- Configure OAuth 2.0 credentials (Client ID and Client Secret from Google)
- Set up attribute mapping to map Google profile fields to Cognito user attributes
- Configure callback URLs for OAuth redirect flow

**CDK Implementation:**
```typescript
// In hallway-track-stack.ts
const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
  userPool: this.userPool,
  clientId: config.google.clientId,
  clientSecret: config.google.clientSecret,
  scopes: ['profile', 'email', 'openid'],
  attributeMapping: {
    email: cognito.ProviderAttribute.GOOGLE_EMAIL,
    givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
    familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
    profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
  },
});

// Update User Pool Client to support federated sign-in
this.userPoolClient = this.userPool.addClient('WebClient', {
  // ... existing config ...
  supportedIdentityProviders: [
    cognito.UserPoolClientIdentityProvider.COGNITO,
    cognito.UserPoolClientIdentityProvider.GOOGLE,
  ],
  oAuth: {
    flows: {
      authorizationCodeGrant: true,
    },
    scopes: [
      cognito.OAuthScope.EMAIL,
      cognito.OAuthScope.OPENID,
      cognito.OAuthScope.PROFILE,
    ],
    callbackUrls: config.oauth.callbackUrls,
    logoutUrls: config.oauth.logoutUrls,
  },
});

// Ensure client depends on provider
this.userPoolClient.node.addDependency(googleProvider);
```

### 2. Configuration Management

**New Configuration Interface:**
```typescript
// In config.ts
export interface HallwayTrackConfig {
  // ... existing config ...
  google: {
    clientId: string;
    clientSecret: string;
  };
  oauth: {
    callbackUrls: string[];
    logoutUrls: string[];
  };
}
```

**Environment-Specific Configuration:**
- Google OAuth credentials should be stored securely (environment variables or AWS Secrets Manager)
- Callback URLs will differ per environment (local dev, staging, production)
- Example callback URL: `https://hallwaytrack.com` or `http://localhost:5173` for local dev

### 3. Frontend Integration

**Amplify Configuration Update:**
```typescript
// In amplify-config.ts
const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN,
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [window.location.origin],
          redirectSignOut: [window.location.origin],
          responseType: 'code',
          providers: ['Google'],
        },
      },
    },
  },
  // ... rest of config
};
```

**Authenticator Component:**
The existing `Authenticator` component from `@aws-amplify/ui-react` automatically displays social sign-in buttons when federated providers are configured. No code changes required - it reads the configuration and renders the Google button automatically.

### 4. Account Linking Mechanism

**Cognito's Built-in Linking:**
Cognito automatically links accounts when:
- A user signs in with Google
- The email from Google matches an existing Cognito user's email
- The existing user's email is verified

**How It Works:**
1. User with email `user@example.com` signs up with password
2. Email is verified via Cognito's verification flow
3. Later, user clicks "Sign in with Google" using `user@example.com`
4. Cognito detects the matching verified email
5. Cognito links the Google identity to the existing user
6. User can now sign in with either method

**No Custom Code Required:**
This is handled entirely by Cognito's identity linking feature. The post-confirmation Lambda only runs for truly new users, not for linked identities.

## Data Models

No changes to existing data models. The Users table structure remains the same:

```typescript
{
  PK: 'USER#<userId>',
  SK: 'PROFILE',
  id: string,           // Cognito sub (same for linked accounts)
  email: string,
  displayName: string,
  gravatarHash: string,
  contactLinks: ContactLink[],
  badges: Badge[],
  connectionCount: number,
  createdAt: string,
  updatedAt: string
}
```

**Note on User ID:** When accounts are linked, Cognito maintains the same `sub` (user ID) for both authentication methods, ensuring data consistency.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Most of the acceptance criteria for this feature involve AWS-managed services (Cognito, OAuth flow) or third-party services (Google authentication) that are outside our direct control. The correctness of these services is guaranteed by AWS and Google. Our testing focus should be on:

1. **Configuration correctness**: Ensuring our CDK code properly configures Cognito with Google as an IdP
2. **Integration verification**: Ensuring the frontend is properly configured to use federated sign-in
3. **Existing functionality**: Ensuring the post-confirmation Lambda handles Google sign-ins correctly

Since most of the functionality is provided by managed services, there are no universal properties to test via property-based testing. The testable aspects are specific configuration examples and integration points.

**Example Test Cases:**

**Example 1: Post-confirmation Lambda handles Google sign-in**
*Given* a post-confirmation event from a Google-authenticated user, *when* the Lambda processes the event, *then* it should create a user profile in DynamoDB with email, displayName, and gravatarHash populated from the event attributes.
**Validates: Requirements 5.2, 5.3, 5.4**

**Example 2: Amplify configuration includes OAuth settings**
*Given* the Amplify configuration, *when* it is loaded, *then* it should include oauth settings with Google as a provider and correct redirect URLs.
**Validates: Requirements 4.1**

**Example 3: CDK creates Google identity provider**
*Given* the CDK stack, *when* it is synthesized, *then* it should include a UserPoolIdentityProviderGoogle resource with correct attribute mappings.
**Validates: Requirements 3.1**

## Error Handling

### OAuth Flow Errors

**Handled by Cognito/Amplify:**
- Invalid OAuth state
- User cancels Google sign-in
- Google authentication fails
- Network errors during OAuth flow

The Amplify Authenticator component automatically displays error messages for these scenarios. No custom error handling required.

### Configuration Errors

**CDK Deployment Validation:**
- Missing Google Client ID or Secret → CDK deployment fails with clear error
- Invalid callback URLs → Cognito rejects configuration during deployment
- Missing OAuth scopes → Caught during CDK synthesis

**Runtime Validation:**
- If Google IdP is not properly configured, Cognito returns error to Amplify
- Amplify Authenticator displays error message to user
- Application logs error for debugging

### Post-Confirmation Lambda Errors

**Existing Error Handling:**
The post-confirmation Lambda already has error handling that logs errors but doesn't throw exceptions (to avoid blocking user sign-up). This same behavior applies to Google sign-ins:

```typescript
try {
  await docClient.send(new PutCommand({ /* ... */ }));
  console.log(`Successfully created profile for user ${userId}`);
} catch (error) {
  console.error('Error creating user profile:', error);
  // Don't throw - frontend can handle profile creation as fallback
}
```

## Testing Strategy

### Unit Tests

**Post-Confirmation Lambda Tests:**
- Test that Lambda correctly processes Google sign-in events
- Verify email extraction from Google attributes
- Verify displayName generation from Google profile
- Verify gravatarHash calculation from email
- Test error handling when DynamoDB write fails

**Example Test:**
```typescript
describe('Post-confirmation Lambda with Google sign-in', () => {
  it('should create user profile from Google attributes', async () => {
    const event = {
      request: {
        userAttributes: {
          sub: 'google-user-123',
          email: 'user@gmail.com',
          given_name: 'John',
          family_name: 'Doe',
        },
      },
      triggerSource: 'PostConfirmation_ConfirmSignUp',
    };

    await handler(event);

    // Verify DynamoDB PutCommand was called with correct data
    expect(mockPutCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Item: expect.objectContaining({
          email: 'user@gmail.com',
          displayName: expect.any(String),
          gravatarHash: expect.any(String),
        }),
      })
    );
  });
});
```

### Integration Tests

**CDK Configuration Tests:**
- Verify CDK stack synthesizes successfully with Google IdP configuration
- Verify User Pool Client includes Google in supported identity providers
- Verify OAuth settings are correctly configured

**Frontend Configuration Tests:**
- Verify Amplify config includes OAuth settings
- Verify Google is listed in providers array
- Verify callback URLs are set correctly

### Manual Testing

**End-to-End OAuth Flow:**
1. Deploy stack with Google IdP configured
2. Navigate to application
3. Click "Sign in with Google"
4. Complete Google authentication
5. Verify redirect back to application
6. Verify user profile created in DynamoDB
7. Sign out and sign in again with Google
8. Verify successful authentication

**Account Linking:**
1. Create account with email/password
2. Verify email
3. Sign out
4. Sign in with Google using same email
5. Verify accounts are linked (same user ID)
6. Verify all existing data preserved
7. Sign out and sign in with password
8. Verify still works

### Property-Based Tests

Not applicable for this feature. The functionality is primarily configuration and integration with managed services (Cognito, Google OAuth) rather than algorithmic logic that would benefit from property-based testing.

## Deployment Considerations

### Prerequisites

1. **Google OAuth Credentials:**
   - Create OAuth 2.0 Client ID in Google Cloud Console
   - Configure authorized redirect URIs (Cognito hosted UI domain)
   - Obtain Client ID and Client Secret

2. **Cognito Domain:**
   - User Pool must have a Cognito domain configured for OAuth flows
   - Domain format: `https://<domain-prefix>.auth.<region>.amazoncognito.com`

3. **Environment Configuration:**
   - Add Google credentials to config per environment
   - Configure callback URLs for each environment
   - Update frontend environment variables with Cognito domain

### Deployment Steps

1. **Configure Google OAuth:**
   ```bash
   # In Google Cloud Console:
   # - Create OAuth 2.0 Client
   # - Add authorized redirect URI: https://<cognito-domain>/oauth2/idpresponse
   # - Copy Client ID and Secret
   ```

2. **Update CDK Configuration:**
   ```typescript
   // In config.ts
   google: {
     clientId: process.env.GOOGLE_CLIENT_ID!,
     clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
   },
   oauth: {
     callbackUrls: [process.env.APP_URL!],
     logoutUrls: [process.env.APP_URL!],
   },
   ```

3. **Deploy Infrastructure:**
   ```bash
   export GOOGLE_CLIENT_ID="<your-client-id>"
   export GOOGLE_CLIENT_SECRET="<your-client-secret>"
   export APP_URL="https://hallwaytrack.com"
   npm run cdk deploy
   ```

4. **Update Frontend Configuration:**
   ```bash
   # Add to frontend/.env
   VITE_COGNITO_DOMAIN=<cognito-domain-from-output>
   ```

5. **Build and Deploy Frontend:**
   ```bash
   cd frontend
   npm run build
   # Frontend deployment happens automatically via CDK
   ```

### Rollback Plan

If issues occur:
1. Remove Google from supported identity providers in User Pool Client
2. Redeploy CDK stack
3. Users can still sign in with email/password
4. Linked accounts remain linked (can re-enable Google later)

## Security Considerations

### OAuth Security

- **State Parameter:** Cognito automatically includes state parameter to prevent CSRF attacks
- **PKCE:** Cognito uses PKCE (Proof Key for Code Exchange) for additional security
- **Token Validation:** Cognito validates all tokens from Google before creating/linking accounts

### Credential Management

- **Client Secret Storage:** Store Google Client Secret in environment variables or AWS Secrets Manager
- **Never Commit Secrets:** Add to .gitignore, use environment-specific configuration
- **Rotation:** Google Client Secret can be rotated without affecting existing users

### Account Linking Security

- **Email Verification Required:** Cognito only links accounts if email is verified
- **Same Email Required:** Prevents unauthorized account linking
- **User ID Consistency:** Cognito maintains same `sub` for linked accounts

### Data Privacy

- **Minimal Data Collection:** Only request necessary scopes (email, profile, openid)
- **No Additional Storage:** Google profile data is mapped to existing Cognito attributes
- **User Control:** Users can unlink Google account through Cognito if needed

## Future Enhancements

### Additional Identity Providers

The same pattern can be used to add other identity providers:
- Apple Sign-In
- Facebook Login
- GitHub OAuth
- SAML-based enterprise SSO

### Account Management UI

Future enhancement could include:
- UI to view linked identity providers
- Ability to link/unlink providers from profile settings
- Display which method was used for current session

### Enhanced Profile Data

Could leverage additional Google profile data:
- Profile picture URL (already mapped, could use instead of Gravatar)
- Locale/language preferences
- Timezone information
