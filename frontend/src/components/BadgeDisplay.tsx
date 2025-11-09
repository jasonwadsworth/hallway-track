import type { Badge } from '../types';
import './BadgeDisplay.css';

interface BadgeDisplayProps {
  badges: Badge[];
}

const BADGE_EMOJIS: Record<string, string> = {
  'first-connection': '🎉',
  'networker': '🤝',
  'socialite': '⭐',
  'connector': '🚀',
  'legend': '👑',
};

export function BadgeDisplay({ badges }: BadgeDisplayProps) {
  if (badges.length === 0) {
    return (
      <div className="badge-display">
        <p className="no-badges">No badges earned yet. Start connecting!</p>
      </div>
    );
  }

  return (
    <div className="badge-display">
      <h3>Earned Badges</h3>
      <div className="badge-grid">
        {badges.map((badge) => (
          <div key={badge.id} className="badge-item earned">
            <div className="badge-icon">{BADGE_EMOJIS[badge.id] || '🏆'}</div>
            <div className="badge-info">
              <div className="badge-name">{badge.name}</div>
              <div className="badge-description">{badge.description}</div>
              <div className="badge-threshold">{badge.threshold} connections</div>
              {badge.earnedAt && (
                <div className="badge-earned-date">
                  Earned: {new Date(badge.earnedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
