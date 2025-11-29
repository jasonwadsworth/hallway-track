# Requirements Document

## Introduction

This feature enables users to upload a custom profile picture for their Hallway Track profile. The uploaded picture will take precedence over automatically
sourced profile pictures from Google or Gravatar, giving users full control over their profile image representation.

## Glossary

-   **Profile Picture**: The image displayed to represent a user's identity in the Hallway Track application
-   **Upload Service**: The AWS S3-based storage system that stores user-uploaded profile pictures
-   **Picture Precedence**: The priority order for displaying profile pictures: uploaded > Google > Gravatar > default
-   **Image Processing Service**: The backend service that validates, resizes, and optimizes uploaded images
-   **User Profile**: The user's account information stored in DynamoDB including profile picture metadata

## Requirements

### Requirement 1

**User Story:** As a user, I want to upload a custom profile picture, so that I can personalize my profile with an image of my choice.

#### Acceptance Criteria

1. WHEN a user selects an image file from their device THEN the system SHALL validate the file type is an accepted image format (JPEG, PNG, WebP, or GIF)
2. WHEN a user selects an image file THEN the system SHALL validate the file size does not exceed 5MB
3. WHEN a user uploads a valid image THEN the system SHALL store the image in S3 with a unique identifier
4. WHEN an image upload completes successfully THEN the system SHALL update the User Profile with the S3 object key
5. WHEN an image upload fails THEN the system SHALL display a clear error message and maintain the current profile picture

### Requirement 2

**User Story:** As a user, I want my uploaded profile picture to be displayed instead of my Google or Gravatar picture, so that my custom image takes priority.

#### Acceptance Criteria

1. WHEN a user has an uploaded profile picture THEN the system SHALL display the uploaded picture in all profile views
2. WHEN a user has both an uploaded picture and a Google profile picture THEN the system SHALL display the uploaded picture
3. WHEN a user has both an uploaded picture and a Gravatar THEN the system SHALL display the uploaded picture
4. WHEN a user has no uploaded picture THEN the system SHALL fall back to Google profile picture if available
5. WHEN a user has no uploaded picture and no Google profile picture THEN the system SHALL fall back to Gravatar

### Requirement 3

**User Story:** As a user, I want to remove my uploaded profile picture, so that I can revert to using my Google or Gravatar picture.

#### Acceptance Criteria

1. WHEN a user removes their uploaded profile picture THEN the system SHALL delete the image from S3
2. WHEN a user removes their uploaded profile picture THEN the system SHALL update the User Profile to remove the S3 object key reference
3. WHEN a profile picture is removed THEN the system SHALL immediately display the next available picture source according to precedence
4. WHEN a picture removal fails THEN the system SHALL display an error message and maintain the current state

### Requirement 4

**User Story:** As a user, I want my uploaded profile picture to be optimized for display, so that it loads quickly and looks good across different screen
sizes.

#### Acceptance Criteria

1. WHEN the Image Processing Service receives an uploaded image THEN the system SHALL resize the image to a maximum dimension of 512x512 pixels while
   maintaining aspect ratio
2. WHEN the Image Processing Service processes an image THEN the system SHALL convert the image to WebP format for optimal file size
3. WHEN the Image Processing Service completes processing THEN the system SHALL store both the original and optimized versions in the Upload Service
4. WHEN displaying a profile picture THEN the system SHALL serve the optimized version
5. WHEN the optimized version is unavailable THEN the system SHALL serve the original uploaded image

### Requirement 5

**User Story:** As a user, I want to preview my profile picture before uploading, so that I can confirm it looks correct.

#### Acceptance Criteria

1. WHEN a user selects an image file THEN the system SHALL display a preview of the selected image
2. WHEN displaying the preview THEN the system SHALL show the image in a circular crop matching the profile picture display format
3. WHEN a user views the preview THEN the system SHALL provide options to confirm upload or cancel
4. WHEN a user cancels the preview THEN the system SHALL discard the selected file and maintain the current profile picture

### Requirement 6

**User Story:** As a system administrator, I want uploaded profile pictures to be stored securely, so that user data is protected and access is controlled.

#### Acceptance Criteria

1. WHEN the system stores a profile picture in S3 THEN the Upload Service SHALL use server-side encryption
2. WHEN the system generates an S3 object key THEN the Upload Service SHALL include the user ID to ensure uniqueness and prevent collisions
3. WHEN a user requests their profile picture THEN the system SHALL generate a signed URL with a limited expiration time
4. WHEN a user deletes their account THEN the system SHALL remove all associated profile pictures from S3
5. WHEN accessing profile pictures THEN the system SHALL enforce that users can only upload or delete their own pictures

### Requirement 7

**User Story:** As a user viewing another user's profile, I want to see their profile picture load quickly, so that I have a smooth browsing experience.

#### Acceptance Criteria

1. WHEN the system serves a profile picture THEN the Upload Service SHALL use CloudFront CDN for content delivery
2. WHEN a profile picture is requested THEN the system SHALL set appropriate cache headers for browser caching
3. WHEN a user updates their profile picture THEN the system SHALL invalidate the CloudFront cache for the old image
4. WHEN displaying profile pictures in lists THEN the system SHALL use lazy loading to optimize page performance
