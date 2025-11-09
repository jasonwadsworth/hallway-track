export function getGravatarUrl(hash: string, size: number = 200): string {
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=${size}`;
}
