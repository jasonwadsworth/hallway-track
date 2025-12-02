import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import type { Connection, ConnectedProfile, RemoveConnectionResult, SearchConnectionsResult } from '../types';
import { getMyConnections, searchMyConnections } from '../graphql/queries';
import { getConnectedProfile } from '../graphql/queries';
import { removeConnection } from '../graphql/mutations';
import { ConnectionCard } from './ConnectionCard';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { PullToRefresh } from './PullToRefresh';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './ConnectionList.css';

// Debounce hook for search input
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export function ConnectionList() {
    const navigate = useNavigate();
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    const [removing, setRemoving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const searchInputRef = useRef<HTMLInputElement>(null);
    // Track the latest search request to ignore stale responses
    const latestSearchRef = useRef<number>(0);

    useEffect(() => {
        loadConnections();
    }, []);

    // Search when debounced query changes
    useEffect(() => {
        if (debouncedSearchQuery.trim()) {
            searchConnections(debouncedSearchQuery);
        } else if (!loading) {
            loadConnections();
        }
    }, [debouncedSearchQuery]);

    async function searchConnections(query: string) {
        const client = generateClient();
        // Increment request ID to track this specific request
        const requestId = ++latestSearchRef.current;

        try {
            setSearching(true);
            setError(null);

            const response = await client.graphql({
                query: searchMyConnections,
                variables: { query },
            });

            // Only update state if this is still the latest request
            if (requestId !== latestSearchRef.current) {
                return; // Stale response, ignore it
            }

            if ('data' in response && response.data) {
                const searchResult = response.data.searchMyConnections as SearchConnectionsResult;
                // Extract connections from search results (already includes connectedUser)
                const searchedConnections = searchResult.results.map((r) => r.connection);
                setConnections(searchedConnections);
            }
        } catch (err) {
            // Only handle error if this is still the latest request
            if (requestId !== latestSearchRef.current) {
                return;
            }
            console.error('Error searching connections:', err);
            const errorInfo = parseGraphQLError(err);
            setError(errorInfo.message);

            if (errorInfo.isAuthError) {
                await handleAuthError();
            }
        } finally {
            // Only update searching state if this is still the latest request
            if (requestId === latestSearchRef.current) {
                setSearching(false);
            }
        }
    }

    function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
        setSearchQuery(e.target.value);
    }

    function handleClearSearch() {
        setSearchQuery('');
        searchInputRef.current?.focus();
    }

    async function loadConnections() {
        const client = generateClient();
        try {
            setLoading(true);
            setError(null);

            const response = await client.graphql({
                query: getMyConnections,
            });

            if ('data' in response && response.data) {
                const connectionsData = response.data.getMyConnections as Connection[];

                // Fetch connected user details for each connection
                const connectionsWithUsers = await Promise.all(
                    connectionsData.map(async (connection) => {
                        try {
                            const userResponse = await client.graphql({
                                query: getConnectedProfile,
                                variables: { userId: connection.connectedUserId },
                            });

                            if ('data' in userResponse && userResponse.data) {
                                return {
                                    ...connection,
                                    connectedUser: userResponse.data.getConnectedProfile as ConnectedProfile,
                                };
                            }
                            return connection;
                        } catch (err) {
                            console.error('Error loading connected user:', err);
                            return connection;
                        }
                    })
                );

                // Sort by createdAt descending (most recent first)
                connectionsWithUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                setConnections(connectionsWithUsers);
            }
        } catch (err) {
            console.error('Error loading connections:', err);
            const errorInfo = parseGraphQLError(err);
            setError(errorInfo.message);

            if (errorInfo.isAuthError) {
                await handleAuthError();
            }
        } finally {
            setLoading(false);
        }
    }

    function handleRemoveClick(connectionId: string) {
        setConfirmRemove(connectionId);
    }

    async function handleConfirmRemove() {
        if (!confirmRemove) return;

        const client = generateClient();
        try {
            setRemoving(true);
            setError(null);

            const response = await client.graphql({
                query: removeConnection,
                variables: { connectionId: confirmRemove },
            });

            if ('data' in response && response.data) {
                const result = response.data.removeConnection as RemoveConnectionResult;

                if (result.success) {
                    // Remove connection from local state
                    setConnections((prev) => prev.filter((c) => c.id !== confirmRemove));
                    setConfirmRemove(null);

                    // Dispatch custom event to notify other components to refresh profile data
                    window.dispatchEvent(new CustomEvent('profileDataChanged'));
                } else {
                    setError(result.message || 'Failed to remove connection');
                }
            }
        } catch (err) {
            console.error('Error removing connection:', err);
            const errorInfo = parseGraphQLError(err);
            setError(errorInfo.message);

            if (errorInfo.isAuthError) {
                await handleAuthError();
            }
        } finally {
            setRemoving(false);
        }
    }

    function handleCancelRemove() {
        setConfirmRemove(null);
    }

    if (loading) {
        return (
            <div className="connection-list">
                <h2>My Connections</h2>
                <LoadingSpinner message="Loading connections..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="connection-list">
                <h2>My Connections</h2>
                <ErrorMessage message={error} onRetry={loadConnections} />
            </div>
        );
    }

    if (connections.length === 0 && !searchQuery) {
        return (
            <div className="connection-list empty">
                <p>No connections yet. Scan someone's QR code to connect!</p>
            </div>
        );
    }

    const connectionToRemove = connections.find((c) => c.id === confirmRemove);

    return (
        <PullToRefresh onRefresh={loadConnections}>
            <div className="connection-list">
                <h2>My Connections ({connections.length})</h2>
                <div className="search-container">
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="search-input"
                        placeholder="Search by name, tag, or note..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        aria-label="Search connections"
                    />
                    {searchQuery && (
                        <button className="search-clear-button" onClick={handleClearSearch} aria-label="Clear search">
                            ×
                        </button>
                    )}
                    {searching && <span className="search-loading">Searching...</span>}
                </div>
                {connections.length === 0 && searchQuery ? (
                    <div className="no-results">
                        <p>No connections found matching "{searchQuery}"</p>
                    </div>
                ) : (
                    <div className="connections-grid">
                        {connections.map((connection) => (
                            <ConnectionCard
                                key={connection.id}
                                connection={connection}
                                onClick={() => navigate(`/connections/${connection.id}`)}
                                onRemove={handleRemoveClick}
                            />
                        ))}
                    </div>
                )}

                {confirmRemove && (
                    <div className="modal-overlay" onClick={handleCancelRemove}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <h3>Remove Connection</h3>
                            <p>
                                Are you sure you want to remove your connection with{' '}
                                <strong>{connectionToRemove?.connectedUser?.displayName || 'this user'}</strong>?
                            </p>
                            <p className="warning-text">This action cannot be undone.</p>
                            <div className="modal-actions">
                                <button className="button-secondary" onClick={handleCancelRemove} disabled={removing}>
                                    Cancel
                                </button>
                                <button className="button-danger" onClick={handleConfirmRemove} disabled={removing}>
                                    {removing ? 'Removing...' : 'Remove Connection'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PullToRefresh>
    );
}
