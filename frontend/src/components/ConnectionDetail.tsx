import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import type { Connection, PublicProfile } from '../types';
import { getMyConnections, getPublicProfile } from '../graphql/queries';
import { getGravatarUrl } from '../utils/gravatar';
import { TagManager } from './TagManager';
import './ConnectionDetail.css';

const client = generateClient();

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
      setError('Failed to load connection');
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
    return <div className="connection-detail loading">Loading connection...</div>;
  }

  if (error || !connection) {
    return (
      <div className="connection-detail error">
        <button onClick={handleBack} className="btn-back">
          ← Back to Connections
        </button>
        <p>{error || 'Unable to load connection details'}</p>
      </div>
    );
  }

  const { connectedUser, createdAt } = connection;

  if (!connectedUser) {
    return (
      <div className="connection-detail error">
        <button onClick={handleBack} className="btn-back">
          ← Back to Connections
        </button>
        <p>Unable to load connection details</p>
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
          src={getGravatarUrl(connectedUser.gravatarHash)}
          alt={connectedUser.displayName}
          className="detail-avatar"
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
