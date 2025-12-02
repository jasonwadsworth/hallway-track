/**
 * Fuzzy matching module for connection search.
 * Provides Levenshtein distance calculation and fuzzy matching functions.
 */

export type MatchType = 'exact' | 'substring' | 'fuzzy' | 'none';

export interface MatchResult {
    matchType: MatchType;
    score: number;
}

/**
 * Calculate the Levenshtein distance between two strings.
 * Uses dynamic programming for O(m*n) time complexity.
 * Case-insensitive comparison.
 *
 * @param a - First string
 * @param b - Second string
 * @returns The edit distance between the two strings
 */
export function levenshteinDistance(a: string, b: string): number {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    const m = aLower.length;
    const n = bLower.length;

    // Handle empty strings
    if (m === 0) return n;
    if (n === 0) return m;

    // Create distance matrix
    const dp: number[][] = Array(m + 1)
        .fill(null)
        .map(() => Array(n + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= m; i++) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const cost = aLower[i - 1] === bLower[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1, // deletion
                dp[i][j - 1] + 1, // insertion
                dp[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return dp[m][n];
}

/**
 * Check if query is a substring of text (case-insensitive).
 */
function isSubstring(query: string, text: string): boolean {
    return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Check if query exactly matches text (case-insensitive).
 */
function isExactMatch(query: string, text: string): boolean {
    return query.toLowerCase() === text.toLowerCase();
}

/**
 * Check if query matches any word in text exactly (case-insensitive).
 */
function matchesWord(query: string, text: string): boolean {
    const words = text.toLowerCase().split(/\s+/);
    return words.some((word) => word === query.toLowerCase());
}

/**
 * Calculate the maximum allowed edit distance based on query length.
 * Shorter queries allow fewer typos.
 */
function getMaxEditDistance(queryLength: number): number {
    if (queryLength <= 2) return 0; // No typos for very short queries
    if (queryLength <= 4) return 1; // 1 typo for short queries
    if (queryLength <= 8) return 2; // 2 typos for medium queries
    return 3; // 3 typos for long queries
}

/**
 * Determine if query fuzzy matches text using Levenshtein distance.
 * Returns true if the edit distance is within acceptable threshold.
 */
export function isFuzzyMatch(query: string, text: string): boolean {
    const maxDistance = getMaxEditDistance(query.length);

    // Check against whole text
    const distance = levenshteinDistance(query, text);
    if (distance <= maxDistance) return true;

    // Check against individual words in text
    const words = text.split(/\s+/);
    for (const word of words) {
        const wordDistance = levenshteinDistance(query, word);
        if (wordDistance <= maxDistance) return true;
    }

    return false;
}

/**
 * Perform fuzzy matching and return match type and base score.
 *
 * Match types and base scores:
 * - exact: 1.0 (query exactly matches text)
 * - substring: 0.8 (query is contained in text)
 * - fuzzy: 0.6 (query is within edit distance threshold)
 * - none: 0.0 (no match)
 *
 * @param query - The search query
 * @param text - The text to match against
 * @returns MatchResult with type and score
 */
export function fuzzyMatch(query: string, text: string): MatchResult {
    // Empty query matches nothing
    if (!query || query.trim() === '') {
        return { matchType: 'none', score: 0 };
    }

    // Empty text matches nothing
    if (!text || text.trim() === '') {
        return { matchType: 'none', score: 0 };
    }

    const trimmedQuery = query.trim();
    const trimmedText = text.trim();

    // Check for exact match
    if (isExactMatch(trimmedQuery, trimmedText)) {
        return { matchType: 'exact', score: 1.0 };
    }

    // Check for exact word match (bonus for matching a complete word)
    if (matchesWord(trimmedQuery, trimmedText)) {
        return { matchType: 'exact', score: 0.95 };
    }

    // Check for substring match
    if (isSubstring(trimmedQuery, trimmedText)) {
        return { matchType: 'substring', score: 0.8 };
    }

    // Check for fuzzy match
    if (isFuzzyMatch(trimmedQuery, trimmedText)) {
        // Calculate score based on edit distance
        const distance = levenshteinDistance(trimmedQuery, trimmedText);
        const maxLen = Math.max(trimmedQuery.length, trimmedText.length);
        const similarity = 1 - distance / maxLen;
        // Scale fuzzy score between 0.4 and 0.6 based on similarity
        const score = 0.4 + similarity * 0.2;
        return { matchType: 'fuzzy', score };
    }

    return { matchType: 'none', score: 0 };
}

/**
 * Match query against an array of strings (e.g., tags).
 * Returns the best match result from all strings.
 */
export function fuzzyMatchArray(query: string, texts: string[]): MatchResult {
    if (!texts || texts.length === 0) {
        return { matchType: 'none', score: 0 };
    }

    let bestResult: MatchResult = { matchType: 'none', score: 0 };

    for (const text of texts) {
        const result = fuzzyMatch(query, text);
        if (result.score > bestResult.score) {
            bestResult = result;
        }
    }

    return bestResult;
}
