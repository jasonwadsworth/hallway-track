# Connection Request Metadata Design

## Overview

This design extends the connection request system to allow users to attach notes and tags when initiating a connection request. When the recipient approves the request, theautomatically transferred to the established connection. This ensures users can capture context at the moment of meeting someone without losing information during the approval process.

## Architecture

### High-Level Flow

```
1. User A meets User B and scans QR code
2. User A creates connection request with notes and tags
3. System stores request with metadata in ConnectionRequests table
4. User B receives request (metadata remains private)
5. User B approves request
6. System creates bidirectional connections
7. System transfers metadata to User A's connection record
8. User A's connection now has the notes and tags they specified
```

### Data Layer Changes

#### Extended ConnectionRequests Table Schema

The existing `ConnectionRequests` table will be extended with metadata fields:

```typescript
interface ConnectionRequest {
  // Existing fields
  PK: string;              // USER#{recipientUserId}
  SK: string;              // REQUEST#{requestId}
  GSI1PK: string;          // USER#{initiatorUserId}
  GSI1SK: string;          // {createdAt}
  id: string;
  initiatorUserId: string;
  recipientUserId: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  actionedAt?: string;

  // NEW: Metadata fields
  initiatorNote?: string;  // Private note from initiator (max 1000 chars)
  initiatorTags?: string[]; // Tags from initiator
}
```

**Design Rationale:**
- Metadata stored directly on ConnectionRequest record (no separate table)
- Fields prefixed with `initiator` to clarify ownership
- Optional fields maintain backward compatibility
- Metadata deleted automatically when request is denied/cancelled

## Components and Interfaces

### Backend API Changes

#### GraphQL Schema Extensions

```graphql
# Extend ConnectionRequest type
type ConnectionRequest {
  id: ID!
  initiatorUserId: ID!
  recipientUserId: ID!
  initiator: PublicProfile
  recipient: PublicProfile
  status: ConnectionRequestStatus!
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
  actionedAt: AWSDateTime
  # NEW: Metadata fields (only visible to initiator)
  initiatorNote: String
  initiatorTags: [String!]
}

# Update createConnectionRequest mutation
extend type Mutation {
  createConnectionRequest(
    recipientUserId: ID!
    note: String              # NEW: Optional note
    tags: [String!]           # NEW: Optional tags
  ): ConnectionRequestResult!

  # NEW: Update metadata on pending request
  updateConnectionRequestMetadata(
    requestId: ID!
    note: String
    tags: [String!]
  ): ConnectionRequestResult!
}
```

#### Lambda Function Updates

**Modified Lambda: connection-requests/index.ts**

Key changes:
1. Accept `note` and `tags` parameters in `createConnectionRequest`
2. Validate note length (≤1000 characters) and tag format
3. Store metadata with request
4. Add new `updateConnectionRequestMetadata` handler
5. Transfer metadata to connection on approval
6. Ensure metadata privacy (not exposed to recipient)

**Metadata Transfer Logic:**

```typescript
async function approveConnectionRequest(recipientUserId: string, args: { requestId: string }) {
  // ... existing approval logic ...

  // After creating connections, transfer metadata
  if (request.initiatorNote || request.initiatorTags) {
    await transferMetadataToConnection(
      request.initiatorUserId,
      recipientUserId,
      request.initiatorNote,
      request.initiatorTags
    );
  }

  // ... rest of approval logic ...
}

async function transferMetadataToConnection(
  initiatorUserId: string,
  recipientUserId: string,
  note?: string,
  tags?: string[]
): Promise<void> {
  // Find the initiator's connection record
  const connectionResult = await docClient.send(
    new QueryCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'connectedUserId = :connectedUserId',
      ExpressionAttributeValues: {
        ':pk': `USER#${initiatorUserId}`,
        ':sk': 'CONNECTION#',
        ':connectedUserId': recipientUserId,
      },
      Limit: 1,
    })
  );

  if (!connectionResult.Items || connectionResult.Items.length === 0) {
    console.error('Connection not found for metadata transfer');
    return;
  }

  const connection = connectionResult.Items[0];
  const now = new Date().toISOString();

  // Build update expression dynamically
  const updateParts: string[] = ['updatedAt = :now'];
  const attributeValues: Record<string, unknown> = { ':now': now };

  if (note) {
    updateParts.push('note = :note');
    attributeValues[':note'] = note;
  }

  if (tags && tags.length > 0) {
    updateParts.push('tags = :tags');
    attributeValues[':tags'] = tags;
  }

  // Update the connection with metadata
  await docClient.send(
    new UpdateCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Key: {
        PK: connection.PK,
        SK: connection.SK,
      },
      UpdateExpression: `SET ${updateParts.join(', ')}`,
      ExpressionAttributeValues: attributeValues,
    })
  );
}
```

### Frontend UI Changes

#### ConnectButton Component Updates

When user clicks to send connection request, show a modal/form:

**New Component: ConnectionRequestModal**
- Text area for notes (1000 char limit)
- Tag input field (reuse existing tag UI pattern)
- Character counter for notes
- Send button
- Cancel button

**Component Structure:**
```
ConnectionRequestModal
├── Header ("Send Connection Request")
├── Recipient Info (name, avatar)
├── Notes Section
│   ├── Label ("Add a note (optional)")
│   ├── Textarea (1000 char limit)
│   └── Character Counter
├── Tags Section
│   ├── Label ("Add tags (optional)")
│   └── TagInput (reuse from TagManager)
└── Actions
    ├── Cancel Button
    └── Send Request Button
