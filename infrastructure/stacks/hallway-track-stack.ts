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
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';
import { HallwayTrackConfig } from '../config';

export interface HallwayTrackStackProps extends cdk.StackProps {
  config: HallwayTrackConfig;
}

export class HallwayTrackStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly usersTable: dynamodb.Table;
  public readonly connectionsTable: dynamodb.Table;
  public readonly connectionRequestsTable: dynamodb.Table;
  public readonly api: appsync.GraphqlApi;
  public readonly websiteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly badgeEventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: HallwayTrackStackProps) {
    super(scope, id, props);

    const { config } = props;

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
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
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
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
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

    // Create Connection Requests DynamoDB Table
    this.connectionRequestsTable = new dynamodb.Table(this, 'ConnectionRequestsTable', {
      tableName: 'hallway-track-connection-requests',
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

    // Add GSI for querying outgoing requests by initiator
    this.connectionRequestsTable.addGlobalSecondaryIndex({
      indexName: 'ByInitiator',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // ===== EventBridge for Badge System =====

    // Create EventBridge event bus for badge events
    this.badgeEventBus = new events.EventBus(this, 'BadgeEventBus', {
      eventBusName: 'hallway-track-badges',
    });

    // Create CloudWatch log group for event bus
    new logs.LogGroup(this, 'BadgeEventBusLogGroup', {
      logGroupName: '/aws/events/hallway-track-badges',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
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

    this.api.addDynamoDbDataSource(
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

    // Create Lambda function for connected profile
    const connectedProfileFunction = new NodejsFunction(
      this,
      'ConnectedProfileFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/connected-profile/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          USERS_TABLE_NAME: this.usersTable.tableName,
          CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
        },
      }
    );

    this.usersTable.grantReadData(connectedProfileFunction);
    this.connectionsTable.grantReadData(connectedProfileFunction);

    // Grant CloudWatch permissions for privacy metrics
    connectedProfileFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'HallwayTrack/Privacy'
          }
        }
      })
    );

    const connectedProfileDataSource = this.api.addLambdaDataSource(
      'ConnectedProfileDataSource',
      connectedProfileFunction
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
          CONNECTION_REQUESTS_TABLE_NAME: this.connectionRequestsTable.tableName,
          MAKER_USER_ID: config.badges.makerUserId || '',
        },
      }
    );

    this.usersTable.grantReadWriteData(connectionsFunction);
    this.connectionsTable.grantReadWriteData(connectionsFunction);
    this.connectionRequestsTable.grantReadWriteData(connectionsFunction);

    const connectionsDataSourceLambda = this.api.addLambdaDataSource(
      'ConnectionsDataSourceLambda',
      connectionsFunction
    );

    // Create Lambda function for connection requests management
    const connectionRequestsFunction = new NodejsFunction(
      this,
      'ConnectionRequestsFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/connection-requests/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          USERS_TABLE_NAME: this.usersTable.tableName,
          CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
          CONNECTION_REQUESTS_TABLE_NAME: this.connectionRequestsTable.tableName,
        },
      }
    );

    this.usersTable.grantReadWriteData(connectionRequestsFunction);
    this.connectionsTable.grantReadWriteData(connectionRequestsFunction);
    this.connectionRequestsTable.grantReadWriteData(connectionRequestsFunction);

    const connectionRequestsDataSource = this.api.addLambdaDataSource(
      'ConnectionRequestsDataSource',
      connectionRequestsFunction
    );

    // ===== Badge Stream Processor =====

    // Create Lambda function for processing DynamoDB streams
    const badgeStreamProcessor = new NodejsFunction(
      this,
      'BadgeStreamProcessor',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/badge-stream-processor/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          EVENT_BUS_NAME: this.badgeEventBus.eventBusName,
        },
      }
    );

    // Grant permissions to publish events to EventBridge
    this.badgeEventBus.grantPutEventsTo(badgeStreamProcessor);

    // Connect Lambda to DynamoDB streams
    badgeStreamProcessor.addEventSource(
      new lambdaEventSources.DynamoEventSource(this.usersTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 3,
      })
    );

    badgeStreamProcessor.addEventSource(
      new lambdaEventSources.DynamoEventSource(this.connectionsTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 3,
      })
    );

    // ===== Badge Handler Lambdas =====

    // Create DLQ for failed badge events
    const badgeDLQ = new sqs.Queue(this, 'BadgeDLQ', {
      queueName: 'hallway-track-badge-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    // Maker Badge Handler
    const makerBadgeHandler = new NodejsFunction(
      this,
      'MakerBadgeHandler',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/badge-handlers/maker-badge/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          USERS_TABLE_NAME: this.usersTable.tableName,
          MAKER_USER_ID: config.badges.makerUserId || '',
        },
      }
    );

    this.usersTable.grantReadWriteData(makerBadgeHandler);

    // Create EventBridge rule for maker badge
    new events.Rule(this, 'MakerBadgeRule', {
      eventBus: this.badgeEventBus,
      eventPattern: {
        source: ['hallway-track.connections'],
        detailType: ['ConnectionCreated'],
      },
      targets: [
        new targets.LambdaFunction(makerBadgeHandler, {
          deadLetterQueue: badgeDLQ,
          retryAttempts: 2,
        }),
      ],
    });

    // VIP Badge Handler
    const vipBadgeHandler = new NodejsFunction(
      this,
      'VIPBadgeHandler',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/badge-handlers/vip-badge/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          USERS_TABLE_NAME: this.usersTable.tableName,
        },
      }
    );

    this.usersTable.grantReadWriteData(vipBadgeHandler);

    // Create EventBridge rule for VIP badge
    new events.Rule(this, 'VIPBadgeRule', {
      eventBus: this.badgeEventBus,
      eventPattern: {
        source: ['hallway-track.connections'],
        detailType: ['ConnectionCreated'],
      },
      targets: [
        new targets.LambdaFunction(vipBadgeHandler, {
          deadLetterQueue: badgeDLQ,
          retryAttempts: 2,
        }),
      ],
    });

    // Triangle Badge Handler
    const triangleBadgeHandler = new NodejsFunction(
      this,
      'TriangleBadgeHandler',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/badge-handlers/triangle-badge/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          USERS_TABLE_NAME: this.usersTable.tableName,
          CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
        },
      }
    );

    this.usersTable.grantReadWriteData(triangleBadgeHandler);
    this.connectionsTable.grantReadData(triangleBadgeHandler);

    // Create EventBridge rule for triangle badge
    new events.Rule(this, 'TriangleBadgeRule', {
      eventBus: this.badgeEventBus,
      eventPattern: {
        source: ['hallway-track.connections'],
        detailType: ['ConnectionCreated'],
      },
      targets: [
        new targets.LambdaFunction(triangleBadgeHandler, {
          deadLetterQueue: badgeDLQ,
          retryAttempts: 2,
        }),
      ],
    });

    // Event Badge Handler
    const eventBadgeHandler = new NodejsFunction(
      this,
      'EventBadgeHandler',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/badge-handlers/event-badge/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          USERS_TABLE_NAME: this.usersTable.tableName,
          REINVENT_DATES: JSON.stringify(config.badges.reinventDates),
        },
      }
    );

    this.usersTable.grantReadWriteData(eventBadgeHandler);

    // Create EventBridge rule for event badge
    new events.Rule(this, 'EventBadgeRule', {
      eventBus: this.badgeEventBus,
      eventPattern: {
        source: ['hallway-track.connections'],
        detailType: ['ConnectionCreated'],
      },
      targets: [
        new targets.LambdaFunction(eventBadgeHandler, {
          deadLetterQueue: badgeDLQ,
          retryAttempts: 2,
        }),
      ],
    });

    // Early Supporter Badge Handler
    const earlySupporterBadgeHandler = new NodejsFunction(
      this,
      'EarlySupporterBadgeHandler',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/badge-handlers/early-supporter-badge/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          USERS_TABLE_NAME: this.usersTable.tableName,
          CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
        },
        timeout: cdk.Duration.minutes(1),
      }
    );

    this.usersTable.grantReadWriteData(earlySupporterBadgeHandler);
    this.connectionsTable.grantReadData(earlySupporterBadgeHandler);

    // Create EventBridge rule for early supporter badge
    new events.Rule(this, 'EarlySupporterBadgeRule', {
      eventBus: this.badgeEventBus,
      eventPattern: {
        source: ['hallway-track.users'],
        detailType: ['UserConnectionCountUpdated'],
      },
      targets: [
        new targets.LambdaFunction(earlySupporterBadgeHandler, {
          deadLetterQueue: badgeDLQ,
          retryAttempts: 2,
        }),
      ],
    });

    // ===== Badge Migration Lambda =====

    // Create Lambda function for one-time badge migration
    const badgeMigrationFunction = new NodejsFunction(
      this,
      'BadgeMigrationFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/badge-migration/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          USERS_TABLE_NAME: this.usersTable.tableName,
          CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
          EVENT_BUS_NAME: this.badgeEventBus.eventBusName,
        },
        timeout: cdk.Duration.minutes(15),
        memorySize: 512,
      }
    );

    this.usersTable.grantReadData(badgeMigrationFunction);
    this.connectionsTable.grantReadData(badgeMigrationFunction);
    this.badgeEventBus.grantPutEventsTo(badgeMigrationFunction);

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

    this.api.addLambdaDataSource(
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

    // Connected profile resolver
    connectedProfileDataSource.createResolver('GetConnectedProfileResolver', {
      typeName: 'Query',
      fieldName: 'getConnectedProfile',
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

    connectionsDataSourceLambda.createResolver('UpdateConnectionNoteResolver', {
      typeName: 'Mutation',
      fieldName: 'updateConnectionNote',
    });

    connectionsDataSourceLambda.createResolver('RemoveConnectionResolver', {
      typeName: 'Mutation',
      fieldName: 'removeConnection',
    });

    // Connection request resolvers
    connectionRequestsDataSource.createResolver('CreateConnectionRequestResolver', {
      typeName: 'Mutation',
      fieldName: 'createConnectionRequest',
    });

    connectionRequestsDataSource.createResolver('ApproveConnectionRequestResolver', {
      typeName: 'Mutation',
      fieldName: 'approveConnectionRequest',
    });

    connectionRequestsDataSource.createResolver('DenyConnectionRequestResolver', {
      typeName: 'Mutation',
      fieldName: 'denyConnectionRequest',
    });

    connectionRequestsDataSource.createResolver('CancelConnectionRequestResolver', {
      typeName: 'Mutation',
      fieldName: 'cancelConnectionRequest',
    });

    connectionRequestsDataSource.createResolver('GetIncomingConnectionRequestsResolver', {
      typeName: 'Query',
      fieldName: 'getIncomingConnectionRequests',
    });

    connectionRequestsDataSource.createResolver('GetOutgoingConnectionRequestsResolver', {
      typeName: 'Query',
      fieldName: 'getOutgoingConnectionRequests',
    });

    connectionRequestsDataSource.createResolver('CheckConnectionOrRequestResolver', {
      typeName: 'Query',
      fieldName: 'checkConnectionOrRequest',
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

    new cdk.CfnOutput(this, 'ConnectionRequestsTableName', {
      value: this.connectionRequestsTable.tableName,
      description: 'Connection Requests DynamoDB Table Name',
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
