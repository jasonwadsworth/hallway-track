# Design Document

## Overview

The Badge Showcase feature adds a dedicated page to the Hallway Track application where users can view all available badges, their unlock criteria, and their progress toward earning them. This feature leverages the existing badge system infrastructure (BadgeList component, badge types, and badge images) and integrates it into the application's navigation structure.

The design follows the existing patterns in the application: React components with TypeScript, GraphQL queries for data fetching, and responsive CSS for mobile-first design.

## Architecture

### Component Structure

```
BadgeShowcase (new page component)
├── Uses existing BadgeList component
├── Fetches user profile data via GraphQL
└── Displays all badges with earned/locked states
```

### Routing

A new route `/badges` will be added to the application's routing configuration in `App.tsx`, protected by the `ProtectedRoute` component to ensure only authenticated users can access it.

### Navigation

The `AppNav` component will be updated to include a link to the Badge Showcase page, positioned logically within the existing navigation menu.

## Components and Interfaces

### New Component: BadgeShowcase

**Location:** `frontend/src/components/BadgeShowcase.tsx`

**Purpose:** Page-level component that fetches user data and displays the badge showcase

**Key Responsibilities:**
- Fetch user profile data (including earned badges and connection count) using the existing `getMyProfile` GraphQL query
- Handle loading and error states
- Render the existing `BadgeList` component with fetched data
- Provide a page header and context for the badge showcase

**Props:** None (page component)

**State:**
- `earnedBadges: Badge[]` - List of badges the user has earned
- `connectionCount: number` - Current connection count for progress calculation
- `loading: boolean` - Loading state during data fetch
- `error: string | null` - Error message if data fetch fails

**Dependencies:**
- Existing `BadgeList` component for rendering badges
- Existing `LoadingSpinner` component for loading state
- Existing `ErrorMessage` component for error handling
- Existing `getMyProfile` GraphQL query
- Existing utility functions: `parseGraphQLError`, `handleAuthError`

### Modified Component: AppNav

**Location:** `frontend/src/components/AppNav.tsx`

**Changes:**
- Add a new navigation link for "🏆 Badges" pointing to `/badges`
- Position the link logically in the navigation menu (suggested: after "Connections", before "My QR Code")
- Ensure mobile menu closes when the link is clicked (using existing `closeMobileMenu` function)

### Modified Component: BadgeProgress

**Location:** `frontend/src/components/BadgeProgress.tsx`

**Changes:**
- Update the component to display earned badges instead of only showing progress to the next badge
- Display earned badges in a horizontal layout with badge images and names
- Make each badge clickable, navigating to `/badges` when clicked
- Show badge names in small font below each badge image
- Maintain the existing loading and error handling logic
- For users with no earned badges, continue showing progress toward the first badge

**New Functionality:**
- Import `useNavigate` from `react-router-dom` for navigation
- Filter earned badges from the user's badge list
- Render earned badges in a grid/horizontal layout
- Add click handlers to navigate to `/badges` page
- Update CSS to support the new earned badges display layout

### Existing Component: BadgeList (No Changes Required)

**Location:** `frontend/src/components/BadgeList.tsx`

**Current Functionality:**
- Displays all badges in a grid layout
- Shows earned vs locked states with visual distinction
- Displays progress information ("X more to unlock")
- Handles badge images with fallback to default
- Already implements responsive design

**Why No Changes:** The existing `BadgeList` component already implements all the requirements for the badge showcase. It accepts `earnedBadges` and `connectionCount` as props and handles all the display logic internally.

## Data Models

### Existing Types (No Changes)

The feature uses existing TypeScript interfaces from `frontend/src/types.ts`:

