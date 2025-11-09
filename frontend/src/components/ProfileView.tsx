import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { User } from '../types';
import { getMyProfile } from '../graphql/queries';
import { getGravatarUrl } from '../utils/gravatar';
import './ProfileView.css';

const client = generateClient();

interface ProfileViewProps {
  onEdit: () => void;
}

export function ProfileView({ onEdit }: ProfileViewProps) {
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
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="profile-view loading">Loading profile...</div>;
  }

  if (error) {
    return (
      <div className="profile-view error">
        <p>{error}</p>
        <button onClick={loadProfile}>Retry</button>
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

      <div className="profile-actions">
        <button onClick={onEdit} className="btn-primary">
          Edit Profile
        </button>
      </div>
    </div>
  );
}
