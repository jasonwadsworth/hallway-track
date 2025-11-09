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
      createdAt
      updatedAt
    }
  }
`;
