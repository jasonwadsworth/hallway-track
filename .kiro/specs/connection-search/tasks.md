# Implementation Plan

-   [x] 1. Create fuzzy matching module

    -   [x] 1.1 Implement Levenshtein distance function for edit distance calculation
        -   Create utility function that calculates edit distance between two strings
        -   Handle case-insensitive comparison
        -   _Requirements: 1.3_
    -   [ ]\* 1.2 Write property test for Levenshtein distance
        -   **Property: Edit distance is symmetric and non-negative**
        -   Test that distance(a, b) === distance(b, a) and distance >= 0
    -   [x] 1.3 Implement fuzzy match function
        -   Create function that determines if query matches text (exact, substring, or within edit distance threshold)
        -   Return match type (exact, substring, fuzzy) and base score
        -   _Requirements: 1.1, 1.2, 1.3_
    -   [ ]\* 1.4 Write property test for fuzzy matching
        -   **Feature: connection-search, Property 1: Name search returns fuzzy matches**
        -   **Validates: Requirements 1.1, 1.2, 1.3**

-   [x] 2. Create scoring module

    -   [x] 2.1 Implement field scoring function
        -   Calculate score based on match type (exact=1.0, substring=0.8, fuzzy=0.6)
        -   Apply field weight multipliers (name=1.0, tag=0.9, note=0.7)
        -   _Requirements: 4.1, 4.3_
    -   [x] 2.2 Implement combined scoring function
        -   Combine scores from multiple field matches
        -   Add bonus for multi-field matches (0.1 per additional field)
        -   _Requirements: 4.2_
    -   [ ]\* 2.3 Write property tests for scoring
        -   **Feature: connection-search, Property 5: Multi-field matches rank higher than single-field matches**
        -   **Validates: Requirements 4.2**
        -   **Feature: connection-search, Property 6: Exact matches rank higher than fuzzy matches**
        -   **Validates: Requirements 4.3**

-   [ ] 3. Checkpoint - Make sure all tests are passing

    -   Ensure all tests pass, ask the user if questions arise.

-   [x] 4. Implement connection search Lambda function

    -   [x] 4.1 Create Lambda handler structure
        -   Set up Lambda function in infrastructure/lambda/connection-search/
        -   Configure DynamoDB client and table access
        -   _Requirements: 6.1_
    -   [x] 4.2 Implement connection fetching logic
        -   Query user's connections from DynamoDB
        -   Fetch connected user profiles to get display names
        -   _Requirements: 1.1, 2.1, 3.1_
    -   [x] 4.3 Implement search logic
        -   Apply fuzzy matching to each connection (name, tags, note)
        -   Calculate combined scores
        -   Sort results by score descending
        -   Handle empty query case (return all connections)
        -   _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_
    -   [ ]\* 4.4 Write property tests for search logic
        -   **Feature: connection-search, Property 2: Tag search returns all matching connections**
        -   **Validates: Requirements 2.1, 2.2**
        -   **Feature: connection-search, Property 3: Note search returns fuzzy matches**
        -   **Validates: Requirements 3.1, 3.2**
        -   **Feature: connection-search, Property 4: Results are ordered by descending score**
        -   **Validates: Requirements 4.1**
        -   **Feature: connection-search, Property 7: Empty query returns all connections**
        -   **Validates: Requirements 5.1, 5.2**

-   [x] 5. Update GraphQL schema and AppSync configuration

    -   [x] 5.1 Add new types to GraphQL schema
        -   Add ConnectionSearchResult type
        -   Add SearchConnectionsResult type
        -   Add searchMyConnections query
        -   _Requirements: 6.2_
    -   [x] 5.2 Create AppSync resolver for searchMyConnections
        -   Configure Lambda resolver for the new query
        -   Set up proper authorization (user must be authenticated)
        -   _Requirements: 6.1_

-   [x] 6. Update CDK stack

    -   [x] 6.1 Add connection-search Lambda to CDK stack
        -   Create Lambda function construct
        -   Grant DynamoDB read permissions for connections and users tables
        -   _Requirements: 6.1_
    -   [x] 6.2 Wire up AppSync resolver to Lambda
        -   Create data source for Lambda
        -   Attach resolver to searchMyConnections query
        -   _Requirements: 6.1, 6.2_

-   [ ] 7. Checkpoint - Make sure all tests are passing

    -   Ensure all tests pass, ask the user if questions arise.

-   [x] 8. Update frontend

    -   [x] 8.1 Add GraphQL query for search
        -   Add searchMyConnections query to frontend/src/graphql/queries.ts
        -   Add TypeScript types for search results
        -   _Requirements: 6.2_
    -   [x] 8.2 Add search input to ConnectionList component
        -   Add search input field with debounced onChange
        -   Call searchMyConnections when query changes
        -   Display results with scores (optional: show match highlights)
        -   Handle empty query to show all connections
        -   _Requirements: 1.1, 2.1, 3.1, 5.1, 5.2_
    -   [x] 8.3 Add search styling
        -   Style search input to match existing UI
        -   Add loading state during search
        -   _Requirements: 5.2_

-   [ ] 9. Final Checkpoint - Make sure all tests are passing
    -   Ensure all tests pass, ask the user if questions arise.
