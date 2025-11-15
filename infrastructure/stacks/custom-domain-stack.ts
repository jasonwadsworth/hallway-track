import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { CustomDomainConfig } from '../config';

export interface CustomDomainStackProps extends cdk.StackProps {
  domainConfig: CustomDomainConfig;
  accountId: string;
  targetRegion: string;
}

/**
 * Stack for custom domain resources that must be created in us-east-1
 * This includes Route53 hosted zone and ACM certificate for CloudFront
 */
export class CustomDomainStack extends cdk.Stack {
  public readonly hostedZone: route53.HostedZone;
  public readonly certificate: acm.Certificate;
  public readonly domainSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: CustomDomainStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.accountId,
        region: 'us-east-1', // Force deployment to us-east-1
      },
    });

    const { domainConfig } = props;

    if (!domainConfig.domainName) {
      throw new Error('Domain name is required for CustomDomainStack');
    }

    const domainName = domainConfig.domainName;

    // Create Route53 hosted zone
    this.hostedZone = new route53.HostedZone(this, 'HostedZone', {
      zoneName: domainName,
      comment: `Hosted zone for Hallway Track custom domain: ${domainName}`,
    });

    // Create ACM certificate in us-east-1 for CloudFront
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: domainName,
      subjectAlternativeNames: [`www.${domainName}`],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    // Store domain information in Secrets Manager for cross-region access
    this.domainSecret = new secretsmanager.Secret(this, 'DomainSecret', {
      secretName: `hallway-track-domain-${props.accountId}`,
      description: `Custom domain configuration for Hallway Track account ${props.accountId}`,
      secretObjectValue: {
        domainName: cdk.SecretValue.unsafePlainText(domainName),
        certificateArn: cdk.SecretValue.unsafePlainText(this.certificate.certificateArn),
        hostedZoneId: cdk.SecretValue.unsafePlainText(this.hostedZone.hostedZoneId),
        nameServers: cdk.SecretValue.unsafePlainText(
          cdk.Fn.join(',', this.hostedZone.hostedZoneNameServers || [])
        ),
      },
      // Replicate to the target region where the main stack will be deployed
      replicaRegions: props.targetRegion !== 'us-east-1' ? [
        {
          region: props.targetRegion,
          encryptionKey: undefined, // Use default KMS key
        },
      ] : [],
    });

    // CloudFormation outputs
    new cdk.CfnOutput(this, 'DomainName', {
      value: domainName,
      description: 'Custom domain name',
    });

    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'Route53 Hosted Zone ID',
    });

    new cdk.CfnOutput(this, 'HostedZoneNameServers', {
      value: cdk.Fn.join(', ', this.hostedZone.hostedZoneNameServers || []),
      description: 'Route53 Hosted Zone Name Servers (for domain delegation)',
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: 'ACM Certificate ARN (us-east-1)',
    });

    new cdk.CfnOutput(this, 'DomainSecretArn', {
      value: this.domainSecret.secretArn,
      description: 'Secrets Manager secret ARN for cross-region access',
    });
  }


}