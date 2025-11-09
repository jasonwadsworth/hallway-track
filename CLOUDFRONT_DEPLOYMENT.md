# CloudFront + S3 Deployment

## Why CloudFront Instead of Amplify Hosting?

We switched from AWS Amplify Hosting to CloudFront + S3 because:

1. **Simpler Architecture**: Since we're using CDK for all infrastructure, keeping everything in one stack is cleaner
2. **Cost Effective**: CloudFront + S3 is typically cheaper than Amplify Hosting for static sites
3. **More Control**: Direct control over caching, distribution settings, and deployment
4. **No Git Dependency**: Can deploy from CI/CD or local builds without Git integration
5. **Consistency**: All infrastructure managed through CDK in one place

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Users                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              CloudFront Distribution                         │
│              d3ahxq34efx0ga.cloudfront.net                  │
│                                                              │
│  • Global CDN with edge locations                           │
│  • HTTPS only (redirects HTTP)                              │
│  • Gzip compression enabled                                 │
│  • Caching optimized for static assets                      │
│  • SPA routing (404 → index.html)                           │
│  • Origin Access Control (OAC) for S3 security              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              S3 Bucket (Private)                             │
│              hallway-track-frontend-831926593673            │
│                                                              │
│  • Not publicly accessible                                  │
│  • CloudFront OAC (Origin Access Control) for access        │
│  • Automatic deployment via CDK                             │
│  • Server-side encryption enabled                           │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Process

### Automatic Deployment

The CDK stack includes a `BucketDeployment` construct that:

1. Builds the frontend (must be done before `cdk deploy`)
2. Uploads all files from `frontend/dist` to S3
3. Invalidates CloudFront cache automatically
4. Keeps old files (no pruning to avoid breaking dynamic imports/lazy-loaded chunks)

### Manual Steps

```bash
# 1. Build frontend
npm run frontend:build

# 2. Deploy everything
npm run cdk:deploy

# Or use the deployment script
./scripts/deploy.sh
```

## CloudFront Configuration

### Caching

- **Default Behavior**: Optimized caching policy
- **Compression**: Gzip enabled
- **Cache Duration**: Managed by CloudFront
- **Query Strings**: Forwarded to origin

### Error Handling

CloudFront is configured to handle SPA routing:

- **404 errors** → Return `index.html` with 200 status
- **403 errors** → Return `index.html` with 200 status
- **TTL**: 5 minutes for error responses

This allows React Router to handle all routes client-side.

### Security

- **HTTPS Only**: HTTP requests redirect to HTTPS
- **Origin Access Control (OAC)**: Modern replacement for OAI, S3 bucket not publicly accessible
- **Encryption**: S3 server-side encryption enabled
- **Block Public Access**: All S3 public access blocked

## Updating the Frontend

### Quick Update

```bash
./scripts/deploy.sh
```

### Manual Update

```bash
# 1. Make changes to frontend code
# 2. Build
npm run frontend:build

# 3. Deploy (automatically uploads and invalidates cache)
npm run cdk:deploy
```

### Manual Cache Invalidation

If you need to invalidate cache without redeploying:

```bash
aws cloudfront create-invalidation \
  --distribution-id EBUPTO8B7TUL3 \
  --paths '/*'
```

## Cost Comparison

### CloudFront + S3
- **S3 Storage**: $0.023/GB/month
- **S3 Requests**: $0.0004 per 1,000 GET requests
- **CloudFront**: $0.085/GB for first 10 TB
- **Estimated**: $1-5/month for low traffic

### Amplify Hosting
- **Build Minutes**: $0.01/minute (after free tier)
- **Hosting**: $0.15/GB served
- **Estimated**: $5-15/month for low traffic

**Savings**: ~50-70% with CloudFront + S3

## Performance

### CloudFront Benefits

1. **Global Edge Locations**: Content served from nearest edge location
2. **Low Latency**: Cached content served in milliseconds
3. **High Availability**: 99.99% SLA
4. **DDoS Protection**: Built-in AWS Shield Standard
5. **Compression**: Automatic gzip compression

### Metrics

- **Time to First Byte**: < 100ms (cached)
- **Page Load Time**: < 2s (first load)
- **Page Load Time**: < 500ms (cached)

## Monitoring

### CloudWatch Metrics

