# Connection Approval System Design

## Overview

This design implements a connection approval system that replaces the current instant connection mechanism with a request-approval workflow. The system maintains backward compatibility with existing connections while introducing new data models and API endpoints for managing connection requests.

## Architecture

### High-Level Flow
1. **Request Initiation**: User A scans User B's QR code or visits their profile
2. **Request Creation**: System creates a `ConnectionRequest` record instead of immediate connection
3. **Notification**: User B sees pending request in their interface
4. **Approval/Denial**: User B approves or denies the request
5. **Connection Creation**: On approval, system creates bidirectional connections and awards badges

### Data Layer Changes

#### New DynamoDB Table: ConnectionRequests
- **Primary Key**: `PK = USER#{recipientUserId}`, `SK = REQUEST#{requestId}`
- **GSI1**: `GSI1PK = USER#{initiatorUserId}`, `GSI1SK = {createdAt}` (for outgoing requests)
- **Attributes**:
  - `id`: Unique request identifier
  - `initiatorUserId`: User who sent the request
  - `recipientUserId`: User who should approve/deny
  - `status`: `pending` | `approved` | `denied` | `cancelled`
  - `createdAt`: Timestamp
  - `updatedAt`: Timestamp
  - `actionedAt`: Timestamp when approved/denied (optional)

#### Modified Connection Creation Logic
- Current `createConnection` mutation becomes `createConnectionRequest`
- New `approveConnectionRequest` and `denyConnectionRequest` mutations
- Badge awarding and connection count updates moved to approval step

## Components and Interfaces

### Backend API Changes

#### GraphQL Schema Updates
```graphql
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
}

enum ConnectionRequestStatus {
  PENDING
  APPROVED
  DENIED
  CANCELLED
}

type ConnectionRequestResult {
  success: Boolean!
  message: String
  request: ConnectionRequest
}

# New Queries
extend type Query {
  getIncomingConnectionRequests: [ConnectionRequest!]!
  getOutgoingConnectionRequests: [ConnectionRequest!]!
  checkConnectionOrRequest(userId: ID!): ConnectionStatus!
}

type ConnectionStatus {
  isConnected: Boolean!
  hasPendingRequest: Boolean!
  requestDirection: String # "incoming" | "outgoing" | null
}

# New Mutations
extend type Mutation {
  createConnectionRequest(recipientUserId: ID!): ConnectionRequestResult!
  approveConnectionRequest(requestId: ID!): ConnectionRequestResult!
  denyConnectionRequest(requestId: ID!): ConnectionRequestResult!
  cancelConnectionRequest(requestId: ID!): ConnectionRequestResult!
}
```

#### Lambda Function Updates

**New Lambda: connection-requests/index.ts**
- Handles all connection request operations
- Validates request uniqueness and user existence
- Manages request lifecycle (create, approve, deny, cancel)
- Triggers connection creation on approval

**Modified Lambda: connections/index.ts**
- Remove direct `createConnection` public access
- Add internal `createApprovedConnection` function
- Maintain existing connection management functions

### Frontend UI Changes

#### ConnectButton Component Updates
- Replace "Connect" with "Send Request" when not connected
- Show "Request Sent" state for pending outgoing requests
- Show "Accept Request" for incoming requests
- Maintain "Already Connected" for existing connections

#### New Component: ConnectionRequestsManager
- Tabbed interface: "Incoming Requests" and "Outgoing Requests"
- Incoming: List with approve/deny buttons
- Outgoing: List with cancel option and status display
- Request counter badge in navigation

#### Dashboard Updates
- Add connection requests section
- Show pending request count
- Quick access to request management

#### Navigation Updates
- Add notification badge for pending incoming requests
- Update menu to include "Connection Requests" section

## Data Models

### ConnectionRequest Interface (Frontend)
```typescript
interface ConnectionRequest {
  id: string;
  initiatorUserId: string;
  recipientUserId: string;
  initiator?: PublicProfile;
  recipient?: PublicProfile;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  actionedAt?: string;
}

interface ConnectionStatus {
  isConnected: boolean;
  hasPendingRequest: boolean;
  requestDirection?: 'incoming' | 'outgoing';
}

interface ConnectionRequestResult {
  success: boolean;
  message?: string;
  request?: ConnectionRequest;
}
```

### Database Schema (DynamoDB)
```typescript
// ConnectionRequests Table
interface ConnectionRequestRecord {
  PK: string; // USER#{recipientUserId}
  SK: string; // REQUEST#{requestId}
  GSI1PK: string; // USER#{initiatorUserId}
  GSI1SK: string; // {createdAt}
  id: string;
  initiatorUserId: string;
  recipientUserId: string;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  actionedAt?: string;
}
```

## Error Handling

### Validation Rules
- Users cannot send requests to themselves
- Users cannot send duplicate requests
- Users cannot send requests to already connected users
- Only recipients can approve/deny requests
- Only initiators can cancel pending requests
- Requests must be in 'pending' status to be actionable

### Error Scenarios
- **User Not Found**: Return clear error message
- **Already Connected**: Redirect to connection management
- **Duplicate Request**: Show existing request status
- **Invalid Permissions**: Return authorization error
- **Concurrent Actions**: Handle race conditions gracefully

### Error Messages
- "User not found"
- "You are already connected with this user"
- "Connection request already sent"
- "Connection request not found"
- "You don't have permission to perform this action"

## Testing Strategy

### Unit Tests
- Connection request CRUD operations
- Request validation logic
- Status transition validation
- Permission checking

### Integration Tests
- End-to-end request approval flow
- Badge awarding after approval
- Connection count updates
- Concurrent request handling

### UI Tests
- Request sending flow
- Request management interface
- Status display accuracy
- Navigation and notifications

## Migration Strategy

### Backward Compatibility
- Existing connections remain unchanged
- Current connection management features continue working
- No data migration required for existing users

### Deployment Approach
1. Deploy new Lambda functions and DynamoDB table
2. Update GraphQL schema with new types and resolvers
3. Deploy frontend changes with feature flag
4. Gradually enable new flow for all users
5. Monitor and adjust based on usage patterns

### Rollback Plan
- Feature flag allows instant rollback to old flow
- New database table can be safely removed if needed
- No impact on existing connections or user data

## Performance Considerations

### Database Access Patterns
- **Incoming Requests**: Query by `PK = USER#{userId}` with `SK` prefix
- **Outgoing Requests**: Query GSI1 by `GSI1PK = USER#{userId}`
- **Request Lookup**: Direct get by `PK` and `SK`

### Caching Strategy
- Cache request counts in user interface
- Refresh on user actions and periodic intervals
- Use optimistic updates for better UX

### Scalability
- DynamoDB auto-scaling for request volume
- Lambda concurrency limits for request processing
- Connection request cleanup for old denied/cancelled requests

## Security Considerations

### Authorization
- Users can only view their own incoming/outgoing requests
- Only request recipients can approve/deny
- Only request initiators can cancel
- All operations require valid authentication

### Data Privacy
- Request data includes minimal user information
- No sensitive data stored in request records
- Audit trail maintained for request actions

### Rate Limiting
- Prevent spam requests from single users
- Implement reasonable request limits per time period
- Monitor for abuse patterns