# Requirements Document

## Introduction

This feature enables users to add private notes to their connections within the Hallway Track application. Notes are personal reminders that help users remember details about their connections, such as conversation topics, shared interests, or follow-up items. Unlike tags which may be used for grouping and filtering connections, notes are purely informational and remain private to the user who created them.

## Glossary

- **User**: An authenticated person using the Hallway Track application
- **Connection**: A relationship between two Users in the system
- **Note**: A private text field associated with a Connection that is only visible to the User who created it
- **Note System**: The backend and frontend components that enable note creation, storage, retrieval, and management

## Requirements

### Requirement 1

**User Story:** As a User, I want to add a note to a connection, so that I can remember important details about that person

#### Acceptance Criteria

1. WHEN a User views a Connection detail page, THE Note System SHALL display a text input field for adding or editing notes
2. WHEN a User enters text into the note field and saves, THE Note System SHALL store the note content associated with that Connection
3. THE Note System SHALL limit note content to 1000 characters maximum
4. WHEN a User saves a note, THE Note System SHALL provide visual confirmation that the save operation completed successfully
5. IF the save operation fails, THEN THE Note System SHALL display an error message to the User

### Requirement 2

**User Story:** As a User, I want to edit or delete my notes, so that I can keep my connection information up to date

#### Acceptance Criteria

1. WHEN a User views a Connection with an existing note, THE Note System SHALL display the current note content in an editable text field
2. WHEN a User modifies note content and saves, THE Note System SHALL update the stored note with the new content
3. WHEN a User clears all text from a note and saves, THE Note System SHALL remove the note from storage
4. THE Note System SHALL preserve note content when navigating away from and returning to a Connection detail page

### Requirement 3

**User Story:** As a User, I want my notes to remain private, so that other users cannot see my personal reminders about connections

#### Acceptance Criteria

1. THE Note System SHALL store notes with an association to both the Connection and the User who created the note
2. WHEN a User queries for Connection details, THE Note System SHALL return only notes created by that User
3. THE Note System SHALL prevent Users from accessing notes created by other Users through API queries
4. WHEN User A views their connection with User B, THE Note System SHALL display only the note that User A created, not any note that User B may have created about User A

### Requirement 4

**User Story:** As a User, I want to see which of my connections have notes, so that I can quickly identify connections where I've added information

#### Acceptance Criteria

1. WHEN a User views their connections list, THE Note System SHALL display a visual indicator on Connection cards that have associated notes
2. THE Note System SHALL display the indicator only for connections where the current User has created a note
3. WHEN a User has not created a note for a Connection, THE Note System SHALL not display the note indicator for that Connection

## Future Capabilities

### Search Notes (Future)

**User Story:** As a User, I want to search through my notes, so that I can find connections based on what I've written about them

This capability is planned for a future iteration and is not part of the initial implementation. When implemented, it would allow users to:
- Search note content across all their connections
- Filter connections list based on note content matches
- Quickly locate connections by keywords in their notes
