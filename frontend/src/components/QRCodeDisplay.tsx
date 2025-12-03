import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateClient } from 'aws-amplify/api';
import type { User, InstantConnectToken } from '../types';
import { getMyProfile } from '../graphql/queries';
import { generateInstantConnectToken } from '../graphql/mutations';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { ShareProfileButton } from './ShareProfileButton';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './QRCodeDisplay.css';

const TOKEN_EXPIRY_MINUTES = 5;
const REFRESH_BUFFER_SECONDS = 30; // Refresh 30 seconds before expiry

export function QRCodeDisplay() {
    const [profile, setProfile] = useState<User | null>(null);
    const [token, setToken] = useState<InstantConnectToken | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const refreshTimerRef = useRef<number | null>(null);

    const generateToken = useCallback(async (isManualRefresh = false) => {
        const client = generateClient();
        try {
            if (isManualRefresh) {
                setRefreshing(true);
            }
            setError(null);

            const response = await client.graphql({
                query: generateInstantConnectToken,
            });

            if ('data' in response && response.data) {
                const newToken = response.data.generateInstantConnectToken as InstantConnectToken;
                setToken(newToken);
                scheduleTokenRefresh(newToken.expiresAt);
            }
        } catch (err) {
            console.error('Error generating instant connect token:', err);
            const errorInfo = parseGraphQLError(err);
            setError(errorInfo.message);

            if (errorInfo.isAuthError) {
                await handleAuthError();
            }
        } finally {
            if (isManualRefresh) {
                setRefreshing(false);
            }
        }
    }, []);

    const scheduleTokenRefresh = useCallback(
        (expiresAt: string) => {
            // Clear any existing timer
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
            }

            const expiryTime = new Date(expiresAt).getTime();
            const now = Date.now();
            const timeUntilRefresh = expiryTime - now - REFRESH_BUFFER_SECONDS * 1000;

            if (timeUntilRefresh > 0) {
                refreshTimerRef.current = window.setTimeout(() => {
                    generateToken(false);
                }, timeUntilRefresh);
            } else {
                // Token already expired or about to expire, refresh immediately
                generateToken(false);
            }
        },
        [generateToken]
    );

    useEffect(() => {
        async function loadData() {
            const client = generateClient();
            try {
                setLoading(true);
                setError(null);

                // Load profile and generate token in parallel
                const [profileResponse] = await Promise.all([client.graphql({ query: getMyProfile })]);

                if ('data' in profileResponse && profileResponse.data) {
                    setProfile(profileResponse.data.getMyProfile as User);
                }

                // Generate initial token
                await generateToken(false);
            } catch (err) {
                console.error('Error loading data:', err);
                const errorInfo = parseGraphQLError(err);
                setError(errorInfo.message);

                if (errorInfo.isAuthError) {
                    await handleAuthError();
                }
            } finally {
                setLoading(false);
            }
        }

        loadData();

        // Cleanup timer on unmount
        return () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
            }
        };
    }, [generateToken]);

    const handleManualRefresh = () => {
        generateToken(true);
    };

    if (loading) {
        return (
            <div className="qr-code-display">
                <LoadingSpinner message="Loading QR code..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="qr-code-display">
                <ErrorMessage message={error} onRetry={() => generateToken(true)} />
            </div>
        );
    }

    if (!profile || !token) {
        return <div className="qr-code-display">No profile found.</div>;
    }

    // Always construct the full URL client-side to ensure it includes the origin
    // The backend URL may be empty if FRONTEND_URL env var isn't set
    const connectUrl = `${window.location.origin}/connect/${token.token}`;

    return (
        <div className="qr-code-display">
            <div className="qr-code-container">
                <QRCodeSVG value={connectUrl} size={256} level="H" includeMargin={true} />
            </div>
            <div className="qr-code-info">
                <h2>{profile.displayName}</h2>
                <p className="qr-code-instruction">Show this QR code to other attendees to connect instantly</p>
                <p className="qr-code-expiry">Expires in {TOKEN_EXPIRY_MINUTES} minutes</p>
                <div className="qr-code-actions">
                    <button className="refresh-button" onClick={handleManualRefresh} disabled={refreshing}>
                        {refreshing ? 'Refreshing...' : 'Generate New Code'}
                    </button>
                    <ShareProfileButton userId={profile.id} displayName={profile.displayName} shareUrl={connectUrl} className="qr-share-button" />
                </div>
            </div>
        </div>
    );
}
