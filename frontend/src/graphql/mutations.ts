export const updateDisplayName = /* GraphQL */ `
  mutation UpdateDisplayName($displayName: String!) {
    updateDisplayName(displayName: $displayName) {
      id
      displayName
      updatedAt
    }
  }
`;

export const addContactLink = /* GraphQL */ `
  mutation AddContactLink($label: String!, $url: AWSURL!) {
    addContactLink(label: $label, url: $url) {
      id
      contactLinks {
        id
        label
        url
        visible
      }
      updatedAt
    }
  }
`;

export const updateContactLink = /* GraphQL */ `
  mutation UpdateContactLink($contactLinkId: ID!, $label: String, $url: AWSURL, $visible: Boolean) {
    updateContactLink(contactLinkId: $contactLinkId, label: $label, url: $url, visible: $visible) {
      id
      contactLinks {
        id
        label
        url
        visible
      }
      updatedAt
    }
  }
`;

export const removeContactLink = /* GraphQL */ `
  mutation RemoveContactLink($contactLinkId: ID!) {
    removeContactLink(contactLinkId: $contactLinkId) {
      id
      contactLinks {
        id
        label
        url
        visible
      }
      updatedAt
    }
  }
`;

export const createUser = /* GraphQL */ `
  mutation CreateUser($email: AWSEmail!, $displayName: String!) {
    createUser(email: $email, displayName: $displayName) {
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

export const createConnection = /* GraphQL */ `
  mutation CreateConnection($connectedUserId: ID!) {
    createConnection(connectedUserId: $connectedUserId) {
      id
      userId
      connectedUserId
      tags
      createdAt
      updatedAt
    }
  }
`;
