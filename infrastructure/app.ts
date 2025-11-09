#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { HallwayTrackStack } from './stacks/hallway-track-stack';

const app = new cdk.App();

new HallwayTrackStack(app, 'HallwayTrackStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
