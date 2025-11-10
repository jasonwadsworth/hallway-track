# Implementation Plan

- [x] 1. Create badge image assets
  - [x] 1.1 Create placeholder SVG badge images for all five badge types
    - Create `frontend/public/badge-images/first-connection.svg` with circular bronze-colored design
    - Create `frontend/public/badge-images/networker.svg` with circular silver-colored design
    - Create `frontend/public/badge-images/socialite.svg` with circular gold-colored design
    - Create `frontend/public/badge-images/connector.svg` with circular platinum-colored design
    - Create `frontend/public/badge-images/legend.svg` with circular diamond/purple-colored design
    - Create `frontend/public/badge-images/default.svg` as fallback image
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Copy badge images to infrastructure assets directory
    - Copy all badge SVG files from `frontend/public/badge-images/` to `infrastructure/assets/badge-images/`
    - Ensure both directories have identical badge image files
    - _Requirements: 1.2_

- [x] 2. Update BadgeDisplay component to use images
  - [x] 2.1 Add badge image URL helper function
    - Create `getBadgeImageUrl(badgeId: string)` function that returns `/badge-images/${badgeId}.svg`
    - Add function to BadgeDisplay.tsx
    - _Requirements: 2.2, 3.2_

  - [x] 2.2 Replace emoji rendering with image rendering
    - Remove `BADGE_EMOJIS` constant from BadgeDisplay.tsx
    - Update badge-icon div to render `<img>` tag instead of emoji
    - Set src to `getBadgeImageUrl(badge.id)`
    - Add alt text using `badge.name`
    - Add onError handler for fallback to default.svg
    - _Requirements: 2.2, 2.3, 3.5_

  - [x] 2.3 Update CSS for image-based badge display
    - Add `.badge-icon-image` class to BadgeDisplay.css
    - Set width and height to 48px
    - Add `object-fit: contain` for aspect ratio preservation
    - Update `.badge-item.locked .badge-icon-image` to apply grayscale filter
    - _Requirements: 2.3, 3.5_

  - [x] 2.4 Ensure badge name is prominently displayed
    - Verify `.badge-name` styling makes the name prominent
    - Ensure badge name appears clearly below or beside the image
    - _Requirements: 2.4, 3.4_

- [x] 3. Update BadgeList component to use images
  - [x] 3.1 Replace emoji rendering with image rendering in BadgeList
    - Remove `BADGE_EMOJIS` constant from BadgeList.tsx
    - Add `getBadgeImageUrl()` helper function (same as BadgeDisplay)
    - Update badge-icon rendering to use `<img>` tag
    - Add onError handler for fallback
    - _Requirements: 2.2, 2.3_

  - [x] 3.2 Verify locked badge styling with images
    - Test that grayscale filter applies correctly to locked badge images
    - Ensure locked badges are visually distinct from earned badges
    - _Requirements: 2.3_

- [x] 4. Add badge section to ConnectionDetail component
  - [x] 4.1 Import BadgeDisplay component in ConnectionDetail
    - Add import statement for BadgeDisplay component
    - _Requirements: 2.1_

  - [x] 4.2 Add badges section to connection detail view
    - Add new detail-section div after contact links section
    - Add "Badges" heading
    - Conditionally render BadgeDisplay when `connectedUser.badges.length > 0`
    - Pass `connectedUser.badges` to BadgeDisplay component
    - _Requirements: 2.1, 2.2, 2.6_

  - [x] 4.3 Handle empty badge state in connection detail
    - Verify empty state message displays when connection has no badges
    - Ensure section doesn't render when badges array is empty
    - _Requirements: 2.6_

- [x] 5. Update PublicProfile component badge display
  - [x] 5.1 Replace hardcoded emoji with badge images in PublicProfile
    - Add `getBadgeImageUrl()` helper function to PublicProfile.tsx
    - Update badge rendering in badges-section to use `<img>` tag
    - Remove hardcoded trophy emoji (🏆)
    - Add proper alt text using badge.name
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 5.2 Ensure badge name is prominently displayed in public profile
    - Verify badge-name styling is consistent with other views
    - Ensure badge description is shown as secondary text
    - _Requirements: 4.2, 4.3_

- [x] 6. Update Profile and Dashboard badge displays
  - [x] 6.1 Update Profile component to use badge images
    - Locate Profile.tsx and identify badge display sections
    - Update any badge rendering to use images instead of emojis
    - Apply consistent styling with other badge displays
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 6.2 Update Dashboard component badge widgets
    - Locate Dashboard.tsx and identify badge-related widgets
    - Update badge rendering to use images
    - Ensure badge names are displayed prominently
    - _Requirements: 3.1, 3.2, 3.4_

- [x] 7. Verify and test badge image display across all views
  - [x] 7.1 Test badge display in all components
    - Verify badges render correctly in ConnectionDetail view
    - Verify badges render correctly in PublicProfile view
    - Verify badges render correctly in Profile view
    - Verify badges render correctly in Dashboard view
    - Verify badges render correctly in BadgeList component
    - _Requirements: 2.1, 2.2, 3.1, 4.1_

  - [x] 7.2 Test error handling and fallback behavior
    - Test image fallback by temporarily breaking an image URL
    - Verify default.svg loads when primary image fails
    - Verify graceful degradation when default.svg also fails
    - _Requirements: 3.6_

  - [x] 7.3 Test empty state handling
    - Test ConnectionDetail with user who has no badges
    - Test PublicProfile with user who has no badges
    - Verify appropriate empty state messages display
    - _Requirements: 2.6_

  - [x] 7.4 Test responsive design
    - Test badge display on mobile viewport (320px-480px)
    - Test badge display on tablet viewport (768px-1024px)
    - Test badge display on desktop viewport (1200px+)
    - Verify images scale appropriately and maintain aspect ratio
    - _Requirements: 2.3, 3.3_
