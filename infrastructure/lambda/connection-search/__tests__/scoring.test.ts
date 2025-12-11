/**
 * Comprehensive tests for scoring module.
 * Tests field scoring, combined scoring, and score comparison logic.
 */

import {
    calculateFieldScore,
    calculateCombinedScore,
    compareScores,
    FieldMatch,
    ScoringResult,
    FieldType,
} from '../scoring';
import { MatchResult, MatchType } from '../fuzzy-match';

describe('calculateFieldScore', () => {
    describe('field weight multipliers', () => {
        test('name field has weight 1.0', () => {
            const matchResult: MatchResult = { matchType: 'exact', score: 1.0 };
            const result = calculateFieldScore('name', matchResult);
            expect(result.field).toBe('name');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0); // 1.0 * 1.0
        });

        test('tag field has weight 0.9', () => {
            const matchResult: MatchResult = { matchType: 'exact', score: 1.0 };
            const result = calculateFieldScore('tag', matchResult);
            expect(result.field).toBe('tag');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(0.9); // 1.0 * 0.9
        });

        test('note field has weight 0.7', () => {
            const matchResult: MatchResult = { matchType: 'exact', score: 1.0 };
            const result = calculateFieldScore('note', matchResult);
            expect(result.field).toBe('note');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(0.7); // 1.0 * 0.7
        });
    });

    describe('match type preservation', () => {
        test('preserves exact match type', () => {
            const matchResult: MatchResult = { matchType: 'exact', score: 1.0 };
            const result = calculateFieldScore('name', matchResult);
            expect(result.matchType).toBe('exact');
        });

        test('preserves substring match type', () => {
            const matchResult: MatchResult = { matchType: 'substring', score: 0.8 };
            const result = calculateFieldScore('name', matchResult);
            expect(result.matchType).toBe('substring');
        });

        test('preserves fuzzy match type', () => {
            const matchResult: MatchResult = { matchType: 'fuzzy', score: 0.5 };
            const result = calculateFieldScore('name', matchResult);
            expect(result.matchType).toBe('fuzzy');
        });

        test('preserves none match type', () => {
            const matchResult: MatchResult = { matchType: 'none', score: 0 };
            const result = calculateFieldScore('name', matchResult);
            expect(result.matchType).toBe('none');
        });
    });

    describe('score weighting calculations', () => {
        test('exact match in name field', () => {
            const matchResult: MatchResult = { matchType: 'exact', score: 1.0 };
            const result = calculateFieldScore('name', matchResult);
            expect(result.score).toBe(1.0);
        });

        test('exact match in tag field', () => {
            const matchResult: MatchResult = { matchType: 'exact', score: 1.0 };
            const result = calculateFieldScore('tag', matchResult);
            expect(result.score).toBe(0.9);
        });

        test('exact match in note field', () => {
            const matchResult: MatchResult = { matchType: 'exact', score: 1.0 };
            const result = calculateFieldScore('note', matchResult);
            expect(result.score).toBe(0.7);
        });

        test('substring match in name field', () => {
            const matchResult: MatchResult = { matchType: 'substring', score: 0.8 };
            const result = calculateFieldScore('name', matchResult);
            expect(result.score).toBe(0.8);
        });

        test('substring match in tag field', () => {
            const matchResult: MatchResult = { matchType: 'substring', score: 0.8 };
            const result = calculateFieldScore('tag', matchResult);
            expect(result.score).toBeCloseTo(0.72); // 0.8 * 0.9
        });

        test('fuzzy match in name field', () => {
            const matchResult: MatchResult = { matchType: 'fuzzy', score: 0.5 };
            const result = calculateFieldScore('name', matchResult);
            expect(result.score).toBe(0.5);
        });

        test('fuzzy match in note field', () => {
            const matchResult: MatchResult = { matchType: 'fuzzy', score: 0.5 };
            const result = calculateFieldScore('note', matchResult);
            expect(result.score).toBe(0.35); // 0.5 * 0.7
        });
    });

    describe('zero and low scores', () => {
        test('no match results in zero score', () => {
            const matchResult: MatchResult = { matchType: 'none', score: 0 };
            const result = calculateFieldScore('name', matchResult);
            expect(result.score).toBe(0);
        });

        test('very low match score is weighted correctly', () => {
            const matchResult: MatchResult = { matchType: 'fuzzy', score: 0.1 };
            const result = calculateFieldScore('tag', matchResult);
            expect(result.score).toBeCloseTo(0.09); // 0.1 * 0.9
        });
    });
});

