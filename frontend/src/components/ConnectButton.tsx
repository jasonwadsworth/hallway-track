import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { checkConnectionOrRequest } from '../graphql/queries';
import { createConnectionRequest, approveConnectionRequest, cancelConnectionRequest } from '../graphql/mutations';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import type { ConnectionStatus, ConnectionRequestResult } from '../types';
import './ConnectButton.css';

interface ConnectButtonProps {
  userId: string;
}

export function ConnectButton({ userId }: ConnectButtonProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkConnectionStatus() {
      const client = generateClient();
      try {
        setLoading(true);
        setError(null);
        const response = await client.graphql({
          query: checkConnectionOrRequest,
          variables: { userId },
        });
        if ('data' in response && response.data) {
          setConnectionStatus(response.data.checkConnectionOrRequest as ConnectionStatus);
        }
      } catch (err) {
        console.error('Error checking connection status:', err);
        const errorInfo = parseGraphQLError(err);
        setError(errorInfo.message);

        if (errorInfo.isAuthError) {
          await handleAuthError();
        }
      } finally {
        setLoading(false);
      }
    }

    checkConnectionStatus();
  }, [userId]);

  async function handleSendRequest() {
    const client = generateClient();
    try {
      setProcessing(true);
      setError(null);
      setSuccessMessage(null);

      const response = await client.graphql({
        query: createConnectionRequest,
        variables: { recipientUserId: userId },
      });

      if ('data' in response && response.data) {
        const result = response.data.createConnectionRequest as ConnectionRequestResult;
        if (result.success) {
          setConnectionStatus({
            isConnected: false,
            hasPendingRequest: true,
            requestDirection: 'outgoing',
          });
          setSuccessMessage('Connection request sent!');
        } else {
          setError(result.message || 'Failed to send connection request');
        }
      }

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: unknown) {
      console.error('Error sending connection request:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setProcessing(false);
    }
  }

  async function handleApproveRequest() {
    // This would need the request ID, which we don't have in this component
    // For now, we'll show a message directing users to the requests page
    setSuccessMessage('Please go to Connection Requests to approve this request');
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  }

  async function handleCancelRequest() {
    // This would need the request ID, which we don't have in this component
    // For now, we'll show a message directing users to the requests page
    setSuccessMessage('Please go to Connection Requests to cancel this request');
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
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

  if (!connectionStatus) {
    return (
      <div className="connect-button-container">
        <button className="btn-connect" disabled>
          Unable to check status
        </button>
      </div>
    );
  }

  return (
    <div className="connect-button-container">
      {connectionStatus.isConnected ? (
        <button className="btn-connected" disabled>
          ✓ Already Connected
        </button>
      ) : connectionStatus.hasPendingRequest ? (
        connectionStatus.requestDirection === 'outgoing' ? (
          <button
            className="btn-pending"
            onClick={handleCancelRequest}
            disabled={processing}
          >
            {processing ? (
              <>
                <LoadingSpinner inline message="" /> Processing...
              </>
            ) : (
              'Request Sent'
            )}
          </button>
        ) : (
          <button
            className="btn-approve"
            onClick={handleApproveRequest}
            disabled={processing}
          >
            {processing ? (
              <>
                <LoadingSpinner inline message="" /> Processing...
              </>
            ) : (
              'Accept Request'
            )}
          </button>
        )
      ) : (
        <button
          className="btn-connect"
          onClick={handleSendRequest}
          disabled={processing}
        >
          {processing ? (
            <>
              <LoadingSpinner inline message="" /> Sending...
            </>
          ) : (
            'Send Request'
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
