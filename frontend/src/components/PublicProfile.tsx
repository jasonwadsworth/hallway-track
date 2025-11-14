import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import type { PublicProfile as PublicProfileType } from '../types';
import { getPublicProfile } from '../graphql/queries';
import { getGravatarUrl, getGravatarSrcSet } from '../utils/gravatar';
import { ConnectButton } from './ConnectButton';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError } from '../utils/errorHandling';
import './PublicProfile.css';

export function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      async function loadProfile() {
        if (!userId) {
          setError('Invalid user ID');
          setLoading(false);
          return;
        }

        const client = generateClient();
        try {
          setLoading(true);
          setError(null);
          const response = await client.graphql({
            query: getPublicProfile,
            variables: { userId },
          });
          if ('data' in response && response.data) {
            setProfile(response.data.getPublicProfile as PublicProfileType);
          }
        } catch (err) {
          console.error('Error loading public profile:', err);
          const errorInfo = parseGraphQLError(err);
          setError(errorInfo.message);
        } finally {
          setLoading(false);
        }
      }

      loadProfile();
    }
  }, [userId]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    // The useEffect will run again because we're changing state
  };

  if (loading) {
    return (
      <div className="public-profile">
        <LoadingSpinner message="Loading profile..." />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="public-profile">
        <ErrorMessage
          message={error || 'User not found'}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className="public-profile">
      <div className="profile-header">
        <img
          src={getGravatarUrl(profile.gravatarHash, 120)}
          srcSet={getGravatarSrcSet(profile.gravatarHash, 120)}
          alt={profile.displayName}
          className="profile-avatar"
          width="120"
          height="120"
          loading="lazy"
        />
        <h2>{profile.displayName}</h2>
      </div>

      {userId && <ConnectButton userId={userId} />}

      <div className="privacy-notice">
        <p>Connect with this user to see their contact links and badges.</p>
      </div>
    </div>
  );
}
