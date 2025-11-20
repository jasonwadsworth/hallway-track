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

export const removeConnection = /* GraphQL */ `
  mutation RemoveConnection($connectionId: ID!) {
    removeConnection(connectionId: $connectionId) {
      success
      message
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

export const updateConnectionTags = /* GraphQL */ `
  mutation UpdateConnectionTags($connectionId: ID!, $tags: [String!]!) {
    updateConnectionTags(connectionId: $connectionId, tags: $tags) {
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

export const createConnectionRequest = /* GraphQL */ `
  mutation CreateConnectionRequest($recipientUserId: ID!, $note: String, $tags: [String!]) {
    createConnectionRequest(recipientUserId: $recipientUserId, note: $note, tags: $tags) {
      success
      message
      request {
        id
        initiatorUserId
        recipientUserId
        status
        createdAt
        updatedAt
        initiatorNote
        initiatorTags
      }
    }
  }
`;

export const approveConnectionRequest = /* GraphQL */ `
  mutation ApproveConnectionRequest($requestId: ID!) {
    approveConnectionRequest(requestId: $requestId) {
      success
      message
      request {
        id
        initiatorUserId
        recipientUserId
        status
        createdAt
        updatedAt
        actionedAt
      }
    }
  }
`;

export const denyConnectionRequest = /* GraphQL */ `
  mutation DenyConnectionRequest($requestId: ID!) {
    denyConnectionRequest(requestId: $requestId) {
      success
      message
      request {
        id
        initiatorUserId
        recipientUserId
        status
        createdAt
        updatedAt
        actionedAt
      }
    }
  }
`;

export const cancelConnectionRequest = /* GraphQL */ `
  mutation CancelConnectionRequest($requestId: ID!) {
    cancelConnectionRequest(requestId: $requestId) {
      success
      message
      request {
        id
        initiatorUserId
        recipientUserId
        status
        createdAt
        updatedAt
        actionedAt
      }
    }
  }
`;

export const updateConnectionRequestMetadata = /* GraphQL */ `
  mutation UpdateConnectionRequestMetadata($requestId: ID!, $note: String, $tags: [String!]) {
    updateConnectionRequestMetadata(requestId: $requestId, note: $note, tags: $tags) {
      success
      message
      request {
        id
        initiatorUserId
        recipientUserId
        status
        createdAt
        updatedAt
        initiatorNote
        initiatorTags
      }
    }
  }
`;
