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
