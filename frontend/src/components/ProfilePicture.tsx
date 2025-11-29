import { useState } from 'react';
import { getGravatarUrl } from '../utils/gravatar';

interface ProfilePictureProps {
    uploadedProfilePictureUrl?: string;
    profilePictureUrl?: string;
    gravatarHash: string;
    displayName: string;
    size?: number;
    className?: string;
    loading?: 'lazy' | 'eager';
}

export function ProfilePicture({
    uploadedProfilePictureUrl,
    profilePictureUrl,
    gravatarHash,
    displayName,
    size = 200,
    className = '',
    loading,
}: ProfilePictureProps) {
    const [uploadedError, setUploadedError] = useState(false);
    const [googleError, setGoogleError] = useState(false);

    // Priority: Uploaded → Google → Gravatar
    const getImageUrl = (): string => {
        if (uploadedProfilePictureUrl && !uploadedError) {
            return uploadedProfilePictureUrl;
        }
        if (profilePictureUrl && !googleError) {
            return profilePictureUrl;
        }
        return getGravatarUrl(gravatarHash, size);
    };

    const handleError = () => {
        if (uploadedProfilePictureUrl && !uploadedError) {
            setUploadedError(true);
        } else if (profilePictureUrl && !googleError) {
            setGoogleError(true);
        }
    };

    return (
        <img
            src={getImageUrl()}
            alt={`${displayName}'s profile picture`}
            className={className}
            loading={loading}
            onError={handleError}
        />
    );
}
