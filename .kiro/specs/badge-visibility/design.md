# Design Document: Badge Visibility with Images

## Overview

This design replaces the current emoji-based badge display system with a proper image-based badge system. The implementation will create placeholder SVG badge images, update all badge display components to use images instead of emojis, and ensure consistent badge presentation across all views (Connection Detail, Public Profile, Profile View, and Dashboard).

The design maintains the existing badge data structure and GraphQL schema while enhancing the visual presentation layer. Badge images will be stored in the public directory similar to link-type images, making them accessible without additional API calls.

## Architecture

### Component Architecture

```
Badge Display System
├── Badge Images (Static Assets)
│   ├── /frontend/public/badge-images/*.svg
│   └── /infrastructure/assets/badge-images/*.svg (for CDK deployment)
│
├── Badge Display Components (React)
│   ├── BadgeDisplay.tsx (updated to use images)
│   ├── BadgeList.tsx (updated to use images)
│   └── ConnectionDetail.tsx (add badge section)
│
└── Data Layer (No changes)
    └── GraphQL queries already return badge data
```

### Data Flow

1. **Badge Images**: Static SVG files served from `/badge-images/` directory
2. **Badge Data**: Retrieved via existing GraphQL queries (getMyProfile, getPublicProfile, getMyConnections)
3. **Badge Rendering**: Components map badge.id to image URL and display with badge.name and badge.description

## Components and Interfaces

### 1. Badge Image Assets

**Location**: `frontend/public/badge-images/` and `infrastructure/assets/badge-images/`

**Files to Create**:
- `first-connection.svg` - Badge for first connection (1 connection)
- `networker.svg` - Badge for networker (5 connections)
- `socialite.svg` - Badge for socialite (10 connections)
- `connector.svg` - Badge for super connector (25 connections)
- `legend.svg` - Badge for networking legend (50 connections)

**Image Specifications**:
- Format: SVG (scalable vector graphics)
- Dimensions: 64x64 viewBox
- Style: Simple, distinct geometric patterns with different colors
- Colors: Use vibrant, distinct colors for each badge tier

**Placeholder Design Approach**:
- Use circular badge shapes with different colors
- Include simple icons or patterns (star, trophy, crown, etc.)
- Ensure visual hierarchy: higher-tier badges should feel more prestigious

### 2. Badge Display Component Updates

**File**: `frontend/src/components/BadgeDisplay.tsx`

**Changes**:
- Remove `BADGE_EMOJIS` constant
- Add `getBadgeImageUrl()` helper function
- Update badge-icon rendering to use `<img>` tag instead of emoji
- Add error handling for missing images (fallback to generic badge icon)
- Update badge name to be more prominent in the display

**New Helper Function**:
```typescript
function getBadgeImageUrl(badgeId: string): string {
  return `/badge-images/${badgeId}.svg`;
}
```

**Image Rendering**:
```typescript
<img
  src={getBadgeImageUrl(badge.id)}
  alt={badge.name}
  className="badge-icon-image"
  onError={(e) => {
    // Fallback to generic badge icon if image fails to load
    e.currentTarget.src = '/badge-images/default.svg';
  }}
/>
```

### 3. Badge List Component Updates

**File**: `frontend/src/components/BadgeList.tsx`

**Changes**:
- Remove `BADGE_EMOJIS` constant
- Use same `getBadgeImageUrl()` helper
- Update rendering to use images
- Maintain locked/earned state styling
- Apply grayscale filter to locked badge images via CSS

### 4. Connection Detail Component Updates

**File**: `frontend/src/components/ConnectionDetail.tsx`

**Changes**:
- Add new badge section after contact links section
- Import and use `BadgeDisplay` component
- Pass `connectedUser.badges` to the component
- Handle empty badge state gracefully

**New Section Structure**:
```typescript
{connectedUser.badges.length > 0 && (
  <div className="detail-section">
    <h3>Badges</h3>
    <BadgeDisplay badges={connectedUser.badges} />
  </div>
)}
```