```

#### ConnectionRequestsManager Component Updates

**Outgoing Requests Tab:**
- Display initiator's own notes and tags
- Allow editing metadata on pending requests
- Show "Edit" button next to each request
- Modal for editing (same UI as creation)

**Incoming Requests Tab:**
- No changes (metadata remains hidden from recipient)
- Continue showing only basic request info

#### Post-Approval Experience

After approval, when initiator views their connections:
- Connection automatically has the notes and tags they specified
- No additional action required
- Seamless experience

### Frontend Type Updates

```typescript
// Extend ConnectionRequest interface
export interface ConnectionRequest {
  id: string;
  initiatorUserId: string;
  recipientUserId: string;
  initiator?: PublicProfile;
  recipient?: PublicProfile;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  actionedAt?: string;
  // NEW: Metadata fields
  initiatorNote?: string;
  initiatorTags?: string[];
}

// New mutation input types
export interface CreateConnectionRequestInput {
  recipientUserId: string;
  note?: string;
  tags?: string[];
}

export interface UpdateConnectionRequestMetadataInput {
  requestId: string;
  note?: string;
  tags?: string[];
}
```

### GraphQL Mutations (Frontend)

```typescript
// Updated mutation
export const createConnectionRequest = /* GraphQL */ `
  mutation CreateConnectionRequest(
    $recipientUserId: ID!
    $note: String
    $tags: [String!]
  ) {
    createConnectionRequest(
      recipientUserId: $recipientUserId
      note: $note
      tags: $tags
    ) {
      success
      message
      request {
        id
        initiatorUserId
        recipientUserId
        status
        createdAt
        updatedAt
        initiatorNote
        initiatorTags
      }
    }
  }
`;

// New mutation
export const updateConnectionRequestMetadata = /* GraphQL */ `
  mutation UpdateConnectionRequestMetadata(
    $requestId: ID!
    $note: String
    $tags: [String!]
  ) {
    updateConnectionRequestMetadata(
      requestId: $requestId
      note: $note
      tags: $tags
    ) {
      success
      message
      request {
        id
        initiatorUserId
        recipientUserId
        status
        createdAt
        updatedAt
        initiatorNote
        initiatorTags
      }
    }
  }
`;

