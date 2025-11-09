import type { Connection } from '../types';
import { getGravatarUrl } from '../utils/gravatar';
import { TagManager } from './TagManager';
import './ConnectionDetail.css';

interface ConnectionDetailProps {
  connection: Connection;
  onBack: () => void;
  onTagsUpdated: (updatedConnection: Connection) => void;
}

export function ConnectionDetail({ connection, onBack, onTagsUpdated }: ConnectionDetailProps) {
  const { connectedUser, createdAt } = connection;

  if (!connectedUser) {
    return (
      <div className="connection-detail error">
        <button onClick={onBack} className="btn-back">
          ← Back to Connections
        </button>
        <p>Unable to load connection details</p>
      </div>
    );
  }

  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const visibleLinks = connectedUser.contactLinks.filter(link => link.visible);

  return (
    <div className="connection-detail">
      <button onClick={onBack} className="btn-back">
        ← Back to Connections
      </button>

      <div className="detail-header">
        <img
          src={getGravatarUrl(connectedUser.gravatarHash)}
          alt={connectedUser.displayName}
          className="detail-avatar"
        />
        <div className="detail-info">
          <h2>{connectedUser.displayName}</h2>
          <p className="connection-date">Connected on {formattedDate}</p>
        </div>
      </div>

      {visibleLinks.length > 0 && (
        <div className="detail-section">
          <h3>Contact Links</h3>
          <ul className="contact-links-list">
            {visibleLinks.map(link => (
              <li key={link.id} className="contact-link-item">
                <span className="link-label">{link.label}:</span>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-url">
                  {link.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="detail-section">
        <h3>Tags</h3>
        <TagManager
          connection={connection}
          onTagsUpdated={onTagsUpdated}
        />
      </div>
    </div>
  );
}
