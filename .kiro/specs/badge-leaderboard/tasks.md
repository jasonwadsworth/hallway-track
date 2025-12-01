# Implementation Plan: Badge Leaderboard

-   [x] 1. Add badgeCount field and GSI to Users DynamoDB table

    -   Add badgeCount attribute to the Users table schema in CDK
    -   Add GSI3PK and GSI3SK attributes to the Users table schema
    -   Create ByBadgeCount GSI with GSI3PK as partition key and GSI3SK as sort key
    -   Configure GSI with on-demand billing mode
    -   _Requirements: 1.2, 3.2, 5.1_

-   [x] 2. Create migration Lambda to populate badge count fields for existing users

    -   Create Lambda function at `infrastructure/lambda/badge-leaderboard-migration/index.ts`
    -   Implement scan of all users in Users table
    -   Count badges array length for each user
    -   Calculate GSI3PK and GSI3SK for each user based on badgeCount
    -   Use batch write operations for efficiency
    -   Add progress logging and error handling
    -   _Requirements: 3.2_

-   [x] 3. Update badge handlers to maintain badge count

    -   [x] 3.1 Update unified badge handler to increment badgeCount

        -   Modify badge handler to update badgeCount when awarding badges
        -   Update GSI3PK and GSI3SK when badgeCount changes
        -   Calculate inverted, zero-padded count for GSI3SK
        -   _Requirements: 3.1, 3.2_

    -   [ ]\* 3.2 Write property test for badge count update
        -   **Property 7: Badge count increments when badges are earned**
        -   **Validates: Requirements 3.1**
        -   Generate random users and badge awards
        -   Verify badgeCount increments correctly
        -   Configure test to run 100 iterations

-   [x] 4. Implement badge leaderboard Lambda function

    -   [x] 4.1 Create Lambda function structure

        -   Create function at `infrastructure/lambda/badge-leaderboard/index.ts`
        -   Define TypeScript interfaces for input/output
        -   Set up DynamoDB client configuration
        -   _Requirements: 1.2, 2.1, 2.2_

    -   [x] 4.2 Implement main badge leaderboard query

        -   Query ByBadgeCount GSI with BADGE_LEADERBOARD partition key
        -   Apply limit and pagination using nextToken
        -   Filter out users with zero badges
        -   Map DynamoDB items to BadgeLeaderboardEntry format
        -   _Requirements: 1.2, 1.3, 1.6_

    -   [x] 4.3 Implement rank calculation logic

        -   Calculate ranks for returned entries
        -   Handle ties by assigning same rank to users with same badge count
        -   _Requirements: 1.3, 1.4_

    -   [x] 4.4 Implement current user identification

        -   Mark current user's entry with isCurrentUser flag
        -   Query for current user's rank if not in top results
        -   Populate currentUserEntry when user is outside displayed range
        -   Handle case where current user has zero badges
        -   _Requirements: 2.1, 2.2, 2.3_

    -   [x] 4.5 Add error handling and validation

        -   Validate limit parameter (1-100 range)
        -   Handle invalid nextToken
        -   Implement retry logic for DynamoDB throttling
        -   Handle edge cases (empty leaderboard, single user)
        -   _Requirements: 1.2, 5.2_

    -   [ ]\* 4.6 Write property-based tests for badge leaderboard Lambda

        -   [ ]\* 4.6.1 Property test: Badge leaderboard sorting

            -   **Property 1: Badge leaderboard entries are sorted by badge count in descending order**
            -   **Validates: Requirements 1.2**
            -   Generate random sets of users with varying badge counts
            -   Query leaderboard and verify descending order
            -   Configure test to run 100 iterations

        -   [ ]\* 4.6.2 Property test: Required fields presence

            -   **Property 2: All badge leaderboard entries contain required fields**
            -   **Validates: Requirements 1.3**
            -   Generate random users and query leaderboard
            -   Verify all entries have rank, userId, displayName, gravatarHash, badgeCount
            -   Configure test to run 100 iterations

        -   [ ]\* 4.6.3 Property test: Tie-breaking behavior

            -   **Property 3: Users with identical badge counts receive identical ranks**
            -   **Validates: Requirements 1.4**
            -   Generate users with duplicate badge counts
            -   Verify users with same count have same rank
            -   Configure test to run 100 iterations

        -   [ ]\* 4.6.4 Property test: Zero badge exclusion

            -   **Property 4: Badge leaderboard excludes users with zero badges**
            -   **Validates: Requirements 1.6**
            -   Generate random user sets including zero-badge users
            -   Verify no entries have badgeCount === 0
            -   Configure test to run 100 iterations

        -   [ ]\* 4.6.5 Property test: Current user identification

            -   **Property 5: Current user is correctly identified in badge leaderboard results**
            -   **Validates: Requirements 2.1**
            -   Generate random leaderboards where current user appears
            -   Verify exactly one entry has isCurrentUser === true with correct userId
            -   Configure test to run 100 iterations

        -   [ ]\* 4.6.6 Property test: Current user entry population

            -   **Property 6: Current user entry is provided when not in top badge results**
            -   **Validates: Requirements 2.2**
            -   Generate scenarios where current user is outside top N
            -   Verify currentUserEntry is populated with correct rank and count
            -   Configure test to run 100 iterations

        -   [ ]\* 4.6.7 Property test: Data consistency
            -   **Property 8: Badge leaderboard data reflects current database state**
            -   **Validates: Requirements 3.2**
            -   Generate random users in database
            -   Query leaderboard and verify badgeCount matches database
            -   Configure test to run 100 iterations

    -   [ ]\* 4.7 Write unit tests for badge leaderboard Lambda
        -   Test empty badge leaderboard scenario
        -   Test single user scenario
        -   Test pagination boundaries
        -   Test rank calculation with ties
        -   Test current user highlighting
        -   Test error handling for invalid inputs

