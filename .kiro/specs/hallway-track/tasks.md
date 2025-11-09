# Implementation Plan

## Overview

This implementation plan breaks down the Hallway Track application into discrete coding tasks. Each task builds incrementally on previous work, starting with infrastructure setup, then backend API implementation, and finally frontend components. All tasks reference specific requirements from the requirements document.

---

- [x] 1. Initialize project structure and AWS infrastructure foundation
  - Create CDK project with TypeScript
  - Set up directory structure for infrastructure code (lib/stacks, lib/constructs)
  - Initialize Amplify project for React frontend
  - Configure TypeScript for both CDK and React with strict mode and no `any` types
  - _Requirements: 1.1, 1.2_

- [x] 2. Implement authentication infrastructure
  - [x] 2.1 Create Cognito User Pool with CDK
    - Define AuthStack with Cognito User Pool
    - Configure password policy (min 8 chars, uppercase, lowercase, number)
    - Set up email as username
    - Configure user pool client for web app
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 2.2 Configure Amplify UI authentication components
    - Install @aws-amplify/ui-react library
    - Configure Authenticator component with Cognito User Pool
    - Wrap application with Authenticator for sign up/sign in flows
    - Configure Amplify with auth resource outputs from CDK
    - Customize Authenticator theme if needed
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Implement DynamoDB tables and GraphQL schema
  - [x] 3.1 Define DynamoDB tables with CDK
    - Create Users table with partition key USER#{userId}
    - Create Connections table with partition key USER#{userId} and sort key CONNECTION#{connectionId}
    - Add GSI to Connections table for querying by connectedUserId
    - Configure on-demand billing mode
    - _Requirements: 2.6, 4.5, 6.5_

  - [x] 3.2 Create GraphQL schema for AppSync
    - Define User type with all profile fields
    - Define ContactLink embedded type
    - Define Connection type with tags
    - Define Badge embedded type
    - Define PublicProfile type for public viewing
    - Add Query operations (getPublicProfile, getMyConnections, checkConnection)
    - Add Mutation operations (createConnection, tag management, contact link management)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4_

  - [x] 3.3 Create AppSync API with CDK
    - Define ApiStack with AppSync GraphQL API
    - Configure Cognito User Pool authorization
    - Link DynamoDB tables as data sources
    - Create Lambda data source for custom resolvers
    - _Requirements: 1.4, 4.2, 4.3_

- [x] 4. Implement user profile backend logic
  - [x] 4.1 Create direct DynamoDB resolvers for profile operations
    - Implement resolver for creating user profile on first sign-in
    - Implement resolver for updating display name
    - Implement resolver for querying own profile
    - Calculate and store Gravatar hash from email
    - _Requirements: 2.1, 2.2, 2.6_

  - [x] 4.2 Implement contact link management resolvers
    - Create addContactLink mutation resolver
    - Create updateContactLink mutation resolver (visibility toggle, edit label/URL)
    - Create removeContactLink mutation resolver
    - Validate URL format and max 10 links per user
    - Default new links to hidden visibility
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 8.2, 8.3_

  - [x] 4.3 Implement public profile Lambda resolver
    - Create Lambda function for getPublicProfile query
    - Fetch user from DynamoDB
    - Filter contact links to only return visible ones
    - Return display name, Gravatar hash, visible links, and badges
    - _Requirements: 2.5, 4.1, 8.4, 8.5_

- [-] 5. Implement connection creation and management backend
  - [x] 5.1 Create connection creation Lambda resolver
    - Implement createConnection mutation Lambda function
    - Validate authenticated user
    - Check for duplicate connections using checkConnection logic
    - Create connection record for current user
    - Create reciprocal connection record for connected user
    - Increment connectionCount for both users
    - Add timestamp to connection records
    - Return error if duplicate connection exists
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 7.2_

  - [x] 5.2 Implement badge award logic in connection Lambda
    - Define badge thresholds in code (1, 5, 10, 25, 50)
    - After creating connection, check if new connectionCount meets any badge threshold
    - Add newly earned badges to user's badge list with earnedAt timestamp
    - Return updated user with new badges
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 5.3 Create connection query resolvers
    - Implement getMyConnections query resolver
    - Query Connections table by userId
    - Sort by createdAt descending
    - Fetch connected user details for each connection
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 5.4 Implement tag management resolvers
    - Create addTagToConnection mutation resolver
    - Create removeTagFromConnection mutation resolver
    - Validate max 30 chars per tag and max 10 tags per connection
    - Update connection record in DynamoDB
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6. Implement user profile frontend components
  - [x] 6.1 Create profile view and edit components
    - Implement ProfileView component to display own profile
    - Implement ProfileEdit component with form for display name
    - Show Gravatar image based on email hash
    - Add navigation between view and edit modes
    - Call GraphQL mutations to update profile
    - _Requirements: 2.1, 2.2, 2.6_

  - [x] 6.2 Create contact link management UI
    - Implement ContactLinkManager component
    - Add form to create new contact links (label + URL)
    - Display list of existing contact links
    - Add toggle switch for visibility on each link
    - Add delete button for each link
    - Show visual indicator for visible vs hidden links
    - Call GraphQL mutations for add/update/remove operations
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 8.2, 8.3_

