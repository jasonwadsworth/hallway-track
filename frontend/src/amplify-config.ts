import type { ResourcesConfig } from 'aws-amplify';

// These values are loaded from environment variables at build time
// Vite requires import.meta.env instead of process.env
const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
        ...(import.meta.env.VITE_COGNITO_DOMAIN && {
          oauth: {
            domain: import.meta.env.VITE_COGNITO_DOMAIN,
            scopes: ['email', 'openid', 'profile'],
            redirectSignIn: [window.location.origin],
            redirectSignOut: [window.location.origin],
            responseType: 'code',
            providers: ['Google'],
          },
        }),
      },
    },
  },
  API: {
    GraphQL: {
      endpoint: import.meta.env.VITE_GRAPHQL_ENDPOINT || 'https://XXXXXXXXXXXXXXXXXXXXXXXXXX.appsync-api.us-east-1.amazonaws.com/graphql',
      region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
      defaultAuthMode: 'userPool',
    },
  },
};

export default amplifyConfig;