### 5. Public Profile Component Updates

**File**: `frontend/src/components/PublicProfile.tsx`

**Changes**:
- Update existing badges section to use images instead of hardcoded emoji
- Use `getBadgeImageUrl()` helper
- Ensure badge name is prominently displayed
- Maintain existing layout structure

### 6. CSS Updates

**File**: `frontend/src/components/BadgeDisplay.css`

**Changes**:
- Update `.badge-icon` styles for image display
- Add `.badge-icon-image` class for proper image sizing
- Ensure images are sized consistently (48x48px or 64x64px)
- Add object-fit property to maintain aspect ratio
- Update locked state to apply grayscale filter to images

**New CSS**:
```css
.badge-icon-image {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.badge-item.locked .badge-icon-image {
  filter: grayscale(100%);
  opacity: 0.5;
}
```

## Data Models

### Existing Badge Type (No Changes)

```typescript
interface Badge {
  id: string;              // e.g., 'first-connection', 'networker'
  name: string;            // e.g., 'Ice Breaker', 'Networker'
  description: string;     // e.g., 'Made your first connection'
  threshold: number;       // e.g., 1, 5, 10, 25, 50
  iconUrl?: string;        // Optional, not currently used
  earnedAt?: string;       // ISO timestamp when badge was earned
}
```

**Note**: The `iconUrl` field exists in the schema but is not currently populated. This design uses client-side URL construction instead of storing URLs in the database, keeping the implementation simple and avoiding database migrations.

### Badge Configuration

**File**: `frontend/src/components/BadgeList.tsx` (existing)

```typescript
const ALL_BADGES = [
  { id: 'first-connection', name: 'Ice Breaker', threshold: 1, description: 'Made your first connection' },
  { id: 'networker', name: 'Networker', threshold: 5, description: 'Connected with 5 people' },
  { id: 'socialite', name: 'Socialite', threshold: 10, description: 'Connected with 10 people' },
  { id: 'connector', name: 'Super Connector', threshold: 25, description: 'Connected with 25 people' },
  { id: 'legend', name: 'Networking Legend', threshold: 50, description: 'Connected with 50 people' },
];
```

This configuration remains unchanged and serves as the source of truth for badge definitions.

## Error Handling

### Image Loading Failures

**Strategy**: Graceful degradation with fallback images

1. **Primary**: Load badge-specific image from `/badge-images/{badgeId}.svg`
2. **Fallback**: If image fails to load, use generic `/badge-images/default.svg`
3. **Ultimate Fallback**: If default.svg also fails, display badge name as text with styled background

**Implementation**:
```typescript
<img
  src={getBadgeImageUrl(badge.id)}
  alt={badge.name}
  onError={(e) => {
    const target = e.currentTarget;
    if (target.src.includes('default.svg')) {
      // Already tried fallback, hide image and rely on text
      target.style.display = 'none';
    } else {
      target.src = '/badge-images/default.svg';
    }
  }}
/>
```

### Missing Badge Data

**Strategy**: Display appropriate empty states

- **No badges earned**: Show encouraging message "No badges earned yet. Start connecting!"
- **Badge data missing**: Log error and skip rendering that badge
- **Invalid badge ID**: Use default badge image

## Testing Strategy

### Visual Testing

1. **Badge Image Display**: Verify all 5 badge images render correctly
2. **Responsive Design**: Test badge display on mobile, tablet, and desktop
3. **Fallback Behavior**: Test with intentionally broken image URLs
4. **Empty States**: Test views with users who have no badges

### Component Testing

1. **BadgeDisplay Component**: Test with various badge arrays (empty, single, multiple)
2. **Image Loading**: Test onError handler with mock failed image loads
3. **Badge Name Display**: Verify badge names are prominently displayed
4. **Locked State**: Verify grayscale filter applies to locked badges in BadgeList

### Integration Testing

