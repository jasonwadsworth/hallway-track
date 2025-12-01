import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import type { LeaderboardResult, LeaderboardEntry, BadgeLeaderboardResult, BadgeLeaderboardEntry } from '../types';
import { getLeaderboard, getBadgeLeaderboard } from '../graphql/queries';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { PullToRefresh } from './PullToRefresh';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import { ProfilePicture } from './ProfilePicture';
import './Leaderboard.css';

const DEFAULT_LIMIT = 10;

type LeaderboardType = 'connections' | 'badges';

export function Leaderboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<LeaderboardType>('connections');

    // Connection leaderboard state
    const [connectionEntries, setConnectionEntries] = useState<LeaderboardEntry[]>([]);
    const [connectionCurrentUserEntry, setConnectionCurrentUserEntry] = useState<LeaderboardEntry | undefined>();
    const [connectionLoading, setConnectionLoading] = useState(true);
    const [connectionLoadingMore, setConnectionLoadingMore] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [connectionHasMore, setConnectionHasMore] = useState(false);
    const [connectionNextToken, setConnectionNextToken] = useState<string | undefined>();

    // Badge leaderboard state
    const [badgeEntries, setBadgeEntries] = useState<BadgeLeaderboardEntry[]>([]);
    const [badgeCurrentUserEntry, setBadgeCurrentUserEntry] = useState<BadgeLeaderboardEntry | undefined>();
    const [badgeLoading, setBadgeLoading] = useState(true);
    const [badgeLoadingMore, setBadgeLoadingMore] = useState(false);
    const [badgeError, setBadgeError] = useState<string | null>(null);
    const [badgeHasMore, setBadgeHasMore] = useState(false);
    const [badgeNextToken, setBadgeNextToken] = useState<string | undefined>();

    useEffect(() => {
        loadConnectionLeaderboard();
        loadBadgeLeaderboard();
    }, []);

    async function loadConnectionLeaderboard(append = false) {
        const client = generateClient();
        try {
            if (append) {
                setConnectionLoadingMore(true);
            } else {
                setConnectionLoading(true);
            }
            setConnectionError(null);

            const response = await client.graphql({
                query: getLeaderboard,
                variables: {
                    limit: DEFAULT_LIMIT,
                    nextToken: append ? connectionNextToken : undefined,
                },
            });

            if ('data' in response && response.data) {
                const result = response.data.getLeaderboard as LeaderboardResult;

                if (append) {
                    setConnectionEntries((prev) => [...prev, ...result.entries]);
                } else {
                    setConnectionEntries(result.entries);
                    setConnectionCurrentUserEntry(result.currentUserEntry);
                }

                setConnectionHasMore(result.hasMore);
                setConnectionNextToken(result.nextToken ?? undefined);
            }
        } catch (err) {
            console.error('Error loading connection leaderboard:', err);
            const errorInfo = parseGraphQLError(err);
            setConnectionError(errorInfo.message);

            if (errorInfo.isAuthError) {
                await handleAuthError();
            }
        } finally {
            setConnectionLoading(false);
            setConnectionLoadingMore(false);
        }
    }

    async function loadBadgeLeaderboard(append = false) {
        const client = generateClient();
        try {
            if (append) {
                setBadgeLoadingMore(true);
            } else {
                setBadgeLoading(true);
            }
            setBadgeError(null);

            const response = await client.graphql({
                query: getBadgeLeaderboard,
                variables: {
                    limit: DEFAULT_LIMIT,
                    nextToken: append ? badgeNextToken : undefined,
                },
            });

            if ('data' in response && response.data) {
                const result = response.data.getBadgeLeaderboard as BadgeLeaderboardResult;

                if (append) {
                    setBadgeEntries((prev) => [...prev, ...result.entries]);
                } else {
                    setBadgeEntries(result.entries);
                    setBadgeCurrentUserEntry(result.currentUserEntry);
                }

                setBadgeHasMore(result.hasMore);
                setBadgeNextToken(result.nextToken ?? undefined);
            }
        } catch (err) {
            console.error('Error loading badge leaderboard:', err);
            const errorInfo = parseGraphQLError(err);
            setBadgeError(errorInfo.message);

            if (errorInfo.isAuthError) {
                await handleAuthError();
            }
        } finally {
            setBadgeLoading(false);
            setBadgeLoadingMore(false);
        }
    }

    function handleEntryClick(userId: string) {
        navigate(`/profile/${userId}`);
    }

    function handleConnectionLoadMore() {
        if (connectionHasMore && !connectionLoadingMore) {
            loadConnectionLeaderboard(true);
        }
    }

    function handleBadgeLoadMore() {
        if (badgeHasMore && !badgeLoadingMore) {
            loadBadgeLeaderboard(true);
        }
    }

    async function handleRefresh() {
        if (activeTab === 'connections') {
            await loadConnectionLeaderboard();
        } else {
            await loadBadgeLeaderboard();
        }
    }

    const renderConnectionLeaderboard = () => {
        if (connectionLoading) {
            return <LoadingSpinner message="Loading leaderboard..." />;
        }

        if (connectionError) {
            return <ErrorMessage message={connectionError} onRetry={() => loadConnectionLeaderboard()} />;
        }

        if (connectionEntries.length === 0) {
            return (
                <div className="leaderboard-empty">
                    <p>No one on the leaderboard yet. Be the first to make connections!</p>
                </div>
            );
        }

        return (
            <>
                <p className="leaderboard-subtitle">Top connectors in the community</p>
                <div className="leaderboard-list">
                    {connectionEntries.map((entry) => (
                        <ConnectionLeaderboardEntryCard key={entry.userId} entry={entry} onClick={() => handleEntryClick(entry.userId)} />
                    ))}
                </div>

                {connectionHasMore && (
                    <button className="load-more-button" onClick={handleConnectionLoadMore} disabled={connectionLoadingMore}>
                        {connectionLoadingMore ? 'Loading...' : 'Load More'}
                    </button>
                )}

                {connectionCurrentUserEntry && !connectionEntries.some((e) => e.isCurrentUser) && (
                    <div className="current-user-section">
                        <h3>Your Ranking</h3>
                        <ConnectionLeaderboardEntryCard
                            entry={connectionCurrentUserEntry}
                            onClick={() => handleEntryClick(connectionCurrentUserEntry.userId)}
                        />
                    </div>
                )}

                {!connectionCurrentUserEntry && !connectionEntries.some((e) => e.isCurrentUser) && (
                    <div className="current-user-section no-rank">
                        <p>Make connections to appear on the leaderboard!</p>
                    </div>
                )}
            </>
        );
    };

    const renderBadgeLeaderboard = () => {
        if (badgeLoading) {
            return <LoadingSpinner message="Loading leaderboard..." />;
        }

        if (badgeError) {
            return <ErrorMessage message={badgeError} onRetry={() => loadBadgeLeaderboard()} />;
        }

        if (badgeEntries.length === 0) {
            return (
                <div className="leaderboard-empty">
                    <p>No one on the badge leaderboard yet. Earn badges to appear here!</p>
                </div>
            );
        }

        return (
            <>
                <p className="leaderboard-subtitle">Top badge collectors in the community</p>
                <div className="leaderboard-list">
                    {badgeEntries.map((entry) => (
                        <BadgeLeaderboardEntryCard key={entry.userId} entry={entry} onClick={() => handleEntryClick(entry.userId)} />
                    ))}
                </div>

                {badgeHasMore && (
                    <button className="load-more-button" onClick={handleBadgeLoadMore} disabled={badgeLoadingMore}>
                        {badgeLoadingMore ? 'Loading...' : 'Load More'}
                    </button>
                )}

                {badgeCurrentUserEntry && !badgeEntries.some((e) => e.isCurrentUser) && (
                    <div className="current-user-section">
                        <h3>Your Ranking</h3>
                        <BadgeLeaderboardEntryCard entry={badgeCurrentUserEntry} onClick={() => handleEntryClick(badgeCurrentUserEntry.userId)} />
                    </div>
                )}

                {!badgeCurrentUserEntry && !badgeEntries.some((e) => e.isCurrentUser) && (
                    <div className="current-user-section no-rank">
                        <p>Earn badges to appear on the leaderboard!</p>
                    </div>
                )}
            </>
        );
    };

    return (
        <PullToRefresh onRefresh={handleRefresh}>
            <div className="leaderboard">
                <h2>🏆 Leaderboard</h2>

                <div className="leaderboard-tabs">
                    <button className={`leaderboard-tab ${activeTab === 'connections' ? 'active' : ''}`} onClick={() => setActiveTab('connections')}>
                        🤝 Connections
                    </button>
                    <button className={`leaderboard-tab ${activeTab === 'badges' ? 'active' : ''}`} onClick={() => setActiveTab('badges')}>
                        🏅 Badges
                    </button>
                </div>

                <div className="leaderboard-content">{activeTab === 'connections' ? renderConnectionLeaderboard() : renderBadgeLeaderboard()}</div>
            </div>
        </PullToRefresh>
    );
}

interface ConnectionLeaderboardEntryCardProps {
    entry: LeaderboardEntry;
    onClick: () => void;
}

function ConnectionLeaderboardEntryCard({ entry, onClick }: ConnectionLeaderboardEntryCardProps) {
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

interface BadgeLeaderboardEntryCardProps {
    entry: BadgeLeaderboardEntry;
    onClick: () => void;
}

function BadgeLeaderboardEntryCard({ entry, onClick }: BadgeLeaderboardEntryCardProps) {
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
                <span className="count-number">{entry.badgeCount}</span>
                <span className="count-label">badges</span>
            </div>
        </div>
    );
}
