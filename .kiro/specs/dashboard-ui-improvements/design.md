# Design Document

## Overview

This design outlines improvements to the Dashboard and AppNav components to create a more streamlined user experience. The Dashboard will be simplified to focus on badge progress and recent connections, removing the tile-based quick actions. The AppNav component will be enhanced with click-outside-to-close functionality and icons for better visual navigation.

## Architecture

### Component Structure

The changes will be isolated to two existing components:

1. **Dashboard Component** (`frontend/src/components/Dashboard.tsx`)
   - Remove the quick-actions tile grid
   - Keep badge progress and recent connections sections
   - Maintain existing data fetching logic

2. **AppNav Component** (`frontend/src/components/AppNav.tsx`)
   - Add click-outside detection using React hooks
   - Add icons to menu items
   - Maintain existing mobile/desktop responsive behavior

### Data Flow

No changes to data flow are required. The Dashboard component will continue to:
- Fetch recent connections via GraphQL
- Display badge progress using the existing BadgeProgress component
- Handle loading and error states

## Components and Interfaces

### Dashboard Component Changes

**Removed Elements:**
- `.quick-actions` grid section containing action cards for:
  - View My QR Code
  - Scan QR Code
  - My Connections
  - Edit Profile

**Retained Elements:**
- Welcome heading
- Badge Progress section
- Recent Connections section
- All existing state management and data fetching logic

**TypeScript Interfaces:**
No changes to existing interfaces. The `Connection` interface remains unchanged.

### AppNav Component Changes

**New Functionality:**

1. **Click-Outside Detection**
   - Use `useEffect` hook to add/remove document click listener
   - Detect clicks outside the menu element using ref
   - Close menu when click is detected outside
   - Clean up event listener on unmount

2. **Menu Icons**
   - Add icon to each menu item using Unicode emoji or SVG
   - Maintain consistent spacing and alignment
   - Icons will be inline with text labels

**Icon Mapping:**
- Home: 🏠
- My Profile: 👤
- Connections: 👥
- My QR Code: 📱
- Scan QR Code: 📷 (already present)
- Sign Out: 🚪

**TypeScript Interfaces:**
No changes to the `AppNavProps` interface.

**Implementation Approach:**
```typescript
// Use useRef to track the menu element
const menuRef = useRef<HTMLDivElement>(null)

// Use useEffect to add click listener when menu is open
useEffect(() => {
  if (!mobileMenuOpen) return

  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setMobileMenuOpen(false)
    }
  }

  // Add listener with slight delay to avoid immediate closure
  const timeoutId = setTimeout(() => {
    document.addEventListener('mousedown', handleClickOutside)
  }, 0)

  return () => {
    clearTimeout(timeoutId)
    document.removeEventListener('mousedown', handleClickOutside)
  }
}, [mobileMenuOpen])
```

## Styling Changes

### Dashboard.css

**Removed Styles:**
- `.quick-actions` grid styles
- `.action-card` styles and hover/active states
- `.action-card-icon` styles
- All media query overrides for quick-actions

**Retained Styles:**
- All `.dashboard-section` styles
- All `.recent-connections` styles
- All `.recent-connection-item` styles
- Responsive breakpoints and media queries for retained elements

### AppNav.css

**New Styles:**
- Icon spacing within menu items (margin-right for icons)
- Ensure icons align properly with text
- Maintain existing responsive behavior

**No Breaking Changes:**
- All existing mobile/desktop styles remain
- Hamburger menu behavior unchanged
- Slide-out animation unchanged

## Error Handling

No new error handling required. Existing error handling in Dashboard component remains:
- GraphQL query errors are caught and displayed via ErrorMessage component
- Auth errors trigger handleAuthError utility
- Loading states shown via LoadingSpinner component

## Testing Strategy

### Manual Testing

1. **Dashboard Simplification**
   - Verify quick-actions tiles are removed
   - Confirm badge progress displays correctly
   - Confirm recent connections display correctly
   - Test on mobile and desktop viewports
   - Verify all links in recent connections work

2. **Click-Outside Menu Closure**
   - Open mobile menu and click outside - menu should close
   - Open mobile menu and click menu item - menu should close
   - Open mobile menu and click hamburger - menu should toggle
   - Verify no interference with desktop horizontal menu
   - Test on various mobile devices and screen sizes

3. **Menu Icons**
   - Verify all menu items have appropriate icons
   - Check icon alignment with text
   - Verify icons are visible in both light and dark backgrounds
   - Test icon rendering on different browsers
   - Ensure icons don't break layout on small screens

### Responsive Testing

- Test on mobile portrait (320px - 767px)
- Test on mobile landscape (max-width 767px)
- Test on tablet (768px - 1024px)
- Test on desktop (1024px+)
- Verify touch targets meet 44px minimum on mobile

### Browser Compatibility

- Test on Chrome, Firefox, Safari, Edge
- Verify emoji icons render consistently
- Test click-outside behavior across browsers

## Implementation Notes

### Click-Outside Implementation Considerations

1. **Event Listener Timing**: Add a small delay before attaching the click listener to prevent the menu from immediately closing when opened
2. **Ref Management**: Use `useRef` to maintain reference to the menu DOM element
3. **Cleanup**: Properly remove event listeners in useEffect cleanup function
4. **Hamburger Button**: Ensure hamburger button clicks don't trigger the outside click handler

### Icon Implementation Considerations

1. **Accessibility**: Icons are decorative and paired with text labels, so no additional ARIA labels needed
2. **Consistency**: Use Unicode emoji for simplicity and consistency with existing "📷" icon
3. **Fallback**: Emoji have good cross-browser support; no fallback needed for modern browsers

### Performance Considerations

1. **Event Listeners**: Only attach click listener when menu is open to minimize overhead
2. **Re-renders**: Click-outside logic won't cause unnecessary re-renders
3. **Bundle Size**: No additional dependencies required

## Migration Path

This is a non-breaking change that simplifies the UI:

1. Users will see a cleaner Dashboard focused on their activity
2. Navigation remains accessible through the AppNav menu
3. All functionality (QR code, scan, connections, profile) remains accessible via menu
4. No data migration or API changes required

## Future Enhancements

Potential future improvements not included in this spec:
- Customizable Dashboard widgets
- User preference for Dashboard layout
- Icon library integration (e.g., React Icons) for more icon options
- Keyboard navigation for menu (Escape key to close)
- Animation improvements for menu transitions
