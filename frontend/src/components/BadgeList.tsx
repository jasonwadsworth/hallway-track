import type { Badge } from '../types';
import './BadgeDisplay.css';

interface BadgeListProps {
  earnedBadges: Badge[];
  connectionCount: number;
}

const THRESHOLD_BADGES = [
  { id: 'first-connection', name: 'Ice Breaker', threshold: 1, description: 'Made your first connection', category: 'threshold' },
  { id: 'networker', name: 'Networker', threshold: 5, description: 'Connected with 5 people', category: 'threshold' },
  { id: 'socialite', name: 'Socialite', threshold: 10, description: 'Connected with 10 people', category: 'threshold' },
  { id: 'connector', name: 'Super Connector', threshold: 25, description: 'Connected with 25 people', category: 'threshold' },
  { id: 'legend', name: 'Networking Legend', threshold: 50, description: 'Connected with 50 people', category: 'threshold' },
];

const SPECIAL_BADGES = [
  { id: 'met-the-maker', name: 'Met the Maker', threshold: 0, description: 'Connected with the creator of Hallway Track', category: 'special' },
  { id: 'early-supporter', name: 'Early Supporter', threshold: 0, description: 'Was among the first 10 connections of a user with 500+ connections', category: 'special' },
  { id: 'vip-connection', name: 'VIP Connection', threshold: 0, description: 'Connected with a highly connected user (50+ connections)', category: 'special' },
  { id: 'triangle-complete', name: 'Triangle Complete', threshold: 0, description: 'Created a mutual connection triangle', category: 'special' },
  { id: 'reinvent-connector', name: 're:Invent Connector', threshold: 0, description: 'Connected during AWS re:Invent', category: 'special' },
];

const ALL_BADGES = [...THRESHOLD_BADGES, ...SPECIAL_BADGES];

function getBadgeImageUrl(badgeId: string): string {
  return `/badge-images/${badgeId}.svg`;
}

export function BadgeList({ earnedBadges, connectionCount }: BadgeListProps) {
  const earnedBadgeIds = new Set(earnedBadges.map(b => b.id));

  return (
    <div className="badge-display">
      <h3>Connection Milestone Badges</h3>
      <div className="badge-grid">
        {THRESHOLD_BADGES.map((badge) => {
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

      <h3 style={{ marginTop: '40px' }}>Special Achievement Badges</h3>
      <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
        Earn these unique badges through special accomplishments
      </p>
      <div className="badge-grid">
        {SPECIAL_BADGES.map((badge) => {
          const isEarned = earnedBadgeIds.has(badge.id);
          const earnedBadge = earnedBadges.find(b => b.id === badge.id);

          return (
            <div key={badge.id} className={`badge-item ${isEarned ? 'earned special-badge' : 'locked'}`}>
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
                {isEarned && earnedBadge?.earnedAt && (
                  <div className="badge-earned-date">
                    Earned: {new Date(earnedBadge.earnedAt).toLocaleDateString()}
                  </div>
                )}
                {!isEarned && (
                  <div className="badge-locked-text">
                    Not yet earned
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
