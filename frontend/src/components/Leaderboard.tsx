import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import type { LeaderboardResult, LeaderboardEntry } from '../types';
import { getLeaderboard } from '../graphql/queries';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { PullToRefresh } from './PullToRefresh';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import { ProfilePicture } from './ProfilePicture';
import './Leaderboard.css';

const DEFAULT_LIMIT = 10;

export function Leaderboard() {
    const navigate = useNavigate();
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | undefined>();
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [nextToken, setNextToken] = useState<string | undefined>();

    useEffect(() => {
        loadLeaderboard();
    }, []);

    async function loadLeaderboard(append = false) {
        const client = generateClient();
        try {
            if (append) {
                setLoadingMore(true);
            } else {
                setLoading(true);
            }
            setError(null);

            const response = await client.graphql({
                query: getLeaderboard,
                variables: {
                    limit: DEFAULT_LIMIT,
                    nextToken: append ? nextToken : undefined,
                },
            });

            if ('data' in response && response.data) {
                const result = response.data.getLeaderboard as LeaderboardResult;

                if (append) {
                    setEntries((prev) => [...prev, ...result.entries]);
                } else {
                    setEntries(result.entries);
                    setCurrentUserEntry(result.currentUserEntry);
                }

                setHasMore(result.hasMore);
                setNextToken(result.nextToken ?? undefined);
            }
        } catch (err) {
            console.error('Error loading leaderboard:', err);
            const errorInfo = parseGraphQLError(err);
            setError(errorInfo.message);

            if (errorInfo.isAuthError) {
                await handleAuthError();
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }

    function handleEntryClick(userId: string) {
        navigate(`/profile/${userId}`);
    }

    function handleLoadMore() {
        if (hasMore && !loadingMore) {
            loadLeaderboard(true);
        }
    }

    const renderContent = () => {
        if (loading) {
            return (
                <div className="leaderboard">
                    <h2>🏆 Connection Leaderboard</h2>
                    <LoadingSpinner message="Loading leaderboard..." />
                </div>
            );
        }

        if (error) {
            return (
                <div className="leaderboard">
                    <h2>🏆 Connection Leaderboard</h2>
                    <ErrorMessage message={error} onRetry={() => loadLeaderboard()} />
                </div>
            );
        }

        if (entries.length === 0) {
            return (
                <div className="leaderboard empty">
                    <h2>🏆 Connection Leaderboard</h2>
                    <p>No one on the leaderboard yet. Be the first to make connections!</p>
                </div>
            );
        }

        return (
            <div className="leaderboard">
                <h2>🏆 Connection Leaderboard</h2>
                <p className="leaderboard-subtitle">Top connectors in the community</p>

                <div className="leaderboard-list">
                    {entries.map((entry) => (
                        <LeaderboardEntryCard key={entry.userId} entry={entry} onClick={() => handleEntryClick(entry.userId)} />
                    ))}
                </div>

                {hasMore && (
                    <button className="load-more-button" onClick={handleLoadMore} disabled={loadingMore}>
                        {loadingMore ? 'Loading...' : 'Load More'}
                    </button>
                )}

                {currentUserEntry && !entries.some((e) => e.isCurrentUser) && (
                    <div className="current-user-section">
                        <h3>Your Ranking</h3>
                        <LeaderboardEntryCard entry={currentUserEntry} onClick={() => handleEntryClick(currentUserEntry.userId)} />
                    </div>
                )}

                {!currentUserEntry && !entries.some((e) => e.isCurrentUser) && (
                    <div className="current-user-section no-rank">
                        <p>Make connections to appear on the leaderboard!</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <PullToRefresh
            onRefresh={async () => {
                await loadLeaderboard();
            }}
        >
            {renderContent()}
        </PullToRefresh>
    );
}

interface LeaderboardEntryCardProps {
    entry: LeaderboardEntry;
    onClick: () => void;
}

function LeaderboardEntryCard({ entry, onClick }: LeaderboardEntryCardProps) {
    const rankClass = entry.rank <= 3 ? `rank-${entry.rank}` : '';
    const rankEmoji = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '';

    return (
        <div
            className={`leaderboard-entry ${rankClass} ${entry.isCurrentUser ? 'current-user' : ''}`}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
        >
            <div className="entry-rank">{rankEmoji || `#${entry.rank}`}</div>
            <div className="entry-avatar">
                <ProfilePicture
                    gravatarHash={entry.gravatarHash}
                    profilePictureUrl={entry.profilePictureUrl}
                    uploadedProfilePictureUrl={entry.uploadedProfilePictureUrl}
                    displayName={entry.displayName}
                    size={40}
                />
            </div>
            <div className="entry-info">
                <span className="entry-name">{entry.displayName}</span>
                {entry.isCurrentUser && <span className="you-badge">You</span>}
            </div>
            <div className="entry-count">
                <span className="count-number">{entry.connectionCount}</span>
                <span className="count-label">connections</span>
            </div>
        </div>
    );
}
