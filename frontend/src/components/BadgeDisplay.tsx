import type { Badge } from '../types';
import './BadgeDisplay.css';

interface BadgeDisplayProps {
  badges: Badge[];
}

function getBadgeImageUrl(badgeId: string): string {
  return `/badge-images/${badgeId}.svg`;
}

function getBadgeMetadataDisplay(badge: Badge): string | null {
  if (!badge.metadata) return null;

  if (badge.metadata.relatedUserName) {
    return `Related to: ${badge.metadata.relatedUserName}`;
  }
  if (badge.metadata.eventYear) {
    return `Year: ${badge.metadata.eventYear}`;
  }
  if (badge.metadata.count && badge.metadata.count > 1) {
    return `${badge.metadata.count} VIP connections`;
  }
  return null;
}

export function BadgeDisplay({ badges }: BadgeDisplayProps) {
  if (badges.length === 0) {
    return (
      <div className="badge-display">
        <p className="no-badges">No badges earned yet. Start connecting!</p>
      </div>
    );
  }

  // Sort badges: special badges first, then threshold badges
  const sortedBadges = [...badges].sort((a, b) => {
    if (a.category === 'special' && b.category !== 'special') return -1;
    if (a.category !== 'special' && b.category === 'special') return 1;
    return 0;
  });

  return (
    <div className="badge-display">
      <h3>Earned Badges</h3>
      <div className="badge-grid">
        {sortedBadges.map((badge, index) => {
          const metadataDisplay = getBadgeMetadataDisplay(badge);
          const badgeKey = badge.metadata?.eventYear
            ? `${badge.id}-${badge.metadata.eventYear}`
            : `${badge.id}-${index}`;

          return (
            <div
              key={badgeKey}
              className={`badge-item earned ${badge.category === 'special' ? 'special-badge' : ''}`}
            >
              <div className="badge-icon">
                <img
                  src={getBadgeImageUrl(badge.id)}
                  alt={badge.name}
                  className="badge-icon-image"
                  onError={(e) => {
                    e.currentTarget.src = '/badge-images/default.svg';
                  }}
                />
              </div>
              <div className="badge-info">
                <div className="badge-name">{badge.name}</div>
                <div className="badge-description">{badge.description}</div>
                {(!badge.category || badge.category === 'threshold') && (
                  <div className="badge-threshold">{badge.threshold} connections</div>
                )}
                {metadataDisplay && (
                  <div className="badge-metadata">{metadataDisplay}</div>
                )}
                {badge.earnedAt && (
                  <div className="badge-earned-date">
                    Earned: {new Date(badge.earnedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
