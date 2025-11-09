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
- AWS Amplify (for AWS service integration)
- AWS Amplify UI React (authentication components)

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

## Next Steps

1. Implement authentication infrastructure (Cognito User Pool)
2. Set up DynamoDB tables and GraphQL schema
3. Create React components for user flows
4. Deploy to AWS
