import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import type { Connection, ConnectedProfile } from '../types';
import { getMyConnections, getConnectedProfile } from '../graphql/queries';
import { updateConnectionNote } from '../graphql/mutations';
import { TagManager } from './TagManager';
import { BadgeDisplay } from './BadgeDisplay';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { ContactLinkList } from './ContactLinkList';
import { ProfilePicture } from './ProfilePicture';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './ConnectionDetail.css';

export function ConnectionDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [connection, setConnection] = useState<Connection | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [noteText, setNoteText] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);
    const [noteSaveStatus, setNoteSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [noteSaveError, setNoteSaveError] = useState<string | null>(null);

    useEffect(() => {
        async function loadConnection() {
            if (!id) {
                setError('Invalid connection ID');
                setLoading(false);
                return;
            }

            const client = generateClient();
            try {
                setLoading(true);
                setError(null);

                // Get all connections and find the one with matching ID
                const response = await client.graphql({
                    query: getMyConnections,
                });

                if ('data' in response && response.data) {
                    const connections = response.data.getMyConnections as Connection[];
                    const foundConnection = connections.find((c) => c.id === id);

                    if (!foundConnection) {
                        setError('Connection not found');
                        setLoading(false);
                        return;
                    }

                    // Fetch connected user details
                    const userResponse = await client.graphql({
                        query: getConnectedProfile,
                        variables: { userId: foundConnection.connectedUserId },
                    });

                    if ('data' in userResponse && userResponse.data) {
                        const userProfile = userResponse.data.getConnectedProfile as ConnectedProfile;
                        setConnection({
                            ...foundConnection,
                            connectedUser: userProfile,
                        });
                        setNoteText(foundConnection.note || '');
                    }
                }
            } catch (err) {
                console.error('Error loading connection:', err);
                const errorInfo = parseGraphQLError(err);
                setError(errorInfo.message);

                if (errorInfo.isAuthError) {
                    await handleAuthError();
                }
            } finally {
                setLoading(false);
            }
        }

        loadConnection();
    }, [id]);

    const handleRetry = () => {
        // Trigger a re-render by updating a dependency
        setError(null);
        setLoading(true);
        // The useEffect will run again because we're changing state
    };

    const handleTagsUpdated = (updatedConnection: Connection) => {
        setConnection(updatedConnection);
    };

    const handleBack = () => {
        navigate('/connections');
    };

    const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        if (value.length <= 1000) {
            setNoteText(value);
            setNoteSaveStatus('idle');
            setNoteSaveError(null);
        }
    };

    const handleNoteSave = async () => {
        if (!connection) return;

        const client = generateClient();
        try {
            setNoteSaving(true);
            setNoteSaveStatus('idle');
            setNoteSaveError(null);

            const noteValue = noteText.trim() === '' ? null : noteText.trim();

            const response = await client.graphql({
                query: updateConnectionNote,
                variables: {
                    connectionId: connection.id,
                    note: noteValue,
                },
            });

            if ('data' in response && response.data) {
                const updatedConnection = response.data.updateConnectionNote as Connection;
                setConnection({
                    ...connection,
                    note: updatedConnection.note,
                    updatedAt: updatedConnection.updatedAt,
                });
                setNoteText(updatedConnection.note || '');
                setNoteSaveStatus('success');

                // Clear success message after 3 seconds
                setTimeout(() => {
                    setNoteSaveStatus('idle');
                }, 3000);
            }
        } catch (err) {
            console.error('Error saving note:', err);
            const errorInfo = parseGraphQLError(err);
            setNoteSaveError(errorInfo.message);
            setNoteSaveStatus('error');

            if (errorInfo.isAuthError) {
                await handleAuthError();
            }
        } finally {
            setNoteSaving(false);
        }
    };

    const handleNoteRetry = () => {
        setNoteSaveError(null);
        setNoteSaveStatus('idle');
        handleNoteSave();
    };

    if (loading) {
        return (
            <div className="connection-detail">
                <LoadingSpinner message="Loading connection..." />
            </div>
        );
    }

    if (error || !connection) {
        return (
            <div className="connection-detail">
                <button onClick={handleBack} className="btn-back">
                    ← Back to Connections
                </button>
                <ErrorMessage message={error || 'Unable to load connection details'} onRetry={handleRetry} />
            </div>
        );
    }

    const { connectedUser, createdAt } = connection;

    if (!connectedUser) {
        return (
            <div className="connection-detail">
                <button onClick={handleBack} className="btn-back">
                    ← Back to Connections
                </button>
                <ErrorMessage message="Unable to load connection details" onRetry={handleRetry} />
            </div>
        );
    }

    const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="connection-detail">
            <button onClick={handleBack} className="btn-back">
                ← Back to Connections
            </button>

            <div className="detail-header">
                <ProfilePicture
                    profilePictureUrl={connectedUser.profilePictureUrl}
                    gravatarHash={connectedUser.gravatarHash}
                    displayName={connectedUser.displayName}
                    size={100}
                    className="detail-avatar"
                />
                <div className="detail-info">
                    <h2>{connectedUser.displayName}</h2>
                    <p className="connection-date">Connected on {formattedDate}</p>
                </div>
            </div>

            <div className="detail-section">
                <h3>Contact Links</h3>
                <ContactLinkList links={connectedUser.contactLinks} emptyMessage="No contact information shared" />
            </div>

            {connectedUser.badges.length > 0 && (
                <div className="detail-section">
                    <h3>Badges</h3>
                    <BadgeDisplay badges={connectedUser.badges} />
                </div>
            )}

            <div className="detail-section">
                <h3>Tags</h3>
                <TagManager connection={connection} onTagsUpdated={handleTagsUpdated} />
            </div>

            <div className="detail-section notes-section">
                <h3>Notes</h3>
                <p className="notes-description">Add private notes about this connection. Only you can see these notes.</p>
                <textarea
                    className="notes-textarea"
                    value={noteText}
                    onChange={handleNoteChange}
                    placeholder="Add a note about this connection..."
                    maxLength={1000}
                    rows={6}
                />
                <div className="notes-footer">
                    <span className="character-counter">{noteText.length} / 1000 characters</span>
                    <button className="btn-save-note" onClick={handleNoteSave} disabled={noteSaving}>
                        {noteSaving ? 'Saving...' : 'Save Note'}
                    </button>
                </div>
                {noteSaveStatus === 'success' && <div className="note-status note-status-success">Note saved successfully!</div>}
                {noteSaveStatus === 'error' && noteSaveError && (
                    <div className="note-status note-status-error">
                        <p>{noteSaveError}</p>
                        <button onClick={handleNoteRetry} className="btn-retry">
                            Retry
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
