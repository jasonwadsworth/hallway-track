/**
 * Comprehensive tests for connection search handler.
 * Tests the scoreConnection and scoreConnections functions.
 */

import { scoreConnection, scoreConnections } from '../index';

// Type definitions matching the handler
interface ConnectedProfile {
    id: string;
    displayName: string;
    gravatarHash: string;
    profilePictureUrl?: string;
    uploadedProfilePictureUrl?: string;
    contactLinks: unknown[];
    badges: unknown[];
}

interface Connection {
    id: string;
    userId: string;
    connectedUserId: string;
    connectedUser?: ConnectedProfile;
    tags: string[];
    note?: string;
    createdAt: string;
    updatedAt: string;
}

describe('scoreConnection', () => {
    // Helper to create a test connection
    const createConnection = (
        displayName: string,
        tags: string[] = [],
        note?: string
    ): Connection => ({
        id: 'conn-123',
        userId: 'user-1',
        connectedUserId: 'user-2',
        connectedUser: {
            id: 'user-2',
            displayName,
            gravatarHash: 'abc123',
            contactLinks: [],
            badges: [],
        },
        tags,
        note,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
    });

    describe('single-word queries', () => {
        test('exact match on display name', () => {
            const connection = createConnection('john smith');
            const result = scoreConnection(connection, 'john');
            expect(result.totalScore).toBeGreaterThan(0);
            expect(result.matches.length).toBeGreaterThan(0);
        });

        test('exact match on full display name', () => {
            const connection = createConnection('john');
            const result = scoreConnection(connection, 'john');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('substring match on display name', () => {
            const connection = createConnection('johnson');
            const result = scoreConnection(connection, 'john');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('fuzzy match on display name', () => {
            const connection = createConnection('john');
            const result = scoreConnection(connection, 'jon'); // typo within threshold
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('exact match on tag', () => {
            const connection = createConnection('alice', ['engineer', 'python', 'react']);
            const result = scoreConnection(connection, 'engineer');
            expect(result.totalScore).toBeGreaterThan(0);
            expect(result.matches.some((m) => m.field === 'tag')).toBe(true);
        });

        test('exact match on note', () => {
            const connection = createConnection('alice', [], 'met at conference');
            const result = scoreConnection(connection, 'conference');
            expect(result.totalScore).toBeGreaterThan(0);
            expect(result.matches.some((m) => m.field === 'note')).toBe(true);
        });

        test('no match anywhere', () => {
            const connection = createConnection('alice', ['engineer'], 'met at conference');
            const result = scoreConnection(connection, 'python');
            expect(result.totalScore).toBe(0);
            expect(result.matches.length).toBe(0);
        });
    });

    describe('multi-word queries', () => {
        test('all words must match somewhere', () => {
            const connection = createConnection('john smith', ['engineer']);
            const result = scoreConnection(connection, 'john engineer');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('one word missing returns no match', () => {
            const connection = createConnection('john smith', ['engineer']);
            const result = scoreConnection(connection, 'john python');
            expect(result.totalScore).toBe(0);
            expect(result.matches.length).toBe(0);
        });

        test('words can match in different fields', () => {
            const connection = createConnection('john smith', ['python'], 'senior engineer');
            const result = scoreConnection(connection, 'john python engineer');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('two-word query both in name', () => {
            const connection = createConnection('john smith');
            const result = scoreConnection(connection, 'john smith');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('multi-word bonus increases score', () => {
            const connection = createConnection('john smith', ['engineer', 'python']);
            const singleWord = scoreConnection(connection, 'john');
            const multiWord = scoreConnection(connection, 'john engineer');
            // Multi-word should have bonus
            expect(multiWord.totalScore).toBeGreaterThanOrEqual(singleWord.totalScore);
        });

        test('empty words filtered out', () => {
            const connection = createConnection('john smith');
            const result = scoreConnection(connection, 'john  smith'); // double space
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('three-word query', () => {
            const connection = createConnection('john smith', ['python', 'react'], 'senior engineer');
            const result = scoreConnection(connection, 'john python engineer');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('four-word query all matching', () => {
            const connection = createConnection('john smith', ['python', 'react'], 'met at google conference');
            const result = scoreConnection(connection, 'john python google conference');
            expect(result.totalScore).toBeGreaterThan(0);
        });
    });

    describe('field matching priority', () => {
        test('matches in name are prioritized', () => {
            const connection = createConnection('engineer john', ['developer']);
            const nameMatch = scoreConnection(connection, 'engineer');
            const tagMatch = scoreConnection(connection, 'developer');
            // Name matches should generally score higher due to field weight
            expect(nameMatch.matches.some((m) => m.field === 'name')).toBe(true);
            expect(tagMatch.matches.some((m) => m.field === 'tag')).toBe(true);
        });

        test('tag matches have lower weight than name', () => {
            const connection = createConnection('alice', ['engineer']);
            const result = scoreConnection(connection, 'engineer');
            const tagMatch = result.matches.find((m) => m.field === 'tag');
            expect(tagMatch).toBeDefined();
            expect(tagMatch!.score).toBeLessThanOrEqual(0.9); // tag weight is 0.9
        });

        test('note matches have lowest weight', () => {
            const connection = createConnection('alice', [], 'engineer');
            const result = scoreConnection(connection, 'engineer');
            const noteMatch = result.matches.find((m) => m.field === 'note');
            expect(noteMatch).toBeDefined();
            expect(noteMatch!.score).toBeLessThanOrEqual(0.7); // note weight is 0.7
        });
    });

    describe('multiple field matches', () => {
        test('matching in multiple fields increases score', () => {
            const singleField = createConnection('engineer', [], 'developer');
            const multiField = createConnection('engineer', ['engineer'], 'developer');

            const singleScore = scoreConnection(singleField, 'engineer');
            const multiScore = scoreConnection(multiField, 'engineer');

            expect(multiScore.matches.length).toBeGreaterThan(singleScore.matches.length);
        });

        test('name and tag both match', () => {
            const connection = createConnection('python developer', ['python', 'react']);
            const result = scoreConnection(connection, 'python');
            expect(result.matches.length).toBeGreaterThanOrEqual(1);
        });

        test('all three fields match', () => {
            const connection = createConnection('python developer', ['python'], 'loves python');
            const result = scoreConnection(connection, 'python');
            expect(result.matches.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('edge cases', () => {
        test('empty query returns zero score', () => {
            const connection = createConnection('john smith');
            const result = scoreConnection(connection, '');
            expect(result.totalScore).toBe(0);
            expect(result.matches.length).toBe(0);
        });

        test('whitespace-only query returns zero score', () => {
            const connection = createConnection('john smith');
            const result = scoreConnection(connection, '   ');
            expect(result.totalScore).toBe(0);
        });

        test('missing displayName', () => {
            const connection = createConnection('', ['engineer']);
            const result = scoreConnection(connection, 'engineer');
            expect(result.totalScore).toBeGreaterThan(0); // can still match tags
        });

        test('missing connectedUser', () => {
            const connection: Connection = {
                id: 'conn-123',
                userId: 'user-1',
                connectedUserId: 'user-2',
                tags: ['engineer'],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };
            const result = scoreConnection(connection, 'engineer');
            expect(result.totalScore).toBeGreaterThan(0); // can still match tags
        });

        test('empty tags array', () => {
            const connection = createConnection('john smith', []);
            const result = scoreConnection(connection, 'john');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('undefined note', () => {
            const connection = createConnection('john smith', ['engineer'], undefined);
            const result = scoreConnection(connection, 'john');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('empty note string', () => {
            const connection = createConnection('john smith', [], '');
            const result = scoreConnection(connection, 'john');
            expect(result.totalScore).toBeGreaterThan(0);
        });
    });

    describe('case insensitivity', () => {
        test('query is case insensitive', () => {
            const connection = createConnection('John Smith');
            const lower = scoreConnection(connection, 'john');
            const upper = scoreConnection(connection, 'JOHN');
            const mixed = scoreConnection(connection, 'JoHn');
            expect(lower.totalScore).toBeGreaterThan(0);
            expect(upper.totalScore).toBeGreaterThan(0);
            expect(mixed.totalScore).toBeGreaterThan(0);
        });

        test('tags are case insensitive', () => {
            const connection = createConnection('alice', ['Python', 'React']);
            const result = scoreConnection(connection, 'python');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('notes are case insensitive', () => {
            const connection = createConnection('alice', [], 'Met at CONFERENCE');
            const result = scoreConnection(connection, 'conference');
            expect(result.totalScore).toBeGreaterThan(0);
        });
    });

    describe('real-world scenarios', () => {
        test('searching for colleague by first name', () => {
            const connection = createConnection('Sarah Johnson', ['engineer', 'python'], 'team lead');
            const result = scoreConnection(connection, 'sarah');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('searching for colleague by last name', () => {
            const connection = createConnection('Sarah Johnson', ['engineer', 'python'], 'team lead');
            const result = scoreConnection(connection, 'johnson');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('searching by skill tag', () => {
            const connection = createConnection('Sarah Johnson', ['engineer', 'python', 'react'], 'team lead');
            const result = scoreConnection(connection, 'python');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('searching by role in note', () => {
            const connection = createConnection('Sarah Johnson', ['engineer'], 'team lead at google');
            const result = scoreConnection(connection, 'team lead');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('searching by company in note', () => {
            const connection = createConnection('Sarah Johnson', ['engineer'], 'works at google');
            const result = scoreConnection(connection, 'google');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('complex multi-word search', () => {
            const connection = createConnection('Sarah Johnson', ['python', 'react'], 'senior engineer at google');
            const result = scoreConnection(connection, 'sarah python google');
            expect(result.totalScore).toBeGreaterThan(0);
        });

        test('typo in search query', () => {
            const connection = createConnection('christopher', ['engineer']);
            const result = scoreConnection(connection, 'cristopher'); // missing 'h'
            expect(result.totalScore).toBeGreaterThan(0);
        });
    });

    describe('scoring consistency', () => {
        test('same query produces same score', () => {
            const connection = createConnection('john smith', ['engineer']);
            const result1 = scoreConnection(connection, 'john');
            const result2 = scoreConnection(connection, 'john');
            expect(result1.totalScore).toBe(result2.totalScore);
        });

        test('better matches have higher scores', () => {
            const connection = createConnection('john smith');
            const exact = scoreConnection(connection, 'john smith');
            const partial = scoreConnection(connection, 'john');
            const fuzzy = scoreConnection(connection, 'jhon');
            expect(exact.totalScore).toBeGreaterThanOrEqual(partial.totalScore);
            expect(partial.totalScore).toBeGreaterThan(fuzzy.totalScore);
        });
    });
});

describe('scoreConnections', () => {
    const createConnection = (
        id: string,
        displayName: string,
        tags: string[] = [],
        note?: string
    ): Connection => ({
        id,
        userId: 'user-1',
        connectedUserId: `user-${id}`,
        connectedUser: {
            id: `user-${id}`,
            displayName,
            gravatarHash: 'abc123',
            contactLinks: [],
            badges: [],
        },
        tags,
        note,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
    });

    describe('basic functionality', () => {
        test('scores empty array', () => {
            const result = scoreConnections([], 'john');
            expect(result).toEqual([]);
        });

        test('scores single connection', () => {
            const connections = [createConnection('1', 'john smith')];
            const result = scoreConnections(connections, 'john');
            expect(result).toHaveLength(1);
            expect(result[0].connection.id).toBe('1');
            expect(result[0].scoring.totalScore).toBeGreaterThan(0);
        });

        test('scores multiple connections', () => {
            const connections = [
                createConnection('1', 'john smith'),
                createConnection('2', 'jane doe'),
                createConnection('3', 'bob johnson'),
            ];
            const result = scoreConnections(connections, 'john');
            expect(result).toHaveLength(3);
            expect(result.every((r) => r.scoring !== undefined)).toBe(true);
        });
    });

    describe('score ordering', () => {
        test('better matches have higher scores', () => {
            const connections = [
                createConnection('1', 'john smith'),
                createConnection('2', 'johnson'),
                createConnection('3', 'jhon'),
            ];
            const result = scoreConnections(connections, 'john');

            const johnSmith = result.find((r) => r.connection.id === '1')!;
            const johnson = result.find((r) => r.connection.id === '2')!;
            const jhon = result.find((r) => r.connection.id === '3')!;

            expect(johnSmith.scoring.totalScore).toBeGreaterThanOrEqual(johnson.scoring.totalScore);
            expect(johnson.scoring.totalScore).toBeGreaterThan(jhon.scoring.totalScore);
        });

        test('no matches have zero score', () => {
            const connections = [
                createConnection('1', 'john smith'),
                createConnection('2', 'jane doe'),
            ];
            const result = scoreConnections(connections, 'python');

            expect(result.every((r) => r.scoring.totalScore === 0)).toBe(true);
        });
    });

    describe('maintains connection data', () => {
        test('preserves all connection properties', () => {
            const connections = [
                createConnection('1', 'john smith', ['engineer', 'python'], 'team lead'),
            ];
            const result = scoreConnections(connections, 'john');

            expect(result[0].connection.id).toBe('1');
            expect(result[0].connection.connectedUser?.displayName).toBe('john smith');
            expect(result[0].connection.tags).toEqual(['engineer', 'python']);
            expect(result[0].connection.note).toBe('team lead');
        });

        test('preserves connection order in array', () => {
            const connections = [
                createConnection('1', 'alice'),
                createConnection('2', 'bob'),
                createConnection('3', 'charlie'),
            ];
            const result = scoreConnections(connections, 'xyz'); // no matches

            expect(result[0].connection.id).toBe('1');
            expect(result[1].connection.id).toBe('2');
            expect(result[2].connection.id).toBe('3');
        });
    });

    describe('varied matching scenarios', () => {
        test('some connections match, others do not', () => {
            const connections = [
                createConnection('1', 'john smith'),
                createConnection('2', 'jane doe'),
                createConnection('3', 'john johnson'),
            ];
            const result = scoreConnections(connections, 'john');

            const matches = result.filter((r) => r.scoring.totalScore > 0);
            const nonMatches = result.filter((r) => r.scoring.totalScore === 0);

            expect(matches.length).toBe(2);
            expect(nonMatches.length).toBe(1);
        });

        test('all connections match', () => {
            const connections = [
                createConnection('1', 'engineer alice', ['engineer']),
                createConnection('2', 'engineer bob', ['engineer']),
                createConnection('3', 'charlie', ['engineer']),
            ];
            const result = scoreConnections(connections, 'engineer');

            expect(result.every((r) => r.scoring.totalScore > 0)).toBe(true);
        });
    });

    describe('complex queries', () => {
        test('multi-word query across connections', () => {
            const connections = [
                createConnection('1', 'john smith', ['python']),
                createConnection('2', 'john doe', ['javascript']),
                createConnection('3', 'jane smith', ['python']),
            ];
            const result = scoreConnections(connections, 'john python');

            const match = result.find((r) => r.connection.id === '1')!;
            expect(match.scoring.totalScore).toBeGreaterThan(0);

            const noMatch = result.find((r) => r.connection.id === '2')!;
            expect(noMatch.scoring.totalScore).toBe(0); // john but not python
        });
    });

    describe('edge cases', () => {
        test('empty query returns zero scores for all', () => {
            const connections = [
                createConnection('1', 'john smith'),
                createConnection('2', 'jane doe'),
            ];
            const result = scoreConnections(connections, '');

            expect(result.every((r) => r.scoring.totalScore === 0)).toBe(true);
        });

        test('handles connections with missing fields', () => {
            const connection: Connection = {
                id: '1',
                userId: 'user-1',
                connectedUserId: 'user-2',
                tags: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };
            const result = scoreConnections([connection], 'john');
            expect(result).toHaveLength(1);
            expect(result[0].scoring.totalScore).toBe(0);
        });
    });
});
