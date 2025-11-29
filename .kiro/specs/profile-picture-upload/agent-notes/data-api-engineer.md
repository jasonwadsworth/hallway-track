# Data API Engineer Notes

## Task: Review Profile Picture GraphQL/Resolvers - **DONE**

### Review Results

**1. `generateProfilePictureUploadUrl` mutation resolver** ✅
- Correctly wired to `ProfilePictureUploadDataSource` Lambda in CDK
- Schema defines: `generateProfilePictureUploadUrl(filename: String!, contentType: String!): ProfilePictureUploadUrl!`
- `ProfilePictureUploadUrl` type has `uploadUrl`, `key`, `expiresIn` fields

**2. `removeProfilePicture` mutation resolver** ✅
- Correctly wired to `ProfilePictureRemoveDataSource` Lambda in CDK
- Schema defines: `removeProfilePicture: User!`

**3. `uploadedProfilePictureUrl` field in queries** ✅
All relevant resolvers return `uploadedProfilePictureUrl`:
- `Query.getMyProfile.js` - Returns `ctx.result` directly (includes all fields from DynamoDB)
- `Query.getPublicProfile.js` - Explicitly returns `uploadedProfilePictureUrl`
- `Query.getConnectedProfile.getUser.js` - Explicitly returns `uploadedProfilePictureUrl`
- `Connection.connectedUser.js` - Explicitly returns `uploadedProfilePictureUrl`
- `ConnectionRequest.initiator.js` - Explicitly returns `uploadedProfilePictureUrl`
- `ConnectionRequest.recipient.js` - Explicitly returns `uploadedProfilePictureUrl`

**Schema types with `uploadedProfilePictureUrl`:**
- `User` type ✅
- `PublicProfile` type ✅
- `ConnectedProfile` type ✅

All GraphQL schema and resolvers are correctly configured for the profile picture feature.
