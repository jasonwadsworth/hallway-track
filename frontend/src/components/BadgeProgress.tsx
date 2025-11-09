import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import './BadgeProgress.css';

const client = generateClient();

const BADGE_THRESHOLDS = [1, 5, 10, 25, 50];

const BADGE_NAMES: Record<number, string> = {
  1: 'Ice Breaker',
  5: 'Networker',
  10: 'Socialite',
  25: 'Super Connector',
  50: 'Networking Legend',
};

export function BadgeProgress() {
  const [connectionCount, setConnectionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConnectionCount();
  }, []);

  async function loadConnectionCount() {
    try {
      const query = `
        query GetMyProfile {
          getMyProfile {
            connectionCount
          }
        }
      `;

      const result = await client.graphql({ query }) as { data: { getMyProfile: { connectionCount: number } } };
      setConnectionCount(result.data.getMyProfile.connectionCount);
    } catch (error) {
      console.error('Error loading connection count:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="badge-progress">Loading...</div>;
  }
  // Find the next badge threshold
  const nextThreshold = BADGE_THRESHOLDS.find(threshold => connectionCount < threshold);

  if (!nextThreshold) {
    // User has earned all badges
    return (
      <div className="badge-progress">
        <h3>Badge Progress</h3>
        <div className="progress-complete">
          <div className="progress-icon">🏆</div>
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
          <div className="next-badge-name">{BADGE_NAMES[nextThreshold]}</div>
          <div className="next-badge-threshold">{nextThreshold} connections</div>
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
