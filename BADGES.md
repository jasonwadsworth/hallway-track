# Badge System Configuration Guide

This guide explains how to configure and manage the special badge system in Hallway Track.

## Overview

The badge system includes two types of badges:

1. **Threshold Badges** - Automatically awarded based on connection count (1, 5, 10, 25, 50 connections)
2. **Special Badges** - Awarded for unique achievements and require configuration

## Special Badge Types

### 1. Met the Maker Badge

Awarded when a user connects with the app creator.

**Configuration Required:** Set the `MAKER_USER_ID` environment variable

**How to Configure:**

```bash
# Find your user ID
# Option 1: From browser console after signing in
localStorage.getItem('CognitoIdentityServiceProvider.3u3h1edvnc0baes8gb8bcptefr.LastAuthUser')

# Option 2: Query DynamoDB
aws dynamodb scan \
  --table-name hallway-track-users \
  --filter-expression "email = :email" \
  --expression-attribute-values '{":email":{"S":"your-email@example.com"}}' \
  --region us-west-2

# Set the environment variable
export MAKER_USER_ID="your-user-id-here"
```

### 2. Early Supporter Badge

Awarded to the first 10 connections of any user who reaches 500 connections.

**Configuration Required:** None - automatically triggered

**How it Works:**
- When a user reaches exactly 500 connections, the system identifies their first 10 connections
- Each of those early supporters receives the badge with the popular user's name in the metadata

### 3. VIP Connection Badge

Awarded when connecting with users who have 50+ connections.

**Configuration Required:** None - automatically triggered

**How it Works:**
- Checks the connected user's connection count at time of connection
- Awards badge on first VIP connection
- Updates count metadata for subsequent VIP connections

### 4. Triangle Complete Badge

Awarded when a new connection creates a mutual connection triangle.

**Configuration Required:** None - automatically triggered

**How it Works:**
- When user A connects with user B, checks if they share any mutual connections
- If a mutual connection exists (user C), awards the badge
- Only awarded once per user

### 5. re:Invent Connector Badge

Awarded for connections made during AWS re:Invent conference dates.

**Configuration Required:** Set the `REINVENT_DATES` environment variable

**How to Configure:**

```bash
# Set date ranges for multiple years
export REINVENT_DATES='[
  {"year": 2024, "start": "2024-12-02", "end": "2024-12-06"},
  {"year": 2025, "start": "2025-12-01", "end": "2025-12-05"}
]'
```

**How it Works:**
- Checks connection timestamp against configured date ranges
- Awards separate badge for each year
- Users can earn multiple re:Invent badges (one per year)

## Deployment with Configuration

### Step 1: Edit Configuration File

Edit `infrastructure/config.ts` to set your badge configuration:

```typescript
export const config: HallwayTrackConfig = {
  badges: {
    // Set this to your user ID to enable "Met the Maker" badge
    // Leave undefined to disable this badge
    makerUserId: 'abc123-def456-ghi789',

    // Configure re:Invent dates for event badges
    reinventDates: [
      {
        year: 2024,
        start: '2024-12-02',
        end: '2024-12-06'
      },
      {
        year: 2025,
        start: '2025-12-01',
        end: '2025-12-05'
      }
    ]
  }
};
```

### Step 2: Deploy Infrastructure

```bash
npm run cdk:deploy
```

The CDK stack will read the configuration file and configure the Lambda functions accordingly.

### Step 3: Verify Configuration

Check that the configuration is set in the Lambda functions:

```bash
# Check Maker Badge Handler
aws lambda get-function-configuration \
  --function-name HallwayTrackStack-MakerBadgeHandler-XXXXX \
  --region us-west-2 \
  --query 'Environment.Variables'

# Check Event Badge Handler
aws lambda get-function-configuration \
  --function-name HallwayTrackStack-EventBadgeHandler-XXXXX \
  --region us-west-2 \
  --query 'Environment.Variables'
```

## Retroactive Badge Migration

After deploying the badge system, run the migration Lambda to award badges for existing connections.

### Step 1: Find the Migration Function

```bash
aws lambda list-functions --region us-west-2 | grep BadgeMigration
```

### Step 2: Invoke the Migration

```bash
aws lambda invoke \
  --function-name HallwayTrackStack-BadgeMigrationFunction-XXXXX \
  --region us-west-2 \
  --log-type Tail \
  response.json

# View the response
cat response.json
```

### Step 3: Monitor Progress

