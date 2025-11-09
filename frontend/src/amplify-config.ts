import type { ResourcesConfig } from 'aws-amplify';

// These values will be replaced with actual values from CDK outputs after deployment
// For local development, you can manually update these values
const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.VITE_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
      userPoolClientId: process.env.VITE_USER_POOL_CLIENT_ID || 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
      },
    },
  },
};

export default amplifyConfig;
