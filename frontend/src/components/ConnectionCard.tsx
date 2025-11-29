import type { Connection } from '../types';
import { ProfilePicture } from './ProfilePicture';
import './ConnectionCard.css';

interface ConnectionCardProps {
    connection: Connection;
    onClick: () => void;
    onRemove?: (connectionId: string) => void;
}

export function ConnectionCard({ connection, onClick, onRemove }: ConnectionCardProps) {
    const handleRemoveClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onRemove) {
            onRemove(connection.id);
        }
    };
    const { connectedUser, tags, createdAt, note } = connection;

    const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

    return (
        <div className="connection-card" onClick={onClick}>
            <div className="card-header">
                {connectedUser ? (
                    <>
                        <ProfilePicture
                            uploadedProfilePictureUrl={connectedUser.uploadedProfilePictureUrl}
                            profilePictureUrl={connectedUser.profilePictureUrl}
                            gravatarHash={connectedUser.gravatarHash}
                            displayName={connectedUser.displayName}
                            size={60}
                            className="card-avatar"
                            loading="lazy"
                        />
                        <div className="card-info">
                            <h3 className="card-name">{connectedUser.displayName}</h3>
                            <p className="card-date">Connected {formattedDate}</p>
                        </div>
                        {note && (
                            <div className="note-indicator" title="Has note">
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                    <polyline points="10 9 9 9 8 9" />
                                </svg>
                            </div>
                        )}
                        {onRemove && (
                            <button className="remove-button" onClick={handleRemoveClick} title="Remove connection" aria-label="Remove connection">
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                            </button>
                        )}
                    </>
                ) : (
                    <div className="card-info">
                        <h3 className="card-name">Unknown User</h3>
                        <p className="card-date">Connected {formattedDate}</p>
                    </div>
                )}
            </div>

            {tags.length > 0 && (
                <div className="card-tags">
                    {tags.map((tag, index) => (
                        <span key={index} className="tag">
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
