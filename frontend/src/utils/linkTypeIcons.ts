/**
 * Utility for mapping contact link types to their corresponding SVG icons
 */

export interface LinkTypeIconMapping {
  [key: string]: string;
}

/**
 * Maps contact link types to their corresponding SVG icon paths
 */
export const linkTypeIcons: LinkTypeIconMapping = {
  email: '/link-type-images/email.svg',
  phone: '/link-type-images/phone.svg',
  website: '/link-type-images/website.svg',
  linkedin: '/link-type-images/linkedin.svg',
  twitter: '/link-type-images/twitter.svg',
  github: '/link-type-images/github.svg',
  facebook: '/link-type-images/facebook.svg',
  instagram: '/link-type-images/instagram.svg',
  mastodon: '/link-type-images/mastodon.svg',
  bluesky: '/link-type-images/bluesky.svg',
};

/**
 * Gets the icon path for a given link type
 * @param linkType - The type of the contact link
 * @returns The path to the SVG icon, or a default website icon if not found
 */
export function getLinkTypeIcon(linkType: string): string {
  const normalizedType = linkType.toLowerCase().trim();
  return linkTypeIcons[normalizedType] || linkTypeIcons.website;
}

/**
 * Checks if an icon exists for the given link type
 * @param linkType - The type of the contact link
 * @returns True if an icon exists for this link type
 */
export function hasLinkTypeIcon(linkType: string): boolean {
  const normalizedType = linkType.toLowerCase().trim();
  return normalizedType in linkTypeIcons;
}

/**
 * Gets all available link types that have icons
 * @returns Array of link type names that have corresponding icons
 */
export function getAvailableLinkTypes(): string[] {
  return Object.keys(linkTypeIcons);
}

/**
 * Normalizes a link type string for consistent matching
 * @param linkType - The raw link type string
 * @returns Normalized link type string
 */
export function normalizeLinkType(linkType: string): string {
  return linkType.toLowerCase().trim();
}