1. **Connection Detail View**: Verify badges appear for connections with earned badges
2. **Public Profile View**: Verify badges display correctly for other users
3. **Profile View**: Verify own badges display correctly
4. **Dashboard**: Verify badge components integrate properly

### Manual Testing Checklist

- [ ] All 5 placeholder badge images are visually distinct
- [ ] Badge images load correctly in all views
- [ ] Badge names are clearly visible and readable
- [ ] Badge descriptions provide helpful context
- [ ] Locked badges appear grayed out in BadgeList
- [ ] Empty state messages display when no badges earned
- [ ] Fallback images work when primary image fails
- [ ] Layout remains consistent across different screen sizes
- [ ] Images maintain aspect ratio and don't appear distorted

## Implementation Notes

### Badge Image Creation

Placeholder badge images should be simple SVG files with:
- Circular or shield-shaped backgrounds
- Distinct colors for each tier (bronze → silver → gold → platinum → diamond concept)
- Simple iconography (star, handshake, trophy, rocket, crown)
- Clean, professional appearance suitable for a networking app

### Deployment Considerations

1. **Frontend Deployment**: Badge images in `frontend/public/badge-images/` will be deployed with the React app to S3/CloudFront
2. **Infrastructure Assets**: Copy badge images to `infrastructure/assets/badge-images/` for CDK deployment consistency
3. **Cache Headers**: Badge images should have long cache times since they're static assets
4. **CDN Distribution**: CloudFront will serve badge images globally with low latency

### Future Extensibility

This design prepares for future badge types:
- Badge IDs are used as filenames, making it easy to add new badges
- No hardcoded badge lists in display components
- Badge configuration in `BadgeList.tsx` can be extended
- Image-based system supports custom badge designs
- No database schema changes required to add new badge types

## Performance Considerations

### Image Optimization

- **SVG Format**: Scalable without quality loss, small file size
- **Lazy Loading**: Use `loading="lazy"` attribute for images below the fold
- **Caching**: Browser will cache badge images after first load
- **CDN**: CloudFront serves images from edge locations

### Bundle Size

- Badge images are static assets, not bundled with JavaScript
- No impact on initial JavaScript bundle size
- Images loaded on-demand as components render

### Rendering Performance

- Simple image rendering has minimal performance impact
- CSS transforms (grayscale filter) are GPU-accelerated
- No complex calculations or state management required

## Security Considerations

### Image Sources

- All badge images served from same origin (CloudFront/S3)
- No external image URLs or user-provided images
- SVG files should be sanitized to prevent XSS (use trusted sources only)

### Data Privacy

- Badge data is already public in the GraphQL schema
- No additional privacy concerns introduced
- Badges visible to all connected users (as per requirements)

## Accessibility

### Image Alt Text

- All badge images must have descriptive alt text using badge.name
- Screen readers will announce badge names clearly

### Color Contrast

- Badge names and descriptions must meet WCAG AA contrast requirements
- Don't rely solely on color to convey badge tier (use iconography too)

### Keyboard Navigation

- Badge displays should be keyboard accessible
- Focus states should be visible for interactive badge elements

## Migration Path

### Phase 1: Create Badge Images
1. Generate 5 placeholder SVG badge images
2. Add images to `frontend/public/badge-images/`
3. Copy images to `infrastructure/assets/badge-images/`
4. Create default.svg fallback image

### Phase 2: Update Components
1. Update BadgeDisplay.tsx to use images
2. Update BadgeList.tsx to use images
3. Update PublicProfile.tsx badges section
4. Add badge section to ConnectionDetail.tsx

### Phase 3: Update Styles
1. Update BadgeDisplay.css for image rendering
2. Test responsive layouts
3. Verify locked state styling

### Phase 4: Testing & Deployment
1. Run visual tests across all views
2. Test error handling and fallbacks
3. Deploy to staging environment
4. Conduct user acceptance testing
5. Deploy to production
