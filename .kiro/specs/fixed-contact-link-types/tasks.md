# Implementation Plan

- [x] 1. Collect and prepare link type images
  - Source high-quality logo images for all 10 link types (LinkedIn, GitHub, Twitter/X, Email, Website, Facebook, Instagram, Mastodon, Bluesky, Phone)
  - Standardize images to 128x128px PNG format with transparent backgrounds
  - Save images in `infrastructure/assets/link-type-images/` directory with consistent naming (e.g., `linkedin.png`, `github.png`)
  - _Requirements: 1.5, 4.3_

- [x] 2. Create backend Lambda function for link types
  - [x] 2.1 Create link type configuration file
    - Create `infrastructure/lambda/link-types/linkTypeConfig.ts` with hardcoded link type definitions
    - Define LinkTypeDefinition interface with id, label, imageUrl, placeholder, urlPattern, and sortOrder
    - Add all 10 link types with appropriate placeholders and URL patterns
    - Use `${CLOUDFRONT_URL}` placeholder in imageUrl paths
    - _Requirements: 1.1, 1.5, 4.1, 4.2_

  - [x] 2.2 Implement Lambda handler function
    - Create `infrastructure/lambda/link-types/index.ts`
    - Import link type configuration
    - Replace `${CLOUDFRONT_URL}` placeholder with actual CloudFront URL from environment variable
    - Return formatted link types array
    - Add error handling for missing environment variables
    - _Requirements: 1.1, 4.1_

  - [x] 2.3 Set up Lambda package configuration
    - Create `infrastructure/lambda/link-types/package.json` with necessary dependencies
    - Create `infrastructure/lambda/link-types/tsconfig.json` for TypeScript compilation
    - _Requirements: 4.1_

- [x] 3. Update GraphQL schema and infrastructure
  - [x] 3.1 Add LinkType to GraphQL schema
    - Update `infrastructure/schema.graphql` to add LinkType type definition
    - Add getLinkTypes query to Query type
    - _Requirements: 1.1, 4.1_

  - [x] 3.2 Update CDK stack for link types
    - Create Lambda function construct for link-types in `infrastructure/stacks/hallway-track-stack.ts`
    - Deploy link type images to S3 using S3 deployment construct
    - Pass CloudFront URL as environment variable to Lambda
    - Create AppSync resolver connecting getLinkTypes query to Lambda function
    - _Requirements: 1.1, 4.1, 4.3_

- [x] 4. Update frontend types and GraphQL queries
  - [x] 4.1 Add LinkType interface to frontend types
    - Update `frontend/src/types.ts` to add LinkType interface
    - Export LinkType interface for use in components
    - _Requirements: 1.1_

  - [x] 4.2 Create getLinkTypes GraphQL query
    - Add getLinkTypes query to `frontend/src/graphql/queries.ts`
    - Include all LinkType fields in the query
    - _Requirements: 1.1_

- [x] 5. Create custom hook for link types
  - Create `frontend/src/hooks/useLinkTypes.ts` custom hook
  - Implement caching logic to avoid repeated API calls
  - Fetch link types on first call and cache results
  - Export hook for use across multiple components
  - Add error handling and loading states
  - _Requirements: 1.1, 1.3_

- [x] 6. Update ContactLinkManager component
  - [x] 6.1 Integrate link types fetching
    - Import and use useLinkTypes hook
    - Add state for selected link type
    - Add loading state for link types
    - _Requirements: 1.1_

  - [x] 6.2 Implement duplicate detection
    - Create function to filter available link types based on existing contact links
    - Update available link types when contact links change
    - Disable "Add Link" button when all link types are used
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 6.3 Replace label input with dropdown
    - Remove text input for label field
    - Add dropdown/select element for link type selection
    - Display link type images in dropdown options (may require custom dropdown component)
    - Update form to use selected link type's label when submitting
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 6.4 Update URL input with dynamic placeholder
    - Update URL input placeholder based on selected link type
    - Add URL validation based on link type's urlPattern (optional)
    - Show helpful error messages for invalid URLs
    - _Requirements: 1.1_

  - [x] 6.5 Update contact link display with images
    - Add helper function to get image URL for a link label
    - Render link type images next to each contact link in the list
    - Update CSS for proper image sizing and spacing
    - _Requirements: 1.3, 1.4, 3.1, 3.2, 3.3_

- [x] 7. Update ProfileView component
  - Import and use useLinkTypes hook
  - Add helper function to match link labels to link type images
  - Update contact link rendering to display images
  - Update CSS for image display
  - _Requirements: 1.3, 1.4, 3.1, 3.2, 3.3_

- [ ] 8. Update PublicProfile component
  - Import and use useLinkTypes hook
  - Add helper function to match link labels to link type images
  - Update contact link rendering to display images
  - Update CSS for image display
  - _Requirements: 1.3, 1.4, 3.1, 3.2, 3.3_

- [ ] 9. Update CSS styles for link type images
  - Update `frontend/src/components/ContactLinkManager.css` for dropdown images and list images
  - Add styles for link type images (sizing, spacing, alignment)
  - Ensure responsive design for images
  - Add styles for custom dropdown if needed
  - Update other component CSS files as needed
  - _Requirements: 1.4, 3.2_

- [ ] 10. Deploy and verify
  - Build and deploy CDK stack with new Lambda function and images
  - Verify link type images are accessible via CloudFront
  - Test getLinkTypes query in AppSync console
  - Test frontend integration end-to-end
  - Verify duplicate prevention works correctly
  - Test all link types can be added and displayed properly
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_
