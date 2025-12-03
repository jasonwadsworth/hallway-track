import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import type { InstantConnectResult } from '../types';
import { redeemInstantConnectToken } from '../graphql/mutations';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './InstantConnectRedeem.css';

export function InstantConnectRedeem() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [result, setResult] = useState<InstantConnectResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function redeemToken() {
            if (!token) {
                setError('Invalid connection link');
                setLoading(false);
                return;
            }

            const client = generateClient();
            try {
                setLoading(true);
                setError(null);

                const response = await client.graphql({
                    query: redeemInstantConnectToken,
                    variables: { token },
                });

                if ('data' in response && response.data) {
                    const redemptionResult = response.data.redeemInstantConnectToken as InstantConnectResult;
                    setResult(redemptionResult);
                }
            } catch (err) {
                console.error('Error redeeming instant connect token:', err);
                const errorInfo = parseGraphQLError(err);
                setError(errorInfo.message);

                if (errorInfo.isAuthError) {
                    await handleAuthError();
                }
            } finally {
                setLoading(false);
            }
        }

        redeemToken();
    }, [token]);

    const handleViewConnection = () => {
        if (result?.connectedUser) {
            // Navigate to the connection detail page (uses connectedUserId as the connection ID)
            navigate(`/connections/${result.connectedUser.id}`);
        }
    };

    const handleGoHome = () => {
        navigate('/');
    };

    if (loading) {
        return (
            <div className="instant-connect-redeem">
                <LoadingSpinner message="Connecting..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="instant-connect-redeem">
                <div className="redeem-result error">
                    <div className="result-icon">❌</div>
                    <h2>Connection Failed</h2>
                    <p className="result-message">{error}</p>
                    <button className="primary-button" onClick={handleGoHome}>
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    if (result && !result.success) {
        return (
            <div className="instant-connect-redeem">
                <div className="redeem-result error">
                    <div className="result-icon">❌</div>
                    <h2>Connection Failed</h2>
                    <p className="result-message">{result.message}</p>
                    <button className="primary-button" onClick={handleGoHome}>
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    if (result?.success && result.connectedUser) {
        return (
            <div className="instant-connect-redeem">
                <div className="redeem-result success">
                    <div className="result-icon">🎉</div>
                    <h2>Connected!</h2>
                    <p className="result-message">
                        You are now connected with <strong>{result.connectedUser.displayName}</strong>
                    </p>
                    <div className="result-actions">
                        <button className="primary-button" onClick={handleViewConnection}>
                            View Connection
                        </button>
                        <button className="secondary-button" onClick={handleGoHome}>
                            Go to Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
