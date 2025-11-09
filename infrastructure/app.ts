#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from './stacks/auth-stack';

const app = new cdk.App();

// Create AuthStack
const authStack = new AuthStack(app, 'HallwayTrackAuthStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});

// Future stacks will be added here
// Example:
// import { ApiStack } from './stacks/api-stack';
//
// const apiStack = new ApiStack(app, 'HallwayTrackApiStack', {
//   env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
//   userPool: authStack.userPool,
// });
