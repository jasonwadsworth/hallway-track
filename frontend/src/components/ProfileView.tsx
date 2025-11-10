import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { User } from '../types';
import { getMyProfile } from '../graphql/queries';
import { getGravatarUrl } from '../utils/gravatar';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import { useLinkTypes } from '../hooks/useLinkTypes';
import './ProfileView.css';

interface ProfileViewProps {
  onEdit: () => void;
}

export function ProfileView({ onEdit }: ProfileViewProps) {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { linkTypes } = useLinkTypes();

  useEffect(() => {
    loadProfile();
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

  // Helper function to get image URL for a link label
  const getLinkImage = (label: string): string | null => {
    const linkType = linkTypes.find(type => type.label === label);
    return linkType?.imageUrl || null;
  };

  if (loading) {
    return (
      <div className="profile-view">
        <LoadingSpinner message="Loading profile..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-view">
        <ErrorMessage
          message={error}
          onRetry={loadProfile}
        />
      </div>
    );
  }

  if (!profile) {
    return <div className="profile-view">No profile found.</div>;
  }

  return (
    <div className="profile-view">
      <div className="profile-header">
        <img
          src={getGravatarUrl(profile.gravatarHash)}
          alt={profile.displayName}
          className="profile-avatar"
        />
        <h2>{profile.displayName}</h2>
        <p className="profile-email">{profile.email}</p>
      </div>

      <div className="profile-stats">
        <div className="stat">
          <span className="stat-value">{profile.connectionCount}</span>
          <span className="stat-label">Connections</span>
        </div>
        <div className="stat">
          <span className="stat-value">{profile.badges.length}</span>
          <span className="stat-label">Badges</span>
        </div>
      </div>

      {profile.contactLinks && profile.contactLinks.length > 0 && (
        <div className="profile-contact-links">
          <h3>Contact Links</h3>
          <div className="contact-links-list">
            {profile.contactLinks
              .filter(link => link.visible)
              .map((link) => {
                const imageUrl = getLinkImage(link.label);
                return (
                  <div key={link.id} className="contact-link-item">
                    <div className="link-header">
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={link.label}
                          className="link-type-image"
                        />
                      )}
                      <span className="link-label">{link.label}</span>
                    </div>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-url"
                    >
                      {link.url}
                    </a>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="profile-actions">
        <button onClick={onEdit} className="btn-primary">
          Edit Profile
        </button>
      </div>
    </div>
  );
}
