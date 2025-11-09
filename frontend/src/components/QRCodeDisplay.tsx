import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateClient } from 'aws-amplify/api';
import type { User } from '../types';
import { getMyProfile } from '../graphql/queries';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './QRCodeDisplay.css';

const client = generateClient();

export function QRCodeDisplay() {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
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

  const profileUrl = `https://app.hallwaytrack.com/profile/${profile.id}`;

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
      </div>
    </div>
  );
}
