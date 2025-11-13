# Implementation Plan

- [x] 1. Add GraphQL schema changes
  - Add `removeConnection` mutation to schema.graphql
  - Add `RemoveConnectionResult` type definition
  - _Requirements: 1.1, 1.5_

- [x] 2. Implement badge re-evaluation utilities
  - [x] 2.1 Create badge re-evaluation helper functions
    - Implement `removeInvalidThresholdBadges` function to filter badges based on connection count
    - Implement `reevaluateVIPBadge` function to check remaining VIP connections
    - Implement `reevaluateMakerBadge` function to check if maker connection still exists
    - Implement `reevaluateTriangleBadge` function to validate triangle integrity
    - Implement main `reevaluateBadges` function that orchestrates all badge checks
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 3. Implement removeConnection Lambda handler
  - [x] 3.1 Add connection validation and retrieval logic
    - Validate connectionId is provided
    - Retrieve connection record from DynamoDB
    - Verify connection belongs to the authenticated user
    - Extract connectedUserId for reciprocal deletion
    - _Requirements: 1.3, 1.4_

  - [x] 3.2 Implement connection deletion logic
    - Delete the user's connection record from DynamoDB
    - Query and delete the reciprocal connection record
    - Handle case where reciprocal connection is not found (log warning)
    - _Requirements: 1.1, 5.2, 5.5_

  - [x] 3.3 Implement connection count updates
    - Decrement connectionCount for the authenticated user
    - Decrement connectionCount for the connected user
    - Handle failures gracefully with error logging
    - _Requirements: 1.2, 5.3_

  - [x] 3.4 Integrate badge re-evaluation
    - Call reevaluateBadges for the authenticated user
    - Call reevaluateBadges for the connected user
    - Update user records with new badge lists
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.5 Add error handling and response
    - Return success response with appropriate message
    - Handle and return appropriate errors for edge cases
    - Implement duplicate request prevention
    - _Requirements: 1.5, 5.1, 5.4_

- [x] 4. Update frontend GraphQL mutations
  - Add removeConnection mutation to mutations.ts
  - Define TypeScript types for RemoveConnectionResult
  - _Requirements: 2.3_

- [x] 5. Add remove functionality to ConnectionCard component
  - [x] 5.1 Add remove button UI
    - Add delete/remove button to connection card
    - Style button as secondary action (subtle appearance)
    - Add appropriate icon (trash or X icon)
    - _Requirements: 2.1_

  - [x] 5.2 Implement confirmation dialog
    - Create confirmation dialog component or use existing modal
    - Display warning message about permanent deletion
    - Add "Cancel" and "Confirm" buttons
    - _Requirements: 2.2_

  - [x] 5.3 Implement remove action handler
    - Call removeConnection mutation with connectionId
    - Handle loading state during deletion
    - Update local state to remove connection from list on success
    - Display error message on failure
    - _Requirements: 2.3, 2.4, 2.5_

- [x] 6. Update ConnectionList component
  - Pass remove handler to ConnectionCard components
  - Handle connection list state updates after removal
  - Ensure proper re-rendering after deletion
  - _Requirements: 2.4_

- [x] 7. Add error handling and user feedback
  - Implement error message display for various failure scenarios
  - Add success notification after successful removal
  - Handle network errors with retry option
  - _Requirements: 2.5, 5.1_
