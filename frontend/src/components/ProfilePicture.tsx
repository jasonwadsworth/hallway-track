import { useState } from 'react';
import { getGravatarUrl } from '../utils/gravatar';

interface ProfilePictureProps {
    profilePictureUrl?: string;
    gravatarHash: string;
    displayName: string;
    size?: number;
    className?: string;
}

export function ProfilePicture({ profilePictureUrl, gravatarHash, displayName, size = 200, className = '' }: ProfilePictureProps) {
    const [imageError, setImageError] = useState(false);

    // Use Google profile picture if available and hasn't errored
    const imageUrl = profilePictureUrl && !imageError ? profilePictureUrl : getGravatarUrl(gravatarHash, size);

    return (
        <img
            src={imageUrl}
            alt={`${displayName}'s profile picture`}
            className={className}
            onError={() => {
                if (profilePictureUrl && !imageError) {
                    // Fallback to Gravatar if Google image fails to load
                    setImageError(true);
                }
            }}
        />
    );
}
