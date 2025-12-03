import { useState } from 'react';
import './ShareProfileButton.css';

interface ShareProfileButtonProps {
    userId: string;
    displayName: string;
    shareUrl?: string;
    className?: string;
}

export function ShareProfileButton({ userId, displayName, shareUrl, className = '' }: ShareProfileButtonProps) {
    const [isSharing, setIsSharing] = useState(false);
    const [copied, setCopied] = useState(false);

    async function handleShare() {
        const urlToShare = shareUrl || `${window.location.origin}/profile/${userId}`;
        setIsSharing(true);

        try {
            if (navigator.share) {
                // Use Web Share API if available
                await navigator.share({
                    title: 'Connect with me on HallwayTrak',
                    text: `Connect with ${displayName} at the conference!`,
                    url: urlToShare,
                });
            } else {
                // Fallback to clipboard copy
                await handleCopyLink(urlToShare);
            }
        } catch (err) {
            // User cancelled the share or share failed
            if (err instanceof Error && err.name !== 'AbortError') {
                console.error('Error sharing:', err);
                // If share fails, try clipboard copy as fallback
                await handleCopyLink(urlToShare);
            }
        } finally {
            setIsSharing(false);
        }
    }

    async function handleCopyLink(profileUrl: string) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(profileUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 3000);
            } else {
                // Fallback for older browsers - create a temporary input element
                const textArea = document.createElement('textarea');
                textArea.value = profileUrl;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                try {
                    document.execCommand('copy');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                } catch (err) {
                    console.error('Fallback copy failed:', err);
                } finally {
                    document.body.removeChild(textArea);
                }
            }
        } catch (err) {
            console.error('Error copying to clipboard:', err);
        }
    }

    return (
        <button className={`share-profile-button ${className}`} onClick={handleShare} disabled={isSharing} aria-label="Share profile">
            {isSharing ? (
                <>
                    <span>⏳</span>
                    <span>Sharing...</span>
                </>
            ) : copied ? (
                <>
                    <span>✅</span>
                    <span>Copied!</span>
                </>
            ) : (
                <>
                    <span>📤</span>
                    <span>Share Profile</span>
                </>
            )}
        </button>
    );
}
