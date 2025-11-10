import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { User } from '../types';
import { getMyProfile } from '../graphql/queries';
import { updateDisplayName } from '../graphql/mutations';
import { getGravatarUrl } from '../utils/gravatar';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './ProfileEdit.css';

interface ProfileEditProps {
  onCancel: () => void;
  onSave: () => void;
}

export function ProfileEdit({ onCancel, onSave }: ProfileEditProps) {
  const [profile, setProfile] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if ('data' in response && response.data?.getMyProfile) {
        const userProfile = response.data.getMyProfile as User;
        setProfile(userProfile);
        setDisplayName(userProfile.displayName);
      } else {
        // Profile doesn't exist yet - this shouldn't happen but handle gracefully
        setError('Profile not found. Please try refreshing the page or contact support.');
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }

    if (displayName.length > 50) {
      setError('Display name must be 50 characters or less');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const client = generateClient();
      await client.graphql({
        query: updateDisplayName,
        variables: {
          displayName: displayName.trim(),
        },
      });
      onSave();
    } catch (err) {
      console.error('Error updating profile:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="profile-edit">
        <LoadingSpinner message="Loading profile..." />
      </div>
    );
  }

  if (!profile) {
    return <div className="profile-edit">No profile found.</div>;
  }

  return (
    <div className="profile-edit">
      <div className="profile-header">
        <img
          src={getGravatarUrl(profile.gravatarHash)}
          alt={profile.displayName}
          className="profile-avatar"
        />
        <p className="gravatar-note">
          Profile picture from <a href="https://gravatar.com" target="_blank" rel="noopener noreferrer">Gravatar</a>
        </p>
      </div>

      <form onSubmit={handleSave} className="profile-form">
        <div className="form-group">
          <label htmlFor="displayName">Display Name</label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            required
            disabled={saving}
          />
          <span className="char-count">{displayName.length}/50</span>
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={profile.email}
            disabled
            className="disabled-input"
          />
          <span className="field-note">Email cannot be changed</span>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