describe('calculateCombinedScore', () => {
    describe('empty and no matches', () => {
        test('empty field matches array', () => {
            const result = calculateCombinedScore([]);
            expect(result.matches).toEqual([]);
            expect(result.totalScore).toBe(0);
        });

        test('all non-matches filtered out', () => {
            const fieldMatches: FieldMatch[] = [
                { field: 'name', matchType: 'none', score: 0 },
                { field: 'tag', matchType: 'none', score: 0 },
            ];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.matches).toEqual([]);
            expect(result.totalScore).toBe(0);
        });

        test('zero score matches filtered out', () => {
            const fieldMatches: FieldMatch[] = [
                { field: 'name', matchType: 'fuzzy', score: 0 },
                { field: 'tag', matchType: 'substring', score: 0 },
            ];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.matches).toEqual([]);
            expect(result.totalScore).toBe(0);
        });
    });

    describe('single field matches', () => {
        test('single name match', () => {
            const fieldMatches: FieldMatch[] = [{ field: 'name', matchType: 'exact', score: 1.0 }];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.matches).toHaveLength(1);
            expect(result.totalScore).toBe(1.0);
        });

        test('single tag match', () => {
            const fieldMatches: FieldMatch[] = [{ field: 'tag', matchType: 'exact', score: 0.9 }];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.matches).toHaveLength(1);
            expect(result.totalScore).toBe(0.9);
        });

        test('single note match', () => {
            const fieldMatches: FieldMatch[] = [{ field: 'note', matchType: 'substring', score: 0.56 }];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.matches).toHaveLength(1);
            expect(result.totalScore).toBe(0.56);
        });

        test('single fuzzy match', () => {
            const fieldMatches: FieldMatch[] = [{ field: 'name', matchType: 'fuzzy', score: 0.5 }];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.matches).toHaveLength(1);
            expect(result.totalScore).toBe(0.5);
        });
    });

    describe('multi-field matches', () => {
        test('two field matches get bonus', () => {
            const fieldMatches: FieldMatch[] = [
                { field: 'name', matchType: 'exact', score: 1.0 },
                { field: 'tag', matchType: 'exact', score: 0.9 },
            ];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.matches).toHaveLength(2);
            // max(1.0, 0.9) + (2-1)*0.1 = 1.0 + 0.1 = 1.1, capped at 1.0
            expect(result.totalScore).toBe(1.0);
        });

        test('three field matches get larger bonus', () => {
            const fieldMatches: FieldMatch[] = [
                { field: 'name', matchType: 'exact', score: 0.8 },
                { field: 'tag', matchType: 'substring', score: 0.72 },
                { field: 'note', matchType: 'fuzzy', score: 0.35 },
            ];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.matches).toHaveLength(3);
            // max(0.8, 0.72, 0.35) + (3-1)*0.1 = 0.8 + 0.2 = 1.0
            expect(result.totalScore).toBe(1.0);
        });

        test('bonus calculation with lower scores', () => {
            const fieldMatches: FieldMatch[] = [
                { field: 'name', matchType: 'fuzzy', score: 0.5 },
                { field: 'tag', matchType: 'fuzzy', score: 0.45 },
            ];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.matches).toHaveLength(2);
            // max(0.5, 0.45) + (2-1)*0.1 = 0.5 + 0.1 = 0.6
            expect(result.totalScore).toBe(0.6);
        });

        test('multi-field bonus does not exceed 1.0', () => {
            const fieldMatches: FieldMatch[] = [
                { field: 'name', matchType: 'exact', score: 0.95 },
                { field: 'tag', matchType: 'exact', score: 0.9 },
                { field: 'note', matchType: 'substring', score: 0.7 },
            ];
            const result = calculateCombinedScore(fieldMatches);
            // max(0.95, 0.9, 0.7) + (3-1)*0.1 = 0.95 + 0.2 = 1.15, capped at 1.0
            expect(result.totalScore).toBe(1.0);
        });
    });

    describe('filters non-matches', () => {
        test('filters out none matches but keeps valid ones', () => {
            const fieldMatches: FieldMatch[] = [
                { field: 'name', matchType: 'exact', score: 1.0 },
                { field: 'tag', matchType: 'none', score: 0 },
                { field: 'note', matchType: 'fuzzy', score: 0.35 },
            ];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.matches).toHaveLength(2);
            expect(result.matches).toEqual([
                { field: 'name', matchType: 'exact', score: 1.0 },
                { field: 'note', matchType: 'fuzzy', score: 0.35 },
            ]);
        });

        test('mixed valid and invalid matches', () => {
            const fieldMatches: FieldMatch[] = [
                { field: 'name', matchType: 'none', score: 0 },
                { field: 'tag', matchType: 'substring', score: 0.72 },
                { field: 'note', matchType: 'none', score: 0 },
            ];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.matches).toHaveLength(1);
            expect(result.totalScore).toBe(0.72);
        });
    });

    describe('uses max score as base', () => {
        test('selects maximum score from multiple fields', () => {
            const fieldMatches: FieldMatch[] = [
                { field: 'name', matchType: 'fuzzy', score: 0.5 },
                { field: 'tag', matchType: 'exact', score: 0.9 },
                { field: 'note', matchType: 'substring', score: 0.56 },
            ];
            const result = calculateCombinedScore(fieldMatches);
            // Base should be max(0.5, 0.9, 0.56) = 0.9
            // Total = 0.9 + (3-1)*0.1 = 1.0 (capped)
            expect(result.totalScore).toBe(1.0);
        });

        test('max score with same scores', () => {
            const fieldMatches: FieldMatch[] = [
                { field: 'name', matchType: 'exact', score: 0.8 },
                { field: 'tag', matchType: 'substring', score: 0.8 },
            ];
            const result = calculateCombinedScore(fieldMatches);
            // max(0.8, 0.8) + (2-1)*0.1 = 0.8 + 0.1 = 0.9
            expect(result.totalScore).toBe(0.9);
        });
    });

    describe('edge cases', () => {
        test('very small positive scores', () => {
            const fieldMatches: FieldMatch[] = [{ field: 'name', matchType: 'fuzzy', score: 0.01 }];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.matches).toHaveLength(1);
            expect(result.totalScore).toBe(0.01);
        });

        test('score exactly at 1.0 without bonus', () => {
            const fieldMatches: FieldMatch[] = [{ field: 'name', matchType: 'exact', score: 1.0 }];
            const result = calculateCombinedScore(fieldMatches);
            expect(result.totalScore).toBe(1.0);
        });

        test('multiple fields with one very high score', () => {
            const fieldMatches: FieldMatch[] = [
                { field: 'name', matchType: 'exact', score: 0.99 },
                { field: 'tag', matchType: 'fuzzy', score: 0.1 },
                { field: 'note', matchType: 'fuzzy', score: 0.1 },
            ];
            const result = calculateCombinedScore(fieldMatches);
            // max(0.99, 0.1, 0.1) + (3-1)*0.1 = 0.99 + 0.2 = 1.19, capped at 1.0
            expect(result.totalScore).toBe(1.0);
        });
    });
});

