# Implementation Plan

- [x] 1. Enhance AppNav component with current page detection and desktop sidebar layout
  - Add useLocation hook to detect current route path
  - Implement desktop sidebar layout with CSS Grid/Flexbox
  - Add current page highlighting logic for both desktop and mobile
  - Update mobile menu toggle behavior to close when already open
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2, 3.4_

- [x] 2. Update AppNav CSS for responsive sidebar design
  - Create desktop sidebar styles (250px width, fixed position)
  - Implement current page highlighting styles for desktop and mobile
  - Adjust main content area margin for desktop sidebar
  - Enhance mobile menu visual feedback and transitions
  - _Requirements: 1.1, 1.3, 2.3, 3.2, 3.3_

- [x] 3. Create modal system components
  - [x] 3.1 Create reusable Modal base component
    - Implement modal overlay and container structure
    - Add focus trapping and escape key handling
    - Include accessibility features (ARIA labels, focus management)
    - _Requirements: 4.2, 5.2_

  - [x] 3.2 Create ProfileEditModal component
    - Wrap existing ProfileEdit component in modal structure
    - Add modal header with title and close button
    - Implement save/cancel actions that close modal
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 3.3 Create ContactLinkModal component
    - Wrap existing ContactLinkManager component in modal structure
    - Add modal header with title and close button
    - Implement close action that returns to profile view
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 4. Refactor Profile component to use modals instead of tabs
  - Remove tab-based navigation from Profile component
  - Add buttons to open ProfileEditModal and ContactLinkModal
  - Update ProfileView component to include edit and manage links buttons
  - Remove tab-related CSS and state management
  - _Requirements: 4.1, 4.4, 5.1, 5.4_

- [x] 5. Update App.tsx layout for desktop sidebar
  - Modify main content area styling to accommodate left sidebar
  - Ensure proper responsive behavior at breakpoint boundaries
  - Test layout with all existing routes and components
  - _Requirements: 1.1, 1.4_

- [ ]* 6. Add comprehensive testing for navigation improvements
  - Write tests for current page highlighting functionality
  - Test mobile menu toggle behavior (open/close states)
  - Test modal open/close interactions and form submissions
  - Test responsive layout behavior at different screen sizes
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_