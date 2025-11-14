# Implementation Plan

- [x] 1. Set up database schema and infrastructure
  - Create DynamoDB table for ConnectionRequests with proper indexes
  - Update CDK infrastructure to include new table and permissions
  - Configure Lambda environment variables for new table
  - _Requirements: 1.2, 2.1, 3.1_

- [ ] 2. Update GraphQL schema and types
  - [x] 2.1 Add ConnectionRequest type and enums to GraphQL schema
    - Define ConnectionRequest, ConnectionRequestStatus, ConnectionStatus types
    - Add ConnectionRequestResult type for mutation responses
    - _Requirements: 1.1, 2.1, 3.1_

  - [x] 2.2 Add new queries to GraphQL schema
    - Add getIncomingConnectionRequests query
    - Add getOutgoingConnectionRequests query
    - Add checkConnectionOrRequest query to replace checkConnection
    - _Requirements: 2.1, 3.1, 4.1_

  - [x] 2.3 Add new mutations to GraphQL schema
    - Add createConnectionRequest mutation
    - Add approveConnectionRequest mutation
    - Add denyConnectionRequest mutation
    - Add cancelConnectionRequest mutation
    - _Requirements: 1.1, 2.2, 2.3, 3.3_

- [ ] 3. Implement connection request Lambda function
  - [ ] 3.1 Create connection-requests Lambda function structure
    - Set up TypeScript interfaces for ConnectionRequest data models
    - Implement request handler with routing for different operations
    - Add DynamoDB client configuration and helper functions
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 3.2 Implement createConnectionRequest functionality
    - Validate recipient user exists and is not the same as initiator
    - Check for existing connections and duplicate requests
    - Create new ConnectionRequest record in DynamoDB
    - Return success response with request details
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 3.3 Implement request approval functionality
    - Validate request exists and user has permission to approve
    - Update request status to approved
    - Call internal connection creation function
    - Award badges and update connection counts
    - _Requirements: 2.2, 2.4, 5.1, 5.2_

  - [ ] 3.4 Implement request denial and cancellation
    - Add denyConnectionRequest function with permission validation
    - Add cancelConnectionRequest function for initiators
    - Update request status and set actionedAt timestamp
    - _Requirements: 2.3, 3.3_

  - [ ] 3.5 Implement request query functions
    - Add getIncomingConnectionRequests with user profile fetching
    - Add getOutgoingConnectionRequests with status tracking
    - Add checkConnectionOrRequest to replace existing checkConnection
    - _Requirements: 2.1, 3.1, 3.2, 4.3_

- [ ] 4. Update existing connections Lambda function
  - [x] 4.1 Refactor connection creation logic
    - Extract connection creation into internal function
    - Remove public access to createConnection mutation
    - Maintain existing connection management functions (remove, tag, note)
    - _Requirements: 5.1, 5.3_

  - [x] 4.2 Update connection validation logic
    - Modify checkConnection to work with new checkConnectionOrRequest
    - Ensure backward compatibility with existing connection queries
    - _Requirements: 5.3, 5.4_

- [x] 5. Update frontend TypeScript types
  - Add ConnectionRequest, ConnectionStatus, ConnectionRequestResult interfaces
  - Update existing types to support new request-based workflow
  - Add status enums for request states
  - _Requirements: 1.1, 2.1, 3.1_

- [ ] 6. Create new GraphQL queries and mutations (frontend)
  - [x] 6.1 Add connection request queries
    - Create getIncomingConnectionRequests query
    - Create getOutgoingConnectionRequests query
    - Create checkConnectionOrRequest query
    - _Requirements: 2.1, 3.1, 4.1_

  - [x] 6.2 Add connection request mutations
    - Create createConnectionRequest mutation
    - Create approveConnectionRequest mutation
    - Create denyConnectionRequest mutation
    - Create cancelConnectionRequest mutation
    - _Requirements: 1.1, 2.2, 2.3, 3.3_

- [ ] 7. Update ConnectButton component
  - [x] 7.1 Modify connection status checking
    - Replace checkConnection with checkConnectionOrRequest
    - Handle new connection status states (connected, pending request, no relationship)
    - _Requirements: 1.4, 2.1, 4.1_

  - [x] 7.2 Update button behavior and display
    - Show "Send Request" for users with no connection or request
    - Show "Request Sent" for outgoing pending requests with cancel option
    - Show "Accept Request" for incoming pending requests
    - Maintain "Already Connected" for existing connections
    - _Requirements: 1.1, 2.2, 3.1_

- [ ] 8. Create ConnectionRequestsManager component
  - [x] 8.1 Build incoming requests interface
    - Create list view for incoming connection requests
    - Add approve and deny buttons for each request
    - Show requester profile information (name, avatar)
    - Handle loading and error states
    - _Requirements: 2.1, 2.2, 2.3, 4.2, 4.3_

  - [x] 8.2 Build outgoing requests interface
    - Create list view for sent connection requests
    - Show request status (pending, approved, denied)
    - Add cancel option for pending requests
    - Display recipient information
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 8.3 Add tabbed interface and navigation
    - Implement tab switching between incoming and outgoing requests
    - Add request count badges to tabs
    - Handle empty states with helpful messaging
    - _Requirements: 4.1, 4.2_

- [ ] 9. Update Dashboard component
  - [x] 9.1 Add connection requests section
    - Display count of pending incoming requests
    - Add quick link to connection requests management
    - Show recent request activity
    - _Requirements: 4.1, 4.2_

  - [x] 9.2 Update recent connections display
    - Ensure existing connection display continues working
    - Add visual distinction between connections and requests
    - _Requirements: 5.3_

- [ ] 10. Update navigation and routing
  - [x] 10.1 Add connection requests route
    - Create new route for /connection-requests
    - Add navigation menu item with notification badge
    - Update routing configuration
    - _Requirements: 4.1, 4.2_

  - [x] 10.2 Add notification badge for pending requests
    - Implement request count fetching and display
    - Update badge count when requests are processed
    - Add visual indicator in navigation menu
    - _Requirements: 4.1_

- [ ]* 11. Add comprehensive error handling
  - Implement error handling for all new API calls
  - Add user-friendly error messages for common scenarios
  - Handle network errors and loading states gracefully
  - _Requirements: 1.4, 2.4, 3.4, 5.5_

- [ ]* 12. Write unit tests for backend functions
  - Test connection request creation, approval, denial, and cancellation
  - Test validation logic and error scenarios
  - Test permission checking and authorization
  - _Requirements: 1.3, 2.2, 2.3, 3.3_

- [ ]* 13. Write integration tests for request workflow
  - Test end-to-end request approval flow
  - Test badge awarding and connection count updates after approval
  - Test concurrent request handling scenarios
  - _Requirements: 5.1, 5.2_