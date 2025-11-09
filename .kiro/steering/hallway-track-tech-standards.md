# Hallway Track Technical Standards

## Technology Stack

### Frontend
- **Framework**: React with TypeScript
- **Hosting**: AWS CloudFront + S3
- **API**: GraphQL (AWS Amplify)

### Backend
- **Runtime**: Node.js
- **Architecture**: Serverless (AWS Lambda)
- **API**: AWS AppSync (GraphQL)

### Data & Storage
- **Database**: Amazon DynamoDB
- **Blob Storage**: Amazon S3 (as needed)
- **Authentication**: Amazon Cognito

### Infrastructure
- **IaC Tool**: AWS CDK
- **Language**: TypeScript

## Code Standards

### Simplicity First
- Keep code simple and straightforward
- Avoid abstractions unless they add real value
- Prefer explicit code over clever solutions
- Don't over-engineer for future requirements

### TypeScript Requirements
- All code MUST be written in TypeScript
- The use of `any` type MUST be avoided
- Explicit types MUST be defined for all function parameters and return values
- Types MUST be used for object shapes
- Type assertions SHOULD be avoided unless absolutely necessary

### Testing Approach
- Testing is minimal by default
- Tests SHOULD only be written for critical functionality that needs verification
- Focus on functional correctness over comprehensive test coverage

## AWS Architecture Principles

### Serverless-First
- All compute MUST use AWS Lambda
- No EC2 instances or containers
- Leverage managed services wherever possible

### GraphQL API Design
- Use AWS AppSync for GraphQL API
- Leverage Amplify's GraphQL transformer directives
- Design schema with DynamoDB access patterns in mind

### Authentication & Authorization
- Amazon Cognito MUST be used for user authentication
- User pools for email/password authentication
- Leverage Amplify Auth for frontend integration

### Data Modeling
- Use separate DynamoDB tables for different entities (Users, Connections, etc.)
- Consider access patterns before defining schema
- Use GSIs (Global Secondary Indexes) for alternate query patterns when needed

## Development Workflow

### Infrastructure as Code
- All AWS resources MUST be defined in CDK
- Use TypeScript for CDK code
- Separate stacks for different concerns (auth, API, storage, etc.)

### Frontend Deployment
- Use CloudFront for global content delivery
- S3 for static asset storage
- Leverage Amplify libraries for frontend AWS service integration (Auth, API)

## Security Considerations

### Data Privacy
- Collect minimal user data
- Users MUST have control over visibility of their information
- Email addresses MUST NOT be shared unless explicitly made visible by the user

### Authentication
- Enforce strong password requirements through Cognito
- Use Cognito's built-in security features (MFA optional for future)

## Performance Guidelines

### Frontend
- Optimize bundle size
- Lazy load components where appropriate
- Cache GraphQL queries appropriately

### Backend
- Keep Lambda functions focused and small
- Optimize DynamoDB queries to minimize RCUs/WCUs
- Use connection pooling for any external service calls

## Future Considerations

These features are planned for future iterations but NOT part of the initial MVP:
- Leaderboard functionality
- Chat/messaging between users
- Integration with re:Invent session catalog
- Mobile native apps (currently web-only)
- Team/group functionality
- Admin dashboard
