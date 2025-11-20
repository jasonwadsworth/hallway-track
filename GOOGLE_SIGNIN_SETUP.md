# Google Sign-In Setup Guide

This guide walks through setting up Google Sign-In for the Hallway Track application.

## Prerequisites

- Access to Google Cloud Console
- AWS account with Hallway Track deployed
- Access to modify `infrastructure/config.ts`

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application** as the application type
6. Configure the OAuth client:
   - **Name**: Hallway Track (or your preferred name)
   - **Authorized JavaScript origins**: Add your application URLs
     - Production: `https://your-domain.com`
     - CloudFront: `https://your-cloudfront-distribution.cloudfront.net`
     - Local dev: `http://localhost:5173`
   - **Authorized redirect URIs**: Add Cognito OAuth callback URL
     - Format: `https://hallway-track-<account-id>.auth.<region>.amazoncognito.com/oauth2/idpresponse`
     - Example: `https://hallway-track-831926593673.auth.us-west-2.amazoncognito.com/oauth2/idpresponse`
7. Click **Create**
8. Copy the **Client ID** and **Client Secret** (you'll need these for configuration)

## Step 2: Store Google Client Secret

Store the Google Client Secret in AWS Secrets Manager:

```bash
aws secretsmanager create-secret \
  --name "hallway-track/google-client-secret" \
  --secret-string "YOUR_GOOGLE_CLIENT_SECRET" \
  --region us-west-2
```

**Important**: Replace `YOUR_GOOGLE_CLIENT_SECRET` with your actual secret from Google Cloud Console.

## Step 3: Configure Application

### Update infrastructure/config.ts

Add Google OAuth configuration to your account's configuration:

```typescript
const accountConfigurations: AccountConfiguration = {
  "YOUR_ACCOUNT_ID": {
    badges: {
      // ... existing badge config
    },
    google: {
      clientId: 'YOUR_GOOGLE_CLIENT_ID',
      clientSecretParameterName: '/hallway-track/google-client-secret',
    },
    oauth: {
      callbackUrls: [
        'https://your-domain.com',
        'https://your-cloudfront-distribution.cloudfront.net',
        'http://localhost:5173', // For local development
      ],
      logoutUrls: [
        'https://your-domain.com',
        'https://your-cloudfront-distribution.cloudfront.net',
        'http://localhost:5173',
      ],
    },
  },
};
```

**Note**: The Client ID can be stored in the config file as it's not sensitive. The Client Secret is securely stored in Parameter Store.

## Step 4: Deploy Infrastructure

Deploy the stack:

```bash
# Deploy the stack
npm run cdk:deploy
```

After deployment, note the `CognitoDomain` output value.

## Step 5: Update Frontend Configuration

Add the Cognito domain to your frontend environment file:

```bash
# In frontend/.env.831926593673 (or your account ID)
VITE_COGNITO_DOMAIN=hallway-track-831926593673
```

**Note**: The domain value is just the prefix, not the full URL.

## Step 6: Build and Deploy Frontend

```bash
cd frontend
npm run build
# Frontend is automatically deployed via CDK
```

## Step 7: Verify Setup

1. Navigate to your application URL
2. You should see a "Sign in with Google" button on the login page
3. Click the button and complete Google authentication
4. Verify you're redirected back to the application
5. Check that your user profile was created in DynamoDB

## Account Linking

If you already have an account with email/password:

1. Sign out of the application
2. Click "Sign in with Google"
3. Use the same email address as your existing account
4. Cognito will automatically link the accounts
5. You can now sign in with either method

## Troubleshooting

### "Invalid redirect URI" error

- Verify the redirect URI in Google Cloud Console matches exactly:
  - `https://hallway-track-<account-id>.auth.<region>.amazoncognito.com/oauth2/idpresponse`
- Check that the Cognito domain was created successfully
- Ensure the region matches your deployment

### Google button doesn't appear

- Verify `VITE_COGNITO_DOMAIN` is set in frontend environment
- Check browser console for configuration errors
- Ensure the CDK stack deployed successfully with Google provider

### "User pool client does not support federated sign-in"

- Verify the User Pool Client has Google in `supportedIdentityProviders`
- Check that OAuth configuration is present in the client
- Redeploy the CDK stack

### Account linking not working

- Ensure the email address is verified in your existing account
- Check that the email from Google matches exactly
- Verify Cognito's account linking is enabled (it's automatic)

## Security Considerations

### Credential Management

- **Never commit** Google Client Secret to version control
- Client Secret is stored in AWS Systems Manager Parameter Store (SecureString)
- Parameter Store provides encryption at rest using AWS KMS
- Access to the parameter is controlled via IAM permissions
- Rotate credentials periodically by updating the parameter value
- Use different parameter names for different environments (e.g., `/hallway-track/dev/google-client-secret`)

### OAuth Configuration

- Only add trusted domains to callback URLs
- Use HTTPS in production (HTTP only for local dev)
- Keep the list of authorized origins minimal

### User Data

- Google Sign-In only requests necessary scopes (email, profile, openid)
- Profile data is mapped to existing Cognito attributes
- No additional data is stored beyond what's already collected

## Local Development

For local development with Google Sign-In:

1. Add `http://localhost:5173` to Google OAuth authorized origins
2. Add `http://localhost:5173` to callback/logout URLs in config
3. Set environment variables before running CDK deploy
4. Set `VITE_COGNITO_DOMAIN` in frontend/.env.local
5. Run `npm run frontend:dev`

## Disabling Google Sign-In

To disable Google Sign-In:

1. Remove the `google` and `oauth` configuration from `config.ts`
2. Redeploy the CDK stack
3. Users can still sign in with email/password
4. Linked accounts remain linked (can re-enable later)

## Managing the Parameter Store Secret

### View the parameter

```bash
aws ssm get-parameter \
  --name "/hallway-track/google-client-secret" \
  --with-decryption \
  --region us-west-2
```

### Update the parameter (rotate secret)

```bash
aws ssm put-parameter \
  --name "/hallway-track/google-client-secret" \
  --value "NEW_GOOGLE_CLIENT_SECRET" \
  --type "SecureString" \
  --overwrite \
  --region us-west-2
```

After updating, redeploy the CDK stack to pick up the new value.

### Delete the parameter

```bash
aws ssm delete-parameter \
  --name "/hallway-track/google-client-secret" \
  --region us-west-2
```

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [AWS Cognito Federated Identities](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation.html)
- [AWS Amplify Authentication](https://docs.amplify.aws/react/build-a-backend/auth/)
