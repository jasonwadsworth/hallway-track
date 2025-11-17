import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import { BadgeList } from './BadgeList';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { PullToRefresh } from './PullToRefresh';
import { parseGraphQLError, handleAuthError } from '../utils/errorHandling';
import type { Badge } from '../types';
import './BadgeShowcase.css';

export function BadgeShowcase() {
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [connectionCount, setConnectionCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBadgeData();

    // Listen for profile data changes (e.g., after connection removal)
    const handleProfileDataChanged = () => {
      loadBadgeData();
    };

    window.addEventListener('profileDataChanged', handleProfileDataChanged);

    return () => {
      window.removeEventListener('profileDataChanged', handleProfileDataChanged);
    };
  }, []);

  const loadBadgeData = async () => {
    const client = generateClient();
    try {
      setLoading(true);
      setError(null);

      const { getMyProfile } = await import('../graphql/queries');

      const response = await client.graphql({
        query: getMyProfile,
      });

      if ('data' in response && response.data) {
        const profile = response.data.getMyProfile;
        setEarnedBadges(profile.badges || []);
        setConnectionCount(profile.connectionCount || 0);
      }
    } catch (err) {
      console.error('Error loading badge data:', err);
      const errorInfo = parseGraphQLError(err);
      setError(errorInfo.message);

      if (errorInfo.isAuthError) {
        await handleAuthError();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PullToRefresh onRefresh={loadBadgeData}>
      <div className="badge-showcase">
        <div className="badge-showcase-header">
          <h1>Badge Showcase</h1>
          <p className="badge-showcase-description">
            Earn badges by connecting with other attendees at the event
          </p>
        </div>

        {error ? (
          <ErrorMessage
            message={error}
            onRetry={loadBadgeData}
            onDismiss={() => setError(null)}
          />
        ) : loading ? (
          <LoadingSpinner message="Loading badges..." />
        ) : (
          <BadgeList earnedBadges={earnedBadges} connectionCount={connectionCount} />
        )}
      </div>
    </PullToRefresh>
  );
}
