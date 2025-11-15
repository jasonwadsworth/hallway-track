# Custom Domain Deployment Guide

This guide explains how to deploy the Hallway Track application with custom domain support.

## Architecture Overview

The custom domain implementation uses a two-stack approach:

1. **CustomDomainStack**: Deployed in `us-east-1` (required for CloudFront)
   - Creates Route53 hosted zone
   - Creates ACM certificate with DNS validation
   - Stores configuration in Secrets Manager with replication to target region

2. **HallwayTrackStack**: Deployed in your target region
   - References domain resources from us-east-1
   - Configures CloudFront with custom domain
   - Creates DNS A records

## Prerequisites

1. **Domain ownership**: You must own the domain you want to use
2. **AWS CLI configured**: With appropriate permissions for both regions
3. **CDK environment**: Set up with account and region

## Deployment Steps

### 1. Configure Your Domain

Edit `infrastructure/config.ts` and add the custom domain configuration:

```typescript
"YOUR_ACCOUNT_ID": {
  badges: { /* existing config */ },
  customDomain: {
    domainName: 'your-domain.com'
  }
}
```

### 2. Deploy the Custom Domain Stack (us-east-1)

The CustomDomainStack is automatically deployed when you have a custom domain configured:

```bash
# Set your AWS account ID
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

# Deploy both stacks (CustomDomainStack will be deployed first in us-east-1)
npm run cdk:deploy
```

### 3. Update Domain Registrar

After the CustomDomainStack deploys successfully:

1. Note the **HostedZoneNameServers** from the CloudFormation outputs
2. Update your domain registrar's DNS settings to use these name servers
3. This step is **critical** - without proper DNS delegation, certificate validation will fail

### 4. Wait for Certificate Validation

- DNS validation typically takes 5-10 minutes after DNS delegation
- The main stack deployment will wait for certificate validation to complete
- Monitor the CloudFormation console for progress

### 5. Verify Deployment

Once both stacks deploy successfully:

1. Check the **CustomDomainURL** output from the main stack
2. Visit `https://your-domain.com` and `https://www.your-domain.com`
3. Both should serve your Hallway Track application

## Troubleshooting

### Certificate Validation Timeout

**Problem**: Certificate validation takes longer than expected

**Solutions**:
1. Verify DNS delegation is correct at your domain registrar
2. Check that name servers match the CloudFormation outputs
3. DNS propagation can take up to 48 hours globally

### Stack Deployment Fails

**Problem**: Main stack fails to deploy

**Solutions**:
1. Ensure CustomDomainStack deployed successfully first
2. Check that Secrets Manager secret exists in us-east-1
3. Verify cross-region permissions are correct

### Domain Not Accessible

**Problem**: Domain resolves but shows errors

**Solutions**:
1. Check CloudFront distribution status (can take 15-20 minutes to deploy)
2. Verify DNS A records were created correctly
3. Check certificate is properly attached to CloudFront distribution

## Cost Considerations

Custom domain support adds these AWS costs:

- **Route53 Hosted Zone**: $0.50/month per hosted zone
- **Secrets Manager**: $0.40/month per secret (primary) + $0.40/month per replica + $0.05 per 10,000 API calls
- **ACM Certificate**: Free for CloudFront usage
- **DNS Queries**: $0.40 per million queries (first 1 billion queries/month)

Total additional cost: ~$1.30/month for typical usage (includes secret replication).

## Removing Custom Domain

To remove custom domain support:

1. Remove the `customDomain` configuration from `config.ts`
2. Deploy the stack: `npm run cdk:deploy`
3. Manually delete the CustomDomainStack: `cdk destroy HallwayTrackCustomDomainStack`

**Note**: Route53 hosted zones and Secrets Manager secrets have retention policies and may need manual cleanup.

## Security Notes

- Certificate is automatically renewed by ACM
- DNS validation ensures domain ownership
- Secrets Manager provides secure cross-region configuration sharing
- All traffic is automatically redirected to HTTPS