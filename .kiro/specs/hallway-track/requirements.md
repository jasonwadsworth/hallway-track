# Requirements Document

## Introduction

Hallway Track is a gamified social networking web application designed for re:Invent attendees. The application enables users to meet and connect with other attendees through QR code scanning, building a network of connections while earning badges based on the number of people they meet. Users maintain control over their profile information and can tag connections with contextual information about where and how they met.

## Glossary

- **Application**: The Hallway Track web application
- **User**: An authenticated attendee using the Application
- **Profile**: A User's personal information including display name, profile picture, and contact links
- **Connection**: A relationship between two Users established through QR code scanning
- **QR Code**: A scannable code unique to each User for establishing Connections
- **Badge**: A visual achievement award earned by a User based on the number of Connections
- **Contact Link**: A URL or contact method (email, LinkedIn, etc.) that a User can share
- **Tag**: A custom label that a User can apply to a Connection to provide context
- **Display Name**: The name shown to other Users in the Application
- **Gravatar**: An external service that provides profile pictures based on email address

## Requirements

### Requirement 1: User Authentication

**User Story:** As an attendee, I want to create an account and sign in securely, so that I can access the application and maintain my profile and connections.

#### Acceptance Criteria

1. THE Application SHALL provide a registration interface that accepts an email address and password
2. WHEN a User submits valid registration credentials, THE Application SHALL create a new account using AWS Cognito
3. THE Application SHALL provide a sign-in interface that accepts email and password credentials
4. WHEN a User submits valid sign-in credentials, THE Application SHALL authenticate the User and grant access to the Application
5. WHEN a User completes authentication, THE Application SHALL redirect the User to their profile or main dashboard

### Requirement 2: User Profile Management

**User Story:** As a User, I want to create and manage my profile with a display name and contact links, so that I can control what information I share with other attendees.

#### Acceptance Criteria

1. THE Application SHALL provide an interface for a User to set their display name
2. THE Application SHALL retrieve and display a profile picture from Gravatar based on the User's email address
3. THE Application SHALL provide an interface for a User to add multiple Contact Links with labels (email, LinkedIn, etc.)
4. THE Application SHALL allow a User to mark each Contact Link as visible or hidden
5. WHEN a User views another User's Profile, THE Application SHALL display only the Contact Links marked as visible by that User
6. THE Application SHALL persist all Profile changes to the database

### Requirement 3: QR Code Generation and Display

**User Story:** As a User, I want to generate and display my unique QR code, so that other attendees can scan it to connect with me.

#### Acceptance Criteria

1. WHEN a User accesses their QR code view, THE Application SHALL generate a unique QR code containing a URL link to the User's profile page
2. THE Application SHALL display the QR code in a format suitable for scanning by another device
3. THE Application SHALL maintain the same QR code URL for a User across multiple sessions

### Requirement 4: Profile Viewing and Connection Creation

**User Story:** As a User, I want to view another attendee's profile and connect with them, so that I can add them to my network after scanning their QR code with my phone's camera.

#### Acceptance Criteria

1. WHEN a User navigates to another User's profile page URL, THE Application SHALL display that User's Profile information
2. WHEN a User views another User's profile page, THE Application SHALL provide an interface to create a Connection with that User
3. WHEN a User initiates a Connection, THE Application SHALL create a Connection between the two Users
4. THE Application SHALL prevent a User from creating duplicate Connections with the same User
5. WHEN a Connection is created, THE Application SHALL persist the Connection to the database with a timestamp

### Requirement 5: Connection Tagging

**User Story:** As a User, I want to add custom tags to my connections, so that I can remember the context of where and how I met each person.

#### Acceptance Criteria

1. THE Application SHALL provide an interface for a User to add one or more Tags to a Connection
2. THE Application SHALL allow a User to enter free-form text for each Tag
3. THE Application SHALL persist Tags associated with each Connection to the database
4. WHEN a User views a Connection, THE Application SHALL display all Tags associated with that Connection
5. THE Application SHALL allow a User to remove Tags from a Connection

### Requirement 6: Connection List and Viewing

**User Story:** As a User, I want to view a list of all my connections and their profiles, so that I can see who I've met and access their contact information.

#### Acceptance Criteria

1. THE Application SHALL provide an interface that displays all of a User's Connections
2. WHEN a User views their Connection list, THE Application SHALL display each Connection's display name and profile picture
3. THE Application SHALL allow a User to select a Connection to view the full Profile
4. WHEN a User views a Connection's Profile, THE Application SHALL display the display name, profile picture, visible Contact Links, and Tags for that Connection
5. THE Application SHALL display Connections in reverse chronological order by creation timestamp

### Requirement 7: Badge System

**User Story:** As a User, I want to earn badges based on the number of connections I make, so that I feel motivated to meet more people and can see my progress.

#### Acceptance Criteria

1. THE Application SHALL define Badge thresholds based on the number of Connections (e.g., 1, 5, 10, 25, 50 connections)
2. WHEN a User's Connection count reaches a Badge threshold, THE Application SHALL award the corresponding Badge to the User
3. THE Application SHALL display all earned Badges on the User's Profile
4. THE Application SHALL display the User's current Connection count
5. THE Application SHALL indicate the next Badge threshold and the number of Connections needed to reach it

### Requirement 8: Data Privacy and Control

**User Story:** As a User, I want control over what personal information is visible to others, so that I can maintain my privacy while networking.

#### Acceptance Criteria

1. THE Application SHALL store only the email address, display name, and Contact Links provided by the User
2. THE Application SHALL default all Contact Links to hidden visibility when created
3. THE Application SHALL require explicit User action to make a Contact Link visible
4. THE Application SHALL NOT share a User's email address with other Users unless the User adds it as a visible Contact Link
5. WHEN a User views another User's Profile, THE Application SHALL display only information that the viewed User has marked as visible
