# Implementation Plan

- [x] 1. Create BadgeShowcase page component
  - Create `frontend/src/components/BadgeShowcase.tsx` with TypeScript
  - Implement data fetching using `getMyProfile` GraphQL query
  - Add loading state with `LoadingSpinner` component
  - Add error handling with `ErrorMessage` component and retry functionality
  - Render `BadgeList` component with fetched `earnedBadges` and `connectionCount` props
  - Include page header with title "Badge Showcase" or "Available Badges"
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3_

- [x] 2. Create BadgeShowcase stylesheet
  - Create `frontend/src/components/BadgeShowcase.css`
  - Style page container with consistent padding and max-width
  - Style page header (title and optional description text)
  - Ensure responsive layout that adapts to mobile, tablet, and desktop viewports
  - Follow existing application styling patterns for consistency
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 3. Add badge showcase route to application
  - Update `frontend/src/App.tsx` to add new `/badges` route
  - Wrap route with `ProtectedRoute` component to require authentication
  - Import and render `BadgeShowcase` component for the route
  - _Requirements: 2.1, 2.2_

- [x] 4. Add badge showcase link to navigation
  - Update `frontend/src/components/AppNav.tsx` to add navigation link
  - Add link with text "🏆 Badges" pointing to `/badges` route
  - Position link after "Connections" and before "My QR Code" in navigation menu
  - Ensure link calls `closeMobileMenu` on click for mobile menu behavior
  - Verify link highlights when user is on `/badges` page (handled automatically by React Router's Link component)
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Update BadgeProgress component to display earned badges
  - Update `frontend/src/components/BadgeProgress.tsx` to fetch and display earned badges
  - Import `useNavigate` from `react-router-dom` for navigation functionality
  - Fetch user's earned badges from the `getMyProfile` GraphQL query response
  - Create a section to display earned badges with images and names
  - Add click handlers to each badge that navigate to `/badges` page
  - Display badge names in small font below badge images
  - Handle the case where user has no earned badges (show progress to next badge)
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 6. Update BadgeProgress stylesheet for earned badges display
  - Update `frontend/src/components/BadgeProgress.css` to style earned badges section
  - Create styles for earned badges container with horizontal/grid layout
  - Style individual earned badge items (image + name)
  - Add hover effects for clickable badges
  - Implement responsive layout that scrolls horizontally on mobile devices
  - Use grid layout for earned badges on larger screens
  - _Requirements: 5.1, 5.2, 5.5_
