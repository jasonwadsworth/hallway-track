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
  mutation AddContactLink($label: String!, $url: String!) {
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
  mutation UpdateContactLink($contactLinkId: ID!, $label: String, $url: String, $visible: Boolean) {
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

export const addTagToConnection = /* GraphQL */ `
  mutation AddTagToConnection($connectionId: ID!, $tag: String!) {
    addTagToConnection(connectionId: $connectionId, tag: $tag) {
      id
      userId
      connectedUserId
      tags
      updatedAt
    }
  }
`;

export const removeTagFromConnection = /* GraphQL */ `
  mutation RemoveTagFromConnection($connectionId: ID!, $tag: String!) {
    removeTagFromConnection(connectionId: $connectionId, tag: $tag) {
      id
      userId
      connectedUserId
      tags
      updatedAt
    }
  }
`;

export const updateConnectionNote = /* GraphQL */ `
  mutation UpdateConnectionNote($connectionId: ID!, $note: String) {
    updateConnectionNote(connectionId: $connectionId, note: $note) {
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
