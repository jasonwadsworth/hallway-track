# Implementation Plan: Connection Leaderboard

-   [x] 1. Add GSI to Users DynamoDB table

    -   Add GSI2PK and GSI2SK attributes to the Users table schema in CDK
    -   Create ByConnectionCount GSI with GSI2PK as partition key and GSI2SK as sort key
    -   Configure GSI with on-demand billing mode
    -   Deploy infrastructure changes
    -   _Requirements: 1.1, 3.3, 5.1_

-   [x] 2. Create migration Lambda to populate GSI fields for existing users

    -   Create Lambda function at `infrastructure/lambda/leaderboard-migration/index.ts`
    -   Implement scan of all users in Users table
    -   Calculate GSI2PK and GSI2SK for each user based on connectionCount
    -   Use batch write operations for efficiency
    -   Add progress logging and error handling
    -   _Requirements: 3.3_

-   [x] 3. Update connection count management to maintain GSI fields

    -   [x] 3.1 Update connection request approved handler

        -   Modify event handler to update GSI2PK and GSI2SK when incrementing connectionCount
        -   Calculate inverted, zero-padded count for GSI2SK
        -   _Requirements: 3.1, 3.3_

    -   [x] 3.2 Update connection removed handler
        -   Modify event handler to update GSI2PK and GSI2SK when decrementing connectionCount
        -   Calculate inverted, zero-padded count for GSI2SK
        -   _Requirements: 3.2, 3.3_

-   [x] 4. Implement leaderboard Lambda function

    -   [x] 4.1 Create Lambda function structure

        -   Create function at `infrastructure/lambda/leaderboard/index.ts`
        -   Define TypeScript interfaces for input/output
        -   Set up DynamoDB client configuration
        -   _Requirements: 1.1, 2.1, 2.2_

    -   [x] 4.2 Implement main leaderboard query

        -   Query ByConnectionCount GSI with LEADERBOARD partition key
        -   Apply limit and pagination using nextToken
        -   Filter out users with zero connections
        -   Map DynamoDB items to LeaderboardEntry format
        -   _Requirements: 1.1, 1.2, 1.5_

    -   [x] 4.3 Implement rank calculation logic

        -   Calculate ranks for returned entries
        -   Handle ties by assigning same rank to users with same connection count
        -   _Requirements: 1.2, 1.3_

    -   [x] 4.4 Implement current user identification

        -   Mark current user's entry with isCurrentUser flag
        -   Query for current user's rank if not in top results
        -   Populate currentUserEntry when user is outside displayed range
        -   Handle case where current user has zero connections
        -   _Requirements: 2.1, 2.2, 2.3_

    -   [x] 4.5 Add error handling and validation
        -   Validate limit parameter (1-100 range)
        -   Handle invalid nextToken
        -   Implement retry logic for DynamoDB throttling
        -   Handle edge cases (empty leaderboard, single user)
        -   _Requirements: 1.1, 5.2_

-   [ ]\* 4.6 Write property-based tests for leaderboard Lambda

    -   [ ]\* 4.6.1 Property test: Leaderboard sorting

        -   **Property 1: Leaderboard entries are sorted by connection count in descending order**
        -   **Validates: Requirements 1.1**
        -   Generate random sets of users with varying connection counts
        -   Query leaderboard and verify descending order
        -   Configure test to run 100 iterations

    -   [ ]\* 4.6.2 Property test: Required fields presence

        -   **Property 2: All leaderboard entries contain required fields**
        -   **Validates: Requirements 1.2**
        -   Generate random users and query leaderboard
        -   Verify all entries have rank, userId, displayName, gravatarHash, connectionCount
        -   Configure test to run 100 iterations

    -   [ ]\* 4.6.3 Property test: Tie-breaking behavior

        -   **Property 3: Users with identical connection counts receive identical ranks**
        -   **Validates: Requirements 1.3**
        -   Generate users with duplicate connection counts
        -   Verify users with same count have same rank
        -   Configure test to run 100 iterations

    -   [ ]\* 4.6.4 Property test: Zero connection exclusion

        -   **Property 4: Leaderboard excludes users with zero connections**
        -   **Validates: Requirements 1.5**
        -   Generate random user sets including zero-connection users
        -   Verify no entries have connectionCount === 0
        -   Configure test to run 100 iterations

    -   [ ]\* 4.6.5 Property test: Current user identification

        -   **Property 5: Current user is correctly identified in results**
        -   **Validates: Requirements 2.1**
        -   Generate random leaderboards where current user appears
        -   Verify exactly one entry has isCurrentUser === true with correct userId
        -   Configure test to run 100 iterations

    -   [ ]\* 4.6.6 Property test: Current user entry population

        -   **Property 6: Current user entry is provided when not in top results**
        -   **Validates: Requirements 2.2**
        -   Generate scenarios where current user is outside top N
        -   Verify currentUserEntry is populated with correct rank and count
        -   Configure test to run 100 iterations

    -   [ ]\* 4.6.7 Property test: Data consistency
        -   **Property 7: Leaderboard data reflects current database state**
        -   **Validates: Requirements 3.3**
        -   Generate random users in database
        -   Query leaderboard and verify connectionCount matches database
        -   Configure test to run 100 iterations

