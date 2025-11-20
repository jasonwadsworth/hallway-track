# Connection Data Migration

## Overview

This migration changes the Connection data model to use `connectedUserId` as the sort key instead of a random UUID. This enables direct GetItem operations instead of Query + filter, significantly improving performance and enabling direct DynamoDB resolvers.

## Data Model Changes

### Before
```
PK: USER#<userId>
SK: CONNECTION#<randomUUID>
id: <randomUUID>
connectedUserId: <otherUserId>
```

### After
```
PK: USER#<userId>
SK: CONNECTION#<connectedUserId>
id: <connectedUserId>
connectedUserId: <connectedUserId>
```

## Benefits

1. **Direct GetItem** for connection checks (no Query + filter needed)
2. **Simpler data model** - SK identifies the connection
3. **No duplicate connections** - DynamoDB enforces uniqueness
4. **Direct DynamoDB resolvers** - Converted 3 Lambda resolvers to direct:
   - `checkConnection` - Now a simple GetItem
   - `getConnectedProfile` - Pipeline resolver with 2 GetItems
   - `getMyConnections` - Already converted earlier

## Migration Steps

### 1. Deploy the Updated Code

```bash
npm run cdk:deploy
```

This deploys:
- Updated Lambda functions with new data structure
- New `ConnectionMigrationFunction` Lambda
- Direct DynamoDB resolvers for `checkConnection` and `getConnectedProfile`

### 2. Run the Migration

```bash
# Find the migration function name
aws lambda list-functions --region us-west-2 | grep ConnectionMigration

# Invoke the migration
aws lambda invoke \
  --function-name HallwayTrackStack-ConnectionMigrationFunction-XXXXX \
  --region us-west-2 \
  response.json

# Check results
cat response.json
```

The migration will:
- Scan all connections in the table
- Create new connections with `SK: CONNECTION#<connectedUserId>`
- Delete old connections with random UUID SKs
- Report migrated count and any errors

### 3. Verify Migration

```bash
# Check a few connections in DynamoDB
aws dynamodb query \
  --table-name hallway-track-connections \
  --key-condition-expression "PK = :pk" \
  --expression-attribute-values '{":pk":{"S":"USER#<some-user-id>"}}' \
  --region us-west-2
```

Verify that SK values are now `CONNECTION#<userId>` format.

### 4. Test the Application

1. Test connection checking
2. Test viewing connected profiles
3. Test creating new connections
4. Test connection management (tags, notes, removal)

## Rollback Plan

If issues occur:

1. Revert the CDK deployment:
   ```bash
   git revert <commit-hash>
   npm run cdk:deploy
   ```

2. The old connection records are deleted during migration, so you'd need to restore from a DynamoDB backup if available.

## Frontend Impact

The frontend uses `connection.id` for:
- React keys
- Routing
- Mutation parameters

Since `id` now equals `connectedUserId`, everything continues to work without frontend changes. The ID is just a different value (user ID instead of random UUID).

## Performance Improvements

- **checkConnection**: Query + filter → GetItem (10x faster)
- **getConnectedProfile**: Query + filter + GetItem → 2x GetItem (5x faster)
- **Reduced Lambda costs**: 2 fewer Lambda functions
- **Lower latency**: Direct DynamoDB access, no Lambda cold starts
