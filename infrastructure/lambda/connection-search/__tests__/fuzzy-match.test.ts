/**
 * Comprehensive tests for fuzzy-match module.
 * Tests Levenshtein distance algorithm, fuzzy matching logic, and scoring.
 */

import { levenshteinDistance, isFuzzyMatch, fuzzyMatch, fuzzyMatchArray, MatchResult } from '../fuzzy-match';

describe('levenshteinDistance', () => {
    describe('edge cases', () => {
        test('empty strings', () => {
            expect(levenshteinDistance('', '')).toBe(0);
        });

        test('first string empty', () => {
            expect(levenshteinDistance('', 'hello')).toBe(5);
        });

        test('second string empty', () => {
            expect(levenshteinDistance('hello', '')).toBe(5);
        });

        test('single character strings', () => {
            expect(levenshteinDistance('a', 'a')).toBe(0);
            expect(levenshteinDistance('a', 'b')).toBe(1);
        });
    });

    describe('identical strings', () => {
        test('same string', () => {
            expect(levenshteinDistance('hello', 'hello')).toBe(0);
        });

        test('case insensitive - same string different case', () => {
            expect(levenshteinDistance('Hello', 'hello')).toBe(0);
            expect(levenshteinDistance('WORLD', 'world')).toBe(0);
            expect(levenshteinDistance('JoHn DoE', 'john doe')).toBe(0);
        });
    });

    describe('single character differences', () => {
        test('insertion', () => {
            expect(levenshteinDistance('cat', 'cats')).toBe(1);
            expect(levenshteinDistance('hello', 'helo')).toBe(1);
        });

        test('deletion', () => {
            expect(levenshteinDistance('cats', 'cat')).toBe(1);
            expect(levenshteinDistance('helo', 'hello')).toBe(1);
        });

        test('substitution', () => {
            expect(levenshteinDistance('cat', 'bat')).toBe(1);
            expect(levenshteinDistance('hello', 'hallo')).toBe(1);
        });
    });

    describe('multiple edits', () => {
        test('two substitutions', () => {
            expect(levenshteinDistance('kitten', 'sitten')).toBe(1);
            expect(levenshteinDistance('sitting', 'kitten')).toBe(3);
        });

        test('insertions and deletions', () => {
            expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
        });

        test('complex transformations', () => {
            expect(levenshteinDistance('flaw', 'lawn')).toBe(2);
            expect(levenshteinDistance('gumbo', 'gambol')).toBe(2);
        });
    });

    describe('real-world names', () => {
        test('common typos', () => {
            expect(levenshteinDistance('john', 'jhon')).toBe(2); // transposition = 2 edits
            expect(levenshteinDistance('sarah', 'sara')).toBe(1);
            expect(levenshteinDistance('michael', 'micheal')).toBe(2);
        });

        test('similar names', () => {
            expect(levenshteinDistance('john', 'jon')).toBe(1);
            expect(levenshteinDistance('katherine', 'catherine')).toBe(1);
            expect(levenshteinDistance('stephen', 'steven')).toBe(2);
        });
    });

    describe('case insensitivity', () => {
        test('mixed case comparisons', () => {
            expect(levenshteinDistance('HeLLo', 'hElLo')).toBe(0);
            expect(levenshteinDistance('JOHN DOE', 'john doe')).toBe(0);
            expect(levenshteinDistance('TeSt', 'test')).toBe(0);
        });
    });

    describe('special characters and numbers', () => {
        test('with numbers', () => {
            expect(levenshteinDistance('user123', 'user124')).toBe(1);
            expect(levenshteinDistance('v1.0', 'v2.0')).toBe(1);
        });

        test('with special characters', () => {
            expect(levenshteinDistance('hello-world', 'hello world')).toBe(1);
            expect(levenshteinDistance('test@example.com', 'test@example.org')).toBe(3);
        });
    });

    describe('performance with longer strings', () => {
        test('long identical strings', () => {
            const longString = 'a'.repeat(100);
            expect(levenshteinDistance(longString, longString)).toBe(0);
        });

        test('long different strings', () => {
            const stringA = 'a'.repeat(50);
            const stringB = 'b'.repeat(50);
            expect(levenshteinDistance(stringA, stringB)).toBe(50);
        });
    });
});

