#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { HallwayTrackStack } from './stacks/hallway-track-stack';
import { CustomDomainStack } from './stacks/custom-domain-stack';
import { getConfigForAccount } from './config';

const app = new cdk.App();

// Get the current AWS account ID
const accountId = process.env.CDK_DEFAULT_ACCOUNT;

try {
  // Load account-specific configuration
  const config = getConfigForAccount(accountId!);

  // Deploy CustomDomainStack first if custom domain is configured
  // This stack is always deployed in us-east-1 for CloudFront compatibility
  if (config.customDomain?.domainName) {
    new CustomDomainStack(app, 'HallwayTrackCustomDomainStack', {
      domainConfig: config.customDomain,
      accountId: accountId!,
      targetRegion: process.env.CDK_DEFAULT_REGION || 'us-east-1',
    });
  }

  // Deploy main application stack
  new HallwayTrackStack(app, 'HallwayTrackStack', {
    env: {
      account: accountId,
      region: process.env.CDK_DEFAULT_REGION,
    },
    config,
  });
} catch (error) {
  console.error('❌ Configuration Error:');
  console.error(error instanceof Error ? error.message : String(error));
  console.error('\n💡 To fix this:');
  console.error('1. Ensure CDK_DEFAULT_ACCOUNT environment variable is set');
  console.error('2. Add your account configuration in infrastructure/config.ts');
  console.error('3. Run: export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)');
  process.exit(1);
}
