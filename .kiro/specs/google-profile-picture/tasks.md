# Implementation Plan

- [x] 1. Update GraphQL schema to include profilePictureUrl
  - Add profilePictureUrl field to User type
  - Add profilePictureUrl field to PublicProfile type
  - Add profilePictureUrl field to ConnectedProfile type
  - _Requirements: 3.1, 3.2_

- [x] 2. Update post-confirmation Lambda to store profile picture URL
  - Extract picture attribute from Cognito event
  - Add profilePictureUrl to DynamoDB item when present
  - Maintain backward compatibility for users without picture attribute
  - _Requirements: 1.3, 3.3, 3.4_

- [x] 3. Create post-authentication Lambda function
  - Create new Lambda directory and handler file
  - Implement logic to retrieve current profile picture from DynamoDB
  - Implement comparison logic to detect URL changes
  - Implement conditional update to DynamoDB when URL changes
  - Add error handling that doesn't block authentication
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.5_

- [x] 4. Configure post-authentication Lambda in CDK
  - Add Lambda function construct to hallway-track-stack.ts
  - Configure environment variables (TABLE_NAME)
  - Grant DynamoDB read/write permissions
  - Add post-authentication trigger to User Pool
  - _Requirements: 2.1, 5.3, 5.4_

- [x] 5. Update GraphQL resolvers to include profilePictureUrl
  - Update Query.getMyProfile resolver
  - Update Query.getPublicProfile resolver
  - Update Query.getConnectedProfile resolver
  - Update Connection.connectedUser resolver
  - Update ConnectionRequest.initiator resolver
  - Update ConnectionRequest.recipient resolver
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Create ProfilePicture component in frontend
  - Create new ProfilePicture component with props interface
  - Implement image display logic with profilePictureUrl priority
  - Implement fallback to Gravatar when profilePictureUrl not available
  - Implement error handling to fall back to Gravatar on load failure
  - Add proper alt text for accessibility
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [x] 7. Update frontend components to use ProfilePicture component
  - Replace img tags in profile views with ProfilePicture component
  - Replace img tags in connection lists with ProfilePicture component
  - Replace img tags in connection request views with ProfilePicture component
  - Update GraphQL queries to fetch profilePictureUrl field
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ]* 8. Write unit tests for post-authentication Lambda
  - Test profile picture update when URL changes
  - Test skipping update when URL unchanged
  - Test handling missing profile picture attribute
  - Test error handling without throwing exceptions
  - _Requirements: 2.3, 2.4, 2.5, 5.1, 5.2, 5.5_

- [ ]* 9. Write unit tests for updated post-confirmation Lambda
  - Test storing profilePictureUrl for Google users
  - Test not including profilePictureUrl for email/password users
  - Test backward compatibility
  - _Requirements: 1.3, 3.3, 3.4_

- [ ]* 10. Write unit tests for ProfilePicture component
  - Test displaying Google profile picture when available
  - Test falling back to Gravatar when no profile picture URL
  - Test falling back to Gravatar on image load error
  - Test proper alt text rendering
  - _Requirements: 4.1, 4.2, 4.3, 4.5_

- [x] 11. Update deployment documentation
  - Document the new post-authentication Lambda trigger
  - Document the profilePictureUrl field in data model
  - Document the migration strategy for existing users
  - Add troubleshooting guide for profile picture issues
  - _Requirements: 1.1, 1.2, 1.3, 2.1_
