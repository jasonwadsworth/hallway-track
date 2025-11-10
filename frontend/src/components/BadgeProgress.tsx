import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { getMyProfile } from '../graphql/queries';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
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
  const [connectionCount, setConnectionCount] = useState(0);
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
      } else {
        setConnectionCount(0);
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
  // Find the next badge threshold
  const nextThreshold = BADGE_THRESHOLDS.find(threshold => connectionCount < threshold);

  if (!nextThreshold) {
    // User has earned all badges
    const legendBadgeId = BADGE_IDS[50];
    return (
      <div className="badge-progress">
        <h3>Badge Progress</h3>
        <div className="progress-complete">
          <div className="progress-icon">
            <img
              src={getBadgeImageUrl(legendBadgeId)}
              alt="Networking Legend"
              className="progress-badge-image"
              onError={(e) => {
                e.currentTarget.src = '/badge-images/default.svg';
              }}
            />
          </div>
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