- [x] 7. Implement QR code generation and display
  - [x] 7.1 Create QR code display component
    - Install qrcode.react library
    - Implement QRCodeDisplay component
    - Generate QR code containing profile URL: `https://app.hallwaytrack.com/profile/{userId}`
    - Display QR code with appropriate size for scanning
    - Add user's display name below QR code
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 8. Implement public profile viewing and connection creation
  - [x] 8.1 Create public profile view component
    - Implement PublicProfile component that accepts userId from URL
    - Call getPublicProfile GraphQL query
    - Display user's display name and Gravatar
    - Display only visible contact links
    - Display earned badges
    - Handle "user not found" error case
    - _Requirements: 4.1, 2.5, 8.5_

  - [x] 8.2 Create connect button component
    - Implement ConnectButton component
    - Call checkConnection query to see if already connected
    - Show "Already Connected" if connection exists
    - Show "Connect" button if not connected
    - Call createConnection mutation on button click
    - Show success message after connection created
    - Handle duplicate connection error
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [x] 9. Implement connection list and detail views
  - [x] 9.1 Create connection list component
    - Implement ConnectionList component
    - Call getMyConnections GraphQL query
    - Display connections in reverse chronological order
    - Implement ConnectionCard component for each connection
    - Show display name, Gravatar, and tags on each card
    - Add click handler to navigate to connection detail
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 9.2 Create connection detail component
    - Implement ConnectionDetail component
    - Display full profile of connected user
    - Show display name, Gravatar, visible contact links
    - Display all tags for this connection
    - Add TagManager component for adding/removing tags
    - _Requirements: 6.3, 6.4, 5.4_

  - [x] 9.3 Implement tag management UI
    - Create TagManager component
    - Add input field and button to add new tag
    - Display existing tags with remove button
    - Call addTagToConnection mutation when adding tag
    - Call removeTagFromConnection mutation when removing tag
    - Validate tag length (max 30 chars)
    - Show error if max 10 tags reached
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 10. Implement badge display components
  - [x] 10.1 Create badge display components
    - Implement BadgeDisplay component to show earned badges
    - Implement BadgeList component showing all badges (locked/unlocked)
    - Create badge icons or use emoji representations
    - Show badge name, description, and threshold
    - Display earnedAt date for earned badges
    - _Requirements: 7.3, 7.4_

  - [x] 10.2 Create badge progress component
    - Implement BadgeProgress component
    - Display current connection count
    - Show next badge threshold
    - Calculate and display connections needed for next badge
    - Show progress bar or percentage
    - _Requirements: 7.4, 7.5_

- [x] 11. Implement navigation and routing
  - [x] 11.1 Set up React Router and navigation
    - Install and configure React Router
    - Define routes: /, /profile, /profile/:userId, /connections, /connections/:id, /qr-code
    - Implement AppNav component with navigation links
    - Add protected route wrapper for authenticated routes
    - Implement Dashboard component as home screen
    - _Requirements: 1.5, 6.1_

  - [x] 11.2 Create dashboard with quick actions
    - Implement Dashboard component
    - Add quick action buttons: "View My QR Code", "My Connections", "Edit Profile"
    - Display badge progress widget
    - Show recent connections (last 5)
    - _Requirements: 7.4, 7.5_

- [x] 12. Implement error handling and loading states
  - [x] 12.1 Add error handling to all components
    - Create ErrorMessage component for displaying errors
    - Add try-catch blocks around GraphQL calls
    - Display user-friendly error messages
    - Add retry functionality for network errors
    - Handle authentication errors with redirect to login
    - _Requirements: All requirements - error handling is cross-cutting_

  - [x] 12.2 Add loading states to all async operations
    - Create LoadingSpinner component
    - Add loading states to all GraphQL queries
    - Show loading indicators during mutations
    - Implement optimistic updates for tag operations
    - _Requirements: All requirements - loading states are cross-cutting_

- [ ] 13. Deploy infrastructure and application
  - [ ] 13.1 Deploy CDK stacks to AWS
    - Deploy AuthStack (Cognito)
    - Deploy ApiStack (AppSync, DynamoDB, Lambda)
    - Verify all resources created successfully
    - Export API endpoint and User Pool ID
    - _Requirements: 1.1, 1.2_

  - [ ] 13.2 Configure and deploy React app
    - Update Amplify configuration with deployed resource IDs
    - Build React application
    - Deploy to Amplify Hosting
    - Configure custom domain (if applicable)
    - Verify application loads and authentication works
    - _Requirements: All requirements - deployment enables all functionality_

- [ ] 14. Integration testing and bug fixes
  - [ ] 14.1 Test critical user flows end-to-end
    - Test sign up and sign in flow
    - Test profile creation and editing
    - Test QR code generation and scanning with real devices
    - Test connection creation and duplicate prevention
    - Test badge awarding at each threshold
    - Test tag management
    - Test contact link visibility controls
    - _Requirements: All requirements_

  - [ ] 14.2 Fix any bugs discovered during testing
    - Address any issues found in integration testing
    - Verify fixes don't break other functionality
    - _Requirements: All requirements_

---

## Notes

- Each task should be completed in order as they build on each other
- TypeScript types should be defined for all data structures
- Avoid using `any` type throughout implementation
- Keep code simple and avoid unnecessary abstractions
- Focus on core functionality; testing is minimal per project requirements
- Optional tasks marked with * can be skipped for faster MVP delivery
