import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import type { User } from '../types';
import { getMyProfile } from '../graphql/queries';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { BadgeDisplay } from './BadgeDisplay';
import { ShareProfileButton } from './ShareProfileButton';
import { ContactLinkList } from './ContactLinkList';
import { ProfilePicture } from './ProfilePicture';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import './ProfileView.css';

export function ProfileView() {
    const [profile, setProfile] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        loadProfile();

        // Listen for profile data changes (e.g., after connection removal)
        const handleProfileDataChanged = () => {
            loadProfile();
        };

        window.addEventListener('profileDataChanged', handleProfileDataChanged);

        return () => {
            window.removeEventListener('profileDataChanged', handleProfileDataChanged);
        };
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
                <ErrorMessage message={error} onRetry={loadProfile} />
            </div>
        );
    }

    if (!profile) {
        return <div className="profile-view">No profile found.</div>;
    }

    return (
        <div className="profile-view">
            <div className="profile-header">
                <ProfilePicture
                    profilePictureUrl={profile.profilePictureUrl}
                    gravatarHash={profile.gravatarHash}
                    displayName={profile.displayName}
                    size={120}
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

            <div className="profile-contact-links">
                <h3>Contact Links</h3>
                <ContactLinkList links={profile.contactLinks || []} emptyMessage="No contact links added yet" />
            </div>

            {profile.badges && profile.badges.length > 0 && (
                <div className="profile-badges">
                    <BadgeDisplay badges={profile.badges} />
                </div>
            )}

            <div className="profile-actions">
                <ShareProfileButton userId={profile.id} displayName={profile.displayName} className="profile-share-button" />
            </div>
        </div>
    );
}
