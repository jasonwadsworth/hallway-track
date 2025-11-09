# Hallway Track Frontend

React + TypeScript + Vite application for the Hallway Track networking app.

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

- `VITE_USER_POOL_ID`: Cognito User Pool ID (from CDK output)
- `VITE_USER_POOL_CLIENT_ID`: Cognito User Pool Client ID (from CDK output)
