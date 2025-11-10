import type { Badge } from '../types';
import './BadgeDisplay.css';

interface BadgeListProps {
  earnedBadges: Badge[];
  connectionCount: number;
}

const ALL_BADGES = [
  { id: 'first-connection', name: 'Ice Breaker', threshold: 1, description: 'Made your first connection' },
  { id: 'networker', name: 'Networker', threshold: 5, description: 'Connected with 5 people' },
  { id: 'socialite', name: 'Socialite', threshold: 10, description: 'Connected with 10 people' },
  { id: 'connector', name: 'Super Connector', threshold: 25, description: 'Connected with 25 people' },
  { id: 'legend', name: 'Networking Legend', threshold: 50, description: 'Connected with 50 people' },
];

function getBadgeImageUrl(badgeId: string): string {
  return `/badge-images/${badgeId}.svg`;
}

export function BadgeList({ earnedBadges, connectionCount }: BadgeListProps) {
  const earnedBadgeIds = new Set(earnedBadges.map(b => b.id));

  return (
    <div className="badge-display">
      <h3>All Badges</h3>
      <div className="badge-grid">
        {ALL_BADGES.map((badge) => {
          const isEarned = earnedBadgeIds.has(badge.id);
          const earnedBadge = earnedBadges.find(b => b.id === badge.id);
          const isLocked = connectionCount < badge.threshold;

          return (
            <div key={badge.id} className={`badge-item ${isEarned ? 'earned' : 'locked'}`}>
              <div className="badge-icon">
                <img
                  src={getBadgeImageUrl(badge.id)}
                  alt={badge.name}
                  className="badge-icon-image"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src.includes('default.svg')) {
                      target.style.display = 'none';
                    } else {
                      target.src = '/badge-images/default.svg';
                    }
                  }}
                />
              </div>
              <div className="badge-info">
                <div className="badge-name">{badge.name}</div>
                <div className="badge-description">{badge.description}</div>
                <div className="badge-threshold">{badge.threshold} connections</div>
                {isEarned && earnedBadge?.earnedAt && (
                  <div className="badge-earned-date">
                    Earned: {new Date(earnedBadge.earnedAt).toLocaleDateString()}
                  </div>
                )}
                {isLocked && (
                  <div className="badge-locked-text">
                    {badge.threshold - connectionCount} more to unlock
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
