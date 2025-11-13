import type { Connection } from '../types';
import { getGravatarUrl, getGravatarSrcSet } from '../utils/gravatar';
import './ConnectionCard.css';

interface ConnectionCardProps {
  connection: Connection;
  onClick: () => void;
}

export function ConnectionCard({ connection, onClick }: ConnectionCardProps) {
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
            <img
              src={getGravatarUrl(connectedUser.gravatarHash, 60)}
              srcSet={getGravatarSrcSet(connectedUser.gravatarHash, 60)}
              alt={connectedUser.displayName}
              className="card-avatar"
              width="60"
              height="60"
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
