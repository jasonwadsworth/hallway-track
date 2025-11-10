# Requirements Document

## Introduction

This feature modifies the contact link management system to use a predefined set of link types instead of allowing users to enter free-form labels. Users will select from a fixed list of common contact methods (LinkedIn, GitHub, Email, etc.) when adding contact links to their profile. This improves consistency, enables better UI presentation with icons, and makes it easier for users to find specific types of contact information on other profiles.

## Glossary

- **Contact Link System**: The feature that allows users to add, manage, and share various contact methods on their profile
- **Link Type**: A predefined category of contact method (e.g., LinkedIn, GitHub, Email) that users can select from
- **Link Label**: The display name for a contact link, which will now be determined by the selected link type
- **Frontend UI**: The React-based user interface components that users interact with
- **Backend Schema**: The GraphQL schema and DynamoDB data model that stores contact link information

## Requirements

### Requirement 1

**User Story:** As a user adding a contact link, I want to select from a predefined list of link types, so that my contact information is consistently formatted and easily recognizable.

#### Acceptance Criteria

1. WHEN a user initiates adding a new contact link, THE Frontend UI SHALL display a dropdown or selection interface containing all available link types
2. THE Frontend UI SHALL prevent users from entering custom text for the link label field
3. WHEN a user selects a link type, THE Frontend UI SHALL populate the label field with the corresponding predefined label
4. THE Frontend UI SHALL display each link type option with a recognizable icon or visual indicator
5. THE Contact Link System SHALL support at least the following link types: LinkedIn, GitHub, Twitter/X, Email, Website, Facebook, Instagram, Mastodon, Bluesky, and Phone

### Requirement 2

**User Story:** As a user, I want to prevent duplicate link types on my profile, so that my contact information remains organized and uncluttered.

#### Acceptance Criteria

1. WHEN a user has already added a specific link type, THE Frontend UI SHALL disable or hide that link type from the selection list
2. WHEN a user attempts to add a link type that already exists, THE Contact Link System SHALL display an error message indicating the duplicate
3. THE Frontend UI SHALL visually indicate which link types have already been added to the user's profile

### Requirement 3

**User Story:** As a user viewing another user's profile, I want to see contact links with consistent labels and icons, so that I can quickly identify the type of contact method.

#### Acceptance Criteria

1. WHEN displaying contact links on any profile view, THE Frontend UI SHALL render each link with its corresponding icon
2. THE Frontend UI SHALL use consistent styling and layout for all contact link types
3. WHEN a contact link is displayed, THE Frontend UI SHALL show the predefined label associated with the link type

### Requirement 4

**User Story:** As a system administrator, I want the list of available link types to be easily maintainable, so that new contact methods can be added as social platforms evolve.

#### Acceptance Criteria

1. THE Frontend UI SHALL define link types in a centralized configuration file or constant
2. WHEN a new link type is added to the configuration, THE Frontend UI SHALL automatically include it in the selection interface without requiring changes to multiple components
3. THE link type configuration SHALL include the label, icon identifier, and URL validation pattern for each type
