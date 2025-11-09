import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import type { PublicProfile as PublicProfileType } from '../types';
import { getPublicProfile } from '../graphql/queries';
import { getGravatarUrl } from '../utils/gravatar';
import { ConnectButton } from './ConnectButton';
import './PublicProfile.css';

const client = generateClient();

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
      setError('User not found');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="public-profile loading">Loading profile...</div>;
  }

  if (error || !profile) {
    return (
      <div className="public-profile error">
        <p>{error || 'User not found'}</p>
      </div>
    );
  }

  const visibleLinks = profile.contactLinks.filter(link => link.visible);

  return (
    <div className="public-profile">
      <div className="profile-header">
        <img
          src={getGravatarUrl(profile.gravatarHash)}
          alt={profile.displayName}
          className="profile-avatar"
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
