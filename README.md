# Hallway Track

A gamified social networking web application for re:Invent attendees to connect through QR code scanning.

## Project Structure

```
hallway-track/
├── infrastructure/          # AWS CDK infrastructure code
│   ├── bin/
│   │   └── app.ts          # CDK app entry point
│   ├── lib/
│   │   ├── stacks/         # CDK stack definitions
│   │   └── constructs/     # Reusable CDK constructs
├── frontend/               # React frontend (Vite)
│   ├── src/
│   └── package.json
├── cdk.json               # CDK configuration
├── tsconfig.json          # TypeScript config for infrastructure
└── package.json           # Root package.json
```

## Technology Stack

### Frontend
- React with TypeScript
- Vite (build tool)
- AWS Amplify libraries (for AWS service integration)
- AWS Amplify UI React (authentication components)
- CloudFront + S3 (hosting)

### Backend
- AWS AppSync (GraphQL API)
- Amazon DynamoDB (database)
- Amazon Cognito (authentication)
- AWS Lambda (serverless functions)

### Infrastructure
- AWS CDK with TypeScript

## Prerequisites

- Node.js (v18 or later)
- AWS CLI configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

## Getting Started

### Install Dependencies

```bash
# Install root dependencies (CDK)
npm install

# Install frontend dependencies
npm run frontend:install
```

### CDK Commands

```bash
# Bootstrap CDK (first time only)
npm run cdk:bootstrap

# Synthesize CloudFormation templates
npm run cdk:synth

# View differences
npm run cdk:diff

# Deploy all stacks
npm run cdk:deploy
```

### Frontend Development

```bash
# Start development server
npm run frontend:dev

# Build for production
npm run frontend:build
```

## Development Workflow

1. Define infrastructure in `infrastructure/lib/stacks/`
2. Deploy infrastructure with `npm run cdk:deploy`
3. Configure Amplify in frontend with deployed resource outputs
4. Develop React components in `frontend/src/`
5. Test locally with `npm run frontend:dev`

## TypeScript Standards

- All code must be written in TypeScript
- Strict mode enabled
- No `any` types allowed
- Explicit types for all function parameters and return values

## Deployment

The application has been deployed to AWS. See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy

```bash
# Deploy infrastructure and build frontend
./scripts/deploy.sh
```

### Deployed Resources

- **Website URL**: https://d3ahxq34efx0ga.cloudfront.net
- **User Pool ID**: us-west-2_hYOYiSD5h
- **User Pool Client ID**: 3u3h1edvnc0baes8gb8bcptefr
- **GraphQL API**: https://3hyp5ylv7rfh5dgjylov7l5zj4.appsync-api.us-west-2.amazonaws.com/graphql
- **CloudFront Distribution**: EBUPTO8B7TUL3
- **S3 Bucket**: hallway-track-frontend-831926593673
- **Region**: us-west-2

### Update Deployment

To update the application after making changes:

```bash
./scripts/deploy.sh
```

This will rebuild the frontend and deploy all changes to AWS.

## Testing the Application

The application is live at: **https://d3ahxq34efx0ga.cloudfront.net**

To test:

1. Navigate to the URL above
2. Sign up with a new account
3. Create your profile with display name and contact links
4. View your QR code
5. Scan another user's QR code to create a connection
6. Earn badges as you make more connections

## Architecture

```
Users → CloudFront (CDN) → S3 (Static Assets)
                ↓
        Cognito (Auth) → AppSync (GraphQL) → Lambda Functions → DynamoDB
```
