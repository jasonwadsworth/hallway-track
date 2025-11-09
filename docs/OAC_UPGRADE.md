# Origin Access Control (OAC) Upgrade

## What Changed?

We upgraded from the deprecated **Origin Access Identity (OAI)** to the modern **Origin Access Control (OAC)** for securing S3 bucket access from CloudFront.

## Why?

### Origin Access Identity (OAI) - Deprecated
- Older method for CloudFront to access private S3 buckets
- Uses IAM user-based authentication
- Limited to S3 buckets in the same AWS account
- AWS recommends migrating to OAC

### Origin Access Control (OAC) - Modern
- Newer, more secure method
- Uses AWS Signature Version 4 (SigV4) for authentication
- Supports S3 buckets in different AWS accounts
- Better security and more features
- Recommended by AWS for all new deployments

## Benefits of OAC

1. **Enhanced Security**: Uses SigV4 authentication
2. **Cross-Account Support**: Can access S3 buckets in different accounts
3. **Better Logging**: Improved CloudWatch logging
4. **Future-Proof**: AWS's recommended approach
5. **SSE-KMS Support**: Works with S3 server-side encryption with KMS

## Code Changes

### Before (Deprecated OAI)
```typescript
// Create CloudFront Origin Access Identity
const originAccessIdentity = new cloudfront.OriginAccessIdentity(
  this,
  'OAI',
  {
    comment: 'OAI for Hallway Track website',
  }
);

// Grant CloudFront access to S3 bucket
this.websiteBucket.grantRead(originAccessIdentity);

// Create CloudFront distribution
this.distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: new origins.S3Origin(this.websiteBucket, {
      originAccessIdentity,
    }),
    // ... other config
  },
});
```

### After (Modern OAC)
```typescript
// Create CloudFront distribution with OAC
this.distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: origins.S3BucketOrigin.withOriginAccessControl(this.websiteBucket),
    // ... other config
  },
});
```

## What Happened During Deployment?

When we deployed the update:

1. **Created**: New `AWS::CloudFront::OriginAccessControl` resource
2. **Updated**: CloudFront distribution to use OAC
3. **Updated**: S3 bucket policy to allow OAC access
4. **Deleted**: Old deprecated `AWS::CloudFront::CloudFrontOriginAccessIdentity`

## Verification

The website continues to work perfectly with OAC:

```bash
curl -I https://d3ahxq34efx0ga.cloudfront.net
# HTTP/2 200 ✅
```

## S3 Bucket Policy

The bucket policy was automatically updated to allow OAC access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::hallway-track-frontend-831926593673/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT:distribution/EBUPTO8B7TUL3"
        }
      }
    }
  ]
}
```

## Key Differences

| Feature | OAI (Old) | OAC (New) |
|---------|-----------|-----------|
| Authentication | IAM User | SigV4 |
| Cross-Account | No | Yes |
| SSE-KMS | Limited | Full Support |
| Status | Deprecated | Recommended |
| CDK Construct | `S3Origin` | `S3BucketOrigin` |

## Migration Impact

✅ **Zero Downtime**: Migration completed without any service interruption
✅ **No Configuration Changes**: Website URL and behavior unchanged
✅ **Improved Security**: Now using modern authentication method
✅ **Future-Proof**: Using AWS's recommended approach

## Resources

- [AWS Documentation: Using OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [Migrating from OAI to OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html#migrate-from-oai-to-oac)
- [CDK S3BucketOrigin Documentation](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront_origins.S3BucketOrigin.html)
