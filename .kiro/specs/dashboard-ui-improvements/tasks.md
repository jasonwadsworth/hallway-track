# Implementation Plan

- [x] 1. Simplify Dashboard component by removing quick-actions tiles
  - Remove the quick-actions grid JSX section from Dashboard.tsx
  - Remove all quick-actions related CSS from Dashboard.css including action-card styles
  - Remove media query overrides for quick-actions in all breakpoints
  - Verify badge progress and recent connections sections remain intact
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Add click-outside-to-close functionality to AppNav
  - [x] 2.1 Implement click-outside detection hook in AppNav.tsx
    - Import useRef and useEffect from React
    - Create menuRef using useRef to reference the nav-links element
    - Add useEffect hook that listens for clicks outside the menu
    - Implement handleClickOutside function to check if click is outside menu bounds
    - Add event listener with setTimeout to prevent immediate closure on menu open
    - Clean up event listener in useEffect return function
    - _Requirements: 2.1, 2.3_

  - [x] 2.2 Apply ref to menu element and verify behavior
    - Add ref attribute to the nav-links div element
    - Ensure hamburger button is excluded from outside click detection
    - Verify menu closes when clicking outside on mobile
    - Verify menu closes when clicking menu items
    - _Requirements: 2.1, 2.2, 2.4_

- [x] 3. Add icons to AppNav menu items
  - [x] 3.1 Add Unicode emoji icons to each menu item
    - Add 🏠 icon to Home link
    - Add 👤 icon to My Profile link
    - Add 👥 icon to Connections link
    - Add 📱 icon to My QR Code link
    - Scan QR Code already has 📷 icon
    - Add 🚪 icon to Sign Out button
    - _Requirements: 3.1, 3.2_

  - [x] 3.2 Style icons for proper alignment and spacing
    - Add CSS to ensure consistent spacing between icons and text
    - Verify icon alignment in both mobile and desktop views
    - Test icon visibility against navigation background color
    - Ensure icons don't break layout on small screens
    - _Requirements: 3.3, 3.4, 3.5_

- [ ]* 4. Test responsive behavior and cross-browser compatibility
  - Test Dashboard on mobile portrait, landscape, tablet, and desktop viewports
  - Test AppNav click-outside behavior on mobile devices
  - Verify menu icons render correctly across Chrome, Firefox, Safari, Edge
  - Verify touch targets meet 44px minimum on mobile
  - Test that all navigation links still work correctly
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_
