export interface LinkType {
    id: string;
    label: string;
    imageUrl: string;
    placeholder: string;
    urlPattern?: string;
    sortOrder: number;
}

export interface ContactLink {
    id: string;
    label: string;
    url: string;
    visible: boolean;
}

export interface BadgeMetadata {
    relatedUserId?: string;
    relatedUserName?: string;
    eventYear?: number;
    count?: number;
    triangleUsers?: string[];
}

export interface Badge {
    id: string;
    name: string;
    description: string;
    threshold: number;
    iconUrl?: string;
    earnedAt?: string;
    category?: 'threshold' | 'special';
    metadata?: BadgeMetadata;
}

export interface User {
    id: string;
    email: string;
    displayName: string;
    gravatarHash: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
    contactLinks: ContactLink[];
    badges: Badge[];
    connectionCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface PublicProfile {
    id: string;
    displayName: string;
    gravatarHash: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
}

export interface ConnectedProfile {
    id: string;
    displayName: string;
    gravatarHash: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
    contactLinks: ContactLink[];
    badges: Badge[];
}

export interface Connection {
    id: string;
    userId: string;
    connectedUserId: string;
    connectedUser?: ConnectedProfile;
    tags: string[];
    note?: string;
    createdAt: string;
    updatedAt: string;
}

export interface RemoveConnectionResult {
    success: boolean;
    message?: string;
}

export type ConnectionRequestStatus = 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';

export interface ConnectionRequest {
    id: string;
    initiatorUserId: string;
    recipientUserId: string;
    initiator?: PublicProfile;
    recipient?: PublicProfile;
    status: ConnectionRequestStatus;
    createdAt: string;
    updatedAt: string;
    actionedAt?: string;
    initiatorNote?: string;
    initiatorTags?: string[];
}

export interface ConnectionRequestResult {
    success: boolean;
    message?: string;
    request?: ConnectionRequest;
}

export interface ConnectionStatus {
    isConnected: boolean;
    hasPendingRequest: boolean;
    requestDirection?: 'incoming' | 'outgoing';
}

export interface CreateConnectionRequestInput {
    recipientUserId: string;
    note?: string;
    tags?: string[];
}

export interface UpdateConnectionRequestMetadataInput {
    requestId: string;
    note?: string;
    tags?: string[];
}

// Leaderboard types
export interface LeaderboardEntry {
    rank: number;
    userId: string;
    displayName: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
    gravatarHash: string;
    connectionCount: number;
    isCurrentUser: boolean;
}

export interface LeaderboardResult {
    entries: LeaderboardEntry[];
    currentUserEntry?: LeaderboardEntry;
    hasMore: boolean;
    nextToken?: string;
}

// Badge Leaderboard types
export interface BadgeLeaderboardEntry {
    rank: number;
    userId: string;
    displayName: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
    gravatarHash: string;
    badgeCount: number;
    isCurrentUser: boolean;
}

export interface BadgeLeaderboardResult {
    entries: BadgeLeaderboardEntry[];
    currentUserEntry?: BadgeLeaderboardEntry;
    hasMore: boolean;
    nextToken?: string;
}

// Connection Search types
export interface ConnectionSearchResult {
    connection: Connection;
    score: number;
}

export interface SearchConnectionsResult {
    results: ConnectionSearchResult[];
    totalCount: number;
}
