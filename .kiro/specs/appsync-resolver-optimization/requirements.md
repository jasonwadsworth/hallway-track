# Requirements Document

## Introduction

This feature refactors the AppSync resolver architecture to improve maintainability and simplify resolver logic. Currently, several resolvers handle complex multi-step operations synchronously and perform data joins inline, making them difficult to test and reason about. This refactoring will move side effects to event-driven async processes and implement field resolvers to separate concerns and simplify the codebase.

## Glossary

- **Field_Resolver**: An AppSync resolver that resolves individual fields on a GraphQL type, enabling batched data fetching
- **Async_Operation**: A non-blocking operation that completes after the API response is returned
- **Batch_Fetching**: Fetching multiple records in a single database operation instead of N individual operations
- **Reciprocal_Connection**: The bidirectional nature of connections where both users have a connection record
- **Event_Bus**: EventBridge bus used for publishing and subscribing to domain events
- **Connection_Metadata**: Additional information stored with a connection (tags, notes)

## Requirements

### Requirement 1

**User Story:** As a developer, I want connection removal to be simple and focused, so that the resolver logic is easy to understand and test.

#### Acceptance Criteria

1. WHEN a user removes a connection, THE Connection_System SHALL delete only the requesting user's connection record
2. THE Connection_System SHALL emit a ConnectionRemoved event to the Event_Bus after deletion
3. THE Connection_System SHALL return success to the user immediately after their connection is deleted
4. THE Connection_System SHALL process Reciprocal_Connection deletion asynchronously via event handler
5. THE Connection_System SHALL update both users' connection counts asynchronously
6. THE Connection_System SHALL maintain data consistency even if async processing fails

### Requirement 2

**User Story:** As a developer, I want connection queries to separate data fetching concerns, so that the resolver logic is simpler and more maintainable.

#### Acceptance Criteria

1. WHEN getMyConnections is called, THE Connection_System SHALL return connection records without embedded user data
2. THE Connection_System SHALL use a Field_Resolver for the Connection.connectedUser field
3. THE Field_Resolver SHALL fetch user data separately from the main query
4. THE Field_Resolver SHALL batch multiple user lookups into a single operation when possible
5. THE Connection_System SHALL maintain the same GraphQL response structure for backward compatibility
6. THE Field_Resolver SHALL handle missing users gracefully (return null for connectedUser)

### Requirement 3

**User Story:** As a developer, I want connection note updates to be simple, so that the code is easier to maintain and test.

#### Acceptance Criteria

1. WHEN a user updates a connection note, THE Connection_System SHALL always use a SET operation
2. THE Connection_System SHALL accept empty strings as valid note values
3. THE Connection_System SHALL validate note length (max 1000 characters)
4. THE Connection_System SHALL not use conditional REMOVE operations for empty notes
5. THE Connection_System SHALL maintain backward compatibility with existing notes

### Requirement 4

**User Story:** As a developer, I want connection request approval to be simple and focused, so that the resolver logic is easy to understand and test.

#### Acceptance Criteria

1. WHEN a user approves a connection request, THE Connection_System SHALL delete the request record
2. THE Connection_System SHALL emit a ConnectionRequestApproved event to the Event_Bus
3. THE Connection_System SHALL return success to the user immediately after request deletion
4. THE Connection_System SHALL create bidirectional connections asynchronously via event handler
5. THE Connection_System SHALL transfer Connection_Metadata (note, tags) to the initiator's connection asynchronously
6. THE Connection_System SHALL handle failures gracefully with retry logic

### Requirement 5

**User Story:** As a developer, I want connection request queries to separate data fetching concerns, so that the resolver logic is simpler and more maintainable.

#### Acceptance Criteria

1. WHEN getIncomingConnectionRequests is called, THE Connection_System SHALL return request records without embedded user data
2. WHEN getOutgoingConnectionRequests is called, THE Connection_System SHALL return request records without embedded user data
3. THE Connection_System SHALL use a Field_Resolver for the ConnectionRequest.initiator field
4. THE Connection_System SHALL use a Field_Resolver for the ConnectionRequest.recipient field
5. THE Field_Resolver SHALL fetch user data separately from the main query
6. THE Field_Resolver SHALL batch multiple user lookups into a single operation when possible
7. THE Field_Resolver SHALL sanitize metadata fields (hide initiatorNote and initiatorTags from recipients)
8. THE Connection_System SHALL maintain the same GraphQL response structure for backward compatibility

## Non-Functional Requirements

### Maintainability

1. Resolver functions SHALL have a single clear responsibility
2. Side effects SHALL be handled asynchronously and separately from the main resolver logic
3. Data fetching SHALL be separated from business logic using field resolvers
4. Code SHALL be easier to test with isolated concerns

### Reliability

1. Failed async operations SHALL be retried automatically
2. Failed events SHALL be sent to a Dead Letter Queue for manual review
3. System SHALL maintain data consistency even when async operations fail

### Monitoring

1. CloudWatch alarms SHALL be created for async operation failures
2. CloudWatch logs SHALL capture all event processing activities
3. DLQ messages SHALL trigger alerts for investigation

## Future Considerations

After these architectural improvements are complete and stable, the team may consider converting Lambda resolvers to direct DynamoDB VTL resolvers where appropriate. The simplified logic will make this conversion easier.
