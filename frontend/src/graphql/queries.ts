export const getMyProfile = /* GraphQL */ `
  query GetMyProfile {
    getMyProfile {
      id
      email
      displayName
      gravatarHash
      contactLinks {
        id
        label
        url
        visible
      }
      badges {
        id
        name
        description
        threshold
        iconUrl
        earnedAt
        category
        metadata {
          relatedUserId
          relatedUserName
          eventYear
          count
          triangleUsers
        }
      }
      connectionCount
      createdAt
      updatedAt
    }
  }
`;

export const getPublicProfile = /* GraphQL */ `
  query GetPublicProfile($userId: ID!) {
    getPublicProfile(userId: $userId) {
      id
      displayName
      gravatarHash
    }
  }
`;

export const getConnectedProfile = /* GraphQL */ `
  query GetConnectedProfile($userId: ID!) {
    getConnectedProfile(userId: $userId) {
      id
      displayName
      gravatarHash
      contactLinks {
        id
        label
        url
        visible
      }
      badges {
        id
        name
        description
        threshold
        iconUrl
        earnedAt
        category
        metadata {
          relatedUserId
          relatedUserName
          eventYear
          count
          triangleUsers
        }
      }
    }
  }
`;

export const checkConnection = /* GraphQL */ `
  query CheckConnection($userId: ID!) {
    checkConnection(userId: $userId)
  }
`;

export const getMyConnections = /* GraphQL */ `
  query GetMyConnections {
    getMyConnections {
      id
      userId
      connectedUserId
      tags
      note
      createdAt
      updatedAt
    }
  }
`;

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

export const getIncomingConnectionRequests = /* GraphQL */ `
  query GetIncomingConnectionRequests {
    getIncomingConnectionRequests {
      id
      initiatorUserId
      recipientUserId
      initiator {
        id
        displayName
        gravatarHash
      }
      status
      createdAt
      updatedAt
      actionedAt
    }
  }
`;

export const getOutgoingConnectionRequests = /* GraphQL */ `
  query GetOutgoingConnectionRequests {
    getOutgoingConnectionRequests {
      id
      initiatorUserId
      recipientUserId
      recipient {
        id
        displayName
        gravatarHash
      }
      status
      createdAt
      updatedAt
      actionedAt
      initiatorNote
      initiatorTags
    }
  }
`;

export const checkConnectionOrRequest = /* GraphQL */ `
  query CheckConnectionOrRequest($userId: ID!) {
    checkConnectionOrRequest(userId: $userId) {
      isConnected
      hasPendingRequest
      requestDirection
    }
  }
`;
