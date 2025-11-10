import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import { Construct } from 'constructs';

export class HallwayTrackStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly usersTable: dynamodb.Table;
  public readonly connectionsTable: dynamodb.Table;
  public readonly api: appsync.GraphqlApi;
  public readonly websiteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ===== Authentication =====

    // Create DynamoDB table first (needed for post-confirmation Lambda)
    // Note: Moving table creation before User Pool so Lambda can reference it

    // Create Users DynamoDB Table
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'hallway-track-users',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create post-confirmation Lambda function
    const postConfirmationFunction = new NodejsFunction(
      this,
      'PostConfirmationFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/post-confirmation/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          TABLE_NAME: this.usersTable.tableName,
        },
      }
    );

    this.usersTable.grantWriteData(postConfirmationFunction);

    // Create Cognito User Pool with post-confirmation trigger
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'hallway-track-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lambdaTriggers: {
        postConfirmation: postConfirmationFunction,
      },
    });

    // Create User Pool Client for web app
    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'hallway-track-web-client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
    });

    // ===== DynamoDB Tables =====

    // Users table already created above (before User Pool)

    // Create Connections DynamoDB Table
    this.connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: 'hallway-track-connections',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add GSI for querying connections by connectedUserId
    this.connectionsTable.addGlobalSecondaryIndex({
      indexName: 'ByConnectedUser',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // ===== AppSync GraphQL API =====

    // Create AppSync GraphQL API
    this.api = new appsync.GraphqlApi(this, 'Api', {
      name: 'hallway-track-api',
      definition: appsync.Definition.fromFile(
        path.join(__dirname, '../schema.graphql')
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: this.userPool,
          },
        },
      },
      xrayEnabled: true,
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ERROR,
      },
    });

    // Create DynamoDB data sources
    const usersDataSource = this.api.addDynamoDbDataSource(
      'UsersDataSource',
      this.usersTable
    );

    const connectionsDataSource = this.api.addDynamoDbDataSource(
      'ConnectionsDataSource',
      this.connectionsTable
    );

    // Create Lambda function for contact link management
    const contactLinksFunction = new NodejsFunction(
      this,
      'ContactLinksFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/contact-links/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          USERS_TABLE_NAME: this.usersTable.tableName,
        },
      }
    );

    this.usersTable.grantReadWriteData(contactLinksFunction);

    const contactLinksDataSource = this.api.addLambdaDataSource(
      'ContactLinksDataSource',
      contactLinksFunction
    );

    // Create Lambda function for public profile
    const publicProfileFunction = new NodejsFunction(
      this,
      'PublicProfileFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/public-profile/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          USERS_TABLE_NAME: this.usersTable.tableName,
        },
      }
    );

    this.usersTable.grantReadData(publicProfileFunction);

    const publicProfileDataSource = this.api.addLambdaDataSource(
      'PublicProfileDataSource',
      publicProfileFunction
    );

    // Create Lambda function for connections management
    const connectionsFunction = new NodejsFunction(
      this,
      'ConnectionsFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/connections/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          USERS_TABLE_NAME: this.usersTable.tableName,
          CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
        },
      }
    );

    this.usersTable.grantReadWriteData(connectionsFunction);
    this.connectionsTable.grantReadWriteData(connectionsFunction);

    const connectionsDataSourceLambda = this.api.addLambdaDataSource(
      'ConnectionsDataSourceLambda',
      connectionsFunction
    );

    // Create Lambda data source for custom resolvers
    const resolverFunction = new lambda.Function(this, 'ResolverFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Placeholder resolver' }),
          };
        };
      `),
      environment: {
        USERS_TABLE_NAME: this.usersTable.tableName,
        CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
      },
    });

    // Grant Lambda permissions to access DynamoDB tables
    this.usersTable.grantReadWriteData(resolverFunction);
    this.connectionsTable.grantReadWriteData(resolverFunction);

    const lambdaDataSource = this.api.addLambdaDataSource(
      'LambdaDataSource',
      resolverFunction
    );

    // ===== AppSync Resolvers =====

    // Profile operation resolvers (direct DynamoDB)
    usersDataSource.createResolver('CreateUserResolver', {
      typeName: 'Mutation',
      fieldName: 'createUser',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/Mutation.createUser.request.vtl')
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/Mutation.createUser.response.vtl')
      ),
    });

    usersDataSource.createResolver('UpdateDisplayNameResolver', {
      typeName: 'Mutation',
      fieldName: 'updateDisplayName',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/Mutation.updateDisplayName.request.vtl')
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/Mutation.updateDisplayName.response.vtl')
      ),
    });

    usersDataSource.createResolver('GetMyProfileResolver', {
      typeName: 'Query',
      fieldName: 'getMyProfile',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/Query.getMyProfile.request.vtl')
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/Query.getMyProfile.response.vtl')
      ),
    });

    usersDataSource.createResolver('GetUserResolver', {
      typeName: 'Query',
      fieldName: 'getUser',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/Query.getUser.request.vtl')
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/Query.getUser.response.vtl')
      ),
    });

    // Contact link management resolvers
    usersDataSource.createResolver('AddContactLinkResolver', {
      typeName: 'Mutation',
      fieldName: 'addContactLink',
      requestMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/Mutation.addContactLink.request.vtl')
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromFile(
        path.join(__dirname, '../resolvers/Mutation.addContactLink.response.vtl')
      ),
    });

    contactLinksDataSource.createResolver('UpdateContactLinkResolver', {
      typeName: 'Mutation',
      fieldName: 'updateContactLink',
    });

    contactLinksDataSource.createResolver('RemoveContactLinkResolver', {
      typeName: 'Mutation',
      fieldName: 'removeContactLink',
    });

    // Public profile resolver
    publicProfileDataSource.createResolver('GetPublicProfileResolver', {
      typeName: 'Query',
      fieldName: 'getPublicProfile',
    });

    // Connection management resolvers
    connectionsDataSourceLambda.createResolver('CreateConnectionResolver', {
      typeName: 'Mutation',
      fieldName: 'createConnection',
    });

    connectionsDataSourceLambda.createResolver('CheckConnectionResolver', {
      typeName: 'Query',
      fieldName: 'checkConnection',
    });

    connectionsDataSourceLambda.createResolver('GetMyConnectionsResolver', {
      typeName: 'Query',
      fieldName: 'getMyConnections',
    });

    connectionsDataSourceLambda.createResolver('AddTagToConnectionResolver', {
      typeName: 'Mutation',
      fieldName: 'addTagToConnection',
    });

    connectionsDataSourceLambda.createResolver('RemoveTagFromConnectionResolver', {
      typeName: 'Mutation',
      fieldName: 'removeTagFromConnection',
    });

    // ===== CloudFormation Outputs =====

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'Users DynamoDB Table Name',
    });

    new cdk.CfnOutput(this, 'ConnectionsTableName', {
      value: this.connectionsTable.tableName,
      description: 'Connections DynamoDB Table Name',
    });

    new cdk.CfnOutput(this, 'GraphQLApiUrl', {
      value: this.api.graphqlUrl,
      description: 'AppSync GraphQL API URL',
    });

    new cdk.CfnOutput(this, 'GraphQLApiId', {
      value: this.api.apiId,
      description: 'AppSync GraphQL API ID',
    });

    // ===== Frontend Hosting (S3 + CloudFront) =====

    // Create S3 bucket for website hosting
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `hallway-track-frontend-${this.account}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Create CloudFront distribution with S3BucketOrigin (replaces deprecated S3Origin)
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.websiteBucket),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US, Canada, Europe
      enableLogging: false,
      comment: 'Hallway Track Frontend Distribution',
    });

    // Create Lambda function for link types
    const linkTypesFunction = new NodejsFunction(
      this,
      'LinkTypesFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/link-types/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
      }
    );

    const linkTypesDataSource = this.api.addLambdaDataSource(
      'LinkTypesDataSource',
      linkTypesFunction
    );

    // Link types resolver
    linkTypesDataSource.createResolver('GetLinkTypesResolver', {
      typeName: 'Query',
      fieldName: 'getLinkTypes',
    });

    // Deploy website assets to S3 (if dist folder exists)
    const frontendDistPath = path.join(__dirname, '../../frontend/dist');
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(frontendDistPath)],
      destinationBucket: this.websiteBucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      // Note: prune is false to avoid breaking dynamic imports/lazy-loaded chunks
      // that may still be referenced by cached HTML files
    });

    // Output CloudFront URL
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'S3 Bucket Name for Website',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });
  }
}
