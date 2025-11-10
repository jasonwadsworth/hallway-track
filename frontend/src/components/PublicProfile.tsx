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
      loadProfile();
    }
  }, [userId]);

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
          onRetry={loadProfile}
        />
      </div>
    );
  }

  const visibleLinks = profile.contactLinks.filter(link => link.visible);

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

      {visibleLinks.length > 0 && (
        <div className="contact-links-section">
          <h3>Contact Links</h3>
          <ul className="contact-links-list">
            {visibleLinks.map(link => (
              <li key={link.id} className="contact-link-item">
                <span className="link-label">{link.label}:</span>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-url">
                  {link.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {profile.badges.length > 0 && (
        <div className="badges-section">
          <h3>Badges</h3>
          <div className="badges-grid">
            {profile.badges.map(badge => (
              <div key={badge.id} className="badge-item">
                <div className="badge-icon">🏆</div>
                <div className="badge-info">
                  <div className="badge-name">{badge.name}</div>
                  <div className="badge-description">{badge.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
