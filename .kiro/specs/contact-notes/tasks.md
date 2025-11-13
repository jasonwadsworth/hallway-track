# Implementation Plan

- [x] 1. Update GraphQL schema and type definitions
  - Add `note` field to Connection type in GraphQL schema
  - Add `updateConnectionNote` mutation to schema
  - Update frontend TypeScript Connection interface to include optional `note` field
  - _Requirements: 1.1, 1.2, 2.1, 3.1_

- [x] 2. Implement backend note management
  - [x] 2.1 Add updateConnectionNote handler to connections Lambda
    - Implement note validation (1000 character limit)
    - Implement note update logic with DynamoDB UpdateCommand
    - Implement note removal logic when note is empty/null
    - Verify connection ownership before updates
    - _Requirements: 1.2, 1.3, 2.2, 3.2, 3.3_

  - [x] 2.2 Update Lambda handler routing
    - Add case for 'updateConnectionNote' field name in main handler
    - Wire up the new function to AppSync resolver
    - _Requirements: 1.2, 2.2_

  - [x] 2.3 Create AppSync resolver for updateConnectionNote
    - Configure resolver to use connections Lambda data source
    - _Requirements: 1.2, 2.2_

- [x] 3. Update frontend GraphQL operations
  - Add `updateConnectionNote` mutation to mutations.ts
  - Update `getMyConnections` query to include `note` field
  - _Requirements: 1.1, 2.1, 2.4_

- [x] 4. Implement notes UI in ConnectionDetail component
  - [x] 4.1 Add notes section to ConnectionDetail component
    - Create textarea for note input with 1000 character limit
    - Implement character counter display
    - Add save button with loading state
    - Display existing note content when available
    - _Requirements: 1.1, 2.1_

  - [x] 4.2 Implement note save functionality
    - Call updateConnectionNote mutation on save
    - Handle empty note as deletion
    - Update local connection state on success
    - Display success confirmation message
    - _Requirements: 1.2, 1.4, 2.2, 2.3_

  - [x] 4.3 Implement error handling
    - Display error messages for failed saves
    - Handle character limit validation
    - Handle network errors with retry option
    - _Requirements: 1.5_

  - [x] 4.4 Add CSS styling for notes section
    - Style textarea, character counter, and save button
    - Ensure responsive design
    - Add visual feedback for save states
    - _Requirements: 1.1_

- [x] 5. Add note indicator to ConnectionCard component
  - Add visual indicator (icon) when connection has a note
  - Style indicator to be subtle and non-intrusive
  - Ensure indicator only shows for connections with notes
  - _Requirements: 4.1, 4.2, 4.3_
