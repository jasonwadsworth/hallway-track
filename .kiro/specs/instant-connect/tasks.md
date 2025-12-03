# Implementation Plan

-   [x] 1. Set up infrastructure for instant connect tokens

    -   [x] 1.1 Create InstantConnectTokens DynamoDB table in CDK
        -   Add table with PK (TOKEN#token), SK (TOKEN), GSI1 (USER#userId)
        -   Enable TTL on the TTL attribute
        -   Add table name to environment variables for Lambda
        -   _Requirements: 1.5, 6.2_
    -   [x] 1.2 Add GraphQL schema extensions
        -   Add InstantConnectToken type with token, expiresAt, url fields
        -   Add InstantConnectResult type with success, message, connectedUser fields
        -   Add generateInstantConnectToken mutation
        -   Add redeemInstantConnectToken mutation
        -   _Requirements: 1.4, 2.1_

-   [x] 2. Implement token generation Lambda handler

    -   [x] 2.1 Create instant-connect Lambda function
        -   Create new Lambda at infrastructure/lambda/instant-connect/index.ts
        -   Implement generateInstantConnectToken handler
        -   Generate 32-byte cryptographically secure token using crypto.randomBytes
        -   Delete existing user token via GSI1 query before creating new one
        -   Store token with 5-minute expiry and 24-hour TTL
        -   Return token, expiresAt, and constructed URL
        -   _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1_
    -   [ ]\* 2.2 Write property test for token generation
        -   **Property 1: Token entropy is sufficient**
        -   **Property 2: Token expiry is consistent**
        -   **Property 4: Token data completeness**
        -   **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 6.1**
    -   [x] 2.3 Wire up Lambda to AppSync
        -   Add Lambda data source for instant-connect
        -   Create resolver for generateInstantConnectToken mutation
        -   _Requirements: 1.4_

-   [x] 3. Implement token redemption Lambda handler

    -   [x] 3.1 Add redeemInstantConnectToken handler to instant-connect Lambda
        -   Look up token by PK
        -   Validate token exists and is not expired
        -   Validate redeemer is not the token owner (self-connection)
        -   Check if users are already connected
        -   Delete token immediately (single-use)
        -   Emit InstantConnectRedeemed event to EventBridge
        -   Return success with token owner's public profile
        -   _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
    -   [ ]\* 3.2 Write property test for token redemption validation
        -   **Property 6: Tokens are single-use**
        -   **Property 11: Distinct error messages for failure scenarios**
        -   **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6, 5.3**
    -   [x] 3.3 Create resolver for redeemInstantConnectToken mutation
        -   Wire up to instant-connect Lambda
        -   _Requirements: 2.1_

-   [x] 4. Implement InstantConnectRedeemed event handler

    -   [x] 4.1 Create instant-connect-redeemed event handler Lambda
        -   Create new Lambda at infrastructure/lambda/event-handlers/instant-connect-redeemed/index.ts
        -   Create bidirectional connection records (reuse pattern from connection-request-approved)
        -   Update connection counts for both users
        -   Update leaderboard GSI for both users
        -   _Requirements: 2.1, 2.7_
    -   [x] 4.2 Add EventBridge rule for InstantConnectRedeemed event
        -   Create rule targeting instant-connect-redeemed Lambda
        -   Filter on source: hallway-track.instant-connect, detail-type: InstantConnectRedeemed
        -   _Requirements: 2.7_
    -   [ ]\* 4.3 Write property test for bidirectional connection creation
        -   **Property 5: Redemption creates bidirectional connections**
        -   **Property 7: Redemption triggers badge evaluation**
        -   **Validates: Requirements 2.1, 2.7**

-   [x] 5. Checkpoint - Ensure all backend tests pass

    -   Ensure all tests pass, ask the user if questions arise.

-   [x] 6. Update frontend QRCodeDisplay component

    -   [x] 6.1 Add GraphQL mutations for instant connect
        -   Add generateInstantConnectToken mutation to frontend/src/graphql/mutations.ts
        -   Add redeemInstantConnectToken mutation to frontend/src/graphql/mutations.ts
        -   Add InstantConnectToken and InstantConnectResult types to frontend/src/types.ts
        -   _Requirements: 1.4, 2.1_
    -   [x] 6.2 Modify QRCodeDisplay to use instant connect tokens
        -   Replace profile URL with instant connect token URL
        -   Call generateInstantConnectToken on component mount
        -   Display "Expires in 5 minutes" message
        -   Set up auto-refresh timer to regenerate token before expiry
        -   Add manual refresh button
        -   Update ShareProfileButton to use instant connect URL
        -   _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1_
    -   [ ]\* 6.3 Write property test for URL format
        -   **Property 8: Instant connect URL format**
        -   **Property 9: Expiry message accuracy**
        -   **Validates: Requirements 3.1, 3.2, 4.1**

-   [x] 7. Implement token redemption frontend flow

    -   [x] 7.1 Create InstantConnectRedeem route component
        -   Create new component at frontend/src/components/InstantConnectRedeem.tsx
        -   Extract token from URL parameter
        -   Show loading state while processing
        -   Call redeemInstantConnectToken mutation
        -   Display success message with connected user's name
        -   Navigate to connected profile on success
        -   Display specific error messages on failure
        -   _Requirements: 5.1, 5.2, 5.3_
    -   [x] 7.2 Add /connect/:token route to App.tsx
        -   Add route for InstantConnectRedeem component
        -   Handle unauthenticated users (store token, redirect to login, process after auth)
        -   _Requirements: 5.4_
    -   [ ]\* 7.3 Write property test for redemption response handling
        -   **Property 10: Redemption response includes owner profile**
        -   **Validates: Requirements 5.1**

-   [x] 8. Final Checkpoint - Ensure all tests pass
    -   Ensure all tests pass, ask the user if questions arise.
