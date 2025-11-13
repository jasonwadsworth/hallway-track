# Design Document: Contact Notes

## Overview

The contact notes feature enables users to add private, personal notes to their connections. Notes are stored as part of the connection data in DynamoDB and are only accessible to the user who created them. This design leverages the existing connections infrastructure and follows the established patterns for data storage and GraphQL API design.

## Architecture

### High-Level Architecture

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │ GraphQL
       ▼
┌─────────────┐
│  AppSync    │
│  GraphQL    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Lambda     │
│ Connections │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  DynamoDB   │
│ Connections │
│   Table     │
└─────────────┘
```

The notes feature integrates into the existing connections architecture:
- Notes are stored as an attribute on Connection items in DynamoDB
- The existing connections Lambda function is extended to handle note operations
- The GraphQL schema is extended with note-related mutations
- The frontend ConnectionDetail component is enhanced to display and edit notes

## Components and Interfaces

### 1. Data Model

#### DynamoDB Schema Extension

The existing Connection item in the `hallway-track-connections` table will be extended with a `note` field:

```typescript
interface Connection {
  PK: string;              // USER#<userId>
  SK: string;              // CONNECTION#<connectionId>
  GSI1PK: string;          // CONNECTED#<connectedUserId>
  GSI1SK: string;          // <timestamp>
  id: string;              // Connection UUID
  userId: string;          // Owner of this connection record
  connectedUserId: string; // The connected user
  tags: string[];          // Existing tags array
  note?: string;           // NEW: Private note (max 1000 chars)
  createdAt: string;       // ISO timestamp
  updatedAt: string;       // ISO timestamp
}
```

**Design Rationale:**
- Notes are stored directly on the Connection item (no separate table needed)
- Each user has their own Connection record for each relationship, ensuring privacy
- The optional `note` field keeps the schema backward compatible
- 1000 character limit balances utility with storage efficiency

### 2. GraphQL API

#### Schema Extensions

Add the following to `infrastructure/schema.graphql`:

```graphql
type Connection {
  id: ID!
  userId: ID!
  connectedUserId: ID!
  connectedUser: User
  tags: [String!]!
  note: String              # NEW: Private note field
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type Mutation {
  # ... existing mutations ...

  # NEW: Update note on a connection
  updateConnectionNote(
    connectionId: ID!
    note: String
  ): Connection!
}
```

**Design Rationale:**
- Single mutation handles both adding and updating notes
- Passing `null` or empty string for `note` removes the note
- Returns the full Connection object for consistency with other mutations

### 3. Backend Lambda Function

#### Connections Lambda Extension

Extend `infrastructure/lambda/connections/index.ts` with a new handler function:

```typescript
async function updateConnectionNote(
  userId: string,
  args: { connectionId: string; note?: string | null }
): Promise<Connection> {
  const { connectionId, note } = args;

  // Validate note length if provided
  if (note && note.length > 1000) {
    throw new Error('Note must be 1000 characters or less');
  }

  // Get the connection to verify ownership
  const result = await docClient.send(
    new GetCommand({
      TableName: CONNECTIONS_TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `CONNECTION#${connectionId}`,
      },
    })
  );

  if (!result.Item) {
    throw new Error('Connection not found');
  }

  const now = new Date().toISOString();

  // Update or remove note
  if (note === null || note === undefined || note.trim() === '') {
    // Remove note
    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: CONNECTIONS_TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `CONNECTION#${connectionId}`,
        },
        UpdateExpression: 'REMOVE note SET updatedAt = :now',
        ExpressionAttributeValues: {
          ':now': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );
    return updateResult.Attributes as Connection;
  } else {
    // Add or update note
    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: CONNECTIONS_TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `CONNECTION#${connectionId}`,
        },
        UpdateExpression: 'SET note = :note, updatedAt = :now',
        ExpressionAttributeValues: {
          ':note': note.trim(),
          ':now': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );
    return updateResult.Attributes as Connection;
  }
}
```

**Design Rationale:**
- Validates note length before database operation
- Verifies connection ownership through PK structure
- Uses DynamoDB's REMOVE operation to cleanly delete notes
- Trims whitespace to prevent storage of empty notes
- Updates the `updatedAt` timestamp for audit trail

### 4. Frontend Components

#### Type Definitions

Extend `frontend/src/types.ts`:

```typescript
export interface Connection {
  id: string;
  userId: string;
  connectedUserId: string;
  connectedUser?: PublicProfile;
  tags: string[];
  note?: string;  // NEW: Private note field
  createdAt: string;
  updatedAt: string;
}
```

#### GraphQL Mutations

Add to `frontend/src/graphql/mutations.ts`:

```typescript
export const updateConnectionNote = /* GraphQL */ `
  mutation UpdateConnectionNote($connectionId: ID!, $note: String) {
    updateConnectionNote(connectionId: $connectionId, note: $note) {
      id
      userId
      connectedUserId
      tags
      note
      createdAt
      updatedAt
    }
  }
`;
```

Update `frontend/src/graphql/queries.ts` to include `note` field:

```typescript
export const getMyConnections = /* GraphQL */ `
  query GetMyConnections {
    getMyConnections {
      id
      userId
      connectedUserId
      tags
      note  # NEW: Include note in query
      createdAt
      updatedAt
      connectedUser {
        id
        displayName
        gravatarHash
        contactLinks {
          id
          label
          url
          visible
        }
        badges {
          id
          name
          description
          threshold
          iconUrl
          earnedAt
        }
      }
    }
  }
`;
```

#### ConnectionDetail Component Enhancement

Extend `frontend/src/components/ConnectionDetail.tsx` to add a notes section:

**Component Structure:**
```
ConnectionDetail
├── Back Button
├── Header (Avatar + Name + Date)
├── Contact Links Section
├── Badges Section
├── Tags Section
└── Notes Section (NEW)
    ├── Textarea (editable)
    ├── Character Counter
    ├── Save Button
    └── Status Message