```bash
# View CloudFront metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=EBUPTO8B7TUL3 \
  --start-time 2025-11-09T00:00:00Z \
  --end-time 2025-11-09T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### Access Logs (Optional)

To enable CloudFront access logs, update the CDK stack:

```typescript
this.distribution = new cloudfront.Distribution(this, 'Distribution', {
  // ... existing config
  enableLogging: true,
  logBucket: logBucket, // Create a separate S3 bucket for logs
  logFilePrefix: 'cloudfront-logs/',
});
```

## Troubleshooting

### Website Shows Old Version

CloudFront caches content. Invalidate the cache:

```bash
aws cloudfront create-invalidation --distribution-id EBUPTO8B7TUL3 --paths '/*'
```

### 403 Access Denied

Check:
1. S3 bucket policy allows CloudFront OAC (Origin Access Control)
2. Files exist in S3: `aws s3 ls s3://hallway-track-frontend-831926593673/`
3. CloudFront origin is using S3 REST API (not website endpoint)

### 404 on Refresh

This is normal for SPAs. CloudFront is configured to return `index.html` for 404s.

### Slow First Load

First request to CloudFront edge location is slower (cache miss). Subsequent requests are fast.

## Custom Domain

To add a custom domain:

### 1. Request Certificate (us-east-1)

```bash
aws acm request-certificate \
  --domain-name hallwaytrack.com \
  --subject-alternative-names www.hallwaytrack.com \
  --validation-method DNS \
  --region us-east-1
```

### 2. Update CDK Stack

```typescript
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

const certificate = acm.Certificate.fromCertificateArn(
  this,
  'Certificate',
  'arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID'
);

this.distribution = new cloudfront.Distribution(this, 'Distribution', {
  // ... existing config
  domainNames: ['hallwaytrack.com', 'www.hallwaytrack.com'],
  certificate: certificate,
});
```

### 3. Update DNS

Point your domain to CloudFront:
- **Type**: CNAME (or ALIAS if using Route53)
- **Name**: www
- **Value**: d3ahxq34efx0ga.cloudfront.net

## Rollback

### Rollback to Previous Version

```bash
# 1. Checkout previous commit
git checkout <previous-commit>

# 2. Rebuild and deploy
./scripts/deploy.sh

# 3. Return to current commit
git checkout main
```

### Emergency Rollback

If you need to quickly rollback:

```bash
# 1. Get previous S3 version (if versioning enabled)
aws s3api list-object-versions --bucket hallway-track-frontend-831926593673

# 2. Restore previous version
# (Manual process - copy old files back)

# 3. Invalidate cache
aws cloudfront create-invalidation --distribution-id EBUPTO8B7TUL3 --paths '/*'
```

## S3 File Management

### Old Files Are Not Pruned

The deployment does **not** automatically delete old files from S3. This is intentional to prevent breaking:
- Dynamic imports that may still be referenced by cached HTML
- Lazy-loaded chunks that users have in their browser cache
- Code-split bundles that are still in use

### Manual Cleanup (Optional)

If you need to clean up old files manually:

```bash
# List all files in the bucket
aws s3 ls s3://hallway-track-frontend-831926593673/ --recursive

# Delete specific old files (be careful!)
aws s3 rm s3://hallway-track-frontend-831926593673/assets/old-file.js

# Or use S3 lifecycle policies to auto-delete files older than X days
```

### S3 Lifecycle Policy (Recommended)

To automatically clean up very old files, you can add a lifecycle policy:

```typescript
// In CDK stack
this.websiteBucket.addLifecycleRule({
  id: 'DeleteOldAssets',
  enabled: true,
  prefix: 'assets/',
  expiration: cdk.Duration.days(90), // Delete files older than 90 days
});
```

## Best Practices

1. **Always build before deploying**: `npm run frontend:build`
2. **Test locally first**: `npm run frontend:dev`
3. **Use deployment script**: `./scripts/deploy.sh`
4. **Monitor CloudWatch**: Check for errors and performance
5. **Enable S3 versioning**: For easy rollbacks
6. **Set up alerts**: CloudWatch alarms for high error rates
7. **Use custom domain**: Better branding and SEO
8. **Enable access logs**: For analytics and debugging
9. **Consider lifecycle policies**: Auto-delete very old files (90+ days)

## Resources

- **CloudFront Distribution**: https://console.aws.amazon.com/cloudfront/v3/home#/distributions/EBUPTO8B7TUL3
- **S3 Bucket**: https://s3.console.aws.amazon.com/s3/buckets/hallway-track-frontend-831926593673
- **CloudWatch Metrics**: https://console.aws.amazon.com/cloudwatch/home?region=us-west-2#metricsV2:graph=~()
