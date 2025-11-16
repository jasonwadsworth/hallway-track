# Implementation Plan

- [x] 1. Extend GraphQL schema with metadata fields
  - Add `initiatorNote` and `initiatorTags` fields to ConnectionRequest type
  - Update `createConnectionRequest` mutation to accept `note` and `tags` parameters
  - Add new `updateConnectionRequestMetadata` mutation
  - Update queries to include metadata fields in response
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 4.1, 4.2_

- [x] 2. Update backend Lambda to handle metadata
  - [x] 2.1 Modify createConnectionRequest to accept and store metadata
    - Add note and tags parameters to function signature
    - Validate note length (max 1000 characters)
    - Validate tag format using existing tag validation rules
    - Store initiatorNote and initiatorTags in ConnectionRequest record
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Implement updateConnectionRequestMetadata handler
    - Create new handler function for metadata updates
    - Verify request belongs to authenticated user (initiator only)
    - Verify request status is PENDING
    - Validate note length and tag format
    - Update initiatorNote and initiatorTags fields
    - Return updated request
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 2.3 Implement metadata transfer logic on approval
    - Create transferMetadataToConnection helper function
    - Query for initiator's connection record after creation
    - Transfer initiatorNote to connection's note field
    - Transfer initiatorTags to connection's tags field
    - Handle transfer failure gracefully (log error, don't block connection)
    - Call transfer function in approveConnectionRequest after connection creation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.4 Ensure metadata privacy in API responses
    - Filter metadata fields based on authenticated user
    - Only include initiatorNote and initiatorTags when user is the initiator
    - Exclude metadata from recipient's view of incoming requests
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 3. Update frontend types and GraphQL operations
  - [x] 3.1 Extend TypeScript interfaces
    - Add initiatorNote and initiatorTags to ConnectionRequest interface
    - Create CreateConnectionRequestInput type
    - Create UpdateConnectionRequestMetadataInput type
    - _Requirements: 1.1, 2.1, 4.1_

  - [x] 3.2 Update GraphQL mutations
    - Modify createConnectionRequest mutation to include note and tags parameters
    - Add updateConnectionRequestMetadata mutation
    - Update getOutgoingConnectionRequests query to include metadata fields
    - _Requirements: 1.1, 2.1, 4.1_

- [x] 4. Create ConnectionRequestModal component
  - [x] 4.1 Build modal structure and layout
    - Create new ConnectionRequestModal component
    - Add modal header with recipient info (name, avatar)
    - Add notes section with label and textarea
    - Add tags section with label and tag input
    - Add action buttons (Cancel, Send Request)
    - Style modal to match existing design patterns
    - _Requirements: 1.1, 2.1_

  - [x] 4.2 Implement note input with character limit
    - Add textarea with 1000 character maxLength
    - Implement real-time character counter
    - Display counter as "X/1000 characters"
    - Disable send button if note exceeds limit
    - _Requirements: 1.2, 1.5_

  - [x] 4.3 Implement tag input functionality
    - Reuse TagManager component logic for tag input
    - Allow adding multiple tags
    - Support tag removal
    - Validate tag format
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 4.4 Wire up mutation and handle submission
    - Call createConnectionRequest mutation with note and tags
    - Show loading state during submission
    - Display success message on completion
    - Display error message on failure
    - Close modal on success
    - _Requirements: 1.3, 1.4, 2.3, 2.4_

- [x] 5. Update ConnectButton to use modal
  - Replace direct mutation call with modal trigger
  - Open ConnectionRequestModal when user clicks "Connect"
  - Pass recipient user info to modal
  - Handle modal close events
  - Maintain backward compatibility for existing connection flow
  - _Requirements: 1.1, 2.1_

- [x] 6. Add metadata editing to outgoing requests
  - [x] 6.1 Display metadata in outgoing requests list
    - Show initiatorNote in request card if present
    - Show initiatorTags in request card if present
    - Add visual indicator for requests with metadata
    - _Requirements: 4.1_

  - [x] 6.2 Implement edit functionality
    - Add "Edit" button to each outgoing request card
    - Open modal with current note and tags pre-filled
    - Reuse ConnectionRequestModal component for editing
    - Call updateConnectionRequestMetadata mutation on save
    - Update local state with new metadata
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [x] 7. Verify metadata transfer and cleanup
  - [x] 7.1 Test metadata transfer on approval
    - Create connection request with note and tags
    - Approve request as recipient
    - Verify initiator's connection has note and tags
    - Verify recipient's connection has no metadata
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 7.2 Test metadata cleanup on denial/cancellation
    - Create connection request with metadata
    - Deny request as recipient
    - Verify request and metadata are deleted
    - Create another request with metadata
    - Cancel request as initiator
    - Verify request and metadata are deleted
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 7.3 Test metadata privacy
    - Create connection request with note and tags
    - View incoming request as recipient
    - Verify metadata is not visible to recipient
    - Verify API does not expose metadata to recipient
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 8. Handle edge cases and error scenarios
  - Test request creation without metadata (backward compatibility)
  - Test note at exactly 1000 characters
  - Test note exceeding 1000 characters (should be rejected)
  - Test empty note and tags (should work)
  - Test editing metadata on non-pending request (should fail)
  - Test editing metadata as non-initiator (should fail)
  - Test metadata transfer failure (connection should still be created)
  - _Requirements: 1.4, 1.5, 2.4, 2.5, 3.5, 4.4, 4.5_
