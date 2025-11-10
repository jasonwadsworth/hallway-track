# Design Document: Fixed Contact Link Types

## Overview

This design transforms the contact link system from accepting free-form text labels to using a predefined set of link types. The change affects both frontend UI components and backend API. The implementation will introduce a centralized link type configuration in a Lambda function, update the ContactLinkManager component to use a dropdown selector, and add duplicate prevention logic.

## Architecture

### High-Level Changes

The implementation requires both frontend and backend changes to support server-side link type management:

1. **Frontend Layer**: Updated UI components with dropdown selection, duplicate detection, and image rendering; fetches available link types from backend
2. **Backend Layer**: New GraphQL query to retrieve link types, Lambda function with hardcoded configuration to serve link types
3. **Data Layer**: No new tables; existing ContactLink structure remains unchanged

### Component Interaction Flow

```
User Opens Add Link Form
    ↓
ContactLinkManager Component
    ↓
GraphQL Query (getLinkTypes)
    ↓
Lambda Function (returns hardcoded link types with CloudFront image URLs)
    ↓
Frontend displays dropdown with images
    ↓
User selects type and submits
    ↓
GraphQL Mutation (addContactLink with selected label)
    ↓
Lambda Function (existing logic)
    ↓
DynamoDB Users Table (stores with predefined label)
```

## Components and Interfaces

### 1. Backend: Link Types Configuration and API

Create a hardcoded configuration in the Lambda function that defines available link types and a GraphQL API to retrieve them.

**Link Type Configuration**:

**File**: `infrastructure/lambda/link-types/linkTypeConfig.ts`

```typescript
interface LinkTypeDefinition {
  id: string;
  label: string;
  imageUrl: string;     // S3/CloudFront URL to logo image
  placeholder: string;
  urlPattern?: string;  // Optional regex pattern as string
  sortOrder: number;
}

export const LINK_TYPES: LinkTypeDefinition[] = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    imageUrl: '${CLOUDFRONT_URL}/link-types/linkedin.png',
    placeholder: 'https://linkedin.com/in/username',
    urlPattern: '^https?:\\/\\/(www\\.)?linkedin\\.com\\/.+',
    sortOrder: 1
  },
  {
    id: 'github',
    label: 'GitHub',
    imageUrl: '${CLOUDFRONT_URL}/link-types/github.png',
    placeholder: 'https://github.com/username',
    urlPattern: '^https?:\\/\\/(www\\.)?github\\.com\\/.+',
    sortOrder: 2
  },
  // ... additional link types
];
```

**Initial Link Types**:
- LinkedIn
- GitHub
- Twitter/X
- Email
- Website
- Facebook
- Instagram
- Mastodon
- Bluesky
- Phone

**GraphQL Schema Addition**:
```graphql
type LinkType {
  id: ID!
  label: String!
  imageUrl: AWSURL!
  placeholder: String!
  urlPattern: String
  sortOrder: Int!
}

type Query {
  getLinkTypes: [LinkType!]!
  # ... existing queries
}
```

**Lambda Function**: `infrastructure/lambda/link-types/index.ts`

This function will:
- Import the LINK_TYPES configuration
- Replace ${CLOUDFRONT_URL} placeholder with actual CloudFront URL from environment variable
- Return the list to the frontend

**Image Storage**:
- Store link type logo images in S3 bucket (same bucket as other static assets)
- Images should be small (e.g., 64x64px or 128x128px)
- Use PNG format with transparent backgrounds
- CDK will upload images to S3 during deployment
- Images will be served via CloudFront

### 2. Frontend: Type Definitions

**File**: `frontend/src/types.ts`

Add new interface for link types:
```typescript
interface LinkType {
  id: string;
  label: string;
  imageUrl: string;
  placeholder: string;
  urlPattern?: string;
  sortOrder: number;
}
```

### 3. Frontend: GraphQL Query

**File**: `frontend/src/graphql/queries.ts`

Add new query:
```typescript
export const getLinkTypes = /* GraphQL */ `
  query GetLinkTypes {
    getLinkTypes {
      id
      label
      imageUrl
      placeholder
      urlPattern
      sortOrder
    }
  }