describe('isFuzzyMatch', () => {
    describe('threshold based on query length', () => {
        test('very short queries (<=2 chars) - no typos allowed', () => {
            expect(isFuzzyMatch('ab', 'ab')).toBe(true);
            expect(isFuzzyMatch('ab', 'ac')).toBe(false);
            expect(isFuzzyMatch('ab', 'abc')).toBe(false);
            expect(isFuzzyMatch('a', 'a')).toBe(true);
            expect(isFuzzyMatch('a', 'b')).toBe(false);
        });

        test('short queries (3-4 chars) - 1 typo allowed', () => {
            expect(isFuzzyMatch('john', 'john')).toBe(true);
            expect(isFuzzyMatch('john', 'jon')).toBe(true); // 1 deletion
            expect(isFuzzyMatch('john', 'johny')).toBe(true); // 1 insertion
            expect(isFuzzyMatch('john', 'jahn')).toBe(true); // 1 substitution
            expect(isFuzzyMatch('john', 'jane')).toBe(false); // 3 edits
        });

        test('medium queries (5-8 chars) - 2 typos allowed', () => {
            expect(isFuzzyMatch('sarah', 'sara')).toBe(true); // 1 deletion
            expect(isFuzzyMatch('sarah', 'sahra')).toBe(true); // 2 transpositions = 2 edits
            expect(isFuzzyMatch('michael', 'micheal')).toBe(true); // 2 edits
            expect(isFuzzyMatch('michael', 'mike')).toBe(false); // 4 edits
        });

        test('long queries (>8 chars) - 3 typos allowed', () => {
            expect(isFuzzyMatch('christopher', 'christofer')).toBe(true); // 1 deletion
            expect(isFuzzyMatch('christopher', 'christoper')).toBe(true); // 1 deletion
            expect(isFuzzyMatch('christopher', 'cristopher')).toBe(true); // 1 deletion
            expect(isFuzzyMatch('christopher', 'chris')).toBe(false); // 6 deletions
        });
    });

    describe('word-level matching', () => {
        test('matches individual words in text', () => {
            expect(isFuzzyMatch('john', 'john doe')).toBe(true);
            expect(isFuzzyMatch('doe', 'john doe')).toBe(true);
            expect(isFuzzyMatch('jane', 'john doe')).toBe(false);
        });

        test('fuzzy matches individual words', () => {
            expect(isFuzzyMatch('jon', 'john doe')).toBe(true); // matches 'john' with 1 typo
            expect(isFuzzyMatch('doe', 'john doe')).toBe(true); // matches 'doe' exactly
        });

        test('handles multi-word text', () => {
            expect(isFuzzyMatch('software', 'software engineer at google')).toBe(true);
            expect(isFuzzyMatch('engineer', 'software engineer at google')).toBe(true);
            expect(isFuzzyMatch('engneer', 'software engineer at google')).toBe(true); // 1 typo
        });
    });

    describe('case insensitivity', () => {
        test('different cases should match', () => {
            expect(isFuzzyMatch('JOHN', 'john')).toBe(true);
            expect(isFuzzyMatch('john', 'JOHN')).toBe(true);
            expect(isFuzzyMatch('JoHn', 'jOhN')).toBe(true);
        });

        test('word matching is case insensitive', () => {
            expect(isFuzzyMatch('JOHN', 'john doe')).toBe(true);
            expect(isFuzzyMatch('doe', 'John DOE')).toBe(true);
        });
    });

    describe('edge cases', () => {
        test('empty query', () => {
            expect(isFuzzyMatch('', 'john')).toBe(false);
        });

        test('empty text', () => {
            expect(isFuzzyMatch('john', '')).toBe(false);
        });

        test('single characters', () => {
            expect(isFuzzyMatch('a', 'a')).toBe(true);
            expect(isFuzzyMatch('a', 'b')).toBe(false);
        });
    });
});

