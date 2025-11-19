export function request() {
  return {};
}

export function response() {
  return [
    { id: 'linkedin', label: 'LinkedIn', imageUrl: '/link-type-images/linkedin.svg', placeholder: 'https://linkedin.com/in/username', urlPattern: '^https?:\\/\\/(www\\.)?linkedin\\.com\\/.+', sortOrder: 1 },
    { id: 'github', label: 'GitHub', imageUrl: '/link-type-images/github.svg', placeholder: 'https://github.com/username', urlPattern: '^https?:\\/\\/(www\\.)?github\\.com\\/.+', sortOrder: 2 },
    { id: 'twitter', label: 'Twitter/X', imageUrl: '/link-type-images/twitter.svg', placeholder: 'https://twitter.com/username', urlPattern: '^https?:\\/\\/(www\\.)?(twitter\\.com|x\\.com)\\/.+', sortOrder: 3 },
    { id: 'email', label: 'Email', imageUrl: '/link-type-images/email.svg', placeholder: 'email@example.com', urlPattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$', sortOrder: 4 },
    { id: 'website', label: 'Website', imageUrl: '/link-type-images/website.svg', placeholder: 'https://example.com', urlPattern: '^https?:\\/\\/.+', sortOrder: 5 },
    { id: 'facebook', label: 'Facebook', imageUrl: '/link-type-images/facebook.svg', placeholder: 'https://facebook.com/username', urlPattern: '^https?:\\/\\/(www\\.)?facebook\\.com\\/.+', sortOrder: 6 },
    { id: 'instagram', label: 'Instagram', imageUrl: '/link-type-images/instagram.svg', placeholder: 'https://instagram.com/username', urlPattern: '^https?:\\/\\/(www\\.)?instagram\\.com\\/.+', sortOrder: 7 },
    { id: 'mastodon', label: 'Mastodon', imageUrl: '/link-type-images/mastodon.svg', placeholder: 'https://mastodon.social/@username', urlPattern: '^https?:\\/\\/[a-zA-Z0-9.-]+\\/@.+', sortOrder: 8 },
    { id: 'bluesky', label: 'Bluesky', imageUrl: '/link-type-images/bluesky.svg', placeholder: 'https://bsky.app/profile/username', urlPattern: '^https?:\\/\\/(www\\.)?bsky\\.app\\/profile\\/.+', sortOrder: 9 },
    { id: 'phone', label: 'Phone', imageUrl: '/link-type-images/phone.svg', placeholder: '+1-234-567-8900', urlPattern: '^[+]?[0-9\\s\\-()]+$', sortOrder: 10 }
  ];
}
