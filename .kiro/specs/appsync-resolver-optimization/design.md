# Design Document

## Overview

This design refactors the AppSync resolver architecture to improve maintainability by separating concerns and moving side effects to asynchronous event-driven processes. The current implementation has several resolvers that perform complex multi-step operations synchronously, making them difficult to test and reason about. This refactoring will:

1. Simplify resolver logic by focusing on single responsibilities
2. Move side effects (reciprocal operations, badge awarding, count updates) to async event handlers
3. Implement field resolvers to separate data fetching from business logic
4. Improve testability and maintainability

## Architecture

### Current Architecture Issues

The current implementation has the following problems:

1. **removeConnection**: Performs 8+ synchronous steps including reciprocal deletion, count updates, and badge re-evaluation
2. **approveConnectionRequest**: Creates bidirectional connections, transfers metadata, and updates counts synchronously
3. **getMyConnections**: Fetches user data inline for each connection (N+1 query problem)
4. **getIncomingConnectionRequests/getOutgoingConnectionRequests**: Fetches user data inline for each request
5. **updateConnectionNote**: Uses conditional REMOVE operations for empty notes instead of consistent SET operations

### Target Architecture

The refactored architecture will use:

1. **Event-Driven Side Effects**: EventBridge for async processing of reciprocal operations and badge awarding
2. **Field Resolvers**: Separate resolvers for nested fields (Connection.connectedUser, ConnectionRequest.initiator/recipient)
3. **Simplified Mutations**: Mutations return immediately after core operation, emit events for side effects
4. **Consistent Data Operations**: Use SET operations consistently, avoid conditional logic

