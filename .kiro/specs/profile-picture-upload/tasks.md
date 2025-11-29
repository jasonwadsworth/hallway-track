# Implementation Plan

- [x] 1. Set up S3 bucket and CloudFront distribution for profile pictures
- [x] 2. Extend GraphQL schema for profile picture operations
- [x] 3. Implement Upload URL Generator Lambda
  - [x] 3.1 Create Lambda function to generate pre-signed S3 URLs
- [x] 4. Implement Image Processor Lambda
  - [x] 4.1 Create Lambda function for image processing (simplified - stores without processing)
- [x] 5. Implement Remove Profile Picture Lambda
  - [x] 5.1 Create Lambda function for profile picture removal
- [x] 6. Create AppSync resolvers for profile picture mutations
- [x] 7. Update DynamoDB Users table schema
- [x] 8. Implement frontend file validation utilities
  - [x] 8.1 Create file validation functions
- [x] 9. Create ProfilePictureUpload component
  - [x] 9.1 Implement upload UI component
- [x] 10. Implement upload flow in ProfilePictureUpload component
- [x] 11. Update ProfilePicture component for precedence logic
  - [x] 11.1 Modify display logic to support uploaded pictures
- [x] 12. Integrate ProfilePictureUpload into Profile and ProfileEdit components
- [x] 13. Update GraphQL queries to fetch uploadedProfilePictureUrl
- [x] 14. Implement CloudFront URL generation utility
  - [x] 14.1 Create utility to generate CloudFront URLs for profile pictures
- [x] 15. Add S3 encryption verification
  - [x] 15.1 Configure S3 bucket encryption in CDK
- [x] 16. Implement lazy loading for profile pictures in lists
  - [x] 16.1 Add lazy loading to ConnectionList and ConnectionCard components
- [x] 17. Add cache headers configuration
  - [x] 17.1 Configure CloudFront cache behavior for profile pictures
- [x] 18. Implement account deletion cleanup
  - [x] 18.1 Add profile picture cleanup to account deletion flow
- [x] 19. Add error handling and user feedback
- [x] 20. Add CloudWatch monitoring and alarms
- [x] 21. Checkpoint - Ensure all tests pass
- [x] 22. Update frontend GraphQL mutations file
- [x] 23. Add mobile-responsive styling for upload component
- [x] 24. Final Checkpoint - Ensure all tests pass

## Notes

- Sharp library was removed to simplify deployment; images stored without server-side processing
- Client-side validation handles file type and size limits (5MB max)
- Optional property tests (marked with *) were not implemented per minimal testing approach
