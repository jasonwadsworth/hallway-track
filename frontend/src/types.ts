export interface ContactLink {
  id: string;
  label: string;
  url: string;
  visible: boolean;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  threshold: number;
  iconUrl?: string;
  earnedAt?: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  gravatarHash: string;
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
  contactLinks: ContactLink[];
  badges: Badge[];
}

export interface Connection {
  id: string;
  userId: string;
  connectedUserId: string;
  connectedUser?: PublicProfile;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