`;
```

### 4. ContactLinkManager Component Updates

**File**: `frontend/src/components/ContactLinkManager.tsx`

**Key Changes**:

1. Fetch link types from backend on component mount
2. Replace text input for label with dropdown selector showing images
3. Add duplicate detection logic
4. Update URL placeholder based on selected link type
5. Add optional URL validation based on link type pattern

**New State Variables**:
```typescript
const [linkTypes, setLinkTypes] = useState<LinkType[]>([]);
const [selectedLinkType, setSelectedLinkType] = useState<LinkType | null>(null);
const [loadingLinkTypes, setLoadingLinkTypes] = useState(false);
```

**Fetch Link Types**:
```typescript
useEffect(() => {
  loadLinkTypes();
}, []);

async function loadLinkTypes() {
  const client = generateClient();
  try {
    setLoadingLinkTypes(true);
    const response = await client.graphql({
      query: getLinkTypes,
    });
    if ('data' in response && response.data) {
      setLinkTypes(response.data.getLinkTypes);
    }
  } catch (err) {
    console.error('Error loading link types:', err);
  } finally {
    setLoadingLinkTypes(false);
  }
}
```

**Duplicate Detection Logic**:
```typescript
// Filter out link types that already exist in user's contact links
const getAvailableLinkTypes = () => {
  const existingLabels = contactLinks.map(link => link.label);
  return linkTypes.filter(type => !existingLabels.includes(type.label));
};
```

**Form Rendering**:
- Replace label text input with a `<select>` dropdown
- Populate dropdown with available link types (filtered for duplicates)
- Display link type image next to each option
- Update URL input placeholder when link type is selected
- Disable "Add Link" button if all link types are used
- Show loading state while fetching link types

### 5. Contact Link Display Components

**Files to Update**:
- `frontend/src/components/ContactLinkManager.tsx` (list view)
- `frontend/src/components/ProfileView.tsx` (profile display)
- `frontend/src/components/PublicProfile.tsx` (public profile display)

**Display Enhancement**:

Each component that displays contact links needs to:
1. Fetch link types on mount (or use a shared context/hook)
2. Match contact link labels to link type images
3. Display the image alongside the link

```typescript
// Helper function to get image URL for a link label
const getLinkImage = (label: string): string | null => {
  const linkType = linkTypes.find(type => type.label === label);
  return linkType?.imageUrl || null;
};
```

**Rendering Pattern**:
```tsx
<div className="contact-link-item">
  {getLinkImage(link.label) && (
    <img
      src={getLinkImage(link.label)}
      alt={link.label}
      className="link-type-image"
    />
  )}
  <span className="link-label">{link.label}</span>
  <a href={link.url}>...</a>
</div>
```

**Optimization**: Consider creating a custom hook `useLinkTypes()` to avoid fetching link types multiple times across different components. The hook can cache the results.

## Data Models

### New: LinkType Model

**Lambda Configuration** (hardcoded):
```typescript
interface LinkTypeDefinition {
  id: string;           // e.g., "linkedin"
  label: string;        // e.g., "LinkedIn"
  imageUrl: string;     // CloudFront URL
  placeholder: string;  // e.g., "https://linkedin.com/in/username"
  urlPattern?: string;  // Optional regex pattern
  sortOrder: number;    // Display order
}
```

**GraphQL Type**:
```graphql
type LinkType {
  id: ID!
  label: String!
  imageUrl: AWSURL!
  placeholder: String!
  urlPattern: String
  sortOrder: Int!
}
```

### Existing: ContactLink Model (No Changes)

The existing `ContactLink` interface and GraphQL schema remain unchanged:

```typescript
interface ContactLink {
  id: string;
  label: string;  // Now constrained to predefined values in UI
  url: string;
  visible: boolean;
}
```

The backend continues to accept any string for `label`, but the frontend UI will only send predefined values from the available link types.

## Error Handling

### Duplicate Link Type Prevention

