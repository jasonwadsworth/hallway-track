import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { getMyProfile } from '../graphql/queries';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import type { Badge } from '../types';
import './BadgeProgress.css';

const BADGE_THRESHOLDS = [1, 5, 10, 25, 50];

const BADGE_NAMES: Record<number, string> = {
  1: 'Ice Breaker',
  5: 'Networker',
  10: 'Socialite',
  25: 'Super Connector',
  50: 'Networking Legend',
};

const BADGE_IDS: Record<number, string> = {
  1: 'first-connection',
  5: 'networker',
  10: 'socialite',
  25: 'connector',
  50: 'legend',
};

function getBadgeImageUrl(badgeId: string): string {
  return `/badge-images/${badgeId}.svg`;
}

export function BadgeProgress() {
  const navigate = useNavigate();
  const [connectionCount, setConnectionCount] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConnectionCount();
  }, []);

  async function loadConnectionCount() {
    const client = generateClient();
    try {
      setLoading(true);
      setError(null);

      const response = await client.graphql({
        query: getMyProfile,
      });

      if ('data' in response && response.data?.getMyProfile) {
        setConnectionCount(response.data.getMyProfile.connectionCount || 0);
        setEarnedBadges(response.data.getMyProfile.badges || []);
      } else {
        setConnectionCount(0);
        setEarnedBadges([]);
      }
    } catch (err) {
      console.error('Error loading connection count:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setLoading(false);
    }
  }

  function handleBadgeClick() {
    navigate('/badges');
  }

  if (loading) {
    return (
      <div className="badge-progress">
        <LoadingSpinner inline message="Loading badge progress..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="badge-progress">
        <ErrorMessage
          message={error}
          onRetry={loadConnectionCount}
          onDismiss={() => setError(null)}
        />
      </div>
    );
  }

  // Separate threshold and special badges
  // For backward compatibility, treat badges without a category as threshold badges
  const thresholdBadges = earnedBadges.filter(badge => !badge.category || badge.category === 'threshold');
  const specialBadges = earnedBadges.filter(badge => badge.category === 'special');

  // If user has earned badges, display them
  if (earnedBadges.length > 0) {
    return (
      <div className="badge-progress">
        <h3>Your Badges</h3>

        {/* Threshold Badges */}
        {thresholdBadges.length > 0 && (
          <div className="badge-section">
            <h4 className="badge-section-title">Connection Milestones</h4>
            <div className="earned-badges-container">
              {thresholdBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="earned-badge-item"
                  onClick={handleBadgeClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleBadgeClick();
                    }
                  }}
                >
                  <img
                    src={getBadgeImageUrl(badge.id)}
                    alt={badge.name}
                    className="earned-badge-image"
                    onError={(e) => {
                      e.currentTarget.src = '/badge-images/default.svg';
                    }}
                  />
                  <div className="earned-badge-name">{badge.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Special Badges */}
        {specialBadges.length > 0 && (
          <div className="badge-section">
            <h4 className="badge-section-title">Special Achievements</h4>
            <div className="earned-badges-container">
              {specialBadges.map((badge, index) => {
                const badgeKey = badge.metadata?.eventYear
                  ? `${badge.id}-${badge.metadata.eventYear}`
                  : `${badge.id}-${index}`;

                return (
                  <div
                    key={badgeKey}
                    className="earned-badge-item special"
                    onClick={handleBadgeClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleBadgeClick();
                      }
                    }}
                  >
                    <img
                      src={getBadgeImageUrl(badge.id)}
                      alt={badge.name}
                      className="earned-badge-image"
                      onError={(e) => {
                        e.currentTarget.src = '/badge-images/default.svg';
                      }}
                    />
                    <div className="earned-badge-name">{badge.name}</div>
                    <div className="earned-badge-status">Earned</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Find the next badge threshold
  const nextThreshold = BADGE_THRESHOLDS.find(threshold => connectionCount < threshold);

  if (!nextThreshold) {
    // User has earned all badges (shouldn't reach here if earnedBadges.length > 0)
    return (
      <div className="badge-progress">
        <h3>Badge Progress</h3>
        <div className="progress-complete">
          <div className="progress-text">
            <div className="progress-title">All Badges Earned!</div>
            <div className="progress-subtitle">
              You've connected with {connectionCount} people
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate progress to next badge
  const previousThreshold = BADGE_THRESHOLDS
    .filter(threshold => threshold <= connectionCount)
    .pop() || 0;

  const connectionsNeeded = nextThreshold - connectionCount;
  const progressRange = nextThreshold - previousThreshold;
  const progressMade = connectionCount - previousThreshold;
  const progressPercentage = (progressMade / progressRange) * 100;

  return (
    <div className="badge-progress">
      <h3>Badge Progress</h3>
      <div className="progress-info">
        <div className="progress-stats">
          <div className="stat">
            <div className="stat-value">{connectionCount}</div>
            <div className="stat-label">Connections</div>
          </div>
          <div className="stat">
            <div className="stat-value">{connectionsNeeded}</div>
            <div className="stat-label">To Next Badge</div>
          </div>
        </div>

        <div className="progress-next-badge">
          <div className="next-badge-label">Next Badge</div>
          <div className="next-badge-preview">
            <img
              src={getBadgeImageUrl(BADGE_IDS[nextThreshold])}
              alt={BADGE_NAMES[nextThreshold]}
              className="next-badge-image"
              onError={(e) => {
                e.currentTarget.src = '/badge-images/default.svg';
              }}
            />
            <div className="next-badge-info">
              <div className="next-badge-name">{BADGE_NAMES[nextThreshold]}</div>
              <div className="next-badge-threshold">{nextThreshold} connections</div>
            </div>
          </div>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="progress-percentage">{Math.round(progressPercentage)}%</div>
        </div>
      </div>
    </div>
  );
}