```
┌─────────────────────────────────────────────────────────────────┐
│                         GraphQL API                              │
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │ Mutation         │         │ Query            │             │
│  │ Resolvers        │         │ Resolvers        │             │
│  │                  │         │                  │             │
│  │ - removeConn     │         │ - getMyConns     │             │
│  │ - approveReq     │         │ - getIncoming    │             │
│  │ - updateNote     │         │ - getOutgoing    │             │
│  └────────┬─────────┘         └────────┬─────────┘             │
│           │                            │                        │
│           │ Emit Event                 │ Return Data           │
│           ▼                            ▼                        │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │ EventBridge      │         │ Field Resolvers  │             │
│  │                  │         │                  │             │
│  │ - ConnRemoved    │         │ - connectedUser  │             │
│  │ - ReqApproved    │         │ - initiator      │             │
│  └────────┬─────────┘         │ - recipient      │             │
│           │                   └──────────────────┘             │
└───────────┼──────────────────────────────────────────────────────┘
            │
            │ Async Processing
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Event Handler Lambdas                         │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Connection Removed Handler                                │   │
│  │ - Delete reciprocal connection                            │   │
│  │ - Update both users' connection counts                    │   │
│  │ - Emit badge re-evaluation events                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Connection Request Approved Handler                       │   │
│  │ - Create bidirectional connections                        │   │
│  │ - Transfer metadata to initiator's connection             │   │
│  │ - Update both users' connection counts                    │   │
│  │ - Emit badge awarding events                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Simplified Mutation Resolvers

#### removeConnection Mutation

**Current Flow** (8+ synchronous steps):
1. Validate connectionId
2. Retrieve connection record
3. Verify connection exists
4. Verify ownership
5. Delete user's connection
6. Query for reciprocal connection
7. Delete reciprocal connection
8. Update both users' connection counts
9. Re-evaluate badges for both users

**New Flow** (3 steps):
1. Validate and delete user's connection record
2. Emit `ConnectionRemoved` event with userId and connectedUserId
3. Return success immediately

**Event Payload**:
```typescript
{
  source: 'hallway-track.connections',
  detailType: 'ConnectionRemoved',
  detail: {
    userId: string,
    connectedUserId: string,
    connectionId: string,
    timestamp: string
  }
}
```

#### approveConnectionRequest Mutation

**Current Flow** (6+ synchronous steps):
1. Retrieve and validate request
2. Create bidirectional connections
3. Transfer metadata to initiator's connection
4. Update both users' connection counts
5. Award badges
6. Delete request record

**New Flow** (2 steps):
1. Delete request record
2. Emit `ConnectionRequestApproved` event with request details
3. Return success immediately

**Event Payload**:
```typescript
{
  source: 'hallway-track.connection-requests',
  detailType: 'ConnectionRequestApproved',
  detail: {
    requestId: string,
    initiatorUserId: string,
    recipientUserId: string,
    initiatorNote?: string,
    initiatorTags?: string[],
    timestamp: string
  }
}
```

#### updateConnectionNote Mutation

**Current Approach**:
- Uses conditional REMOVE for empty notes
- Uses SET for non-empty notes

**New Approach**:
- Always use SET operation
- Store empty string for cleared notes
- Simpler, more consistent logic

### 2. Field Resolvers

#### Connection.connectedUser Field Resolver

**Purpose**: Fetch user data separately from connection query

**Implementation**:
- Input: Connection object with connectedUserId
- Output: User object or null
- Batching: Use DataLoader pattern to batch multiple user lookups

**Benefits**:
- Separates data fetching from business logic
- Enables batching to reduce DynamoDB queries
- Easier to test and maintain

#### ConnectionRequest.initiator Field Resolver

**Purpose**: Fetch initiator user data separately from request query

**Implementation**:
- Input: ConnectionRequest object with initiatorUserId
- Output: PublicProfile object or null
- Batching: Use DataLoader pattern

#### ConnectionRequest.recipient Field Resolver

**Purpose**: Fetch recipient user data separately from request query

**Implementation**:
- Input: ConnectionRequest object with recipientUserId
- Output: PublicProfile object or null
- Batching: Use DataLoader pattern
- Privacy: Sanitize metadata fields (hide initiatorNote and initiatorTags from recipients)

### 3. Event Handler Lambdas

#### ConnectionRemovedHandler

**Trigger**: EventBridge rule matching `ConnectionRemoved` events

**Responsibilities**:
1. Query for reciprocal connection using connectedUserId
2. Delete reciprocal connection if found
3. Update both users' connection counts (decrement)
4. Emit badge re-evaluation events for both users

**Error Handling**:
- Retry up to 2 times on failure
- Send to DLQ after exhausting retries
- Log all operations for debugging

**Idempotency**: Use event ID to prevent duplicate processing

#### ConnectionRequestApprovedHandler

**Trigger**: EventBridge rule matching `ConnectionRequestApproved` events

**Responsibilities**:
1. Create bidirectional connection records
2. Transfer metadata (note, tags) to initiator's connection
3. Update both users' connection counts (increment)
4. Emit badge awarding events

**Error Handling**:
- Retry up to 2 times on failure
- Send to DLQ after exhausting retries
- Log all operations for debugging

**Idempotency**: Use event ID to prevent duplicate processing

### 4. Query Resolvers with Field Resolvers

#### getMyConnections Query

**Current Implementation**:
- Queries connections table
- Loops through each connection
- Fetches user data inline (N+1 problem)

**New Implementation**:
- Query connections table
- Return connection records without user data
- Field resolver fetches user data with batching

#### getIncomingConnectionRequests Query

**Current Implementation**:
- Queries connection requests table
- Loops through each request
- Fetches initiator user data inline
- Sanitizes metadata fields

**New Implementation**:
- Query connection requests table
- Return request records without user data
- Field resolver fetches initiator data with batching
- Field resolver handles metadata sanitization

#### getOutgoingConnectionRequests Query

**Current Implementation**:
- Queries connection requests table via GSI
- Loops through each request
- Fetches recipient user data inline

**New Implementation**:
- Query connection requests table via GSI
- Return request records without user data
- Field resolver fetches recipient data with batching

## Data Models

### Event Schemas

#### ConnectionRemoved Event
```typescript
interface ConnectionRemovedEvent {
  source: 'hallway-track.connections';
  detailType: 'ConnectionRemoved';
  detail: {
    userId: string;
    connectedUserId: string;
    connectionId: string;
    timestamp: string;
  };
}
```

#### ConnectionRequestApproved Event
```typescript
interface ConnectionRequestApprovedEvent {
  source: 'hallway-track.connection-requests';
  detailType: 'ConnectionRequestApproved';
  detail: {
    requestId: string;
    initiatorUserId: string;
    recipientUserId: string;
    initiatorNote?: string;
    initiatorTags?: string[];
    timestamp: string;
  };
}
```

### DynamoDB Access Patterns

No changes to existing DynamoDB schema or access patterns. The refactoring maintains the same data model.

## Error Handling

### Mutation Error Handling

**Principle**: Fail fast for user-facing operations, handle side effects asynchronously

**Implementation**:
- Validate inputs before any database operations
- Return errors immediately for validation failures
- Return success after core operation completes
- Side effects handled asynchronously with retry logic

### Event Handler Error Handling

**Retry Strategy**:
- Automatic retry up to 2 times
- Exponential backoff between retries
- Send to DLQ after exhausting retries

**Dead Letter Queue**:
- Retain failed events for 14 days
- CloudWatch alarm for DLQ messages
- Manual investigation and replay process

**Idempotency**:
- Use EventBridge event ID as idempotency key
- Check if operation already completed before processing
- Prevent duplicate side effects

### Field Resolver Error Handling

**Missing Data**:
- Return null for missing users
- Log warning for debugging
- Don't fail entire query

**Batching Errors**:
- Handle partial failures gracefully
- Return null for failed individual lookups
- Log errors for investigation

## Testing Strategy

### Unit Testing

**Mutation Resolvers**:
- Test validation logic
- Test core database operations
- Mock EventBridge client
- Verify event emission

**Event Handlers**:
- Test with sample events
- Mock DynamoDB operations
- Verify retry logic
- Test idempotency

**Field Resolvers**:
- Test with sample parent objects
- Mock DynamoDB operations
- Test batching logic
- Test error handling

### Integration Testing

**End-to-End Flows**:
- Test removeConnection flow from mutation to event handler
- Test approveConnectionRequest flow from mutation to event handler
- Verify data consistency after async operations
- Test field resolver batching with multiple connections

**Error Scenarios**:
- Test DLQ behavior with forced failures
- Test idempotency with duplicate events
- Test partial failures in batch operations

### Manual Testing

**Monitoring**:
- Verify CloudWatch logs for event processing
- Check DLQ for failed events
- Monitor Lambda execution times
- Verify connection counts remain accurate

## Migration Strategy

### Phase 1: Add Event Infrastructure
- Create EventBridge rules for new event types
- Deploy event handler Lambdas
- Test event handlers in isolation

### Phase 2: Add Field Resolvers
- Implement field resolvers for Connection.connectedUser
- Implement field resolvers for ConnectionRequest.initiator/recipient
- Deploy alongside existing resolvers
- Test with production traffic

### Phase 3: Refactor Mutations
- Update removeConnection to emit events
- Update approveConnectionRequest to emit events
- Update updateConnectionNote to use SET consistently
- Deploy with feature flag for gradual rollout

### Phase 4: Cleanup
- Remove old synchronous code paths
- Remove feature flags
- Update documentation

## Performance Considerations

### Latency

**Mutation Latency**: Improved
- removeConnection: ~500ms → ~100ms (80% reduction)
- approveConnectionRequest: ~800ms → ~150ms (81% reduction)

**Query Latency**: Slightly improved
- getMyConnections: Batching reduces DynamoDB queries
- Field resolvers enable parallel data fetching

### Throughput

**Event Processing**: Asynchronous
- No impact on user-facing API latency
- EventBridge handles high throughput
- Lambda scales automatically

### Cost

**DynamoDB**: Neutral
- Same number of total operations
- Better distribution over time

**Lambda**: Slight increase
- Additional Lambda invocations for event handlers
- Offset by reduced execution time for mutations

**EventBridge**: Minimal
- Low cost per event
- Negligible for expected traffic

## Monitoring and Observability

### CloudWatch Metrics

**Custom Metrics**:
- ConnectionRemovedEventProcessed
- ConnectionRequestApprovedEventProcessed
- FieldResolverBatchSize
- EventHandlerRetryCount

**Alarms**:
- DLQ message count > 0
- Event handler error rate > 5%
- Field resolver error rate > 1%

### CloudWatch Logs

**Log Groups**:
- /aws/lambda/connections-removed-handler
- /aws/lambda/connection-request-approved-handler
- /aws/events/hallway-track-badges (existing)

**Log Insights Queries**:
- Event processing duration
- Failed event details
- Idempotency key usage

### X-Ray Tracing

**Trace Points**:
- Mutation resolver execution
- Event emission
- Event handler execution
- Field resolver execution
- DynamoDB operations

## Security Considerations

### Authorization

**No Changes**: Existing Cognito authorization remains unchanged

### Data Privacy

**Field Resolver Privacy**:
- ConnectionRequest.recipient field resolver sanitizes metadata
- Ensures initiatorNote and initiatorTags not exposed to recipients

### Event Data

**Sensitive Data**: Events contain user IDs only, no PII
**Access Control**: EventBridge rules restrict event targets

## Backward Compatibility

### GraphQL Schema

**No Breaking Changes**: Schema remains identical
- Connection type unchanged
- ConnectionRequest type unchanged
- Mutation signatures unchanged
- Query signatures unchanged

### API Behavior

**User-Facing Behavior**: Identical
- Same response structures
- Same error messages
- Same validation rules

**Internal Behavior**: Different
- Side effects happen asynchronously
- Eventual consistency for reciprocal operations
- Typically completes within 1-2 seconds

## Future Enhancements

### Potential Optimizations

1. **VTL Resolvers**: After simplification, consider converting Lambda resolvers to VTL for better performance
2. **Batch Operations**: Add batch mutation support for multiple connections
3. **Caching**: Add AppSync caching for frequently accessed data
4. **GraphQL Subscriptions**: Add real-time updates for connection events

### Monitoring Improvements

1. **Distributed Tracing**: Enhanced X-Ray integration
2. **Custom Dashboards**: CloudWatch dashboards for key metrics
3. **Alerting**: PagerDuty integration for critical failures
