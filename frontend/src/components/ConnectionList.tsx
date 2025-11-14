import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import type { Connection, ConnectedProfile, RemoveConnectionResult } from '../types';
import { getMyConnections } from '../graphql/queries';
import { getConnectedProfile } from '../graphql/queries';
import { removeConnection } from '../graphql/mutations';
import { ConnectionCard } from './ConnectionCard';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './ConnectionList.css';

export function ConnectionList() {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

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
        connectionsWithUsers.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

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
          setConnections(prev => prev.filter(c => c.id !== confirmRemove));
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
        <ErrorMessage
          message={error}
          onRetry={loadConnections}
        />
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="connection-list empty">
        <p>No connections yet. Scan someone's QR code to connect!</p>
      </div>
    );
  }

  const connectionToRemove = connections.find(c => c.id === confirmRemove);

  return (
    <div className="connection-list">
      <h2>My Connections ({connections.length})</h2>
      <div className="connections-grid">
        {connections.map(connection => (
          <ConnectionCard
            key={connection.id}
            connection={connection}
            onClick={() => navigate(`/connections/${connection.id}`)}
            onRemove={handleRemoveClick}
          />
        ))}
      </div>

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
              <button
                className="button-secondary"
                onClick={handleCancelRemove}
                disabled={removing}
              >
                Cancel
              </button>
              <button
                className="button-danger"
                onClick={handleConfirmRemove}
                disabled={removing}
              >
                {removing ? 'Removing...' : 'Remove Connection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
