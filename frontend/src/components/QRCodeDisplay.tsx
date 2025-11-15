import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateClient } from 'aws-amplify/api';
import type { User } from '../types';
import { getMyProfile } from '../graphql/queries';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './QRCodeDisplay.css';

export function QRCodeDisplay() {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    loadProfile();
    // Check if Web Share API is available
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  async function loadProfile() {
    const client = generateClient();
    try {
      setLoading(true);
      setError(null);
      const response = await client.graphql({
        query: getMyProfile,
      });
      if ('data' in response && response.data) {
        setProfile(response.data.getMyProfile as User);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleShare(profileUrl: string, displayName: string) {
    if (!navigator.share) {
      return;
    }

    try {
      await navigator.share({
        title: 'My HallwayTrak Profile',
        text: `Connect with ${displayName} at the conference!`,
        url: profileUrl,
      });
    } catch (err) {
      // User cancelled the share or share failed
      // This is expected behavior, so we don't show an error
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Error sharing:', err);
      }
    }
  }

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
        <ErrorMessage
          message={error}
          onRetry={loadProfile}
        />
      </div>
    );
  }

  if (!profile) {
    return <div className="qr-code-display">No profile found.</div>;
  }

  const profileUrl = `${window.location.origin}/profile/${profile.id}`;

  return (
    <div className="qr-code-display">
      <div className="qr-code-container">
        <QRCodeSVG
          value={profileUrl}
          size={256}
          level="H"
          includeMargin={true}
        />
      </div>
      <div className="qr-code-info">
        <h2>{profile.displayName}</h2>
        <p className="qr-code-instruction">
          Show this QR code to other attendees to connect
        </p>
        {canShare && (
          <button
            className="share-button"
            onClick={() => handleShare(profileUrl, profile.displayName)}
            aria-label="Share profile"
          >
            <span>📤</span>
            <span>Share Profile</span>
          </button>
        )}
      </div>
    </div>
  );
}
