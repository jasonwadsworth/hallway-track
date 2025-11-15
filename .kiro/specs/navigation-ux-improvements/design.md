# Design Document

## Overview

This design transforms the current navigation system from a mobile-first horizontal layout to a responsive design that provides an optimal experience on both desktop and mobile devices. The key improvements include a left-sidebar navigation for desktop, enhanced mobile menu behavior, active page highlighting, and modal-based profile management.

## Architecture

### Layout Structure

The application will maintain its current React Router structure but with enhanced layout components:

```
App
├── AppNav (Enhanced)
│   ├── Desktop: Left Sidebar Layout
│   └── Mobile: Slide-out Menu (Enhanced)
├── Main Content Area
│   ├── Desktop: Adjusted for left sidebar
│   └── Mobile: Full width
└── Modal System (New)
    ├── ProfileEditModal
    └── ContactLinkModal
```

### Responsive Breakpoints

- **Mobile**: < 768px - Slide-out menu behavior
- **Desktop**: ≥ 768px - Left sidebar navigation

## Components and Interfaces

### 1. Enhanced AppNav Component

**Current State Management:**
```typescript
interface AppNavState {
  mobileMenuOpen: boolean
  pendingRequestsCount: number
  currentPath: string // New
}
```

**New Props:**
```typescript
interface AppNavProps {
  signOut?: () => void
  currentPath: string // New - passed from router
}
```

### 2. Modal System Components

**ProfileEditModal:**
```typescript
interface ProfileEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}
```

**ContactLinkModal:**
```typescript
interface ContactLinkModalProps {
  isOpen: boolean
  onClose: () => void
}
```

### 3. Updated Profile Component

The Profile component will be simplified to remove tabs and use modals:

```typescript
interface ProfileState {
  showEditModal: boolean
  showContactModal: boolean
}
```

## Data Models

### Navigation Item Model

```typescript
interface NavigationItem {
  path: string
  label: string
  icon: string
  badge?: number // For notification counts
}
```

### Modal State Model

```typescript
interface ModalState {
  profileEdit: boolean
  contactLinks: boolean
}
```

## Design Specifications

### Desktop Navigation (≥ 768px)

**Layout:**
- Fixed left sidebar: 250px width
- Main content: `margin-left: 250px`
- Sidebar: Full height, fixed position
- Background: `#232f3e` (current nav color)

**Visual Design:**
- Vertical menu items with consistent spacing
- Current page highlight: Subtle left border (`#ff9900`, 3px) + background tint
- Hover states: Light background overlay
- Brand logo at top of sidebar

**Navigation Items:**
```
HallwayTrak (Brand)
─────────────────
🏠 Home
👤 My Profile
👥 Connections
📬 Requests [badge]
🏆 Badges
📱 My QR Code
📷 Scan QR Code
─────────────────
🚪 Sign Out
```

### Mobile Navigation (< 768px)

**Enhanced Behavior:**
- Current slide-out from right maintained
- **New**: Toggle behavior - clicking menu button when open closes menu
- Current page highlighting maintained in mobile menu
- Touch-friendly sizing preserved

### Current Page Highlighting

**Visual Specification:**
- **Desktop**: Left border (3px, `#ff9900`) + background tint (`rgba(255, 153, 0, 0.1)`)
- **Mobile**: Background highlight (`rgba(255, 153, 0, 0.15)`)
- **Text**: Slightly bolder weight for active item

### Modal Design System

**Modal Container:**
- Overlay: `rgba(0, 0, 0, 0.5)`
- Modal: Centered, max-width 600px, white background
- Border radius: 8px
- Box shadow: `0 4px 20px rgba(0, 0, 0, 0.15)`

**Profile Edit Modal:**
- Header: "Edit Profile" with close button
- Content: Current ProfileEdit component content
- Actions: Save, Cancel buttons

**Contact Links Modal:**
- Header: "Manage Contact Links" with close button
- Content: Current ContactLinkManager component content
- Actions: Close button

## Error Handling

### Navigation State Management

- **Route Detection**: Use `useLocation` hook to track current path
- **Modal State**: Prevent multiple modals open simultaneously
- **Mobile Menu**: Handle outside clicks and escape key
- **Responsive**: Graceful degradation if CSS features unsupported

### Modal Error Handling

- **Form Validation**: Maintain existing validation in modal components
- **Save Failures**: Display error messages within modal
- **Network Issues**: Prevent modal close during save operations

## Testing Strategy

### Component Testing Focus

1. **Navigation Highlighting**: Verify correct active state for each route
2. **Mobile Menu Toggle**: Test open/close behavior with menu button
3. **Modal Interactions**: Test open/close and form submission flows
4. **Responsive Behavior**: Test layout at breakpoint boundaries

### Integration Testing

1. **Route Navigation**: Verify active highlighting updates on navigation
2. **Modal Data Flow**: Test profile/contact data persistence through modals
3. **Mobile UX**: Test menu behavior on actual mobile devices

### Accessibility Testing

1. **Keyboard Navigation**: Tab order through sidebar and modals
2. **Screen Reader**: Proper ARIA labels for navigation states
3. **Focus Management**: Modal focus trapping and restoration

## Implementation Notes

### CSS Architecture

- Maintain mobile-first approach in media queries
- Use CSS Grid/Flexbox for sidebar layout
- CSS custom properties for consistent theming
- Smooth transitions for responsive changes

### State Management

- Use React Router's `useLocation` for current path detection
- Local component state for modal visibility
- Maintain existing authentication and data fetching patterns

### Performance Considerations

- Lazy load modal components if bundle size becomes concern
- Maintain existing navigation performance characteristics
- CSS transforms for smooth mobile menu animations