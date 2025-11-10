import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import type { Connection, PublicProfile } from '../types';
import { getMyConnections, getPublicProfile } from '../graphql/queries';
import { getGravatarUrl, getGravatarSrcSet } from '../utils/gravatar';
import { TagManager } from './TagManager';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './ConnectionDetail.css';

export function ConnectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConnection();
  }, [id]);

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
        const foundConnection = connections.find(c => c.id === id);

        if (!foundConnection) {
          setError('Connection not found');
          setLoading(false);
          return;
        }

        // Fetch connected user details
        const userResponse = await client.graphql({
          query: getPublicProfile,
          variables: { userId: foundConnection.connectedUserId },
        });

        if ('data' in userResponse && userResponse.data) {
          setConnection({
            ...foundConnection,
            connectedUser: userResponse.data.getPublicProfile as PublicProfile,
          });
        } else {
          setConnection(foundConnection);
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

  const handleTagsUpdated = (updatedConnection: Connection) => {
    setConnection(updatedConnection);
  };

  const handleBack = () => {
    navigate('/connections');
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
        <ErrorMessage
          message={error || 'Unable to load connection details'}
          onRetry={loadConnection}
        />
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
        <ErrorMessage
          message="Unable to load connection details"
          onRetry={loadConnection}
        />
      </div>
    );
  }

  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const visibleLinks = connectedUser.contactLinks.filter(link => link.visible);

  return (
    <div className="connection-detail">
      <button onClick={handleBack} className="btn-back">
        ← Back to Connections
      </button>

      <div className="detail-header">
        <img
          src={getGravatarUrl(connectedUser.gravatarHash, 100)}
          srcSet={getGravatarSrcSet(connectedUser.gravatarHash, 100)}
          alt={connectedUser.displayName}
          className="detail-avatar"
          width="100"
          height="100"
          loading="lazy"
        />
        <div className="detail-info">
          <h2>{connectedUser.displayName}</h2>
          <p className="connection-date">Connected on {formattedDate}</p>
        </div>
      </div>

      {visibleLinks.length > 0 && (
        <div className="detail-section">
          <h3>Contact Links</h3>
          <ul className="contact-links-list">
            {visibleLinks.map(link => (
              <li key={link.id} className="contact-link-item">
                <span className="link-label">{link.label}:</span>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-url">
                  {link.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="detail-section">
        <h3>Tags</h3>
        <TagManager
          connection={connection}
          onTagsUpdated={handleTagsUpdated}
        />
      </div>
    </div>
  );
}