```

**Key Features:**
- Textarea with 1000 character limit
- Real-time character counter
- Auto-save on blur or manual save button
- Visual feedback for save success/failure
- Debounced save to prevent excessive API calls

#### ConnectionCard Component Enhancement

Add a visual indicator to `frontend/src/components/ConnectionCard.tsx`:

**Indicator Design:**
- Small note icon displayed when `connection.note` exists
- Positioned in the card header or corner
- Subtle styling to avoid visual clutter
- Only visible to the connection owner

## Data Flow

### Adding/Updating a Note

```
1. User types in note textarea
2. User clicks Save or textarea loses focus
3. Frontend validates length (≤1000 chars)
4. Frontend calls updateConnectionNote mutation
5. AppSync routes to connections Lambda
6. Lambda validates ownership and length
7. Lambda updates DynamoDB Connection item
8. Lambda returns updated Connection
9. Frontend updates local state
10. Frontend displays success message
```

### Deleting a Note

```
1. User clears textarea content
2. User clicks Save or textarea loses focus
3. Frontend calls updateConnectionNote with null/empty
4. Lambda removes note field from DynamoDB
5. Frontend updates local state
6. Note section shows empty state
```

### Loading Notes

```
1. User navigates to ConnectionDetail
2. Frontend calls getMyConnections query
3. Query includes note field
4. Connection data with note is returned
5. Note is displayed in textarea
```

## Error Handling

### Validation Errors

| Error Condition | Handling |
|----------------|----------|
| Note exceeds 1000 characters | Frontend: Prevent input beyond limit<br>Backend: Return validation error |
| Connection not found | Backend: Return 404 error<br>Frontend: Display error message |
| Unauthorized access | Backend: Verify userId matches PK<br>Frontend: Handle auth error |
| Network failure | Frontend: Display retry option<br>Backend: N/A |

### Error Messages

- **Character limit exceeded**: "Note must be 1000 characters or less"
- **Connection not found**: "Unable to update note. Connection not found."
- **Save failed**: "Failed to save note. Please try again."
- **Network error**: "Unable to connect. Please check your connection and try again."

## Testing Strategy

### Backend Testing

**Unit Tests (Optional):**
- Validate note length enforcement
- Verify note update logic
- Test note removal logic
- Confirm ownership validation

**Integration Tests (Optional):**
- Test full mutation flow through AppSync
- Verify DynamoDB updates
- Test error scenarios

### Frontend Testing

**Component Tests (Optional):**
- Render note textarea with existing note
- Character counter updates correctly
- Save button triggers mutation
- Error states display properly

**Manual Testing:**
- Add note to connection
- Edit existing note
- Delete note by clearing content
- Verify character limit enforcement
- Test save success/failure states
- Verify note privacy (not visible to other user)

## Security Considerations

### Privacy

- Notes are stored on the user's own Connection record
- DynamoDB key structure (`PK: USER#<userId>`) ensures isolation
- Lambda validates userId from Cognito token matches PK
- No API endpoint exposes notes from other users

### Data Validation

- Frontend enforces 1000 character limit
- Backend validates length as defense-in-depth
- Input is trimmed to prevent whitespace-only notes
- GraphQL schema uses String type (no special sanitization needed)

### Authorization

- AppSync uses Cognito User Pool authentication
- Lambda extracts userId from authenticated identity
- Connection ownership verified before any update
- No additional IAM policies required

## Performance Considerations

### Database Impact

- Notes stored as string attribute (minimal overhead)
- No additional GSI required
- No impact on existing query patterns
- Typical note size: 100-500 characters (negligible storage cost)

### Frontend Performance

- Debounce save operations (500ms delay)
- Optimistic UI updates for better UX
- No impact on connection list rendering
- Note indicator uses CSS (no image assets)

### API Efficiency

- Single mutation handles add/update/delete
- No additional round trips required
- Existing getMyConnections query includes notes
- No pagination concerns (notes are small)

## Future Enhancements

### Search Notes (Future Capability)

When implementing note search in the future:

**Approach 1: Client-Side Search**
- Filter connections in frontend based on note content
- Simple implementation, no backend changes
- Limited to loaded connections only

**Approach 2: DynamoDB Scan with Filter**
- Add scan operation to Lambda
- Filter on note attribute
- Works for small datasets (<10k connections)

**Approach 3: OpenSearch Integration**
- Index notes in OpenSearch
- Full-text search capabilities
- Best for large-scale deployments
- Requires additional infrastructure

**Recommendation**: Start with client-side search, migrate to OpenSearch if needed.

## Implementation Notes

### Backward Compatibility

- Existing Connection records without `note` field work unchanged
- Frontend handles missing `note` field gracefully
- No migration required for existing data

### Deployment Sequence

1. Update GraphQL schema
2. Deploy Lambda function changes
3. Deploy AppSync resolver
4. Deploy frontend changes
5. Test end-to-end flow

### Rollback Plan

- Frontend changes can be rolled back independently
- Backend changes are additive (no breaking changes)
- Existing functionality unaffected if rollback needed
