# Hallway Track - Quick Start Guide

## ✅ Infrastructure Deployed

Your Hallway Track infrastructure is now live on AWS!

## 🚀 What's Been Deployed

- ✅ **Authentication**: Cognito User Pool for secure sign-up/sign-in
- ✅ **API**: AppSync GraphQL API with 13 resolvers
- ✅ **Database**: 2 DynamoDB tables (Users, Connections)
- ✅ **Functions**: 4 Lambda functions for business logic
- ✅ **Frontend**: Built and ready to deploy

## 📋 Your Deployment Details

```
Region:              us-west-2
User Pool ID:        us-west-2_hYOYiSD5h
User Pool Client:    3u3h1edvnc0baes8gb8bcptefr
GraphQL Endpoint:    https://3hyp5ylv7rfh5dgjylov7l5zj4.appsync-api.us-west-2.amazonaws.com/graphql
Website URL:         https://d3ahxq34efx0ga.cloudfront.net
CloudFront ID:       EBUPTO8B7TUL3
S3 Bucket:           hallway-track-frontend-831926593673
```

## 🎉 Frontend Already Deployed!

Your frontend is already live on CloudFront:

**🌐 Live URL**: https://d3ahxq34efx0ga.cloudfront.net

The deployment script automatically:
- Built the React application
- Uploaded assets to S3
- Configured CloudFront CDN
- Invalidated the cache

### Update Frontend

To deploy frontend changes:

```bash
# Make your changes, then:
./scripts/deploy.sh

# Or manually:
npm run frontend:build
npm run cdk:deploy
```

## 🧪 Test Your Deployment

Once frontend is deployed:

1. **Sign Up**
   - Navigate to your app URL
   - Click "Sign Up"
   - Enter email and password
   - Verify email

2. **Create Profile**
   - Sign in
   - Add display name
   - Add contact links (LinkedIn, email, etc.)
   - Toggle visibility

3. **Generate QR Code**
   - Go to "My QR Code"
   - Your unique QR code will display

4. **Test Connection**
   - Open app on another device/browser
   - Sign up with different account
   - Scan first user's QR code
   - Create connection
   - Check badges!

## 📊 Monitor Your Application

### CloudWatch Logs
```bash
# View Lambda logs
aws logs tail /aws/lambda/HallwayTrackStack-ConnectionsFunction --follow --region us-west-2

# View AppSync logs
aws logs tail /aws/appsync/apis/6qiunaickneo7ommibfhkwdjse --follow --region us-west-2
```

### Check Resources
```bash
# List DynamoDB tables
aws dynamodb list-tables --region us-west-2

# Check Cognito users
aws cognito-idp list-users --user-pool-id us-west-2_hYOYiSD5h --region us-west-2
```

## 🔧 Useful Commands

```bash
# Redeploy infrastructure
npm run cdk:deploy

# Rebuild frontend
npm run frontend:build

# View CloudFormation stack
aws cloudformation describe-stacks --stack-name HallwayTrackStack --region us-west-2

# Run deployment script
./scripts/deploy.sh
```

## 📚 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide
- **[DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)** - What was deployed
- **[README.md](README.md)** - Project overview

## 🆘 Troubleshooting

### Frontend won't build?
```bash
cd frontend
npm install
npm run build
```

### Can't authenticate?
- Verify User Pool ID and Client ID in frontend/.env
- Check Cognito User Pool exists in us-west-2
- Ensure email verification is enabled

### GraphQL errors?
- Check CloudWatch logs for Lambda functions
- Verify authentication token is being sent
- Review AppSync resolver logs

### Need to start over?
```bash
# Delete everything (WARNING: Deletes all data)
cdk destroy HallwayTrackStack
```

## 💰 Cost Estimate

With AWS Free Tier:
- **Development/Testing**: $0-5/month
- **Light Production**: $5-20/month
- **Heavy Usage**: $20-50/month

Most costs come from:
- DynamoDB on-demand requests
- AppSync query/mutation operations
- Lambda invocations

## 🎉 You're Ready!

Your backend is live and ready to handle:
- ✅ User authentication
- ✅ Profile management
- ✅ QR code generation
- ✅ Connection creation
- ✅ Badge awarding
- ✅ Tag management

Just deploy the frontend and you're good to go! 🚀
