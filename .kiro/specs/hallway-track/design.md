# Hallway Track Design Document

## Overview

Hallway Track is a serverless web application built on AWS that enables re:Invent attendees to network through QR code-based connections. The application uses a React frontend hosted on AWS Amplify, with a GraphQL API powered by AWS AppSync and DynamoDB for data persistence. Authentication is handled through Amazon Cognito.

The design prioritizes simplicity and uses straightforward patterns without unnecessary abstractions. The architecture leverages AWS managed services to minimize operational overhead while maintaining scalability.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   React App     │
│  (AWS Amplify)  │
└────────┬────────┘
         │
         │ GraphQL
         │
┌────────▼────────┐
│   AWS AppSync   │
│  (GraphQL API)  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────┐
│Cognito│ │DynamoDB │
│       │ │         │
└───────┘ └─────────┘
```

### Technology Stack

- **Frontend**: React with TypeScript, AWS Amplify UI components
- **API**: AWS AppSync (GraphQL)
- **Authentication**: Amazon Cognito User Pools
- **Database**: Amazon DynamoDB (separate tables per entity)
- **Hosting**: AWS Amplify Hosting
- **Infrastructure**: AWS CDK (TypeScript)

### AWS Services

1. **AWS Amplify**: Hosts the React application and provides client libraries for API/Auth integration
2. **AWS AppSync**: Manages the GraphQL API with built-in resolvers for DynamoDB
3. **Amazon Cognito**: Handles user registration, authentication, and session management
4. **Amazon DynamoDB**: Stores user profiles, connections, and related data
5. **AWS Lambda**: Custom business logic (badge calculation, connection validation)
6. **Amazon S3**: Potential future use for file storage

## Components and Interfaces

### Frontend Components

#### Authentication Components
- **SignIn**: Email/password login form
- **SignUp**: New user registration form
- **AuthWrapper**: Manages authentication state and redirects

#### Profile Components
- **ProfileView**: Displays user's own profile with edit capabilities
- **ProfileEdit**: Form for editing display name and contact links
- **ContactLinkManager**: Add/remove/toggle visibility of contact links
- **QRCodeDisplay**: Generates and displays user's QR code

#### Connection Components
- **ConnectionList**: Displays all user connections
- **ConnectionCard**: Individual connection item with name, avatar, tags
- **ConnectionDetail**: Full view of a connection's profile
- **PublicProfile**: View of another user's profile (from QR code scan)
- **ConnectButton**: Button to create a connection with another user
- **TagManager**: Add/remove tags for a connection

#### Badge Components
- **BadgeDisplay**: Shows earned badges
- **BadgeProgress**: Shows progress toward next badge
- **BadgeList**: Grid of all available badges with locked/unlocked states

#### Navigation Components
- **AppNav**: Main navigation bar
- **Dashboard**: Home screen with quick actions

### GraphQL Schema

```graphql
type User @model @auth(rules: [{ allow: owner }]) {
  id: ID!
  email: AWSEmail!
  displayName: String!
  gravatarHash: String!
  contactLinks: [ContactLink!]!
  connections: [Connection!] @hasMany(indexName: "byUser", fields: ["id"])
  badges: [Badge!]!
  connectionCount: Int!
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type ContactLink {
  id: ID!
  label: String!
  url: AWSURL!
  visible: Boolean!
}

type Connection @model @auth(rules: [{ allow: owner }]) {
  id: ID!
  userId: ID! @index(name: "byUser")
  connectedUserId: ID!
  connectedUser: User @hasOne(fields: ["connectedUserId"])
  tags: [String!]!
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

type Badge {
  id: ID!
  name: String!
  description: String!
  threshold: Int!
  iconUrl: AWSURL
  earnedAt: AWSDateTime
}

type PublicProfile {
  id: ID!
  displayName: String!
  gravatarHash: String!
  contactLinks: [ContactLink!]!
  badges: [Badge!]!
}

type Query {
  getPublicProfile(userId: ID!): PublicProfile
  getMyConnections: [Connection!]!
  checkConnection(userId: ID!): Boolean!
}

type Mutation {
  createConnection(connectedUserId: ID!): Connection!
  addTagToConnection(connectionId: ID!, tag: String!): Connection!
  removeTagFromConnection(connectionId: ID!, tag: String!): Connection!
  updateContactLink(contactLinkId: ID!, label: String, url: AWSURL, visible: Boolean): User!
  addContactLink(label: String!, url: AWSURL!): User!
  removeContactLink(contactLinkId: ID!): User!
}
```

### API Resolvers

#### AppSync Resolvers

1. **Direct DynamoDB Resolvers** (for simple CRUD):
   - User queries and mutations
   - Connection queries
   - Contact link mutations

2. **Lambda Resolvers** (for business logic):
   - `createConnection`: Validates no duplicate, creates bidirectional connection, updates connection count, checks badge thresholds
   - `getPublicProfile`: Returns only visible contact links
   - `checkConnection`: Verifies if connection already exists

## Data Models

### DynamoDB Tables

#### Users Table
```
PK: USER#{userId}
SK: PROFILE

Attributes:
- id (String)
- email (String)
- displayName (String)
- gravatarHash (String)
- contactLinks (List<Map>)
  - id (String)
  - label (String)
  - url (String)
  - visible (Boolean)
- badges (List<Map>)
  - id (String)
  - name (String)
  - description (String)
  - threshold (Number)
  - iconUrl (String)
  - earnedAt (String - ISO timestamp)
- connectionCount (Number)
- createdAt (String - ISO timestamp)
- updatedAt (String - ISO timestamp)
```

#### Connections Table
```
PK: USER#{userId}
SK: CONNECTION#{connectionId}

Attributes:
- id (String)
- userId (String)
- connectedUserId (String)
- tags (List<String>)
- createdAt (String - ISO timestamp)
- updatedAt (String - ISO timestamp)

GSI: ByConnectedUser
- PK: CONNECTED#{connectedUserId}
- SK: createdAt
```

### Badge Definitions

Badges are defined in application code and stored in user records when earned:

```typescript
const BADGE_DEFINITIONS = [
  { id: 'first-connection', name: 'Ice Breaker', threshold: 1, description: 'Made your first connection' },
  { id: 'networker', name: 'Networker', threshold: 5, description: 'Connected with 5 people' },
  { id: 'socialite', name: 'Socialite', threshold: 10, description: 'Connected with 10 people' },
  { id: 'connector', name: 'Super Connector', threshold: 25, description: 'Connected with 25 people' },
  { id: 'legend', name: 'Networking Legend', threshold: 50, description: 'Connected with 50 people' },
];
```

### Gravatar Integration

Profile pictures use Gravatar based on email hash:
```typescript
import md5 from 'crypto-js/md5';

function getGravatarUrl(email: string): string {
  const hash = md5(email.toLowerCase().trim()).toString();
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200`;
}
```

## User Flows

### Registration and Profile Setup Flow

1. User navigates to application
2. User clicks "Sign Up"
3. User enters email and password
4. Cognito creates user account
5. User is redirected to profile setup
6. User enters display name
7. Gravatar hash is calculated from email
8. User profile is created in DynamoDB
9. User is redirected to dashboard

### QR Code Sharing Flow

1. User navigates to "My QR Code" view
2. Application generates QR code containing URL: `https://app.hallwaytrack.com/profile/{userId}`
3. User displays QR code on their device
4. Another attendee scans QR code with phone camera
5. Phone opens the URL in browser
6. Application loads the public profile view

### Connection Creation Flow

1. User scans another user's QR code (via phone camera)
2. Browser opens profile URL
3. Application loads public profile view
4. User sees display name, avatar, visible contact links, badges
5. User clicks "Connect" button
6. Application calls `createConnection` mutation
7. Lambda function:
   - Validates user is authenticated
   - Checks for duplicate connection
   - Creates connection record for both users
   - Increments connection count
   - Checks badge thresholds
   - Awards new badges if thresholds met
8. User sees success message
9. Connection appears in user's connection list

### Viewing Connections Flow

1. User navigates to "My Connections"
2. Application queries connections for current user
3. Connections displayed in reverse chronological order
4. User clicks on a connection
5. Application displays connection detail with:
   - Display name and avatar
   - Visible contact links
   - Tags
   - Option to add/remove tags

### Tag Management Flow

1. User views a connection detail
2. User clicks "Add Tag"
3. User enters tag text (e.g., "AWS Summit", "Keynote")
4. Application calls `addTagToConnection` mutation
5. Tag is saved and displayed
6. User can remove tags by clicking X on tag

## Error Handling

### Frontend Error Handling

1. **Network Errors**: Display user-friendly message, retry button
2. **Authentication Errors**: Redirect to login, clear session
3. **Validation Errors**: Inline form validation messages
4. **Not Found Errors**: Display "Profile not found" message

### Backend Error Handling

1. **Duplicate Connection**: Return error "Already connected with this user"
2. **Invalid User ID**: Return error "User not found"
3. **Unauthorized Access**: Return 401 with "Authentication required"
4. **Database Errors**: Log error, return generic "Something went wrong" message

### Error Response Format

```typescript
interface ErrorResponse {
  message: string;
  code: string;
  details?: Record<string, unknown>;
}
```

## Security Considerations

### Authentication & Authorization

1. **Cognito User Pools**: Enforce password requirements (min 8 chars, uppercase, lowercase, number)
2. **AppSync Authorization**: Use Cognito User Pool authorization
3. **Owner-Based Access**: Users can only modify their own data
4. **Public Profile Access**: Anyone can view public profiles (visible contact links only)

### Data Privacy

1. **Email Privacy**: Email never exposed in public profiles
2. **Contact Link Visibility**: Default to hidden, explicit opt-in required
3. **Connection Privacy**: Users only see their own connections
4. **No PII Leakage**: Gravatar hash stored, not raw email

### Input Validation

1. **Email Format**: Validated by Cognito
2. **URL Format**: Validated by GraphQL AWSURL scalar
3. **Display Name**: Max 50 characters, no special characters
4. **Tags**: Max 30 characters per tag, max 10 tags per connection
5. **Contact Links**: Max 10 links per user

## Performance Considerations

### Frontend Optimization

1. **Code Splitting**: Lazy load routes
2. **Image Optimization**: Use appropriate Gravatar sizes
3. **GraphQL Caching**: Cache user profile and connections
4. **Optimistic Updates**: Update UI before server confirmation for tags

### Backend Optimization

1. **DynamoDB Capacity**: On-demand pricing for variable traffic
2. **AppSync Caching**: Enable caching for public profile queries (5 min TTL)
3. **Lambda Cold Starts**: Keep functions small and focused
4. **Batch Operations**: Fetch connection details in batches

### Scalability

1. **Stateless Architecture**: All state in DynamoDB/Cognito
2. **Managed Services**: Auto-scaling handled by AWS
3. **CDN**: Amplify hosting includes CloudFront CDN
4. **Connection Limits**: No hard limits, DynamoDB scales automatically

## Testing Strategy

### Critical Functionality Tests

1. **Connection Creation**: Verify no duplicates, bidirectional creation
2. **Badge Award Logic**: Verify correct thresholds trigger badges
3. **Contact Link Visibility**: Verify hidden links not exposed in public profile
4. **Gravatar Hash**: Verify correct MD5 hash generation

### Manual Testing Focus

1. **QR Code Scanning**: Test with real devices
2. **Authentication Flow**: Test sign up, sign in, sign out
3. **Profile Editing**: Test all CRUD operations on contact links
4. **Connection Flow**: End-to-end test from QR scan to connection creation

### Testing Approach

- Unit tests for badge calculation logic
- Integration tests for Lambda resolvers
- Manual testing for UI flows
- No comprehensive test coverage required per project requirements

## Deployment Strategy

### Infrastructure Deployment

1. **CDK Stacks**:
   - `AuthStack`: Cognito User Pool
   - `ApiStack`: AppSync API, DynamoDB tables
   - `FrontendStack`: Amplify hosting configuration

2. **Deployment Order**:
   - Deploy AuthStack
   - Deploy ApiStack (depends on AuthStack)
   - Deploy FrontendStack (depends on ApiStack)
   - Build and deploy React app to Amplify

### Environment Configuration

- **Development**: Separate AWS account or isolated resources
- **Production**: Dedicated resources with appropriate capacity

### CI/CD

- Use Amplify's built-in CI/CD for frontend
- CDK deployment via GitHub Actions or similar
- Automatic deployments on main branch merge

## Future Enhancements

These features are explicitly out of scope for MVP but designed to be added later:

1. **Leaderboard**: Add global leaderboard query, cache results
2. **Chat/Messaging**: Add real-time messaging via AppSync subscriptions
3. **Session Integration**: Import re:Invent session catalog, allow tagging connections with sessions
4. **Advanced Badges**: Add badges for specific achievements (e.g., "Met a speaker")
5. **Profile Customization**: Allow custom profile themes or backgrounds
6. **Export Connections**: Allow users to export their connection list
7. **Search**: Search connections by name or tags