**Frontend Validation**:
1. Before showing the add form, check if all link types are already used
2. In the dropdown, only show link types not yet added
3. If user somehow submits a duplicate (edge case), show error message

**Error Messages**:
- "You've already added a {linkType} link"
- "Maximum link types reached (10/10)"
- "Please select a link type"

### URL Validation

**Optional Pattern Matching**:
- If a link type has a `urlPattern`, validate the URL before submission
- Show helpful error: "Please enter a valid {linkType} URL (e.g., {placeholder})"
- Allow users to override validation if needed (some platforms have varied URL formats)



## Testing Strategy

### Unit Testing Focus

Given the minimal testing approach, focus on critical functionality:

1. **Link Type Configuration**
   - Verify all link types have required fields
   - Ensure no duplicate IDs or labels

2. **Duplicate Detection Logic**
   - Test filtering of available link types based on existing links
   - Verify correct behavior when all types are used

### Manual Testing Checklist

1. **Add Link Flow**
   - Select each link type from dropdown
   - Verify correct placeholder appears
   - Verify URL validation (if applicable)
   - Confirm link is added with correct label and icon

2. **Duplicate Prevention**
   - Add a link type
   - Verify it no longer appears in dropdown
   - Try to add all 10 link types
   - Verify "Add Link" button is disabled when all types are used

3. **Display Consistency**
   - Check icons appear correctly in profile view
   - Verify icons appear in public profile view
   - Confirm icons appear in connection details

4. **Edge Cases**
   - Test with empty contact links list
   - Test with maximum (10) contact links
   - Test URL validation with various formats

### Integration Testing

1. **End-to-End Flow**
   - Create new user account
   - Add multiple contact links with different types
   - Toggle visibility
   - View public profile to confirm display
   - Remove links and verify dropdown updates

## Implementation Notes

### CSS Updates

Update `ContactLinkManager.css` and related stylesheets to support:
- Image display in dropdown options (may require custom dropdown component)
- Image display in link list items
- Proper sizing and spacing for link type images (e.g., 24x24px or 32x32px)
- Improved visual hierarchy with images

### Image Asset Management

**Initial Image Collection**:
- Source high-quality logo images for each link type
- Recommended sources: Official brand assets, Simple Icons (https://simpleicons.org/), or similar
- Standardize image dimensions (e.g., 128x128px PNG with transparency)
- Store in `infrastructure/assets/link-type-images/` directory

**CDK Deployment**:
- Upload images to S3 during stack deployment
- Use S3 deployment construct to sync images
- Generate CloudFront URLs for images
- Pass CloudFront base URL to Lambda as environment variable

**Future Management**:
- New link types can be added by:
  1. Adding image to S3 (via CDK or manual upload)
  2. Updating the hardcoded configuration in Lambda
  3. Deploying the updated Lambda function

### Performance Considerations

- Link type configuration is a small hardcoded array (10 items) in Lambda
- Lambda function is lightweight and fast (no database queries)
- Frontend caches link types after first fetch
- No performance impact from filtering available types

### Future Extensibility

The centralized configuration makes it easy to:
- Add new link types by updating the hardcoded `LINK_TYPES` array in Lambda
- Modify images or labels without touching frontend component logic
- Add more sophisticated URL validation patterns
- Introduce link type categories or grouping
- Migrate to database storage in the future if dynamic management is needed (no frontend changes required)

### Infrastructure Changes Summary

**New CDK Resources**:
1. Lambda Function: `link-types` (for getLinkTypes query)
2. S3 folder: For link type images (in existing static assets bucket)
3. AppSync Resolver: Connect getLinkTypes query to Lambda

**Modified CDK Resources**:
1. Update GraphQL schema with LinkType type and getLinkTypes query
2. Deploy link type images to S3
3. Pass CloudFront URL as environment variable to link-types Lambda

**Benefits of Hardcoded Configuration**:
- No database seeding required
- Simpler deployment process
- Easy to update by modifying code and redeploying
- No additional DynamoDB costs
- Can migrate to database storage in the future if needed without frontend changes