```bash
# View CloudWatch logs
aws logs tail /aws/lambda/HallwayTrackStack-BadgeMigrationFunction-XXXXX \
  --follow \
  --region us-west-2
```

The migration will:
1. Scan all users in the database
2. Query all connections for each user
3. Publish events to EventBridge for each connection
4. Badge handlers will process events and award badges asynchronously

**Expected Duration:** ~1 hour for 10,000 users

## Updating Configuration

To update badge configuration after initial deployment:

### Update Configuration File

Edit `infrastructure/config.ts` with your new values:

```typescript
export const config: HallwayTrackConfig = {
  badges: {
    // Update maker user ID
    makerUserId: 'new-user-id',

    // Add new years or update dates
    reinventDates: [
      {
        year: 2024,
        start: '2024-12-02',
        end: '2024-12-06'
      },
      {
        year: 2025,
        start: '2025-12-01',
        end: '2025-12-05'
      },
      {
        year: 2026,
        start: '2026-11-30',
        end: '2026-12-04'
      }
    ]
  }
};
```

### Redeploy

```bash
npm run cdk:deploy
```

After updating configuration, you may want to run the migration Lambda again to award badges based on the new configuration.

## Monitoring Badge Awards

### View EventBridge Events

```bash
# Check event bus metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name Invocations \
  --dimensions Name=EventBusName,Value=hallway-track-badges \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-12-31T23:59:59Z \
  --period 3600 \
  --statistics Sum \
  --region us-west-2
```

### View Badge Handler Logs

```bash
# Maker Badge Handler
aws logs tail /aws/lambda/HallwayTrackStack-MakerBadgeHandler-XXXXX --follow

# VIP Badge Handler
aws logs tail /aws/lambda/HallwayTrackStack-VIPBadgeHandler-XXXXX --follow

# Triangle Badge Handler
aws logs tail /aws/lambda/HallwayTrackStack-TriangleBadgeHandler-XXXXX --follow

# Event Badge Handler
aws logs tail /aws/lambda/HallwayTrackStack-EventBadgeHandler-XXXXX --follow

# Early Supporter Badge Handler
aws logs tail /aws/lambda/HallwayTrackStack-EarlySupporterBadgeHandler-XXXXX --follow
```

### Check Dead Letter Queue

If badge awards fail, they'll be sent to the DLQ:

```bash
# Check DLQ message count
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-west-2.amazonaws.com/ACCOUNT_ID/hallway-track-badge-dlq \
  --attribute-names ApproximateNumberOfMessages \
  --region us-west-2

# Receive messages from DLQ
aws sqs receive-message \
  --queue-url https://sqs.us-west-2.amazonaws.com/ACCOUNT_ID/hallway-track-badge-dlq \
  --region us-west-2
```

## Troubleshooting

### Badges Not Being Awarded

1. **Check EventBridge events are being published:**
   ```bash
   aws logs tail /aws/lambda/HallwayTrackStack-BadgeStreamProcessor-XXXXX --follow
   ```

2. **Check badge handler is being invoked:**
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Invocations \
     --dimensions Name=FunctionName,Value=HallwayTrackStack-MakerBadgeHandler-XXXXX \
     --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 300 \
     --statistics Sum
   ```

3. **Check for errors in badge handler logs:**
   ```bash
   aws logs filter-log-events \
     --log-group-name /aws/lambda/HallwayTrackStack-MakerBadgeHandler-XXXXX \
     --filter-pattern "ERROR" \
     --region us-west-2
   ```

### Configuration Not Taking Effect

1. **Verify environment variables are set:**
   ```bash
   aws lambda get-function-configuration \
     --function-name HallwayTrackStack-MakerBadgeHandler-XXXXX \
     --query 'Environment.Variables'
   ```

2. **Redeploy if needed:**
   ```bash
   export MAKER_USER_ID="your-user-id"
   npm run cdk:deploy
   ```

### Migration Lambda Timeout

If the migration Lambda times out:

1. The function has a 15-minute timeout
2. It processes users in batches of 25
3. Check CloudWatch logs to see how many users were processed
4. You can invoke it multiple times - badge handlers are idempotent

## Architecture

The badge system uses an event-driven architecture:

```
Connection Created
       ↓
DynamoDB Stream
       ↓
Stream Processor Lambda
       ↓
EventBridge Event Bus
       ↓
Badge Handler Lambdas (5 handlers)
       ↓
Update User Badges in DynamoDB
```

This ensures:
- Fast connection creation (no blocking)
- Independent scaling of badge handlers
- Easy addition of new badge types
- Reliable processing with retries and DLQ