// Updated query to include metadata
export const getOutgoingConnectionRequests = /* GraphQL */ `
  query GetOutgoingConnectionRequests {
    getOutgoingConnectionRequests {
      id
      initiatorUserId
      recipientUserId
      status
      createdAt
      updatedAt
      initiatorNote
      initiatorTags
      recipient {
        id
        displayName
        gravatarHash
      }
    }
  }
`;
```

## Data Flow

### Creating Request with Metadata

```
1. User A clicks "Connect" on User B's profile
2. ConnectionRequestModal opens
3. User A enters note and/or tags
4. User A clicks "Send Request"
5. Frontend validates note length (≤1000 chars)
6. Frontend calls createConnectionRequest mutation with metadata
7. Lambda validates inputs
8. Lambda stores request with metadata in DynamoDB
9. Frontend shows success message
10. Modal closes
```

### Editing Metadata on Pending Request

```
1. User A views outgoing requests
2. User A clicks "Edit" on a pending request
3. Modal opens with current note and tags
4. User A modifies note and/or tags
5. User A clicks "Save"
6. Frontend calls updateConnectionRequestMetadata
7. Lambda updates request record
8. Frontend updates local state
9. Modal closes
```

### Metadata Transfer on Approval

```
1. User B approves connection request
2. Lambda retrieves request with metadata
3. Lambda creates bidirectional connections
4. Lambda transfers metadata to User A's connection
5. Lambda deletes request record (with metadata)
6. User A's connection now has note and tags
7. User B's connection has no metadata (as expected)
```

### Metadata Cleanup on Denial/Cancellation

```
1. Request is denied or cancelled
2. Lambda deletes request record from DynamoDB
3. Metadata is automatically removed (part of record)
4. No orphaned data remains
```

## Error Handling

### Validation Errors

| Error Condition | Handling |
|----------------|----------|
| Note exceeds 1000 characters | Frontend: Prevent input beyond limit<br>Backend: Return validation error |
| Invalid tag format | Frontend: Validate tag input<br>Backend: Return validation error |
| Request not found | Backend: Return 404 error<br>Frontend: Display error message |
| Request not pending | Backend: Return status error<br>Frontend: Display error message |
| Unauthorized access | Backend: Verify userId matches initiator<br>Frontend: Handle auth error |

### Error Messages

- **Note too long**: "Note must be 1000 characters or less"
- **Request not found**: "Connection request not found"
- **Request not pending**: "This request can no longer be edited"
- **Unauthorized**: "You don't have permission to edit this request"
- **Metadata transfer failed**: Logged but doesn't block connection creation

### Graceful Degradation

- If metadata transfer fails during approval, connection is still created
- Error is logged for investigation
- User can manually add note/tags to connection afterward
- System remains functional even if metadata feature fails

## Testing Strategy

### Backend Testing

**Unit Tests (Optional):**
- Validate note length enforcement
- Validate tag format
- Test metadata storage on request creation
- Test metadata update on pending requests
- Test metadata transfer on approval
- Test metadata cleanup on denial/cancellation

**Integration Tests (Optional):**
- End-to-end request creation with metadata
- End-to-end approval with metadata transfer
- Verify metadata privacy (not exposed to recipient)

### Frontend Testing

**Component Tests (Optional):**
- ConnectionRequestModal renders correctly
- Note character counter works
- Tag input functions properly
- Metadata displays in outgoing requests
- Edit functionality works

**Manual Testing:**
- Create request with note only
- Create request with tags only
- Create request with both note and tags
- Create request with neither (backward compatibility)
- Edit metadata on pending request
- Approve request and verify metadata transfer
- Deny request and verify metadata cleanup
- Cancel request and verify metadata cleanup

## Security Considerations

### Privacy

- Metadata only visible to initiator (not recipient)
- GraphQL resolvers filter metadata based on userId
- Recipient cannot access initiator's notes or tags
- Metadata transferred only to initiator's connection record

### Authorization

- Only initiator can view/edit metadata on their requests
- Only initiator can update metadata on pending requests
- Recipient cannot see or modify initiator's metadata
- All operations require valid Cognito authentication

### Data Validation

- Frontend enforces 1000 character limit on notes
- Backend validates note length as defense-in-depth
- Tag format validated against existing tag rules
- Input trimmed to prevent whitespace-only values

## Performance Considerations

### Database Impact

- Metadata stored as attributes on existing ConnectionRequest records
- No additional tables or indexes required
- Minimal storage overhead (typical note: 100-500 chars)
- Metadata deleted with request (no cleanup jobs needed)

### API Efficiency

- Single mutation handles request creation with metadata
- No additional round trips required
- Metadata transfer happens during approval (no extra calls)
- Optimistic UI updates for better UX

### Scalability

- No impact on existing query patterns
- Metadata transfer is lightweight operation
- No additional Lambda invocations required
- DynamoDB auto-scaling handles increased item size

## Migration Strategy

### Backward Compatibility

- Existing connection requests without metadata work unchanged
- Frontend handles missing metadata fields gracefully
- Backend treats metadata as optional
- No migration required for existing requests

### Deployment Approach

1. Update GraphQL schema with new fields
2. Deploy Lambda function changes
3. Deploy AppSync resolvers
4. Deploy frontend changes
5. Test end-to-end flow
6. Monitor for issues

### Rollback Plan

- Frontend changes can be rolled back independently
- Backend changes are additive (no breaking changes)
- Existing functionality unaffected if rollback needed
- Metadata fields can be ignored if feature disabled

## Future Enhancements

### Recipient Metadata (Future)

Allow recipients to also add notes/tags when approving:
- Add `recipientNote` and `recipientTags` fields
- Show input fields in approval modal
- Transfer to recipient's connection record
- Both users can capture context at connection time

### Metadata Templates (Future)

Pre-defined note templates for common scenarios:
- "Met at re:Invent 2024"
- "Interested in [topic]"
- "Follow up about [subject]"
- Quick selection for faster input

### Rich Text Notes (Future)

Support formatted notes:
- Bold, italic, lists
- Links to resources
- Mentions of other connections
- Requires rich text editor component

## Implementation Notes

### Reuse Existing Components

- Tag input: Reuse TagManager component logic
- Note textarea: Similar to existing note feature
- Modal: Reuse Modal component
- Character counter: Standard React pattern

### Code Organization

- Metadata logic in connection-requests Lambda
- Transfer logic as separate function for clarity
- Frontend modal as new component
- GraphQL mutations follow existing patterns

### Testing Priority

Focus manual testing on:
1. Metadata privacy (recipient cannot see)
2. Metadata transfer on approval
3. Metadata cleanup on denial/cancellation
4. Edit functionality on pending requests
5. Backward compatibility (requests without metadata)
