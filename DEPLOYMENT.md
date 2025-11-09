# Hallway Track Deployment Guide

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Node.js 20.x or later

## Deployment Steps

### Quick Deploy (Recommended)

The easiest way to deploy everything:

```bash
./scripts/deploy.sh
```

This script will:
1. Build the frontend with current environment variables
2. Deploy all AWS infrastructure (Cognito, AppSync, DynamoDB, Lambda, S3, CloudFront)
3. Upload frontend assets to S3
4. Invalidate CloudFront cache
5. Output your live application URL

### Manual Deployment

If you prefer to deploy step-by-step:

#### 1. Build Frontend

```bash
npm run frontend:build
```

#### 2. Deploy Infrastructure

```bash
npm run cdk:deploy
```

This deploys:
- **Cognito User Pool**: Authentication
- **AppSync GraphQL API**: Backend API
- **DynamoDB Tables**: Users and Connections
- **Lambda Functions**: Business logic
- **S3 Bucket**: Frontend assets
- **CloudFront Distribution**: Global CDN

#### 3. Get Deployment Outputs

```bash
aws cloudformation describe-stacks --stack-name HallwayTrackStack --region us-west-2 --query "Stacks[0].Outputs"
```

## Current Deployment

Your application is currently deployed with these resources:

```
Region:              us-west-2
User Pool ID:        us-west-2_hYOYiSD5h
User Pool Client:    3u3h1edvnc0baes8gb8bcptefr
GraphQL Endpoint:    https://3hyp5ylv7rfh5dgjylov7l5zj4.appsync-api.us-west-2.amazonaws.com/graphql
Website URL:         https://d3ahxq34efx0ga.cloudfront.net
Distribution ID:     EBUPTO8B7TUL3
S3 Bucket:           hallway-track-frontend-831926593673
```

## Updating the Frontend

After making changes to the frontend:

```bash
# Build the frontend
npm run frontend:build

# Deploy (will automatically upload to S3 and invalidate CloudFront)
npm run cdk:deploy

# Or manually invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id EBUPTO8B7TUL3 --paths '/*'
```

## Architecture

```
┌─────────────┐
│   Users     │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  CloudFront (CDN)   │
│  d3ahxq34efx0ga     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   S3 Bucket         │
│   (Static Assets)   │
└─────────────────────┘

       │
       ▼ (API Calls)
┌─────────────────────┐
│  Cognito User Pool  │
│  (Authentication)   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  AppSync GraphQL    │
│  (API Gateway)      │
└──────┬──────────────┘
       │
       ├──▶ Lambda Functions
       │    (Business Logic)
       │
       ▼
┌─────────────────────┐
│  DynamoDB Tables    │
│  (Data Storage)     │
└─────────────────────┘
```

## Verify Deployment

### 1. Test Website Access

```bash
curl -I https://d3ahxq34efx0ga.cloudfront.net
```

Should return `200 OK`

### 2. Test Authentication

1. Navigate to https://d3ahxq34efx0ga.cloudfront.net
2. Click "Sign Up"
3. Enter email and password
4. Verify email
5. Sign in

### 3. Test Profile Creation

1. After signing in, create your profile
2. Add a display name
3. Add contact links
4. Toggle visibility

### 4. Test QR Code

1. Navigate to "My QR Code"
2. Verify QR code displays
3. Scan with mobile device

### 5. Test Connection Creation

1. Create a second test account
2. Scan first user's QR code
3. Verify connection is created
4. Check badges are awarded

## Monitoring and Logs

### CloudWatch Logs

```bash
# Lambda function logs
aws logs tail /aws/lambda/HallwayTrackStack-ConnectionsFunction --follow

# AppSync logs
aws logs tail /aws/appsync/apis/6qiunaickneo7ommibfhkwdjse --follow
```

### CloudFront Metrics

```bash
# View CloudFront metrics
aws cloudfront get-distribution --id EBUPTO8B7TUL3
```

### DynamoDB Metrics

```bash
# Check table metrics
aws dynamodb describe-table --table-name hallway-track-users
aws dynamodb describe-table --table-name hallway-track-connections
```

## Troubleshooting

### Frontend Shows Old Version

CloudFront caches content. Invalidate the cache:

```bash
aws cloudfront create-invalidation --distribution-id EBUPTO8B7TUL3 --paths '/*'
```

### Authentication Errors

- Verify User Pool ID and Client ID in frontend/.env
- Check Cognito User Pool exists: `aws cognito-idp describe-user-pool --user-pool-id us-west-2_hYOYiSD5h`
- Ensure email verification is enabled

### GraphQL API Errors