describe('fuzzyMatch', () => {
    describe('exact matches', () => {
        test('identical strings', () => {
            const result = fuzzyMatch('john', 'john');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0);
        });

        test('case insensitive exact match', () => {
            const result = fuzzyMatch('JOHN', 'john');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0);
        });

        test('with extra whitespace trimmed', () => {
            const result = fuzzyMatch('  john  ', 'john');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0);
        });
    });

    describe('word matches', () => {
        test('query matches complete word in text', () => {
            const result = fuzzyMatch('john', 'john doe');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(0.95);
        });

        test('query matches word in multi-word text', () => {
            const result = fuzzyMatch('engineer', 'software engineer');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(0.95);
        });

        test('case insensitive word match', () => {
            const result = fuzzyMatch('ENGINEER', 'software engineer');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(0.95);
        });
    });

    describe('substring matches', () => {
        test('query is substring of text', () => {
            const result = fuzzyMatch('soft', 'software');
            expect(result.matchType).toBe('substring');
            expect(result.score).toBe(0.8);
        });

        test('case insensitive substring', () => {
            const result = fuzzyMatch('SOFT', 'software');
            expect(result.matchType).toBe('substring');
            expect(result.score).toBe(0.8);
        });

        test('substring in middle of word', () => {
            const result = fuzzyMatch('oft', 'software');
            expect(result.matchType).toBe('substring');
            expect(result.score).toBe(0.8);
        });

        test('substring in multi-word text', () => {
            const result = fuzzyMatch('eng', 'software engineer');
            expect(result.matchType).toBe('substring');
            expect(result.score).toBe(0.8);
        });
    });

    describe('fuzzy matches', () => {
        test('single character typo', () => {
            const result = fuzzyMatch('john', 'jon');
            expect(result.matchType).toBe('fuzzy');
            expect(result.score).toBeGreaterThan(0.4);
            expect(result.score).toBeLessThan(0.6);
        });

        test('multiple typos within threshold', () => {
            const result = fuzzyMatch('sarah', 'sara');
            expect(result.matchType).toBe('fuzzy');
            expect(result.score).toBeGreaterThan(0.4);
            expect(result.score).toBeLessThan(0.6);
        });

        test('fuzzy score calculated based on similarity', () => {
            const result = fuzzyMatch('john', 'jon'); // fuzzy match
            expect(result.matchType).toBe('fuzzy');
            expect(result.score).toBeGreaterThan(0.4);
            expect(result.score).toBeLessThan(0.6);
        });

        test('fuzzy match in word', () => {
            const result = fuzzyMatch('jon', 'john doe');
            expect(result.matchType).toBe('fuzzy');
            expect(result.score).toBeGreaterThan(0);
        });
    });

    describe('no matches', () => {
        test('completely different strings', () => {
            const result = fuzzyMatch('john', 'sarah');
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });

        test('exceeds edit distance threshold', () => {
            const result = fuzzyMatch('abc', 'xyz');
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });

        test('too many typos for query length', () => {
            const result = fuzzyMatch('ab', 'cd'); // 2 chars, 0 typos allowed
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });
    });

    describe('empty inputs', () => {
        test('empty query', () => {
            const result = fuzzyMatch('', 'john');
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });

        test('empty text', () => {
            const result = fuzzyMatch('john', '');
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });

        test('both empty', () => {
            const result = fuzzyMatch('', '');
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });

        test('whitespace only query', () => {
            const result = fuzzyMatch('   ', 'john');
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });

        test('whitespace only text', () => {
            const result = fuzzyMatch('john', '   ');
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });
    });

    describe('special characters and numbers', () => {
        test('exact match with numbers', () => {
            const result = fuzzyMatch('user123', 'user123');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0);
        });

        test('fuzzy match with number typo', () => {
            const result = fuzzyMatch('user123', 'user124');
            expect(result.matchType).toBe('fuzzy');
            expect(result.score).toBeGreaterThan(0);
        });

        test('with special characters', () => {
            const result = fuzzyMatch('john-doe', 'john-doe');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0);
        });

        test('email-like strings', () => {
            const result = fuzzyMatch('test', 'test@example.com');
            expect(result.matchType).toBe('substring');
            expect(result.score).toBe(0.8);
        });
    });

    describe('priority of match types', () => {
        test('exact match preferred over word match', () => {
            const exact = fuzzyMatch('john', 'john');
            const word = fuzzyMatch('john', 'john doe');
            expect(exact.score).toBeGreaterThan(word.score);
        });

        test('word match preferred over substring', () => {
            const word = fuzzyMatch('john', 'john doe');
            const substring = fuzzyMatch('john', 'johnson');
            expect(word.score).toBeGreaterThan(substring.score);
        });

        test('substring preferred over fuzzy', () => {
            const substring = fuzzyMatch('john', 'johnson');
            const fuzzy = fuzzyMatch('john', 'jon');
            expect(substring.score).toBeGreaterThan(fuzzy.score);
        });
    });

    describe('real-world scenarios', () => {
        test('searching for first name in full name', () => {
            const result = fuzzyMatch('john', 'john smith');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(0.95);
        });

        test('searching for last name in full name', () => {
            const result = fuzzyMatch('smith', 'john smith');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(0.95);
        });

        test('searching with typo matches word', () => {
            const result = fuzzyMatch('jon', 'john smith'); // 1 char difference within threshold
            expect(result.matchType).toBe('fuzzy');
            expect(result.score).toBeGreaterThan(0);
        });

        test('searching for company in job title', () => {
            const result = fuzzyMatch('google', 'software engineer at google');
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(0.95);
        });

        test('partial company name', () => {
            const result = fuzzyMatch('micro', 'microsoft');
            expect(result.matchType).toBe('substring');
            expect(result.score).toBe(0.8);
        });
    });
});

