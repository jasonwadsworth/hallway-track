# HallwayTrak Frontend

React + TypeScript + Vite application for the HallwayTrak networking app.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure authentication:
   - Copy `.env.example` to `.env`
   - Deploy the CDK AuthStack: `cd .. && npm run cdk:deploy HallwayTrackAuthStack`
   - Copy the User Pool ID and Client ID from the CDK outputs
   - Update the `.env` file with these values

3. Run the development server:
```bash
npm run dev
```

## Authentication

The app uses AWS Amplify UI components for authentication. The Authenticator component provides:
- Sign up with email and password
- Sign in with email and password
- Password reset functionality
- Email verification

The authentication is configured to use the Cognito User Pool created by the CDK AuthStack.

## Environment Variables

The app uses account-specific environment configurations. See [README-environments.md](./README-environments.md) for detailed information about:

- Account-specific environment files (`.env.[account-id]`)
- Build commands for different AWS accounts
- Deployment integration with CDK

### Required Variables

- `VITE_USER_POOL_ID`: Cognito User Pool ID (from CDK output)
- `VITE_USER_POOL_CLIENT_ID`: Cognito User Pool Client ID (from CDK output)
- `VITE_GRAPHQL_ENDPOINT`: AppSync GraphQL API URL (from CDK output)
- `VITE_AWS_REGION`: AWS region (typically us-west-2)

## Building for Production

Build for a specific AWS account:

```bash
npm run build:account [account-id]
```

Example:
```bash
npm run build:account 831926593673
```

This creates account-specific build artifacts in `dist/[account-id]/` that the CDK deployment will use.