- Check Lambda function logs in CloudWatch
- Verify authentication token is being sent
- Review AppSync resolver logs

### 404 Errors on Refresh

This is normal for SPAs. CloudFront is configured to return index.html for 404s to support client-side routing.

### Build Fails

```bash
# Clean and rebuild
rm -rf frontend/dist frontend/node_modules
cd frontend && npm install
npm run build
```

## Custom Domain (Optional)

To add a custom domain:

### 1. Request SSL Certificate

```bash
# Must be in us-east-1 for CloudFront
aws acm request-certificate \
  --domain-name hallwaytrack.com \
  --validation-method DNS \
  --region us-east-1
```

### 2. Update CDK Stack

Add to `hallway-track-stack.ts`:

```typescript
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';

// Reference existing certificate
const certificate = acm.Certificate.fromCertificateArn(
  this,
  'Certificate',
  'arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID'
);

// Update distribution
this.distribution = new cloudfront.Distribution(this, 'Distribution', {
  // ... existing config
  domainNames: ['hallwaytrack.com', 'www.hallwaytrack.com'],
  certificate: certificate,
});

// Add Route53 records (if using Route53)
const zone = route53.HostedZone.fromLookup(this, 'Zone', {
  domainName: 'hallwaytrack.com',
});

new route53.ARecord(this, 'AliasRecord', {
  zone,
  target: route53.RecordTarget.fromAlias(
    new targets.CloudFrontTarget(this.distribution)
  ),
});
```

### 3. Deploy

```bash
npm run cdk:deploy
```

## Rollback

### Rollback Infrastructure

```bash
# WARNING: This will delete all data
cdk destroy HallwayTrackStack
```

### Rollback Frontend Only

```bash
# Get previous version from S3
aws s3 ls s3://hallway-track-frontend-831926593673/ --recursive

# Or redeploy from a previous commit
git checkout <previous-commit>
./scripts/deploy.sh
```

## Cost Optimization

### Current Costs (Estimated)

- **CloudFront**: ~$0.085 per GB (first 10 TB)
- **S3**: ~$0.023 per GB storage + $0.0004 per 1,000 GET requests
- **DynamoDB**: On-demand pricing, ~$1.25 per million writes
- **Lambda**: Free tier covers 1M requests/month
- **Cognito**: Free for first 50,000 MAUs
- **AppSync**: $4 per million operations

**Estimated Monthly Cost**:
- Development/Testing: $0-5
- Light Production (< 1,000 users): $5-20
- Heavy Usage (> 10,000 users): $50-200

### Cost Reduction Tips

1. **Enable CloudFront caching**: Already configured
2. **Use DynamoDB on-demand**: Already configured
3. **Optimize Lambda memory**: Adjust based on CloudWatch metrics
4. **Enable S3 lifecycle policies**: Archive old logs
5. **Use CloudFront price class**: Currently set to US/Canada/Europe only

## Security Considerations

### Current Security Features

✅ CloudFront HTTPS only (HTTP redirects to HTTPS)
✅ S3 bucket not publicly accessible (CloudFront OAI only)
✅ Strong password policy in Cognito
✅ Email verification required
✅ All API calls require authentication
✅ Contact links default to hidden
✅ Owner-based access control

### Additional Security Recommendations

1. **Enable WAF**: Add AWS WAF to CloudFront for DDoS protection
2. **Enable CloudTrail**: Audit all API calls
3. **Enable GuardDuty**: Threat detection
4. **Rotate credentials**: Regularly rotate API keys
5. **Enable MFA**: Add MFA support to Cognito

## Performance Optimization

### Current Optimizations

✅ CloudFront global CDN
✅ Gzip compression enabled
✅ Browser caching configured
✅ DynamoDB on-demand scaling
✅ Lambda concurrent execution

### Additional Optimizations

1. **Enable CloudFront compression**: Already enabled
2. **Optimize images**: Use WebP format
3. **Code splitting**: Lazy load React components
4. **Enable HTTP/2**: Already enabled by CloudFront
5. **Use CloudFront Functions**: Add custom headers

## Backup and Disaster Recovery

### DynamoDB Backups

```bash
# Enable point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name hallway-track-users \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

aws dynamodb update-continuous-backups \
  --table-name hallway-track-connections \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

### S3 Versioning

```bash
# Enable versioning on website bucket
aws s3api put-bucket-versioning \
  --bucket hallway-track-frontend-831926593673 \
  --versioning-configuration Status=Enabled
```

## Support

For issues or questions:
- Check CloudWatch logs
- Review [QUICKSTART.md](QUICKSTART.md)
- Review [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)
