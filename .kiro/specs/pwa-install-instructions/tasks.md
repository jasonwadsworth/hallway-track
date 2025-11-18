# Implementation Plan

- [x] 1. Update PWAInstallPrompt component with iOS-specific share icon and improved formatting
  - Replace the generic Android share icon SVG with iOS-specific share icon (square with upward arrow)
  - Improve instruction text formatting with better spacing between steps
  - Add proper visual hierarchy with step numbers displayed more prominently
  - Enhance overall layout spacing and typography for better readability
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2. Update PWAInstallButton component modal with enhanced instruction formatting
  - Improve modal instruction text with better visual hierarchy
  - Add iOS-specific share icon to the instruction steps
  - Enhance spacing and typography in the modal for better readability
  - Ensure consistent formatting with PWAInstallPrompt component
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x]* 3. Add platform detection and Android-specific instructions
  - Add `isAndroid()` function to pwa.ts utility
  - Create Android-specific share icon SVG
  - Implement conditional rendering for Android vs iOS instructions
  - Update both components to use platform-specific icons and text
  - _Requirements: 2.1, 2.2, 2.3_
