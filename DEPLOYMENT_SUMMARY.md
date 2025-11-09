# Deployment Summary

## Deployment Date
November 9, 2025

## Infrastructure Deployed

### AWS Resources Created

#### Authentication (Amazon Cognito)
- **User Pool**: hallway-track-users
- **User Pool ID**: us-west-2_hYOYiSD5h
- **User Pool Client ID**: 3u3h1edvnc0baes8gb8bcptefr
- **Region**: us-west-2
- **Password Policy**: Min 8 chars, uppercase, lowercase, number required
- **Sign-in Method**: Email
- **Auto-verify**: Email enabled

#### API (AWS AppSync)
- **API Name**: hallway-track-api
- **API ID**: 6qiunaickneo7ommibfhkwdjse
- **GraphQL Endpoint**: https://3hyp5ylv7rfh5dgjylov7l5zj4.appsync-api.us-west-2.amazonaws.com/graphql
- **Authentication**: Cognito User Pool
- **Logging**: Error level enabled
- **X-Ray Tracing**: Enabled

#### Database (Amazon DynamoDB)
- **Users Table**: hallway-track-users
  - Partition Key: PK (String)
  - Sort Key: SK (String)
  - Billing Mode: On-demand

- **Connections Table**: hallway-track-connections
  - Partition Key: PK (String)
  - Sort Key: SK (String)
  - GSI: ByConnectedUser (GSI1PK, GSI1SK)
  - Billing Mode: On-demand

#### Lambda Functions
1. **ContactLinksFunction**
   - Runtime: Node.js 20.x
   - Purpose: Manage contact link operations
   - Permissions: Read/Write to Users table

2. **PublicProfileFunction**
   - Runtime: Node.js 20.x
   - Purpose: Retrieve public profile with visible contact links
   - Permissions: Read from Users table

3. **ConnectionsFunction**
   - Runtime: Node.js 20.x
   - Purpose: Manage connections, badges, and tags
   - Permissions: Read/Write to Users and Connections tables

4. **ResolverFunction**
   - Runtime: Node.js 20.x
   - Purpose: Placeholder for custom resolvers
   - Permissions: Read/Write to Users and Connections tables

#### GraphQL Resolvers
- **Direct DynamoDB Resolvers**:
  - createUser (Mutation)
  - updateDisplayName (Mutation)
  - getMyProfile (Query)
  - getUser (Query)
  - addContactLink (Mutation)

- **Lambda Resolvers**:
  - updateContactLink (Mutation)
  - removeContactLink (Mutation)
  - getPublicProfile (Query)
  - createConnection (Mutation)
  - checkConnection (Query)
  - getMyConnections (Query)
  - addTagToConnection (Mutation)
  - removeTagFromConnection (Mutation)

## Frontend Deployment

### Hosting Infrastructure
- **S3 Bucket**: hallway-track-frontend-831926593673
- **CloudFront Distribution ID**: EBUPTO8B7TUL3
- **Website URL**: https://d3ahxq34efx0ga.cloudfront.net
- **SSL/TLS**: Enabled (CloudFront default certificate)
- **Origin Access Control**: Modern OAC (not deprecated OAI)
- **Caching**: Optimized caching policy
- **Compression**: Gzip enabled
- **Error Handling**: SPA routing configured (404 → index.html)
- **File Management**: Old files not pruned (prevents breaking dynamic imports)

### Environment Variables
Created `frontend/.env` with:
- VITE_USER_POOL_ID=us-west-2_hYOYiSD5h
- VITE_USER_POOL_CLIENT_ID=3u3h1edvnc0baes8gb8bcptefr
- VITE_GRAPHQL_ENDPOINT=https://3hyp5ylv7rfh5dgjylov7l5zj4.appsync-api.us-west-2.amazonaws.com/graphql
- VITE_AWS_REGION=us-west-2

### Build Status
✅ Frontend built successfully
✅ Deployed to S3
✅ CloudFront distribution created
✅ Assets cached globally
- Output directory: `frontend/dist`
- Bundle size: ~847 KB (244 KB gzipped)
- Live at: https://d3ahxq34efx0ga.cloudfront.net

## Deployment Files Created

1. **amplify.yml** - Amplify Hosting build configuration
2. **DEPLOYMENT.md** - Comprehensive deployment guide
3. **scripts/deploy.sh** - Automated deployment script
4. **frontend/.env** - Frontend environment variables

## Deployment Complete

### Frontend is Live! 🎉

Your application is fully deployed and accessible at:
**https://d3ahxq34efx0ga.cloudfront.net**

### To Update Frontend:

```bash
# Make changes to frontend code, then:
./scripts/deploy.sh

# Or manually:
npm run frontend:build
npm run cdk:deploy
```

### To Invalidate CloudFront Cache:

```bash
aws cloudfront create-invalidation --distribution-id EBUPTO8B7TUL3 --paths '/*'
```

## Verification Checklist

✅ CDK stack deployed successfully
✅ Cognito User Pool created and configured
✅ AppSync GraphQL API created with schema
✅ DynamoDB tables created with correct keys
✅ Lambda functions deployed and configured
✅ All resolvers attached to GraphQL API
✅ S3 bucket created for frontend hosting
✅ CloudFront distribution created and configured
✅ Frontend built successfully
✅ Frontend deployed to S3
✅ CloudFront cache invalidated
✅ Application accessible via CloudFront URL
⏳ End-to-end testing (ready for testing)

## Cost Estimate

Based on AWS Free Tier and expected usage:

- **Cognito**: Free for first 50,000 MAUs
- **AppSync**: $4 per million query/mutation operations
- **DynamoDB**: On-demand pricing, ~$1.25 per million writes
- **Lambda**: Free tier covers 1M requests/month
- **Amplify Hosting**: Free tier covers 1,000 build minutes/month

**Estimated Monthly Cost**: $0-10 for development/testing

## Security Configuration

✅ All API calls require Cognito authentication
✅ Strong password policy enforced
✅ Email verification enabled
✅ Contact links default to hidden
✅ Owner-based access control for user data
✅ Public profiles only show visible information
✅ X-Ray tracing enabled for monitoring
✅ CloudFront Origin Access Control (OAC) secures S3 bucket

## Monitoring and Logging

- **CloudWatch Logs**: All Lambda functions log to CloudWatch
- **AppSync Logs**: Error-level logging enabled
- **X-Ray Tracing**: Enabled for API performance monitoring
- **CloudFormation**: Stack events tracked

## Rollback Procedure

If issues occur:

```bash
# Rollback infrastructure
cdk destroy HallwayTrackStack

# Or via CloudFormation Console
# Delete stack: HallwayTrackStack
```

## Support and Troubleshooting

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Detailed troubleshooting steps
- Common error resolutions
- Monitoring and logging access
- Cost optimization tips

## Stack ARN
arn:aws:cloudformation:us-west-2:831926593673:stack/HallwayTrackStack/65a0d150-bdaf-11f0-9c6e-06713110dddd
