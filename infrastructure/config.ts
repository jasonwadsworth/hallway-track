/**
 * Hallway Track Configuration
 *
 * This file contains account-based configuration values for the application.
 * Each AWS account has its own configuration section.
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

export interface CustomDomainConfig {
  /**
   * The custom domain name for the application
   * Example: "hallwaytrak.com"
   *
   * When configured, both the apex domain and www subdomain will be supported
   */
  domainName?: string;
}

export interface HallwayTrackConfig {
  /**
   * Badge system configuration
   */
  badges: BadgeConfig;

  /**
   * Custom domain configuration (optional)
   */
  customDomain?: CustomDomainConfig;
}

interface AccountConfiguration {
  [accountId: string]: HallwayTrackConfig;
}

/**
 * Account-based Application Configuration
 *
 * Add configuration for each AWS account that will deploy this application.
 * The account ID should match the CDK_DEFAULT_ACCOUNT environment variable.
 */
const accountConfigurations: AccountConfiguration = {
  "831926593673": {
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
  },
  "602223306405": {
    badges: {
      // Set this to your user ID to enable "Met the Maker" badge
      // Leave undefined to disable this badge
      makerUserId: 'a8e193b0-40e1-705d-a7a6-192fd97ec25e',

      // Configure re:Invent dates for event badges
      reinventDates: [
        {
          year: 2025,
          start: '2025-11-30',
          end: '2025-12-05'
        },
      ]
    },
    customDomain: {
      domainName: 'hallwaytrak.com'
    }
  }
};

/**
 * Validates a domain name format
 *
 * @param domainName - The domain name to validate
 * @returns true if the domain name is valid, false otherwise
 */
export function isValidDomainName(domainName: string): boolean {
  // Basic domain name validation
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!domainName || domainName.length > 253) {
    return false;
  }

  // Check if it matches the regex and doesn't start/end with hyphen
  if (!domainRegex.test(domainName)) {
    return false;
  }

  // Check that it has at least one dot (not just a TLD)
  if (!domainName.includes('.')) {
    return false;
  }

  return true;
}

/**
 * Get configuration for a specific AWS account
 *
 * @param accountId - The AWS account ID from CDK_DEFAULT_ACCOUNT
 * @returns The configuration for the specified account
 * @throws Error if accountId is missing or no configuration exists for the account
 */
export function getConfigForAccount(accountId: string): HallwayTrackConfig {
  if (!accountId) {
    throw new Error(
      'CDK_DEFAULT_ACCOUNT environment variable is required. ' +
      'Please set this environment variable to your AWS account ID.'
    );
  }

  const config = accountConfigurations[accountId];
  if (!config) {
    throw new Error(
      `No configuration found for account ${accountId}. ` +
      `Please add configuration for this account in infrastructure/config.ts. ` +
      `Available accounts: ${Object.keys(accountConfigurations).join(', ')}`
    );
  }

  // Validate custom domain if configured
  if (config.customDomain?.domainName) {
    if (!isValidDomainName(config.customDomain.domainName)) {
      throw new Error(
        `Invalid domain name format: ${config.customDomain.domainName}. ` +
        'Domain name must be a valid DNS name (e.g., example.com)'
      );
    }
  }

  return config;
}
