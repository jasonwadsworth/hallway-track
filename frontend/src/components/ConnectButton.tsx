import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { checkConnection } from '../graphql/queries';
import { createConnection } from '../graphql/mutations';
import './ConnectButton.css';

const client = generateClient();

interface ConnectButtonProps {
  userId: string;
}

export function ConnectButton({ userId }: ConnectButtonProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    checkIfConnected();
  }, [userId]);

  async function checkIfConnected() {
    try {
      setLoading(true);
      setError(null);
      const response = await client.graphql({
        query: checkConnection,
        variables: { userId },
      });
      if ('data' in response && response.data) {
        setIsConnected(response.data.checkConnection as boolean);
      }
    } catch (err) {
      console.error('Error checking connection:', err);
      setError('Failed to check connection status');
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    try {
      setConnecting(true);
      setError(null);
      setSuccessMessage(null);

      await client.graphql({
        query: createConnection,
        variables: { connectedUserId: userId },
      });

      setIsConnected(true);
      setSuccessMessage('Connection created successfully!');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: unknown) {
      console.error('Error creating connection:', err);

      // Check if it's a duplicate connection error
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('duplicate') || errorMessage.includes('already connected')) {
        setError('Already connected with this user');
        setIsConnected(true);
      } else {
        setError('Failed to create connection. Please try again.');
      }
    } finally {
      setConnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="connect-button-container">
        <button className="btn-connect" disabled>
          Checking...
        </button>
      </div>
    );
  }

  return (
    <div className="connect-button-container">
      {isConnected ? (
        <button className="btn-connected" disabled>
          ✓ Already Connected
        </button>
      ) : (
        <button
          className="btn-connect"
          onClick={handleConnect}
          disabled={connecting}
        >
          {connecting ? 'Connecting...' : 'Connect'}
        </button>
      )}

      {error && (
        <div className="error-message">{error}</div>
      )}

      {successMessage && (
        <div className="success-message">{successMessage}</div>
      )}
    </div>
  );
}
