# AppSync Architect Notes

## Current State

### GraphQL Schema
- Located at `infrastructure/schema.graphql`
- Types: User, Connection, ConnectionRequest, Badge, ContactLink, LinkType, PublicProfile, ConnectedProfile
- Queries: getMyProfile, getPublicProfile, getConnectedProfile, getMyConnections, checkConnection, getLinkTypes, getIncomingConnectionRequests, getOutgoingConnectionRequests, checkConnectionOrRequest
- Mutations: updateDisplayName, addContactLink, updateContactLink, removeContactLink, createConnection, removeConnection, updateConnectionTags, updateConnectionNote, createConnectionRequest, approveConnectionRequest, denyConnectionRequest, cancelConnectionRequest, updateConnectionRequestMetadata

### Resolvers
- JavaScript direct resolvers in `infrastructure/resolvers/`
- Pipeline resolver for getConnectedProfile (checkConnection → getUser)
- Field resolvers for Connection.connectedUser, ConnectionRequest.initiator, ConnectionRequest.recipient

## Work Requested

(No pending work requests)

## Completed Work

(None yet)
