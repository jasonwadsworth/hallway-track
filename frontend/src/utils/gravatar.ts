export function getGravatarUrl(hash: string, size: number = 200): string {
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=${size}`;
}

/**
 * Generate srcset for responsive Gravatar images
 * Returns a srcset string with 1x, 2x, and 3x resolutions
 */
export function getGravatarSrcSet(hash: string, baseSize: number = 200): string {
  const size1x = baseSize;
  const size2x = baseSize * 2;
  const size3x = baseSize * 3;

  return `${getGravatarUrl(hash, size1x)} 1x, ${getGravatarUrl(hash, size2x)} 2x, ${getGravatarUrl(hash, size3x)} 3x`;
}