describe('fuzzyMatchArray', () => {
    describe('empty arrays', () => {
        test('empty array', () => {
            const result = fuzzyMatchArray('john', []);
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });

        test('undefined array', () => {
            const result = fuzzyMatchArray('john', undefined as unknown as string[]);
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });

        test('null array', () => {
            const result = fuzzyMatchArray('john', null as unknown as string[]);
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });
    });

    describe('single element', () => {
        test('exact match', () => {
            const result = fuzzyMatchArray('developer', ['developer']);
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0);
        });

        test('fuzzy match', () => {
            const result = fuzzyMatchArray('develper', ['developer']);
            expect(result.matchType).toBe('fuzzy');
            expect(result.score).toBeGreaterThan(0);
        });

        test('no match', () => {
            const result = fuzzyMatchArray('designer', ['developer']);
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });
    });

    describe('multiple elements', () => {
        test('exact match in array', () => {
            const result = fuzzyMatchArray('engineer', ['developer', 'engineer', 'designer']);
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0);
        });

        test('best match selected', () => {
            const result = fuzzyMatchArray('dev', ['developer', 'development', 'devops']);
            expect(result.matchType).toBe('substring');
            expect(result.score).toBe(0.8);
        });

        test('prefers exact over fuzzy', () => {
            const result = fuzzyMatchArray('python', ['python', 'pyton']); // both match but exact is better
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0);
        });

        test('returns highest score', () => {
            const result = fuzzyMatchArray('soft', ['software', 'soft', 'softy']);
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0); // 'soft' is exact match
        });
    });

    describe('case insensitivity', () => {
        test('mixed case in array', () => {
            const result = fuzzyMatchArray('python', ['JavaScript', 'PYTHON', 'Ruby']);
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0);
        });
    });

    describe('real-world tag matching', () => {
        test('searching tags for exact match', () => {
            const tags = ['javascript', 'react', 'nodejs', 'typescript'];
            const result = fuzzyMatchArray('react', tags);
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0);
        });

        test('searching tags with typo', () => {
            const tags = ['javascript', 'react', 'nodejs', 'typescript'];
            const result = fuzzyMatchArray('recat', tags); // typo in 'react'
            expect(result.matchType).toBe('fuzzy');
            expect(result.score).toBeGreaterThan(0);
        });

        test('searching tags with partial match', () => {
            const tags = ['javascript', 'react', 'nodejs', 'typescript'];
            const result = fuzzyMatchArray('type', tags);
            expect(result.matchType).toBe('substring');
            expect(result.score).toBe(0.8);
        });

        test('no matching tags', () => {
            const tags = ['javascript', 'react', 'nodejs', 'typescript'];
            const result = fuzzyMatchArray('python', tags);
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });

        test('job title tags', () => {
            const tags = ['Senior Engineer', 'Team Lead', 'Architect'];
            const result = fuzzyMatchArray('engineer', tags);
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(0.95); // word match
        });
    });

    describe('empty strings in array', () => {
        test('array with empty strings', () => {
            const result = fuzzyMatchArray('test', ['', 'test', '']);
            expect(result.matchType).toBe('exact');
            expect(result.score).toBe(1.0);
        });

        test('all empty strings', () => {
            const result = fuzzyMatchArray('test', ['', '', '']);
            expect(result.matchType).toBe('none');
            expect(result.score).toBe(0);
        });
    });

    describe('ordering does not matter', () => {
        test('best match at start', () => {
            const result1 = fuzzyMatchArray('python', ['python', 'pyton', 'java']);
            expect(result1.matchType).toBe('exact');
        });

        test('best match at end', () => {
            const result2 = fuzzyMatchArray('python', ['pyton', 'java', 'python']);
            expect(result2.matchType).toBe('exact');
        });

        test('best match in middle', () => {
            const result3 = fuzzyMatchArray('python', ['java', 'python', 'pyton']);
            expect(result3.matchType).toBe('exact');
        });
    });
});
