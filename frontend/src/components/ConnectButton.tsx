import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { checkConnection } from '../graphql/queries';
import { createConnection } from '../graphql/mutations';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './ConnectButton.css';

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
    const client = generateClient();
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
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    const client = generateClient();
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
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      } else if (errorInfo.message.includes('already connected')) {
        setIsConnected(true);
      }
    } finally {
      setConnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="connect-button-container">
        <button className="btn-connect" disabled>
          <LoadingSpinner inline message="" /> Checking...
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
          {connecting ? (
            <>
              <LoadingSpinner inline message="" /> Connecting...
            </>
          ) : (
            'Connect'
          )}
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
