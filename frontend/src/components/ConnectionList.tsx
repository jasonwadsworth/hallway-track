import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { Connection, PublicProfile } from '../types';
import { getMyConnections } from '../graphql/queries';
import { getPublicProfile } from '../graphql/queries';
import { ConnectionCard } from './ConnectionCard';
import './ConnectionList.css';

const client = generateClient();

interface ConnectionListProps {
  onSelectConnection: (connection: Connection) => void;
}

export function ConnectionList({ onSelectConnection }: ConnectionListProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
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
                query: getPublicProfile,
                variables: { userId: connection.connectedUserId },
              });

              if ('data' in userResponse && userResponse.data) {
                return {
                  ...connection,
                  connectedUser: userResponse.data.getPublicProfile as PublicProfile,
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
      setError('Failed to load connections');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="connection-list loading">Loading connections...</div>;
  }

  if (error) {
    return (
      <div className="connection-list error">
        <p>{error}</p>
        <button onClick={loadConnections} className="btn-retry">
          Retry
        </button>
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

  return (
    <div className="connection-list">
      <h2>My Connections ({connections.length})</h2>
      <div className="connections-grid">
        {connections.map(connection => (
          <ConnectionCard
            key={connection.id}
            connection={connection}
            onClick={() => onSelectConnection(connection)}
          />
        ))}
      </div>
    </div>
  );
}
