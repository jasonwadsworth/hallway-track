# Design Document

## Overview

The shareable connection link feature extends the existing HallwayTrak connection system by providing an alternative to QR code scanning. Users can generate unique, secure URLs that others can click to initiate connection requests. The feature integrates with the existing connection request workflow and leverages native OS sharing capabilities for seamless distribution.

## Architecture

### High-Level Flow
1. User accesses their shareable connection link (same URL as QR code uses)
2. User shares the link via native OS sharing or manual copy
3. Recipient clicks the link and is directed to the user's public profile
4. Recipient uses existing ConnectButton to send connection request
5. Connection request follows existing approval workflow

### Integration Points
- **Frontend**: Extends existing QRCodeDisplay component with sharing functionality
- **Backend**: No changes needed - uses existing public profile and connection request system
- **GraphQL**: No changes needed - uses existing queries and mutations
- **Database**: No changes needed - uses existing tables and access patterns

## Components and Interfaces

### Frontend Components

#### Enhanced QRCodeDisplay Component
**New Props:**
```typescript
interface QRCodeDisplayProps {
  // Existing props remain the same
}

interface QRCodeDisplayState {
  profile: User | null;
  loading: boolean;
  error: string | null;
  canShare: boolean;
  isSharing: boolean;
  copied: boolean;
}
```

**New Responsibilities:**
- Add "Share Link" button alongside existing share functionality
- Provide clipboard copy functionality as fallback
- Use same profile URL that QR code already generates
- Maintain existing QR code functionality

#### No New Backend Components Needed
- Uses existing public profile system (`/profile/{userId}`)
- Uses existing ConnectButton component for connection requests
- Uses existing connection request Lambda functions
- No new GraphQL operations required

### Data Models

#### Connection Link URL Structure
**URL Format:** `{window.location.origin}/profile/{userId}`

**Existing Data Models Used:**
- Uses existing `User` type for profile information
- Uses existing `PublicProfile` type for public profile display
- Uses existing `ConnectionRequest` type for connection requests
- No new database schema changes required

## Error Handling

### Frontend Error Scenarios
1. **Share API Unavailable**: Fallback to clipboard copy with user feedback
2. **Clipboard Copy Failure**: Show manual copy option with URL displayed
3. **Network Failures**: Use existing error handling from QRCodeDisplay component
4. **Profile Loading Errors**: Use existing error handling and retry mechanisms

### Existing Error Handling Leveraged
- Public profile loading errors (handled by PublicProfile component)
- Connection request errors (handled by ConnectButton component)
- Authentication errors (handled by existing auth system)
- Invalid user IDs (handled by existing public profile system)

## Testing Strategy

### Unit Tests
- Token generation and validation logic
- Component rendering and state management
- Error handling scenarios
- Security validation functions

### Integration Tests
- End-to-end connection link flow
- Native sharing API integration
- GraphQL query/mutation execution
- Database operations and data consistency

### Security Tests
- Token tampering attempts
- Rate limiting enforcement
- Authentication bypass attempts
- Cross-site scripting prevention

## Implementation Phases

### Phase 1: Enhanced QR Code Component
- Add "Share Link" button to existing QRCodeDisplay component
- Implement Web Share API integration
- Add clipboard copy fallback functionality
- Update component styling for new button

### Phase 2: User Experience Polish
- Add user feedback for successful sharing/copying
- Implement loading states for share operations
- Add appropriate icons and styling
- Test across different devices and browsers

## User Experience Flow

### Link Sharing Flow
1. User navigates to Profile → QR Code section
2. User sees existing QR code with new "Share Link" button
3. User clicks "Share Link" button
4. If Web Share API available: Native share sheet appears with profile URL
5. If Web Share API unavailable: URL copied to clipboard with confirmation
6. User selects sharing method (SMS, email, social media, etc.)

### Link Reception Flow
1. Recipient receives shared link via chosen method
2. Recipient clicks link, opening user's public profile in browser
3. If not authenticated, recipient can view public profile and is prompted to log in to connect
4. If authenticated, recipient sees existing ConnectButton to send connection request
5. Connection request follows existing approval workflow

### Error Recovery Flow
1. Share failures fall back to clipboard copy
2. Clipboard failures show manual copy option with URL displayed
3. Invalid user IDs handled by existing public profile error handling
4. Network errors use existing retry mechanisms

## Performance Considerations

### Frontend Optimizations
- Reuse existing profile URL generation logic from QRCodeDisplay
- Debounce share button clicks to prevent accidental multiple shares
- Use existing component loading states and error handling
- No additional bundle size impact (uses existing Web APIs)

### Backend Considerations
- No backend changes required
- Uses existing public profile and connection request infrastructure
- Leverages existing performance optimizations and caching
- No additional database operations needed

## Monitoring and Analytics

### Existing Metrics Leveraged
- Public profile view rates (existing)
- Connection request success rates (existing)
- User engagement metrics (existing)

### Optional New Metrics
- Share button click rates
- Web Share API vs clipboard copy usage
- Share method preferences (if trackable via referrers)