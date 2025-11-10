import type { Connection } from '../types';
import { getGravatarUrl, getGravatarSrcSet } from '../utils/gravatar';
import './ConnectionCard.css';

interface ConnectionCardProps {
  connection: Connection;
  onClick: () => void;
}

export function ConnectionCard({ connection, onClick }: ConnectionCardProps) {
  const { connectedUser, tags, createdAt } = connection;

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