-   [ ]\* 4.7 Write unit tests for leaderboard Lambda

    -   Test empty leaderboard scenario
    -   Test single user scenario
    -   Test pagination boundaries
    -   Test rank calculation with ties
    -   Test current user highlighting
    -   Test error handling for invalid inputs

-   [x] 5. Add GraphQL schema and resolver

    -   [x] 5.1 Update GraphQL schema

        -   Add LeaderboardEntry type definition
        -   Add LeaderboardResult type definition
        -   Add getLeaderboard query to Query type
        -   _Requirements: 1.1, 1.2, 2.1, 2.2_

    -   [x] 5.2 Create AppSync resolver

        -   Add Lambda data source for leaderboard function
        -   Create resolver for getLeaderboard query
        -   Configure caching with 60-second TTL
        -   _Requirements: 1.1, 5.3_

    -   [x] 5.3 Update CDK infrastructure
        -   Add leaderboard Lambda to stack
        -   Grant DynamoDB read permissions on Users table and GSI
        -   Wire up AppSync data source and resolver
        -   _Requirements: 1.1, 5.1_

-   [x] 6. Implement frontend leaderboard component

    -   [x] 6.1 Create TypeScript types

        -   Add LeaderboardEntry interface to types.ts
        -   Add LeaderboardResult interface to types.ts
        -   _Requirements: 1.1, 1.2_

    -   [x] 6.2 Create GraphQL query

        -   Add getLeaderboard query to queries.ts
        -   Include all required fields in query
        -   _Requirements: 1.1, 1.2_

    -   [x] 6.3 Create Leaderboard component

        -   Create Leaderboard.tsx component
        -   Implement data fetching using GraphQL query
        -   Display ranked list of users
        -   Show rank, display name, profile picture, and connection count
        -   Highlight current user's entry
        -   Display current user's rank separately if not in top results
        -   Handle loading and error states
        -   _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

    -   [x] 6.4 Create LeaderboardEntry component

        -   Create LeaderboardEntry.tsx component
        -   Display user rank, name, picture, and connection count
        -   Make entry clickable to navigate to profile
        -   Apply visual highlighting for current user
        -   _Requirements: 1.2, 2.1, 4.1, 4.2_

    -   [x] 6.5 Add styling

        -   Create Leaderboard.css for main component
        -   Create LeaderboardEntry.css for entry component
        -   Implement responsive design
        -   Add visual indicators for clickable entries
        -   Style current user highlighting
        -   _Requirements: 1.1, 4.2_

    -   [x] 6.6 Add navigation integration
        -   Add leaderboard route to App.tsx
        -   Add leaderboard link to navigation menu
        -   Implement click handler to navigate to user profiles
        -   _Requirements: 4.1_

-   [ ]\* 6.7 Write unit tests for frontend components

    -   Test Leaderboard component rendering
    -   Test LeaderboardEntry component rendering
    -   Test current user highlighting
    -   Test navigation on entry click
    -   Test loading and error states

-   [x] 7. Checkpoint - Ensure all tests pass
    -   Ensure all tests pass, ask the user if questions arise.