```typescript
interface Badge {
  id: string;
  name: string;
  description: string;
  threshold: number;
  iconUrl?: string;
  earnedAt?: string;
}

interface User {
  id: string;
  email: string;
  displayName: string;
  gravatarHash: string;
  contactLinks: ContactLink[];
  badges: Badge[];
  connectionCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### Badge Configuration

The badge configuration is hardcoded in `BadgeList.tsx`:

```typescript
const ALL_BADGES = [
  { id: 'first-connection', name: 'Ice Breaker', threshold: 1, description: 'Made your first connection' },
  { id: 'networker', name: 'Networker', threshold: 5, description: 'Connected with 5 people' },
  { id: 'socialite', name: 'Socialite', threshold: 10, description: 'Connected with 10 people' },
  { id: 'connector', name: 'Super Connector', threshold: 25, description: 'Connected with 25 people' },
  { id: 'legend', name: 'Networking Legend', threshold: 50, description: 'Connected with 50 people' },
];
```

This configuration remains unchanged and is used by the `BadgeList` component.

## Data Flow

1. User navigates to `/badges` route
2. `BadgeShowcase` component mounts and triggers data fetch
3. Component calls `getMyProfile` GraphQL query via AWS Amplify
4. GraphQL query returns user profile with `badges` array and `connectionCount`
5. Component passes data to `BadgeList` component as props
6. `BadgeList` renders all badges with appropriate earned/locked states
7. `BadgeList` calculates and displays progress for locked badges

### GraphQL Query

Uses existing `getMyProfile` query from `frontend/src/graphql/queries.ts`:

```graphql
query GetMyProfile {
  getMyProfile {
    id
    email
    displayName
    gravatarHash
    contactLinks {
      id
      label
      url
      visible
    }
    badges {
      id
      name
      description
      threshold
      earnedAt
    }
    connectionCount
    createdAt
    updatedAt
  }
}
```

No changes to GraphQL schema or queries are required.

## Error Handling

The `BadgeShowcase` component will implement error handling consistent with other components in the application:

1. **Network Errors:** Display error message with retry button using `ErrorMessage` component
2. **Authentication Errors:** Automatically handle via `handleAuthError()` utility
3. **GraphQL Errors:** Parse using `parseGraphQLError()` utility and display user-friendly message
4. **Image Loading Errors:** Handled by `BadgeList` component (fallback to default badge image)

## Styling

### New Stylesheet: BadgeShowcase.css

**Location:** `frontend/src/components/BadgeShowcase.css`

**Styling Requirements:**
- Page container with consistent padding and max-width
- Page header styling (title and optional description)
- Responsive layout that works on mobile, tablet, and desktop
- Consistent with existing application styling patterns

### Existing Stylesheet: BadgeDisplay.css (No Changes)

The `BadgeList` component already uses `BadgeDisplay.css` which includes:
- Responsive grid layout for badges
- Visual distinction between earned and locked badges (opacity, grayscale filter)
- Badge card styling with icon, name, description, and metadata
- Progress indicators for locked badges
- Mobile-responsive breakpoints

### Modified Stylesheet: BadgeProgress.css

**Location:** `frontend/src/components/BadgeProgress.css`

**New Styling Requirements:**
- Earned badges container with horizontal layout
- Individual earned badge styling (image + name)
- Clickable badge styling with hover effects
- Small font size for badge names
- Responsive layout that scrolls horizontally on mobile
- Grid layout for earned badges on larger screens

## Responsive Design

The feature will be fully responsive using existing CSS patterns:

- **Mobile (< 768px):** Single column badge grid
- **Tablet (768px - 1024px):** Two column badge grid
- **Desktop (> 1024px):** Three or four column badge grid

These breakpoints are already implemented in `BadgeDisplay.css` and will work automatically.

## Testing Strategy

### Manual Testing

1. **Navigation Test:**
   - Verify badge showcase link appears in navigation
   - Verify clicking link navigates to `/badges` route
   - Verify navigation link highlights when on badges page

2. **Data Display Test:**
   - Verify all 5 badges are displayed
   - Verify earned badges show "Earned" indicator and earned date
   - Verify locked badges show progress ("X more to unlock")
   - Verify badge images load correctly with fallback

3. **Responsive Test:**
   - Test on mobile viewport (< 768px)
   - Test on tablet viewport (768px - 1024px)
   - Test on desktop viewport (> 1024px)
   - Verify grid layout adapts appropriately

4. **Error Handling Test:**
   - Test with network disconnected (should show error message)
   - Test retry functionality after error
   - Verify error dismissal works

5. **Loading State Test:**
   - Verify loading spinner appears during data fetch
   - Verify smooth transition from loading to content

### Edge Cases

1. **No Badges Earned:** User with 0 connections should see all badges as locked
2. **All Badges Earned:** User with 50+ connections should see all badges as earned
3. **Partial Progress:** User with various connection counts should see accurate progress
4. **Missing Badge Images:** Fallback to default badge image should work

## Implementation Notes

### Simplicity First

This design follows the "simplicity first" principle from the technical standards:
- Reuses existing `BadgeList` component without modification
- Uses existing GraphQL queries and types
- Minimal new code (one new page component, one navigation link, one stylesheet)
- No new abstractions or complex patterns

### TypeScript Compliance

All new code will:
- Use explicit types for all function parameters and return values
- Avoid the `any` type
- Leverage existing type definitions from `types.ts`

### Performance Considerations

- Single GraphQL query on page load (no excessive API calls)
- Badge images are cached by the browser
- Component uses React hooks efficiently (useEffect for data fetching)
- No unnecessary re-renders

## Future Enhancements (Out of Scope)

These features are not part of the initial implementation but could be added later:
- Badge detail modal with expanded information
- Share badge achievements on social media
- Badge filtering or sorting options
- Animated badge unlock celebrations
- Badge categories or groupings
