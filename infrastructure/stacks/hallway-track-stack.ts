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
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
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
  public readonly hostedZone?: route53.IHostedZone;
  public readonly certificate?: acm.ICertificate;

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
          EVENT_BUS_NAME: this.badgeEventBus.eventBusName,
        },
      }
    );

    this.usersTable.grantReadWriteData(connectionsFunction);
    this.connectionsTable.grantReadWriteData(connectionsFunction);
    this.connectionRequestsTable.grantReadWriteData(connectionsFunction);
    this.badgeEventBus.grantPutEventsTo(connectionsFunction);

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
          EVENT_BUS_NAME: this.badgeEventBus.eventBusName,
        },
      }
    );

    this.usersTable.grantReadWriteData(connectionRequestsFunction);
    this.connectionsTable.grantReadWriteData(connectionRequestsFunction);
    this.connectionRequestsTable.grantReadWriteData(connectionRequestsFunction);
    this.badgeEventBus.grantPutEventsTo(connectionRequestsFunction);

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

    // Unified Badge Handler
    const unifiedBadgeHandler = new NodejsFunction(
      this,
      'UnifiedBadgeHandler',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/badge-handlers/unified-badge-handler/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          USERS_TABLE_NAME: this.usersTable.tableName,
          CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
          MAKER_USER_ID: config.badges.makerUserId || '',
          REINVENT_DATES: JSON.stringify(config.badges.reinventDates),
        },
        timeout: cdk.Duration.minutes(2),
        memorySize: 512,
      }
    );

    this.usersTable.grantReadWriteData(unifiedBadgeHandler);
    this.connectionsTable.grantReadData(unifiedBadgeHandler);

    // Create EventBridge rule for connection created events
    new events.Rule(this, 'UnifiedBadgeConnectionCreatedRule', {
      eventBus: this.badgeEventBus,
      eventPattern: {
        source: ['hallway-track.connections'],
        detailType: ['ConnectionCreated'],
      },
      targets: [
        new targets.LambdaFunction(unifiedBadgeHandler, {
          deadLetterQueue: badgeDLQ,
          retryAttempts: 2,
        }),
      ],
    });

    // Create EventBridge rule for connection count updated events
    new events.Rule(this, 'UnifiedBadgeConnectionCountRule', {
      eventBus: this.badgeEventBus,
      eventPattern: {
        source: ['hallway-track.users'],
        detailType: ['UserConnectionCountUpdated'],
      },
      targets: [
        new targets.LambdaFunction(unifiedBadgeHandler, {
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

    // ===== Connection Event Handlers =====

    // Connection Removed Handler
    const connectionRemovedHandler = new NodejsFunction(
      this,
      'ConnectionRemovedHandler',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/event-handlers/connection-removed/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
          USERS_TABLE_NAME: this.usersTable.tableName,
        },
        timeout: cdk.Duration.minutes(2),
        memorySize: 512,
      }
    );

    this.connectionsTable.grantReadWriteData(connectionRemovedHandler);
    this.usersTable.grantReadWriteData(connectionRemovedHandler);

    // Create EventBridge rule for ConnectionRemoved events
    new events.Rule(this, 'ConnectionRemovedRule', {
      eventBus: this.badgeEventBus,
      eventPattern: {
        source: ['hallway-track.connections'],
        detailType: ['ConnectionRemoved'],
      },
      targets: [
        new targets.LambdaFunction(connectionRemovedHandler, {
          deadLetterQueue: badgeDLQ,
          retryAttempts: 2,
        }),
      ],
    });

    // Connection Request Approved Handler
    const connectionRequestApprovedHandler = new NodejsFunction(
      this,
      'ConnectionRequestApprovedHandler',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: path.join(__dirname, '../lambda/event-handlers/connection-request-approved/index.ts'),
        bundling: {
          externalModules: ['@aws-sdk/*'],
        },
        environment: {
          CONNECTIONS_TABLE_NAME: this.connectionsTable.tableName,
          USERS_TABLE_NAME: this.usersTable.tableName,
        },
        timeout: cdk.Duration.minutes(2),
        memorySize: 512,
      }
    );

    this.connectionsTable.grantReadWriteData(connectionRequestApprovedHandler);
    this.usersTable.grantReadWriteData(connectionRequestApprovedHandler);

    // Create EventBridge rule for ConnectionRequestApproved events
    new events.Rule(this, 'ConnectionRequestApprovedRule', {
      eventBus: this.badgeEventBus,
      eventPattern: {
        source: ['hallway-track.connection-requests'],
        detailType: ['ConnectionRequestApproved'],
      },
      targets: [
        new targets.LambdaFunction(connectionRequestApprovedHandler, {
          deadLetterQueue: badgeDLQ,
          retryAttempts: 2,
        }),
      ],
    });

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

    // Profile operation resolvers (direct DynamoDB with JavaScript)
    usersDataSource.createResolver('UpdateDisplayNameResolver', {
      typeName: 'Mutation',
      fieldName: 'updateDisplayName',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        path.join(__dirname, '../resolvers/Mutation.updateDisplayName.js')
      ),
    });

    usersDataSource.createResolver('GetMyProfileResolver', {
      typeName: 'Query',
      fieldName: 'getMyProfile',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        path.join(__dirname, '../resolvers/Query.getMyProfile.js')
      ),
    });

    // Contact link management resolvers
    usersDataSource.createResolver('AddContactLinkResolver', {
      typeName: 'Mutation',
      fieldName: 'addContactLink',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        path.join(__dirname, '../resolvers/Mutation.addContactLink.js')
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

    // Public profile resolver (direct DynamoDB)
    usersDataSource.createResolver('GetPublicProfileResolver', {
      typeName: 'Query',
      fieldName: 'getPublicProfile',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        path.join(__dirname, '../resolvers/Query.getPublicProfile.js')
      ),
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

    // Get my connections (direct DynamoDB)
    connectionsDataSource.createResolver('GetMyConnectionsResolver', {
      typeName: 'Query',
      fieldName: 'getMyConnections',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        path.join(__dirname, '../resolvers/Query.getMyConnections.js')
      ),
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

    // ===== Field Resolvers =====

    // Connection.connectedUser field resolver (direct DynamoDB)
    usersDataSource.createResolver('ConnectionConnectedUserResolver', {
      typeName: 'Connection',
      fieldName: 'connectedUser',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        path.join(__dirname, '../resolvers/Connection.connectedUser.js')
      ),
    });

    // ConnectionRequest.initiator field resolver (direct DynamoDB)
    usersDataSource.createResolver('ConnectionRequestInitiatorResolver', {
      typeName: 'ConnectionRequest',
      fieldName: 'initiator',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        path.join(__dirname, '../resolvers/ConnectionRequest.initiator.js')
      ),
    });

    // ConnectionRequest.recipient field resolver (direct DynamoDB)
    usersDataSource.createResolver('ConnectionRequestRecipientResolver', {
      typeName: 'ConnectionRequest',
      fieldName: 'recipient',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        path.join(__dirname, '../resolvers/ConnectionRequest.recipient.js')
      ),
    });

    // ===== CloudWatch Alarms =====

    // Alarm for DLQ messages
    new cloudwatch.Alarm(this, 'BadgeDLQAlarm', {
      metric: badgeDLQ.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Alert when messages appear in the badge DLQ',
      alarmName: 'hallway-track-badge-dlq-messages',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm for ConnectionRemovedHandler errors
    new cloudwatch.Alarm(this, 'ConnectionRemovedHandlerErrorAlarm', {
      metric: connectionRemovedHandler.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Alert when ConnectionRemovedHandler has high error rate',
      alarmName: 'hallway-track-connection-removed-handler-errors',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm for ConnectionRequestApprovedHandler errors
    new cloudwatch.Alarm(this, 'ConnectionRequestApprovedHandlerErrorAlarm', {
      metric: connectionRequestApprovedHandler.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      alarmDescription: 'Alert when ConnectionRequestApprovedHandler has high error rate',
      alarmName: 'hallway-track-connection-request-approved-handler-errors',
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
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

    // ===== Custom Domain Setup (Optional) =====

    let customDomainNames: string[] | undefined;

    if (config.customDomain?.domainName) {
      const domainName = config.customDomain.domainName;

      // Lookup domain configuration from Secrets Manager (created by CustomDomainStack in us-east-1)
      const domainSecret = secretsmanager.Secret.fromSecretNameV2(
        this,
        'DomainSecret',
        `hallway-track-domain-${this.account}`
      );

      // Reference the hosted zone created in us-east-1 using values from Secrets Manager
      const hostedZoneId = domainSecret.secretValueFromJson('hostedZoneId').unsafeUnwrap();
      this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'CustomDomainHostedZone', {
        hostedZoneId: hostedZoneId,
        zoneName: domainName,
      });

      // Reference the certificate created in us-east-1
      const certificateArn = domainSecret.secretValueFromJson('certificateArn').unsafeUnwrap();
      this.certificate = acm.Certificate.fromCertificateArn(
        this,
        'CustomDomainCertificate',
        certificateArn
      );

      customDomainNames = [domainName, `www.${domainName}`];
    }

    // Create CloudFront distribution with S3BucketOrigin (replaces deprecated S3Origin)
    const distributionConfig: cloudfront.DistributionProps = {
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
      // Add custom domain configuration if available
      ...(customDomainNames && this.certificate && {
        domainNames: customDomainNames,
        certificate: this.certificate,
      }),
    };

    this.distribution = new cloudfront.Distribution(this, 'Distribution', distributionConfig);

    // Create DNS A records for custom domain (if configured)
    if (config.customDomain?.domainName && this.hostedZone) {
      const domainName = config.customDomain.domainName;

      // Create A record for apex domain
      new route53.ARecord(this, 'CustomDomainARecord', {
        zone: this.hostedZone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(this.distribution)
        ),
        comment: `A record for ${domainName} pointing to CloudFront distribution`,
      });

      // Create A record for www subdomain
      new route53.ARecord(this, 'CustomDomainWwwARecord', {
        zone: this.hostedZone,
        recordName: `www.${domainName}`,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(this.distribution)
        ),
        comment: `A record for www.${domainName} pointing to CloudFront distribution`,
      });
    }

    // Link types resolver (static data, no data source needed)
    this.api.createResolver('GetLinkTypesResolver', {
      typeName: 'Query',
      fieldName: 'getLinkTypes',
      runtime: appsync.FunctionRuntime.JS_1_0_0,
      code: appsync.Code.fromAsset(
        path.join(__dirname, '../resolvers/Query.getLinkTypes.js')
      ),
    });

    // Deploy website assets to S3 (account-specific build directory)
    const frontendDistPath = path.join(__dirname, `../../frontend/dist/${this.account}`);
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

    // Custom domain outputs (conditional)
    if (config.customDomain?.domainName) {
      const domainName = config.customDomain.domainName;

      new cdk.CfnOutput(this, 'CustomDomainURL', {
        value: `https://${domainName}`,
        description: 'Custom Domain URL',
      });

      new cdk.CfnOutput(this, 'CustomDomainWwwURL', {
        value: `https://www.${domainName}`,
        description: 'Custom Domain WWW URL',
      });

      new cdk.CfnOutput(this, 'DomainSecretName', {
        value: `hallway-track-domain-${this.account}`,
        description: 'Secrets Manager secret name containing domain configuration',
      });

      if (this.certificate) {
        new cdk.CfnOutput(this, 'CertificateArn', {
          value: this.certificate.certificateArn,
          description: 'SSL Certificate ARN (from us-east-1)',
        });
      }
    }
  }
}
