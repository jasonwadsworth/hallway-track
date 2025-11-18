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

## Testing

The application has comprehensive test coverage:
- **69 automated tests** across 3 levels
- Unit tests for backend Lambda functions
- Integration tests for workflows
- E2E tests for user journeys

See [TESTING.md](TESTING.md) for detailed testing guide.

### Run Tests
```bash
# Backend tests
npm test

# Frontend E2E tests
cd frontend && npm run test:e2e
```

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

## Badge System Configuration

The application includes a special badge system with configurable parameters.

### Configuration File

Edit `infrastructure/config.ts` to configure badge settings:

```typescript
export const config: HallwayTrackConfig = {
  badges: {
    // Set this to your user ID to enable "Met the Maker" badge
    makerUserId: 'your-cognito-user-id-here',

    // Configure re:Invent dates for event badges
    reinventDates: [
      {
        year: 2024,
        start: '2024-12-02',
        end: '2024-12-06'
      },
      {
        year: 2025,
        start: '2025-12-01',
        end: '2025-12-05'
      }
    ]
  }
};
```

#### Finding Your User ID

To find your user ID for the maker badge:
1. Sign in to the application
2. Open browser DevTools → Console
3. Run: `localStorage.getItem('CognitoIdentityServiceProvider.3u3h1edvnc0baes8gb8bcptefr.LastAuthUser')`
4. Or query DynamoDB Users table for your email

### Deploying with Configuration

```bash
# Edit infrastructure/config.ts with your values
# Then deploy
npm run cdk:deploy
```

### Special Badge Types

1. **Met the Maker** - Awarded when connecting with the configured maker user
2. **Early Supporter** - Awarded to first 10 connections when someone reaches 500 connections
3. **VIP Connection** - Awarded for connecting with users who have 50+ connections
4. **Triangle Complete** - Awarded when creating a mutual connection triangle
5. **re:Invent Connector** - Awarded for connections made during configured event dates

### Running Badge Migration

After deploying the badge system, run the migration Lambda to award badges retroactively:

```bash
# Invoke the migration Lambda
aws lambda invoke \
  --function-name HallwayTrackStack-BadgeMigrationFunction-XXXXX \
  --region us-west-2 \
  response.json

# Check the response
cat response.json
```

Find the exact function name:
```bash
aws lambda list-functions --region us-west-2 | grep BadgeMigration
```

## Architecture

```
Users → CloudFront (CDN) → S3 (Static Assets)
                ↓
        Cognito (Auth) → AppSync (GraphQL) → Lambda Functions → DynamoDB
                                                      ↓
                                              EventBridge (Badge Events)
                                                      ↓
                                              Badge Handler Lambdas
```