-   [x] 5. Add GraphQL schema and resolver

    -   [x] 5.1 Update GraphQL schema

        -   Add BadgeLeaderboardEntry type definition
        -   Add BadgeLeaderboardResult type definition
        -   Add getBadgeLeaderboard query to Query type
        -   _Requirements: 1.2, 1.3, 2.1, 2.2_

    -   [x] 5.2 Create AppSync resolver

        -   Add Lambda data source for badge leaderboard function
        -   Create resolver for getBadgeLeaderboard query
        -   _Requirements: 1.2, 5.1_

    -   [x] 5.3 Update CDK infrastructure
        -   Add badge leaderboard Lambda to stack
        -   Grant DynamoDB read permissions on Users table and GSI
        -   Wire up AppSync data source and resolver
        -   _Requirements: 1.2, 5.1_

-   [x] 6. Checkpoint - Ensure all tests pass

    -   Ensure all tests pass, ask the user if questions arise.

-   [x] 7. Implement frontend badge leaderboard component

    -   [x] 7.1 Create TypeScript types

        -   Add BadgeLeaderboardEntry interface to types.ts
        -   Add BadgeLeaderboardResult interface to types.ts
        -   _Requirements: 1.2, 1.3_

    -   [x] 7.2 Create GraphQL query

        -   Add getBadgeLeaderboard query to queries.ts
        -   Include all required fields in query
        -   _Requirements: 1.2, 1.3_

    -   [x] 7.3 Update Leaderboard component with tabs

        -   Add tab state to switch between connections and badges
        -   Create tab UI with connection and badge options
        -   Maintain consistent styling between tabs
        -   _Requirements: 6.1, 6.2_

    -   [x] 7.4 Create BadgeLeaderboard component

        -   Create badge leaderboard data fetching logic
        -   Display ranked list of users by badge count
        -   Show rank, display name, profile picture, and badge count
        -   Highlight current user's entry
        -   Display current user's rank separately if not in top results
        -   Handle loading and error states
        -   _Requirements: 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

    -   [x] 7.5 Create BadgeLeaderboardEntry component

        -   Display user rank, name, picture, and badge count
        -   Make entry clickable to navigate to profile
        -   Apply visual highlighting for current user
        -   _Requirements: 1.3, 2.1, 4.1, 4.2_

    -   [x] 7.6 Add styling

        -   Update Leaderboard.css for tabs
        -   Style badge leaderboard entries
        -   Implement responsive design
        -   Add visual indicators for clickable entries
        -   Style current user highlighting
        -   _Requirements: 1.2, 4.2, 6.2_

    -   [x] 7.7 Add navigation integration
        -   Implement click handler to navigate to user profiles from badge leaderboard
        -   _Requirements: 4.1_

-   [ ]\* 7.8 Write unit tests for frontend components

    -   Test Leaderboard tab switching
    -   Test BadgeLeaderboard component rendering
    -   Test BadgeLeaderboardEntry component rendering
    -   Test current user highlighting
    -   Test navigation on entry click
    -   Test loading and error states

-   [x] 8. Final Checkpoint - Ensure all tests pass
    -   Ensure all tests pass, ask the user if questions arise.
