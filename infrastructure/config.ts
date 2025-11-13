/**
 * Hallway Track Configuration
 *
 * This file contains configuration values for the application.
 * Update these values before deploying.
 */

export interface BadgeConfig {
  /**
   * User ID of the app creator for "Met the Maker" badge
   *
   * To find your user ID:
   * 1. Sign in to the application
   * 2. Open browser DevTools → Console
   * 3. Run: localStorage.getItem('CognitoIdentityServiceProvider.3u3h1edvnc0baes8gb8bcptefr.LastAuthUser')
   *
   * Or query DynamoDB Users table for your email
   */
  makerUserId?: string;

  /**
   * Date ranges for re:Invent connector badges
   *
   * Users who create connections during these dates will earn the re:Invent badge
   * for that year. Multiple years can be configured.
   */
  reinventDates: Array<{
    year: number;
    start: string; // ISO date format: YYYY-MM-DD
    end: string;   // ISO date format: YYYY-MM-DD
  }>;
}

export interface HallwayTrackConfig {
  /**
   * Badge system configuration
   */
  badges: BadgeConfig;
}

/**
 * Application Configuration
 *
 * Update these values to configure your deployment
 */
export const config: HallwayTrackConfig = {
  badges: {
    // Set this to your user ID to enable "Met the Maker" badge
    // Leave undefined to disable this badge
    makerUserId: '78a18380-5071-70a6-4fb6-435dcf286de8',

    // Configure re:Invent dates for event badges
    reinventDates: [
      {
        year: 2025,
        start: '2025-11-30',
        end: '2025-12-05'
      },
     ]
  }
};
