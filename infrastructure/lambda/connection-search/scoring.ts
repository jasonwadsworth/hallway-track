/**
 * Scoring module for connection search.
 * Calculates match scores based on field type and match quality.
 */

import { MatchResult, MatchType } from './fuzzy-match';

export type FieldType = 'name' | 'tag' | 'note';

export interface FieldMatch {
    field: FieldType;
    matchType: MatchType;
    score: number;
}

export interface ScoringResult {
    matches: FieldMatch[];
    totalScore: number;
}

/**
 * Field weight multipliers.
 * Name matches are weighted highest, followed by tags, then notes.
 */
const FIELD_WEIGHTS: Record<FieldType, number> = {
    name: 1.0,
    tag: 0.9,
    note: 0.7,
};

/**
 * Bonus for matching in multiple fields.
 */
const MULTI_FIELD_BONUS = 0.1;

/**
 * Calculate the weighted score for a field match.
 *
 * @param field - The field type (name, tag, note)
 * @param matchResult - The match result from fuzzy matching
 * @returns FieldMatch with weighted score
 */
export function calculateFieldScore(field: FieldType, matchResult: MatchResult): FieldMatch {
    const weight = FIELD_WEIGHTS[field];
    const weightedScore = matchResult.score * weight;

    return {
        field,
        matchType: matchResult.matchType,
        score: weightedScore,
    };
}

/**
 * Calculate the combined score from multiple field matches.
 *
 * Scoring algorithm:
 * 1. Take the maximum score from all field matches
 * 2. Add bonus for each additional field that matches (0.1 per field)
 *
 * @param fieldMatches - Array of field match results
 * @returns ScoringResult with all matches and total score
 */
export function calculateCombinedScore(fieldMatches: FieldMatch[]): ScoringResult {
    // Filter out non-matches
    const validMatches = fieldMatches.filter((m) => m.matchType !== 'none' && m.score > 0);

    if (validMatches.length === 0) {
        return {
            matches: [],
            totalScore: 0,
        };
    }

    // Find the maximum score
    const maxScore = Math.max(...validMatches.map((m) => m.score));

    // Add bonus for multi-field matches
    const additionalFields = validMatches.length - 1;
    const bonus = additionalFields * MULTI_FIELD_BONUS;

    // Cap total score at 1.0
    const totalScore = Math.min(maxScore + bonus, 1.0);

    return {
        matches: validMatches,
        totalScore,
    };
}

/**
 * Compare two scoring results for sorting.
 * Returns negative if a should come before b (higher score first).
 */
export function compareScores(a: ScoringResult, b: ScoringResult): number {
    // Primary sort: by total score (descending)
    if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
    }

    // Secondary sort: by number of matching fields (descending)
    if (b.matches.length !== a.matches.length) {
        return b.matches.length - a.matches.length;
    }

    // Tertiary sort: prefer exact matches over fuzzy
    const aHasExact = a.matches.some((m) => m.matchType === 'exact');
    const bHasExact = b.matches.some((m) => m.matchType === 'exact');
    if (aHasExact !== bHasExact) {
        return aHasExact ? -1 : 1;
    }

    return 0;
}