describe('compareScores', () => {
    describe('primary sort by total score', () => {
        test('higher score comes first', () => {
            const a: ScoringResult = {
                matches: [{ field: 'name', matchType: 'exact', score: 1.0 }],
                totalScore: 1.0,
            };
            const b: ScoringResult = {
                matches: [{ field: 'name', matchType: 'fuzzy', score: 0.5 }],
                totalScore: 0.5,
            };
            expect(compareScores(a, b)).toBeLessThan(0); // a comes before b
            expect(compareScores(b, a)).toBeGreaterThan(0); // b comes after a
        });

        test('zero score comes last', () => {
            const a: ScoringResult = { matches: [], totalScore: 0 };
            const b: ScoringResult = {
                matches: [{ field: 'name', matchType: 'fuzzy', score: 0.1 }],
                totalScore: 0.1,
            };
            expect(compareScores(a, b)).toBeGreaterThan(0); // a comes after b
            expect(compareScores(b, a)).toBeLessThan(0); // b comes before a
        });

        test('descending order', () => {
            const high: ScoringResult = { matches: [], totalScore: 0.9 };
            const medium: ScoringResult = { matches: [], totalScore: 0.6 };
            const low: ScoringResult = { matches: [], totalScore: 0.3 };

            expect(compareScores(high, medium)).toBeLessThan(0);
            expect(compareScores(high, low)).toBeLessThan(0);
            expect(compareScores(medium, low)).toBeLessThan(0);
        });
    });

    describe('secondary sort by number of matching fields', () => {
        test('same score, more matches comes first', () => {
            const a: ScoringResult = {
                matches: [
                    { field: 'name', matchType: 'exact', score: 0.5 },
                    { field: 'tag', matchType: 'fuzzy', score: 0.4 },
                ],
                totalScore: 0.6,
            };
            const b: ScoringResult = {
                matches: [{ field: 'name', matchType: 'exact', score: 0.6 }],
                totalScore: 0.6,
            };
            expect(compareScores(a, b)).toBeLessThan(0); // a has more matches
            expect(compareScores(b, a)).toBeGreaterThan(0);
        });

        test('same score, three matches beats one match', () => {
            const a: ScoringResult = {
                matches: [
                    { field: 'name', matchType: 'fuzzy', score: 0.3 },
                    { field: 'tag', matchType: 'fuzzy', score: 0.3 },
                    { field: 'note', matchType: 'fuzzy', score: 0.3 },
                ],
                totalScore: 0.5,
            };
            const b: ScoringResult = {
                matches: [{ field: 'name', matchType: 'exact', score: 0.5 }],
                totalScore: 0.5,
            };
            expect(compareScores(a, b)).toBeLessThan(0);
        });
    });

    describe('tertiary sort by exact match presence', () => {
        test('same score and matches, exact match comes first', () => {
            const a: ScoringResult = {
                matches: [
                    { field: 'name', matchType: 'exact', score: 0.5 },
                    { field: 'tag', matchType: 'fuzzy', score: 0.4 },
                ],
                totalScore: 0.6,
            };
            const b: ScoringResult = {
                matches: [
                    { field: 'name', matchType: 'fuzzy', score: 0.5 },
                    { field: 'tag', matchType: 'fuzzy', score: 0.4 },
                ],
                totalScore: 0.6,
            };
            expect(compareScores(a, b)).toBeLessThan(0); // a has exact match
            expect(compareScores(b, a)).toBeGreaterThan(0);
        });

        test('both have exact matches', () => {
            const a: ScoringResult = {
                matches: [{ field: 'name', matchType: 'exact', score: 0.5 }],
                totalScore: 0.5,
            };
            const b: ScoringResult = {
                matches: [{ field: 'tag', matchType: 'exact', score: 0.5 }],
                totalScore: 0.5,
            };
            expect(compareScores(a, b)).toBe(0); // equal
        });

        test('neither has exact matches', () => {
            const a: ScoringResult = {
                matches: [{ field: 'name', matchType: 'fuzzy', score: 0.5 }],
                totalScore: 0.5,
            };
            const b: ScoringResult = {
                matches: [{ field: 'tag', matchType: 'substring', score: 0.5 }],
                totalScore: 0.5,
            };
            expect(compareScores(a, b)).toBe(0); // equal
        });
    });

    describe('completely equal scores', () => {
        test('identical scoring results', () => {
            const a: ScoringResult = {
                matches: [{ field: 'name', matchType: 'exact', score: 1.0 }],
                totalScore: 1.0,
            };
            const b: ScoringResult = {
                matches: [{ field: 'name', matchType: 'exact', score: 1.0 }],
                totalScore: 1.0,
            };
            expect(compareScores(a, b)).toBe(0);
        });

        test('both empty', () => {
            const a: ScoringResult = { matches: [], totalScore: 0 };
            const b: ScoringResult = { matches: [], totalScore: 0 };
            expect(compareScores(a, b)).toBe(0);
        });
    });

    describe('sorting behavior', () => {
        test('can be used with array.sort for descending order', () => {
            const results: ScoringResult[] = [
                { matches: [], totalScore: 0.3 },
                { matches: [], totalScore: 0.9 },
                { matches: [], totalScore: 0.6 },
                { matches: [], totalScore: 0.1 },
            ];

            results.sort(compareScores);

            expect(results[0].totalScore).toBe(0.9);
            expect(results[1].totalScore).toBe(0.6);
            expect(results[2].totalScore).toBe(0.3);
            expect(results[3].totalScore).toBe(0.1);
        });

        test('complex sorting with all criteria', () => {
            const results: ScoringResult[] = [
                {
                    // Rank 3: score 0.6, 1 match, no exact
                    matches: [{ field: 'note', matchType: 'fuzzy', score: 0.6 }],
                    totalScore: 0.6,
                },
                {
                    // Rank 1: score 0.6, 2 matches, has exact
                    matches: [
                        { field: 'name', matchType: 'exact', score: 0.5 },
                        { field: 'tag', matchType: 'fuzzy', score: 0.4 },
                    ],
                    totalScore: 0.6,
                },
                {
                    // Rank 2: score 0.6, 2 matches, no exact
                    matches: [
                        { field: 'name', matchType: 'fuzzy', score: 0.5 },
                        { field: 'tag', matchType: 'fuzzy', score: 0.4 },
                    ],
                    totalScore: 0.6,
                },
                {
                    // Rank 4: score 0.5
                    matches: [{ field: 'name', matchType: 'exact', score: 0.5 }],
                    totalScore: 0.5,
                },
            ];

            results.sort(compareScores);

            // Check order after sort
            expect(results[0].matches.length).toBe(2);
            expect(results[0].matches[0].matchType).toBe('exact');
            expect(results[1].matches.length).toBe(2);
            expect(results[1].matches[0].matchType).toBe('fuzzy');
            expect(results[2].matches.length).toBe(1);
            expect(results[2].totalScore).toBe(0.6);
            expect(results[3].totalScore).toBe(0.5);
        });
    });

    describe('edge cases', () => {
        test('very close scores', () => {
            const a: ScoringResult = { matches: [], totalScore: 0.9999 };
            const b: ScoringResult = { matches: [], totalScore: 0.9998 };
            expect(compareScores(a, b)).toBeLessThan(0);
        });

        test('negative comparison value', () => {
            const a: ScoringResult = { matches: [], totalScore: 1.0 };
            const b: ScoringResult = { matches: [], totalScore: 0.0 };
            expect(compareScores(a, b)).toBeLessThan(0);
            expect(compareScores(b, a)).toBeGreaterThan(0);
        });
    });
});
