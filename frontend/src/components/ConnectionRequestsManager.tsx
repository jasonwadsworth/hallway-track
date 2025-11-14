import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { ConnectionRequest, ConnectionRequestResult } from '../types';
import { getIncomingConnectionRequests, getOutgoingConnectionRequests } from '../graphql/queries';
import { approveConnectionRequest, denyConnectionRequest, cancelConnectionRequest } from '../graphql/mutations';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './ConnectionRequestsManager.css';

export function ConnectionRequestsManager() {
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    const client = generateClient();
    try {
      setLoading(true);
      setError(null);

      const [incomingResponse, outgoingResponse] = await Promise.all([
        client.graphql({ query: getIncomingConnectionRequests }),
        client.graphql({ query: getOutgoingConnectionRequests }),
      ]);

      if ('data' in incomingResponse && incomingResponse.data) {
        setIncomingRequests(incomingResponse.data.getIncomingConnectionRequests as ConnectionRequest[]);
      }

      if ('data' in outgoingResponse && outgoingResponse.data) {
        setOutgoingRequests(outgoingResponse.data.getOutgoingConnectionRequests as ConnectionRequest[]);
      }
    } catch (err) {
      console.error('Error loading connection requests:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveRequest(requestId: string) {
    const client = generateClient();
    try {
      setProcessingRequest(requestId);
      setError(null);

      const response = await client.graphql({
        query: approveConnectionRequest,
        variables: { requestId },
      });

      if ('data' in response && response.data) {
        const result = response.data.approveConnectionRequest as ConnectionRequestResult;
        if (result.success) {
          // Remove the request from incoming requests
          setIncomingRequests(prev => prev.filter(req => req.id !== requestId));

          // Dispatch custom event to notify other components to refresh
          window.dispatchEvent(new CustomEvent('profileDataChanged'));
        } else {
          setError(result.message || 'Failed to approve connection request');
        }
      }
    } catch (err) {
      console.error('Error approving connection request:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setProcessingRequest(null);
    }
  }

  async function handleDenyRequest(requestId: string) {
    const client = generateClient();
    try {
      setProcessingRequest(requestId);
      setError(null);

      const response = await client.graphql({
        query: denyConnectionRequest,
        variables: { requestId },
      });

      if ('data' in response && response.data) {
        const result = response.data.denyConnectionRequest as ConnectionRequestResult;
        if (result.success) {
          // Remove the request from incoming requests
          setIncomingRequests(prev => prev.filter(req => req.id !== requestId));
        } else {
          setError(result.message || 'Failed to deny connection request');
        }
      }
    } catch (err) {
      console.error('Error denying connection request:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setProcessingRequest(null);
    }
  }

  async function handleCancelRequest(requestId: string) {
    const client = generateClient();
    try {
      setProcessingRequest(requestId);
      setError(null);

      const response = await client.graphql({
        query: cancelConnectionRequest,
        variables: { requestId },
      });

      if ('data' in response && response.data) {
        const result = response.data.cancelConnectionRequest as ConnectionRequestResult;
        if (result.success) {
          // Remove the request from outgoing requests
          setOutgoingRequests(prev => prev.filter(req => req.id !== requestId));
        } else {
          setError(result.message || 'Failed to cancel connection request');
        }
      }
    } catch (err) {
      console.error('Error cancelling connection request:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setProcessingRequest(null);
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="connection-requests-manager">
        <h2>Connection Requests</h2>
        <LoadingSpinner message="Loading requests..." />
      </div>
    );
  }

  return (
    <div className="connection-requests-manager">
      <h2>Connection Requests</h2>

      {error && (
        <ErrorMessage
          message={error}
          onRetry={loadRequests}
          onDismiss={() => setError(null)}
        />
      )}

      <div className="request-tabs">
        <button
          className={`tab-button ${activeTab === 'incoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('incoming')}
        >
          Incoming ({incomingRequests.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'outgoing' ? 'active' : ''}`}
          onClick={() => setActiveTab('outgoing')}
        >
          Outgoing ({outgoingRequests.length})
        </button>
      </div>

      <div className="request-content">
        {activeTab === 'incoming' ? (
          <div className="incoming-requests">
            {incomingRequests.length === 0 ? (
              <div className="empty-state">
                <p>No incoming connection requests</p>
              </div>
            ) : (
              <div className="requests-list">
                {incomingRequests.map((request) => (
                  <div key={request.id} className="request-item">
                    <div className="request-user">
                      <img
                        src={`https://www.gravatar.com/avatar/${request.initiator?.gravatarHash}?d=identicon&s=100`}
                        alt={request.initiator?.displayName || 'User'}
                        className="request-avatar"
                      />
                      <div className="request-info">
                        <div className="request-name">
                          {request.initiator?.displayName || 'Unknown User'}
                        </div>
                        <div className="request-date">
                          Sent {formatDate(request.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="request-actions">
                      <button
                        className="btn-approve"
                        onClick={() => handleApproveRequest(request.id)}
                        disabled={processingRequest === request.id}
                      >
                        {processingRequest === request.id ? (
                          <>
                            <LoadingSpinner inline message="" /> Approving...
                          </>
                        ) : (
                          'Approve'
                        )}
                      </button>
                      <button
                        className="btn-deny"
                        onClick={() => handleDenyRequest(request.id)}
                        disabled={processingRequest === request.id}
                      >
                        {processingRequest === request.id ? (
                          <>
                            <LoadingSpinner inline message="" /> Denying...
                          </>
                        ) : (
                          'Deny'
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="outgoing-requests">
            {outgoingRequests.length === 0 ? (
              <div className="empty-state">
                <p>No outgoing connection requests</p>
              </div>
            ) : (
              <div className="requests-list">
                {outgoingRequests.map((request) => (
                  <div key={request.id} className="request-item">
                    <div className="request-user">
                      <img
                        src={`https://www.gravatar.com/avatar/${request.recipient?.gravatarHash}?d=identicon&s=100`}
                        alt={request.recipient?.displayName || 'User'}
                        className="request-avatar"
                      />
                      <div className="request-info">
                        <div className="request-name">
                          {request.recipient?.displayName || 'Unknown User'}
                        </div>
                        <div className="request-date">
                          Sent {formatDate(request.createdAt)}
                        </div>
                        <div className="request-status">
                          Status: {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </div>
                      </div>
                    </div>
                    <div className="request-actions">
                      {request.status === 'PENDING' && (
                        <button
                          className="btn-cancel"
                          onClick={() => handleCancelRequest(request.id)}
                          disabled={processingRequest === request.id}
                        >
                          {processingRequest === request.id ? (
                            <>
                              <LoadingSpinner inline message="" /> Cancelling...
                            </>
                          ) : (
                            'Cancel'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}